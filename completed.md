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

---

## Step 4: Image → SVG Conversion ✅

### Backend — `POST /convert-to-svg`

- Accepts `{ image_id: string }` — the preprocessed image ID
- Uses **vtracer** (Rust-based bitmap-to-vector tracer) to autotrace the image into an SVG
- Tracing parameters tuned for embroidery: color mode, spline paths, speckle filtering, stacked layering
- SVGs saved to `generated_svgs/` directory, served via `/svgs/*` static mount
- Returns `{ svg_id, svg_url, source_image_id }`
- Error handling: missing source file, conversion failure, empty output

**vtracer Configuration:**
- `colormode="color"` — preserves the quantized color palette from preprocessing
- `hierarchical="stacked"` — stacked layers (maps well to stitch layers)
- `mode="spline"` — smooth Bézier curves instead of jagged polygons
- `filter_speckle=4` — removes tiny noise artifacts
- `color_precision=8` — high color fidelity for thread matching
- `path_precision=3` — clean paths without excessive nodes

### Frontend — `/canvas` Page Update

- Pipeline now auto-chains: preprocessing → SVG conversion (no user action needed)
- Two loading states: "Preprocessing image..." → "Converting to SVG..."
- **Three-tab viewer** (Original / Preprocessed / SVG) — user can compare all stages
- Preprocessing badges shown when viewing the preprocessed tab
- Smart retry: if SVG conversion fails, retries only that step (not the whole pipeline)
- Status text updates per active tab: "SVG generated — ready for review"

### Dependencies Added
- `vtracer>=0.6.0` — Rust-based image-to-SVG vectorization with color support

---

## Step 6: SVG → DST Conversion ✅

### Backend — `POST /convert-to-dst`

Converts the preprocessed image into a machine-ready `.dst` embroidery file using scanline fill stitch generation.

**Stitch Generation Pipeline:**
1. Load the preprocessed PNG (already quantized to ~10 colors)
2. Extract unique colors (skip transparent/white background)
3. For each color, create a pixel mask
4. Scanline fill: scan each row, find contiguous runs, generate stitch coordinates
5. Alternating row direction for efficient needle travel
6. Scale pixel coordinates to embroidery units (target: 100mm / ~4" design)
7. Assemble stitches with JUMP, STITCH, TRIM, and COLOR_CHANGE commands
8. Write DST via pyembroidery

**Endpoint Details:**
- Accepts `{ image_id: string }` — the preprocessed image
- DST files saved to `generated_dst/` directory, served via `/dst/*` static mount
- Returns `{ dst_id, dst_url, source_image_id, thread_colors, stitch_count, dimensions_mm }`
- `thread_colors` includes RGB values and hex for each thread
- Error handling: missing source, stitch generation failure, empty DST output

**Embroidery Parameters:**
- Design size: 100mm (4") on longest side
- Fill row spacing: 0.4mm (standard fill density)
- Max stitch length: 3.5mm (within DST spec limits)

### Frontend — `/canvas` Page Update

- Pipeline now auto-chains: preprocessing → SVG → DST (fully automatic)
- Three loading states with descriptive messages for each stage
- **Completion screen** shows:
  - Three-tab image viewer (Original / Preprocessed / SVG)
  - Stitch stats: count, dimensions in mm, thread count
  - Thread color swatches (colored circles)
  - **"Download .DST File"** button (orange CTA)
- Smart retry: failures retry only the failed stage

### Dependencies Added
- `pyembroidery>=1.4.36` — Embroidery file read/write supporting DST, PES, and 40+ formats

---

## Step 5: OpenCLAW Check #1 — SVG Review ✅

### Backend — `POST /review-svg`

- Accepts `{ svg_id: string, image_id: string }` — the generated SVG and its preprocessed source image
- Sends both files to the Discord channel via webhook, mentioning the OpenCLAW agent (@Jarvis)
- Message includes review instructions: check for excess nodes, shapes too fine to stitch, color problems, trace artifacts
- Polls the Discord channel every 5 seconds for up to 5 minutes for the agent's reply
- **If agent responds with an improved SVG attachment:** downloads and saves the improved SVG, returns its ID/URL
- **If agent responds with text only (approval):** returns the original SVG as approved
- **If timeout (5 min) or agent unreachable:** gracefully falls back to the original SVG with a status note
- Returns `{ svg_id, svg_url, reviewed: bool, agent_feedback: string | null }`

### Frontend — `/canvas` Page Update

- New `reviewing_svg` pipeline state inserted between SVG conversion and DST conversion
- Loading spinner with "AI agent reviewing SVG quality..." text
- Sub-text: "OpenCLAW agent checking for excess nodes, trace artifacts, stitch issues..."
- Green "SVG reviewed by AI" badge shown on completion screen if review succeeded
- Agent feedback displayed as an italic quote below the badges
- Smart retry: if SVG review fails, retries only that step

---

## Step 7: OpenCLAW Check #2 — DST Review ✅

### Backend — `POST /review-dst`

- Accepts `{ dst_id: string, svg_id: string }` — the generated DST and the (reviewed) SVG
- Sends both files to the Discord channel via webhook, mentioning the OpenCLAW agent (@Jarvis)
- Message includes review instructions: check for bad jump stitches, incorrect stitch density, elements too small to stitch, color stop order, underlay problems
- Polls the Discord channel every 5 seconds for up to 5 minutes
- Same response handling as Step 5: download improved DST if attached, or fall back to original
- Returns `{ dst_id, dst_url, reviewed: bool, agent_feedback: string | null }`

### Frontend — `/canvas` Page Update

- New `reviewing_dst` pipeline state inserted after DST conversion
- Loading spinner with "AI agent optimizing stitch file..." text
- Sub-text: "OpenCLAW agent checking stitch density, jump stitches, color order..."
- Green "DST optimized by AI" badge shown on completion screen
- Full pipeline chain is now: preprocessing → SVG → SVG review → DST → DST review → done

---

## Manufacturing Quote (Placeholder) ✅

### Backend — `POST /manufacturing-quote`

- Accepts `{ garment: string, quantity: int, stitch_count: int, thread_colors: int }`
- Returns a placeholder estimated quote with unit price, total price, turnaround days, and notes
- Pricing based on garment base cost + stitch count surcharge + thread color surcharge
- Volume discounts at 25+, 50+, 100+ unit thresholds
- Not connected to real pricing engine yet — placeholder formula for demo purposes
- Supports garments: t-shirt, hoodie, hat, polo, jacket, tote

### Frontend — `/canvas` Page Update

- "Want these manufactured?" link appears below the Download button
- Expands to a compact quote form: garment selector + quantity input + "Get Quote" button
- Displays quote result inline: unit price, total, turnaround days, and notes
- Dark-themed form consistent with Suture design language

### Dependencies Added
- `httpx>=0.27.0` — Async HTTP client for Discord webhook/API communication

### Environment Variables Added
- `DISCORD_WEBHOOK_URL` — Discord webhook for sending files to the agent channel
- `DISCORD_BOT_TOKEN` — Bot token for reading agent responses from the channel
- `DISCORD_CHANNEL_ID` — Target Discord channel where the agent listens
