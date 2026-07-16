---
title: Your brand look
category: Setup
order: 4
---

Every image the engine produces — composed graphics, annotated screenshots, generated
scenes — can land in **your** palette, fonts, and style instead of a stock look. That
look lives in one folder per profile: `profiles/<slug>/brand/` (gitignored, never
committed), and the **imagery** skill reads all of it before producing anything.

It's **optional**. With no brand set up, images are produced *unbranded*: composed
figures fall back to a neutral rendering default, and generated images take their style
from the piece alone. Nothing blocks — you can add a look later and only new images pick
it up.

## What's in the folder

| File | What it is |
|---|---|
| `brand/brand.yaml` | The explicit rules: `colors` (primary / accent / background / foreground / muted), `fonts` (heading/body CSS stacks), optional `logo` (a file in `brand/`, composited onto cards), and `style_notes` (freeform judgment prose) |
| `brand/refs/` | Example **images** whose look imagery should match — palette, mood, composition |
| `brand/*.md` / `*.html` | Brand **documents** — a company brand book, design system, tone guide, or messaging doc, read in full (most useful for a brand profile that already has formal guidelines) |

Everything is optional; anything missing falls back to a neutral default.
`profile.example/brand/` shows the documented shape.

## Three ways to set it up

1. **The Brand page** (sidebar → Inputs → Brand): color pickers, font fields, style
   notes, and logo / reference / document uploads, with a **live test card** rendered in
   the look as you edit. This is the hand-editor — no AI involved.
2. **The `brand` skill** (the Brand page's AI assistant, or "set up my brand" in any
   session): it reads whatever you've already attached — brand documents and reference
   images drive the conversation, not a fixed menu — and can also **derive a palette
   straight from your live website or a reference image**, or import from wherever your
   brand already lives (a design system, a site codebase). It proposes, shows you a test
   card, and only writes when you confirm.
3. **By hand in the files**: edit `profiles/<slug>/brand/brand.yaml` directly and drop
   refs/documents into the folder, following `profile.example/brand/`.

However it's authored, the skill touches **only** the `brand/` folder — never the voice
card (the writing authority), pillars, or the register. The voice card owns how you
*write*; the brand folder owns how images *look*.

## Per profile, like everything else

The look belongs to the active profile — a personal profile and a company profile each
carry their own. Switching profiles switches the look the imagery skill reads.
