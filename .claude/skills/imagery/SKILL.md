---
name: imagery
description: Put a supporting image on a queue idea's card, and pick the right model for it automatically — a photo, abstract metaphor, or illustration generated locally (a named model from image-generation.config.json, FLUX.2 klein by default via mflux, no API key), or a diagram / data figure / comparison table / quote card composed by Claude so its text is typeset rather than garbled. Chooses per image type from what's actually installed on this machine and says which model it picked and why (you can force one instead). Also does annotated screenshots of a live page, Unsplash photos, and perspective-correct UI-card composites onto a generated scene. Reads your brand guidelines (profiles/<slug>/brand/) so everything lands in your look. Proposes the types that fit the piece, you pick; generation runs in the background with candidates appearing live on the card; images are supporting visuals not covers; never publishes — Publish on the card ships the image with the piece.
type: skill
---

# imagery

The standalone entry point for adding an image to a queue idea. The whole method lives in
the shared procedure — this skill routes into it and adds nothing of its own:

**Follow `.claude/skills/imagery-procedure.md` exactly.**

1. **Find the idea.** If the message carries a queue-item id, use it. Otherwise ask which
   queue idea the image is for (list the current queue briefly so the owner can point).
2. **Run the procedure** — read the idea + its written piece, load the brand guidelines
   (and view the refs), propose concepts, produce through the payload CLIs, verify, report.
3. One idea per run; several images on that idea in one session is fine.

## Rules

- The procedure file is the single source — do not re-derive its steps or CLIs here.
- Never publish, never edit the piece's text.
- The owner picks the image; nothing is attached sight-unseen.
