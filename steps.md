# Suture — Build Steps

## Step 1: Project Setup ✅

- ✅ Initialize a Next.js + TypeScript project for the frontend
- ✅ Initialize a Python + FastAPI project for the backend
- ✅ Set up CORS and a basic health check endpoint to confirm the two services can communicate
- ✅ Configure environment variables for Nana Banana (Gemini) API keys and any OpenCLAW credentials

---

## Step 2: Input Handling — Text or Image ✅

Build the landing/input page where users choose their input type.

**Text path:**
- ✅ User types a prompt into the input field
- ✅ Frontend sends the prompt to the backend `/generate-image` endpoint
- ✅ Backend calls **Nana Banana** (Gemini text-to-image) and returns the generated image
- ✅ Frontend displays the image to the user with three options: **Approve**, **Regenerate**, or **Re-prompt**
- ✅ Loop continues until the user approves

**Image upload path:**
- ✅ User uploads an image file
- ✅ Backend validates image quality (resolution, clarity, noise level)
- ✅ Auto-enhancement: if quality is insufficient, backend attempts to fix (upscale, sharpen, boost contrast)
- ✅ If still insufficient after enhancement, return an error message prompting the user to upload a better image
- ✅ If quality passes (original or enhanced), proceed to the next step

---

## Step 3: Image Preprocessing ✅

Before conversion, preprocess the approved image to maximize trace quality:

- ✅ Remove background (if applicable)
- ✅ Increase contrast and simplify colors
- ✅ Resize/normalize to a consistent resolution
- ✅ The goal is a clean, flat, high-contrast image that will trace well into SVG

---

## Step 4: Image → SVG Conversion ✅

- ✅ Use vtracer server-side to autotrace the preprocessed image into an SVG
- ✅ Return the raw SVG output for the next check

---

## Step 5: OpenCLAW Check #1 — SVG Review & Edit ✅

- ✅ Pass the SVG to **OpenCLAW Check #1** via Discord agent integration
- ✅ OpenCLAW reviews the SVG for quality issues: excess nodes, shapes too fine to stitch, color problems, trace artifacts
- ✅ **If approved:** SVG passes through as-is
- ✅ **If issues found:** OpenCLAW automatically edits the SVG to correct the problems
- ✅ Output is a clean, stitch-ready SVG
- ✅ 5-minute polling timeout with graceful fallback to original SVG

---

## Step 6: SVG → DST Conversion ✅

- ✅ Convert preprocessed image to DST via scanline fill stitch generation (pyembroidery)
- ✅ Generate fill stitches with configurable density (0.4mm row spacing, 3.5mm max stitch)
- ✅ Map quantized colors to thread colors with proper COLOR_CHANGE commands

---

## Step 7: OpenCLAW Check #2 — DST Review & Edit ✅

- ✅ Pass the DST file to **OpenCLAW Check #2** via Discord agent integration
- ✅ OpenCLAW reviews the DST for embroidery-specific issues: bad jump stitches, incorrect stitch density, elements too small to physically stitch, color stop order, underlay problems
- ✅ **If approved:** DST is finalized as-is
- ✅ **If issues found:** OpenCLAW automatically adjusts the DST file
- ✅ Output is the final, machine-ready DST file
- ✅ 5-minute polling timeout with graceful fallback to original DST

---

## Step 8: Delivery ✅

- ✅ Return the final `.dst` file to the frontend
- ✅ Display a success screen with a download button ("Download .DST File" orange CTA)
- ✅ Show stitch stats (count, dimensions, thread count), thread color swatches, and AI review badges
- ✅ Manufacturing quote form ("Want these manufactured?") with garment picker + quantity + inline pricing
- Optionally show a preview render of the DST so the user can see the stitch layout before downloading

---

## Step 9: Frontend Polish

- Wire all steps to the UI per the design in `ui.png`
- ✅ Implement loading states for each pipeline stage (preprocessing, SVG conversion, SVG review, DST conversion, DST review)
- ✅ Handle all error states gracefully (bad image quality, failed generation, conversion errors)
- Ensure the dark theme, orange accents, and Suture branding are consistent throughout

---

## Step 10: Testing & Cleanup

- Test the full pipeline end-to-end with several different prompts and image uploads
- Identify any common failure points in the SVG trace or DST conversion and tune accordingly
- Clean up API error handling and edge cases
- Prepare a demo flow for the hackathon presentation

---

## Unused Jarvis Skill — Manufacturing Quote (Real Pricing Engine)

Jarvis has a **real embroidery pricing engine** that can calculate actual production costs. Currently our `/manufacturing-quote` endpoint uses a placeholder formula. To connect:

- Send a Discord message to `@Jarvis` with garment type, stitch count, and quantity
- Or call Jarvis's `embroidery-pricing/pricing-engine.py` directly
- Wire up when ready to replace the placeholder pricing
