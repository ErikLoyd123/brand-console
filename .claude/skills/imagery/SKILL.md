---
name: imagery
description: Put a supporting image on a queue idea's card, and pick the right model for it automatically — a photo, abstract metaphor, or illustration generated locally (a named model from image-generation.config.json, FLUX.2 klein by default via mflux, no API key), or a diagram / data figure / comparison table / quote card composed by Claude so its text is typeset rather than garbled. Chooses per image type from what's actually installed on this machine and says which model it picked and why (you can force one instead). Also does annotated screenshots of a live page, Unsplash photos, and perspective-correct UI-card composites onto a generated scene. Reads your brand guidelines (profiles/<slug>/brand/) so everything lands in your look. Starts from the piece's argument rather than its topic: proposes 2-3 concepts that demonstrate the point, complement it, or land it as a joke, checked so a domain expert would find nothing false, and you pick. Every render is critiqued before you see it, and an opt-in loop mode keeps rendering, critiquing, and fixing (showing you each round) until one clears the bar; generation runs in the background with candidates appearing live on the card; images are supporting visuals not covers; never publishes — Publish on the card ships the image with the piece.
type: skill
---

# imagery

The standalone entry point for adding an image to a queue idea. The whole method lives in
the shared procedure — this skill routes into it and adds nothing of its own:

**Follow `.claude/skills/imagery-procedure.md` exactly.**

1. **Find the idea.** If the message carries a queue-item id, use it. Otherwise ask which
   queue idea the image is for (list the current queue briefly so the owner can point).
2. **Run the procedure** — read the idea + its written piece, load the brand guidelines
   (and view the refs), find the concept (the piece's move and the image's role) before the
   type, propose, produce through the payload CLIs, critique every render (looping round
   after round when the owner opts in), report.
3. One idea per run; several images on that idea in one session is fine.

## Rules

- The procedure file is the single source — do not re-derive its steps or CLIs here.
- Never publish, never edit the piece's text.
- The owner picks the image; nothing is attached sight-unseen.
