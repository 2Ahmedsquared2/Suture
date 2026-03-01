from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image, ImageEnhance, ImageFilter
import os
import uuid
import io
import pathlib
import numpy as np

try:
    from rembg import remove as remove_bg
    REMBG_AVAILABLE = True
except ImportError:
    REMBG_AVAILABLE = False

load_dotenv()

IMAGES_DIR = pathlib.Path("generated_images")
IMAGES_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Suture API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

_gemini_client = None

MIN_RESOLUTION = 256
MAX_FILE_SIZE_MB = 10


class GenerateRequest(BaseModel):
    prompt: str


class GenerateResponse(BaseModel):
    image_id: str
    image_url: str


class UploadResponse(BaseModel):
    image_id: str
    image_url: str
    enhanced: bool = False
    enhancement_note: str | None = None


class ErrorDetail(BaseModel):
    detail: str


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "suture-api",
        "version": "0.1.0",
    }


def get_gemini_client() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured.")
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


@app.post("/generate-image", response_model=GenerateResponse)
async def generate_image(req: GenerateRequest):
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    try:
        client = get_gemini_client()
        response = client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=prompt,
            config=types.GenerateImagesConfig(number_of_images=1),
        )

        if not response.generated_images:
            raise HTTPException(
                status_code=502,
                detail="Gemini returned no images. Try a different prompt.",
            )

        image_bytes = response.generated_images[0].image.image_bytes
        image_id = str(uuid.uuid4())
        ext = "png"
        filename = f"{image_id}.{ext}"
        filepath = IMAGES_DIR / filename

        with open(filepath, "wb") as f:
            f.write(image_bytes)

        return GenerateResponse(
            image_id=image_id,
            image_url=f"/images/{filename}",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Image generation failed: {e}")


HARD_MIN_RESOLUTION = 64


def assess_quality(img: Image.Image) -> list[str]:
    """Return a list of quality issues found. Empty list = good to go."""
    issues = []
    w, h = img.size

    if w < MIN_RESOLUTION or h < MIN_RESOLUTION:
        issues.append("low_resolution")

    if img.mode in ("L", "1"):
        issues.append("grayscale")

    try:
        arr = np.array(img.convert("RGB"), dtype=np.float64)
        if arr.std() < 15:
            issues.append("low_contrast")
        laplacian_var = np.var(np.convolve(arr.mean(axis=2).flatten(), [1, -2, 1], mode="valid"))
        if laplacian_var < 50:
            issues.append("blurry")
    except Exception:
        pass

    return issues


def enhance_image(img: Image.Image, issues: list[str]) -> Image.Image:
    """Attempt to fix detected quality issues."""
    enhanced = img.copy()

    if enhanced.mode in ("L", "1"):
        enhanced = enhanced.convert("RGB")

    if "low_resolution" in issues:
        w, h = enhanced.size
        scale = max(MIN_RESOLUTION / w, MIN_RESOLUTION / h, 1.0)
        if scale > 1.0:
            new_w = int(w * scale * 1.25)
            new_h = int(h * scale * 1.25)
            enhanced = enhanced.resize((new_w, new_h), Image.LANCZOS)

    if "blurry" in issues:
        enhanced = enhanced.filter(ImageFilter.SHARPEN)
        enhanced = enhanced.filter(ImageFilter.DETAIL)

    if "low_contrast" in issues:
        enhancer = ImageEnhance.Contrast(enhanced)
        enhanced = enhancer.enhance(1.5)
        enhancer = ImageEnhance.Brightness(enhanced)
        enhanced = enhancer.enhance(1.1)

    return enhanced


@app.post("/upload-image", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    contents = await file.read()

    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Image is too large ({size_mb:.1f} MB). Maximum is {MAX_FILE_SIZE_MB} MB.",
        )

    try:
        img = Image.open(io.BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read image. File may be corrupted.")

    w, h = img.size
    if w < HARD_MIN_RESOLUTION or h < HARD_MIN_RESOLUTION:
        raise HTTPException(
            status_code=400,
            detail=f"Image is far too small ({w}×{h}). Please upload an image with better quality.",
        )

    issues = assess_quality(img)
    was_enhanced = False
    enhancement_note = None

    if issues:
        img = enhance_image(img, issues)
        remaining = assess_quality(img)

        if remaining:
            raise HTTPException(
                status_code=400,
                detail="Please upload an image with better quality. We tried to enhance it automatically but it's still not suitable for embroidery conversion.",
            )

        was_enhanced = True
        fixes = []
        if "low_resolution" in issues:
            fixes.append("upscaled")
        if "blurry" in issues:
            fixes.append("sharpened")
        if "low_contrast" in issues:
            fixes.append("contrast boosted")
        if "grayscale" in issues:
            fixes.append("converted to color")
        enhancement_note = f"Image was auto-enhanced ({', '.join(fixes)})"

    image_id = str(uuid.uuid4())
    filename = f"{image_id}.png"
    filepath = IMAGES_DIR / filename
    img.save(filepath, "PNG")

    return UploadResponse(
        image_id=image_id,
        image_url=f"/images/{filename}",
        enhanced=was_enhanced,
        enhancement_note=enhancement_note,
    )


# ---------------------------------------------------------------------------
# Step 3 — Image Preprocessing
# ---------------------------------------------------------------------------

PREPROCESS_TARGET_SIZE = 1024
PREPROCESS_NUM_COLORS = 10


class PreprocessRequest(BaseModel):
    image_id: str


class PreprocessResponse(BaseModel):
    original_image_id: str
    preprocessed_image_id: str
    preprocessed_image_url: str
    steps_applied: list[str]


def _remove_background(img: Image.Image) -> tuple[Image.Image, bool]:
    """Strip background using rembg. Returns (image, was_removed)."""
    if not REMBG_AVAILABLE:
        return img, False
    try:
        result = remove_bg(img)
        return result, True
    except Exception:
        return img, False


def _normalize_resolution(img: Image.Image) -> tuple[Image.Image, bool]:
    """Scale so the longest side equals PREPROCESS_TARGET_SIZE."""
    w, h = img.size
    longest = max(w, h)
    if longest == PREPROCESS_TARGET_SIZE:
        return img, False
    ratio = PREPROCESS_TARGET_SIZE / longest
    new_w = int(w * ratio)
    new_h = int(h * ratio)
    return img.resize((new_w, new_h), Image.LANCZOS), True


def _enhance_for_tracing(img: Image.Image) -> Image.Image:
    """Boost contrast and sharpness so edges trace cleanly."""
    if img.mode == "RGBA":
        r, g, b, a = img.split()
        rgb = Image.merge("RGB", (r, g, b))
        rgb = ImageEnhance.Contrast(rgb).enhance(1.5)
        rgb = ImageEnhance.Sharpness(rgb).enhance(1.4)
        r2, g2, b2 = rgb.split()
        return Image.merge("RGBA", (r2, g2, b2, a))
    img = ImageEnhance.Contrast(img).enhance(1.5)
    img = ImageEnhance.Sharpness(img).enhance(1.4)
    return img


def _simplify_colors(img: Image.Image, num_colors: int = PREPROCESS_NUM_COLORS) -> Image.Image:
    """Quantize to a limited palette — each color maps to one thread."""
    if img.mode == "RGBA":
        alpha = img.split()[3]
        rgb = img.convert("RGB")
        quantized = rgb.quantize(colors=num_colors, method=Image.Quantize.MEDIANCUT).convert("RGB")
        quantized = quantized.convert("RGBA")
        quantized.putalpha(alpha)
        return quantized
    return img.convert("RGB").quantize(colors=num_colors, method=Image.Quantize.MEDIANCUT).convert("RGB")


def preprocess_pipeline(img: Image.Image) -> tuple[Image.Image, list[str]]:
    """Run the full preprocessing pipeline and return (result, steps_applied)."""
    steps: list[str] = []

    img, bg_removed = _remove_background(img)
    if bg_removed:
        steps.append("background_removed")

    img, resized = _normalize_resolution(img)
    if resized:
        steps.append("normalized_resolution")

    img = _enhance_for_tracing(img)
    steps.append("contrast_sharpness_boosted")

    img = _simplify_colors(img)
    steps.append("colors_simplified")

    return img, steps


@app.post("/preprocess-image", response_model=PreprocessResponse)
async def preprocess_image(req: PreprocessRequest):
    source_path = IMAGES_DIR / f"{req.image_id}.png"
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Source image not found.")

    try:
        img = Image.open(source_path)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not open the image file.")

    processed, steps = preprocess_pipeline(img)

    preprocessed_id = str(uuid.uuid4())
    filename = f"{preprocessed_id}.png"
    filepath = IMAGES_DIR / filename
    processed.save(filepath, "PNG")

    return PreprocessResponse(
        original_image_id=req.image_id,
        preprocessed_image_id=preprocessed_id,
        preprocessed_image_url=f"/images/{filename}",
        steps_applied=steps,
    )
