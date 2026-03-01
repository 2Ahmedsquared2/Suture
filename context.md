# Suture — Project Context

## Overview

Suture is a web application that converts text prompts or images into embroidery-ready DST files. The tagline is **Upload. Convert. Stitch.** — and the product delivers exactly that. Users can either describe what they want embroidered or upload an existing image, and Suture handles the entire pipeline from idea to a machine-ready stitch file.

The project was built for a hackathon and is designed to make embroidery digitization accessible to anyone, regardless of technical skill.

---

## Tech Stack

### Backend
- **Python** — core language for all pipeline logic
- **FastAPI** — REST API framework, handles all endpoints and pipeline orchestration

### Frontend
- **React + Next.js + TypeScript** — modern, type-safe frontend framework
- The UI follows the Suture design language: dark theme, orange accents, minimal and clean

### External Services & Tools
- **Nana Banana** — Gemini-powered text-to-image generation. Used when the user provides a text prompt instead of an image.
- **OpenCLAW (Check #1)** — AI-powered quality checker and editor for the image → SVG conversion step. Reviews the SVG output and either approves it or makes corrections automatically.
- **OpenCLAW (Check #2)** — AI-powered quality checker and editor for the SVG → DST conversion step. Reviews the final DST file and either approves it or adjusts stitch paths, density, and structure as needed.
- **Inkscape (with Ink/Stitch)** — used server-side to convert SVGs into DST embroidery files

---

## What the App Does

1. User inputs either a **text prompt** or an **image**
2. If text: Nana Banana generates an image using Gemini; user can approve, regenerate, or re-prompt
3. If image: quality is validated; user is prompted to re-upload if the image is too low quality
4. The approved image is converted to an **SVG**
5. OpenCLAW Check #1 reviews and edits the SVG if needed
6. The SVG is passed to Inkscape to generate a **DST file**
7. OpenCLAW Check #2 reviews and edits the DST file if needed
8. The final DST file is delivered to the user for download

---

## UI Reference

See `ui.png` in the repo root for the UI design reference. The design uses a dark background, white contour/topographic graphic as the hero element, orange CTAs, and clean sans-serif typography. All frontend work should stay consistent with this aesthetic.
