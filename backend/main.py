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
import vtracer
import pyembroidery

from discord_integration import send_files_to_agent

try:
    from rembg import remove as remove_bg
    REMBG_AVAILABLE = True
except ImportError:
    REMBG_AVAILABLE = False

load_dotenv()

IMAGES_DIR = pathlib.Path("generated_images")
IMAGES_DIR.mkdir(exist_ok=True)

SVG_DIR = pathlib.Path("generated_svgs")
SVG_DIR.mkdir(exist_ok=True)

DST_DIR = pathlib.Path("generated_dst")
DST_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Suture API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")
app.mount("/svgs", StaticFiles(directory=str(SVG_DIR)), name="svgs")
app.mount("/dst", StaticFiles(directory=str(DST_DIR)), name="dst")

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

    embroidery_prompt = (
        "Create a simple, bold, flat design with minimal fine detail and high contrast, "
        "suitable for embroidery and SVG tracing. Use solid filled shapes, avoid gradients, "
        "thin lines, and photorealistic textures. Keep the design clean with few colors. "
        f"Subject: {prompt}"
    )

    try:
        client = get_gemini_client()
        response = client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=embroidery_prompt,
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


# ---------------------------------------------------------------------------
# Step 4 — Image → SVG Conversion
# ---------------------------------------------------------------------------


class ConvertSvgRequest(BaseModel):
    image_id: str


class ConvertSvgResponse(BaseModel):
    svg_id: str
    svg_url: str
    source_image_id: str


def _trace_image_to_svg(input_path: str, output_path: str) -> None:
    """Use vtracer to autotrace a raster image into an SVG."""
    vtracer.convert_image_to_svg_py(
        input_path,
        output_path,
        colormode="color",
        hierarchical="stacked",
        mode="spline",
        filter_speckle=4,
        color_precision=8,
        layer_difference=16,
        corner_threshold=60,
        length_threshold=4.0,
        max_iterations=10,
        splice_threshold=45,
        path_precision=3,
    )


@app.post("/convert-to-svg", response_model=ConvertSvgResponse)
async def convert_to_svg(req: ConvertSvgRequest):
    source_path = IMAGES_DIR / f"{req.image_id}.png"
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Source image not found.")

    svg_id = str(uuid.uuid4())
    svg_filename = f"{svg_id}.svg"
    svg_path = SVG_DIR / svg_filename

    try:
        _trace_image_to_svg(str(source_path), str(svg_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SVG conversion failed: {e}")

    if not svg_path.exists() or svg_path.stat().st_size == 0:
        raise HTTPException(status_code=500, detail="SVG conversion produced no output.")

    return ConvertSvgResponse(
        svg_id=svg_id,
        svg_url=f"/svgs/{svg_filename}",
        source_image_id=req.image_id,
    )


# ---------------------------------------------------------------------------
# Step 6 — SVG → DST Conversion  (raster-based scanline fill)
# ---------------------------------------------------------------------------

DESIGN_SIZE_MM = 100.0
STITCH_ROW_SPACING_MM = 0.4
MAX_STITCH_LENGTH_MM = 3.5


class ConvertDstRequest(BaseModel):
    image_id: str


class ThreadInfo(BaseModel):
    r: int
    g: int
    b: int
    hex: str


class ConvertDstResponse(BaseModel):
    dst_id: str
    dst_url: str
    source_image_id: str
    thread_colors: list[ThreadInfo]
    stitch_count: int
    dimensions_mm: list[float]


def _find_runs(row: np.ndarray) -> list[tuple[int, int]]:
    """Find contiguous True segments in a boolean row. Returns (start, end) pairs."""
    diffs = np.diff(row.astype(np.int8))
    starts = np.where(diffs == 1)[0] + 1
    ends = np.where(diffs == -1)[0] + 1

    if row[0]:
        starts = np.concatenate(([0], starts))
    if row[-1]:
        ends = np.concatenate((ends, [len(row)]))

    return list(zip(starts.tolist(), ends.tolist()))


def _image_to_pattern(img: Image.Image) -> tuple[pyembroidery.EmbPattern, list[tuple[int, int, int]]]:
    """Convert a quantized PNG into a pyembroidery stitch pattern."""
    pattern = pyembroidery.EmbPattern()

    has_alpha = img.mode == "RGBA"
    alpha = np.array(img)[:, :, 3] if has_alpha else None
    rgb_arr = np.array(img.convert("RGB"))
    h, w = rgb_arr.shape[:2]

    scale = (DESIGN_SIZE_MM * 10.0) / max(w, h)
    row_gap = max(1, round(STITCH_ROW_SPACING_MM * 10.0 / scale))
    max_len = max(4, round(MAX_STITCH_LENGTH_MM * 10.0 / scale))

    flat = rgb_arr.reshape(-1, 3)
    if alpha is not None:
        flat = flat[alpha.flatten() > 128]
    unique = np.unique(flat, axis=0)

    colors = [tuple(c) for c in unique if not (c[0] > 240 and c[1] > 240 and c[2] > 240)]
    if not colors:
        colors = [(0, 0, 0)]

    used_colors: list[tuple[int, int, int]] = []

    for ci, (cr, cg, cb) in enumerate(colors):
        mask = (rgb_arr[:, :, 0] == cr) & (rgb_arr[:, :, 1] == cg) & (rgb_arr[:, :, 2] == cb)
        if alpha is not None:
            mask &= alpha > 128

        if not mask.any():
            continue

        thread = pyembroidery.EmbThread()
        thread.set("color", int(cr) << 16 | int(cg) << 8 | int(cb))
        thread.set("name", f"Thread {ci + 1}")
        pattern.add_thread(thread)
        used_colors.append((int(cr), int(cg), int(cb)))

        if len(used_colors) > 1:
            pattern.add_command(pyembroidery.COLOR_CHANGE)

        first_stitch = True
        direction = 1

        for y in range(0, h, row_gap):
            runs = _find_runs(mask[y])
            if not runs:
                direction *= -1
                continue

            if direction == -1:
                runs = [(e, s) for s, e in reversed(runs)]

            for rs, re in runs:
                if rs == re:
                    continue
                step = 1 if rs < re else -1
                xs = list(range(rs, re, max_len * step))
                if xs[-1] != re:
                    xs.append(re)

                sx = round(xs[0] * scale)
                sy = round(y * scale)

                if first_stitch:
                    pattern.add_stitch_absolute(pyembroidery.JUMP, sx, sy)
                    pattern.add_stitch_absolute(pyembroidery.STITCH, sx, sy)
                    first_stitch = False
                else:
                    pattern.add_stitch_absolute(pyembroidery.TRIM)
                    pattern.add_stitch_absolute(pyembroidery.JUMP, sx, sy)
                    pattern.add_stitch_absolute(pyembroidery.STITCH, sx, sy)

                for x in xs[1:]:
                    pattern.add_stitch_absolute(pyembroidery.STITCH, round(x * scale), sy)

            direction *= -1

    pattern.add_command(pyembroidery.END)
    return pattern, used_colors


@app.post("/convert-to-dst", response_model=ConvertDstResponse)
async def convert_to_dst(req: ConvertDstRequest):
    source_path = IMAGES_DIR / f"{req.image_id}.png"
    if not source_path.exists():
        raise HTTPException(status_code=404, detail="Source image not found.")

    try:
        img = Image.open(source_path)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not open the image file.")

    try:
        pattern, colors = _image_to_pattern(img)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stitch generation failed: {e}")

    dst_id = str(uuid.uuid4())
    dst_filename = f"{dst_id}.dst"
    dst_path = DST_DIR / dst_filename

    try:
        pyembroidery.write_dst(pattern, str(dst_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DST file write failed: {e}")

    if not dst_path.exists() or dst_path.stat().st_size == 0:
        raise HTTPException(status_code=500, detail="DST conversion produced no output.")

    w, h = img.size
    scale = DESIGN_SIZE_MM / max(w, h)

    return ConvertDstResponse(
        dst_id=dst_id,
        dst_url=f"/dst/{dst_filename}",
        source_image_id=req.image_id,
        thread_colors=[
            ThreadInfo(r=r, g=g, b=b, hex=f"#{r:02x}{g:02x}{b:02x}")
            for r, g, b in colors
        ],
        stitch_count=len(pattern.stitches),
        dimensions_mm=[round(w * scale, 1), round(h * scale, 1)],
    )


# ---------------------------------------------------------------------------
# Step 5 — OpenCLAW Check #1: SVG Review via Discord Agent
# ---------------------------------------------------------------------------


class ReviewSvgRequest(BaseModel):
    svg_id: str
    image_id: str


class ReviewSvgResponse(BaseModel):
    svg_id: str
    svg_url: str
    reviewed: bool
    agent_feedback: str | None = None


@app.post("/review-svg", response_model=ReviewSvgResponse)
async def review_svg(req: ReviewSvgRequest):
    svg_path = SVG_DIR / f"{req.svg_id}.svg"
    image_path = IMAGES_DIR / f"{req.image_id}.png"

    if not svg_path.exists():
        raise HTTPException(status_code=404, detail="SVG file not found.")
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Source image not found.")

    msg_id = await send_files_to_agent(
        message="SVG Review Check #1 — Please review this SVG for embroidery quality. "
        "Check for: excess nodes, shapes too fine to stitch, color problems, trace artifacts. "
        "Reply with an improved SVG attached if changes are needed, or confirm it's good.",
        file_paths=[str(image_path), str(svg_path)],
    )

    if not msg_id:
        return ReviewSvgResponse(
            svg_id=req.svg_id,
            svg_url=f"/svgs/{req.svg_id}.svg",
            reviewed=False,
            agent_feedback="Could not reach the review agent. Continuing with original SVG.",
        )

    result = await poll_for_agent_response(msg_id)

    if result is None:
        return ReviewSvgResponse(
            svg_id=req.svg_id,
            svg_url=f"/svgs/{req.svg_id}.svg",
            reviewed=False,
            agent_feedback="Agent did not respond in time. Continuing with original SVG.",
        )

    svg_attachments = [u for u in result["attachment_urls"] if u.lower().endswith(".svg")]

    if svg_attachments:
        reviewed_id = str(uuid.uuid4())
        reviewed_filename = f"{reviewed_id}.svg"
        reviewed_path = SVG_DIR / reviewed_filename
        downloaded = await download_file(svg_attachments[0], str(reviewed_path))

        if downloaded and reviewed_path.exists() and reviewed_path.stat().st_size > 0:
            return ReviewSvgResponse(
                svg_id=reviewed_id,
                svg_url=f"/svgs/{reviewed_filename}",
                reviewed=True,
                agent_feedback=result["content"] or "Agent improved the SVG.",
            )

    return ReviewSvgResponse(
        svg_id=req.svg_id,
        svg_url=f"/svgs/{req.svg_id}.svg",
        reviewed=True,
        agent_feedback=result["content"] or "Agent approved the SVG as-is.",
    )


# ---------------------------------------------------------------------------
# Step 7 — OpenCLAW Check #2: DST Review via Discord Agent
# ---------------------------------------------------------------------------


class ReviewDstRequest(BaseModel):
    dst_id: str
    svg_id: str


class ReviewDstResponse(BaseModel):
    dst_id: str
    dst_url: str
    reviewed: bool
    agent_feedback: str | None = None


@app.post("/review-dst", response_model=ReviewDstResponse)
async def review_dst(req: ReviewDstRequest):
    dst_path = DST_DIR / f"{req.dst_id}.dst"
    svg_path = SVG_DIR / f"{req.svg_id}.svg"

    if not dst_path.exists():
        raise HTTPException(status_code=404, detail="DST file not found.")

    files_to_send = [str(dst_path)]
    if svg_path.exists():
        files_to_send.append(str(svg_path))

    msg_id = await send_files_to_agent(
        message="DST Review Check #2 — Please review this DST embroidery file. "
        "Check for: bad jump stitches, incorrect stitch density, elements too small to stitch, "
        "color stop order, underlay problems. "
        "Reply with an optimized DST attached if changes are needed, or confirm it's good.",
        file_paths=files_to_send,
    )

    if not msg_id:
        return ReviewDstResponse(
            dst_id=req.dst_id,
            dst_url=f"/dst/{req.dst_id}.dst",
            reviewed=False,
            agent_feedback="Could not reach the review agent. Continuing with original DST.",
        )

    result = await poll_for_agent_response(msg_id)

    if result is None:
        return ReviewDstResponse(
            dst_id=req.dst_id,
            dst_url=f"/dst/{req.dst_id}.dst",
            reviewed=False,
            agent_feedback="Agent did not respond in time. Continuing with original DST.",
        )

    dst_attachments = [u for u in result["attachment_urls"] if u.lower().endswith(".dst")]

    if dst_attachments:
        reviewed_id = str(uuid.uuid4())
        reviewed_filename = f"{reviewed_id}.dst"
        reviewed_path = DST_DIR / reviewed_filename
        downloaded = await download_file(dst_attachments[0], str(reviewed_path))

        if downloaded and reviewed_path.exists() and reviewed_path.stat().st_size > 0:
            return ReviewDstResponse(
                dst_id=reviewed_id,
                dst_url=f"/dst/{reviewed_filename}",
                reviewed=True,
                agent_feedback=result["content"] or "Agent optimized the DST.",
            )

    return ReviewDstResponse(
        dst_id=req.dst_id,
        dst_url=f"/dst/{req.dst_id}.dst",
        reviewed=True,
        agent_feedback=result["content"] or "Agent approved the DST as-is.",
    )


# ---------------------------------------------------------------------------
# Manufacturing Quote (placeholder — not connected to real pricing yet)
# ---------------------------------------------------------------------------


class QuoteRequest(BaseModel):
    garment: str
    quantity: int
    stitch_count: int
    thread_colors: int


class QuoteResponse(BaseModel):
    garment: str
    quantity: int
    unit_price: float
    total_price: float
    turnaround_days: int
    notes: str


@app.post("/manufacturing-quote", response_model=QuoteResponse)
async def manufacturing_quote(req: QuoteRequest):
    if req.quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1.")

    base_prices = {
        "t-shirt": 8.00,
        "hoodie": 18.00,
        "hat": 6.00,
        "polo": 12.00,
        "jacket": 22.00,
        "tote": 5.00,
    }
    base = base_prices.get(req.garment.lower(), 10.00)

    stitch_surcharge = (req.stitch_count / 1000) * 0.15
    color_surcharge = max(0, req.thread_colors - 1) * 0.50

    unit = round(base + stitch_surcharge + color_surcharge, 2)

    if req.quantity >= 100:
        unit = round(unit * 0.80, 2)
    elif req.quantity >= 50:
        unit = round(unit * 0.85, 2)
    elif req.quantity >= 25:
        unit = round(unit * 0.90, 2)

    total = round(unit * req.quantity, 2)

    turnaround = 14 if req.quantity <= 25 else 21 if req.quantity <= 100 else 30

    return QuoteResponse(
        garment=req.garment,
        quantity=req.quantity,
        unit_price=unit,
        total_price=total,
        turnaround_days=turnaround,
        notes=f"Estimated quote for {req.quantity}× {req.garment} with {req.stitch_count:,} stitches. "
        f"Final pricing confirmed after production review.",
    )
