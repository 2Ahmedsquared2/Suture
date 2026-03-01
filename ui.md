# Suture — UI Reference

## Design Reference

> **See `ui.png` in the repo root for the full visual reference.** All frontend work should be built to match or be inspired by this design.

---

## Design Language

**Theme:** Dark — near-black background (`#0a0a0a` or similar), white/light text

**Accent Color:** Orange — used sparingly for CTAs, links, and highlights (e.g. "Get Started →"). This is the only color pop in an otherwise monochrome layout.

**Typography:** Clean sans-serif. The "Suture" wordmark uses a stylized S. Keep type minimal and well-spaced.

**Hero Graphic:** A contour/topographic line illustration (white lines on dark background). This graphic is intentional — the flowing stitch-like lines visually communicate what the product does. Use the asset from `ui.png` as reference, or generate something similar with SVG/canvas if the asset isn't available separately.

---

## Pages / Screens

### Screen 1 — Landing / Hero
- Suture logo + wordmark top right
- Login / Sign Up nav top right
- Large hero graphic (contour lines) on the left
- Tagline: **"Upload. Convert. Stitch."**
- **"Get Started →"** CTA in orange

### Screen 2 — Input / Build
- Prompt input field labeled **"Let's Build ..."**
- Text input for prompt OR image upload toggle
- Submit/generate button
- Clean, minimal layout — the canvas/grid background suggests a workspace

### Screen 3 — Canvas / Preview
- Grid-based canvas area for previewing the SVG or DST output
- Same "Let's Build ..." input at the bottom for iteration
- Should feel like a creative workspace

---

## Component Notes

- Buttons: dark background, orange text or orange border for primary actions; subtle for secondary
- Input fields: dark fill, light border, placeholder text in muted gray
- Keep spacing generous — this is a tool, not a marketing site, so clarity wins
- Loading states should be subtle (spinner or progress indicator) to not interrupt the dark aesthetic
- Error messages should be inline and non-intrusive

---

## Implementation Notes

- Build mobile-responsive but prioritize desktop — embroidery tool users are likely on desktop
- Use Tailwind CSS for utility-first styling that aligns easily with this design system
- The contour graphic can be implemented as: a static PNG/SVG asset, an SVG filter effect, or a canvas animation (p5.js or similar) if you want it to be dynamic
