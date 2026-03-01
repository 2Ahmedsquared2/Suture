# Suture — Completed Work

## Step 1: Project Setup ✅

### Frontend
- Initialized Next.js 16 + React 19 + TypeScript project
- Configured Tailwind CSS v4 with custom theme (dark background `#0a0a0a`, orange accent `#e97319`, muted, surface, border tokens)
- Geist font family (sans + mono)
- Created layout with persistent `Navbar` component (logo, Build link, Log In, Sign Up)
- Three pages wired up: `/` (landing), `/build` (input), `/canvas` (preview workspace)
- `ContourGraphic` component — SVG-based contour/topographic line art used as hero and background decoration
- Grid-canvas CSS background for the workspace screen
- Environment: `NEXT_PUBLIC_API_URL=http://localhost:8000`

### Backend
- Initialized Python + FastAPI project with uvicorn
- CORS configured to allow frontend origin
- `GET /health` endpoint returning status, service name, and version
- Environment variables set up: `FRONTEND_URL`, `GEMINI_API_KEY`, `OPENCLAW_API_KEY`
- Virtual environment (`venv`) with all dependencies pinned in `requirements.txt`

---

## Step 2: Input Handling — Text or Image ✅

### Backend — New Endpoints

**`POST /generate-image`**
- Accepts `{ prompt: string }`
- Lazy-initializes Gemini client (server starts even without API key)
- Calls Gemini Imagen 3.0 (`imagen-3.0-generate-002`) for text-to-image generation
- Saves generated image to `generated_images/` directory as PNG
- Returns `{ image_id, image_url }` for frontend to display
- Error handling: empty prompt, missing API key, Gemini failures

**`POST /upload-image`**
- Accepts multipart file upload
- Validates: file type (must be image), file size (≤10 MB), resolution (≥256×256)
- **Auto-enhancement pipeline** for borderline images:
  - Detects issues: low resolution, blurriness, low contrast, grayscale
  - Attempts fixes: LANCZOS upscaling, sharpening, contrast boost, color conversion
  - Re-validates after enhancement
  - Only rejects if image is still bad after enhancement attempt
- Returns `{ image_id, image_url, enhanced, enhancement_note }`
- Hard minimum of 64×64 — images below this are rejected outright

**`/images/*` (Static)**
- Serves generated and uploaded images from `generated_images/` directory

### Frontend — `/build` Page Redesign

**Describe / Upload Tabs**
- Clean pill-style toggle at top of input area
- "Describe" tab: text input + "Generate" button
- "Upload" tab: drag-and-drop zone with click-to-browse fallback
- Accepts PNG, JPG, WebP up to 10 MB

**Image Generation Flow (Describe mode)**
1. User types prompt → clicks Generate (or Enter)
2. Loading spinner with "Generating your image..."
3. Generated image displayed in bordered preview card
4. Three action buttons: **Approve →** (orange CTA), **Regenerate**, **Re-prompt**
5. Regenerate: re-calls Gemini with same prompt
6. Re-prompt: clears preview, returns to input
7. Approve: navigates to `/canvas` with image data

**Image Upload Flow (Upload mode)**
1. User drops or selects an image file
2. Loading spinner with "Validating your image..."
3. If backend enhanced the image: orange notice banner showing what was fixed
4. Uploaded/enhanced image displayed in preview card
5. Two action buttons: **Approve →**, **Re-upload**
6. Approve: navigates to `/canvas` with image data

**Error Handling**
- Inline error messages below input area (red text, non-intrusive)
- Covers: network failures, bad file types, quality rejections, generation failures

### Frontend — `/canvas` Page Update
- Receives approved image via URL query params (`imageId` + `imageUrl`)
- Displays the approved image centered in the grid workspace
- Shows "Image approved — ready for next step" status text
- Bottom input bar preserved for future pipeline iteration

### Dependencies Added
- `google-genai>=1.0.0` — Gemini API client for image generation
- `Pillow>=10.0.0` — Image processing, validation, and enhancement
- `numpy>=1.26.0` — Image quality assessment (contrast, blur detection)

---

## Step 3: Image Preprocessing ✅

### Backend — `POST /preprocess-image`

**Preprocessing Pipeline (4 stages):**

1. **Background Removal** — uses `rembg` (U2-Net model) to strip the background, leaving a transparent subject. Graceful fallback if rembg is unavailable.
2. **Resolution Normalization** — scales the image so the longest side equals 1024px (LANCZOS resampling). Handles both upscaling and downscaling.
3. **Contrast & Sharpness Boost** — increases contrast by 1.5× and sharpness by 1.4× to produce crisp edges that trace cleanly into SVG. Alpha channel is preserved for RGBA images.
4. **Color Simplification** — quantizes to 10 colors using median-cut algorithm. Each resulting color maps to one embroidery thread. Alpha channel preserved.

**Endpoint Details:**
- Accepts `{ image_id: string }` — looks up the source PNG in `generated_images/`
- Returns `{ original_image_id, preprocessed_image_id, preprocessed_image_url, steps_applied }`
- `steps_applied` lists which stages ran (e.g. `["background_removed", "normalized_resolution", "contrast_sharpness_boosted", "colors_simplified"]`)

### Frontend — `/canvas` Page Update

- Automatically triggers preprocessing when an approved image arrives via query params
- Shows a loading spinner with the four pipeline stages listed
- Displays the preprocessed image in the canvas area on completion
- **Original / Preprocessed toggle** — user can switch between the two to see what changed
- Steps applied shown as orange pill badges below the image
- Error state with retry button if preprocessing fails
- Status text: "Image preprocessed — ready for SVG conversion"

### Dependencies Added
- `rembg>=2.0.50` — AI-powered background removal (U2-Net)
