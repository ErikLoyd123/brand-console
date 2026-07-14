---
name: brand
description: Set up or refine the active profile's brand look — the brand/ folder the imagery skill reads before producing any image (colors, fonts, logo, style notes, reference images, optional brand-book documents). Can derive a palette straight from your live website or a reference image, and shows you a test card in the new look before saving. Per profile; writes only profiles/<slug>/brand/, never the voice card, pillars, or register.
type: skill
---

# brand

The assistant for a profile's **visual brand** — the sibling of `pillars` (topics),
`register` (platform/tone), and `voice` (the voice card), each managing one axis of the
profile. This one owns `profiles/<slug>/brand/`, which the `imagery` skill reads before
producing any image. It touches **only** that folder: never the voice card (the writing
authority), never pillars, never the register.

The folder it manages:

| File | What it is |
|---|---|
| `brand/brand.yaml` | The explicit rules: `colors` (primary/accent/background/foreground/muted), `fonts` (heading/body CSS stacks), optional `logo` (file in brand/, composited onto cards), `style_notes` (freeform judgment prose) |
| `brand/refs/` | Example **images** whose look imagery should match (palette, mood, composition) |
| `brand/*.md` / `*.html` | Brand **documents** — a company brand book, tone guide, messaging doc, read in full |

Everything is optional; anything missing falls back to a neutral default.
`profile.example/brand/` is the documented reference shape.

## 1. Orient first

Resolve the active profile and read what's there, then open by telling the owner where
their brand stands — the folder path, what exists, what's defaulted — before asking
anything:

```bash
npx tsx -e "import('./src/profile/loader.js').then(async (l) => { const dir = l.resolveActiveProfileDir(); const b = (await import('./src/profile/brand.js')).loadBrand(); console.log(JSON.stringify({ brandDir: dir + '/brand', ...b }, null, 2)) })"
```

If `brand.yaml` exists, also read the raw file (comments and all) so an edit preserves
the owner's own annotations. View every ref image and read every brand doc listed.

## 2. Ask what they want

One question: set up from scratch, refine something specific (a color, the notes, the
fonts), derive the palette from a website or image, or just tour where things go. If the
owner opened with a specific ask, skip the menu and do that.

## 3. Building the pieces

- **Import from an existing brand source** — when the owner points at where their brand
  already lives (another repo, a brand-book folder, a design-system doc, a site
  codebase), go get it rather than making them ferry files:
  - **Read the docs they name** (brand book, design system, tone guide) and copy the
    useful ones into `brand/` as brand documents.
  - **Trace tokens to values.** Design-system docs often name tokens ("primary is
    blue-500") and deliberately omit hex — the values live in the code (a
    `globals.css`/tokens file the doc usually cites). Follow the pointer, quote the
    real hex into `brand.yaml`, and note the source in a comment.
  - **Map tokens to the five slots with judgment**, and say what you chose: which ramp
    step becomes `primary`, whether the heading ink should be a stronger step than the
    app's body text (big card titles usually want it), which warm tone is the accent.
  - **Copy the logo set** into `brand/logos/` (all variants — primary/mono/reversed/
    icon/stacked; keep SVG sources in a subfolder) and set the light-ground variant as
    the card default.
  - Confirm the mapping with the owner before writing, and flag that copies are
    snapshots — if the source brand evolves, re-import.
- **Palette from a live site** — capture it and read the colors off the render:

  ```bash
  cat > .brand-shot.json <<'JSON'
  { "url": "https://<their site>", "out": "/tmp/brand-site.png" }
  JSON
  npx tsx src/images/capture-image.ts .brand-shot.json && rm .brand-shot.json
  ```

  View the PNG, propose the five slots as hex values (primary = the signature color,
  accent, background, foreground, muted), each with one plain-words line on where you
  saw it. The owner confirms or adjusts.
- **Palette from a reference image** — same, minus the capture: view the file they name,
  propose the five slots.
- **Fonts** — ask what they use (site CSS, brand book); write CSS `font-family` stacks
  with honest fallbacks. Rendering uses system fonts, so exotic webfonts may fall back —
  say so.
- **Logo** — the owner drops the file into `brand/` themselves; record its filename as
  `logo:`. Never fetch or invent one.
- **Style notes** — draw out in the owner's words what images should feel like and what
  to avoid; a few specific lines beat a page of adjectives.
- **Refs and docs** — the owner drops files in (`refs/` for images, `brand/` root for
  `.md`/`.html` docs); nothing to configure. Tell them the paths and confirm what you can
  see once they have.

## 4. Show it before saving

Render a test card in the proposed look and show it (view the PNG and describe it, and
give the path so the owner can open it):

```bash
cat > .brand-card.json <<'JSON'
{ "template": "headline", "inputs": { "kicker": "Preview", "title": "This is your brand look", "subtitle": "Colors, fonts, and spacing from brand.yaml" }, "out": "/tmp/brand-card.png" }
JSON
npx tsx src/images/compose-image.ts .brand-card.json && rm .brand-card.json
```

(Preview mode reads the **active profile's saved brand**, so run it after writing the
yaml — or to compare a proposal, write first, preview, and adjust.)

## 5. Save

Write `brand/brand.yaml` (create the folder and `refs/` if missing) in the shape
`profile.example/brand/brand.yaml` documents, keeping the owner's existing comments when
editing. Report what was set, what stayed default, and where refs/docs go.

## Rules

- Writes only inside the active profile's `brand/` folder. The voice card, pillars,
  register, identity.yaml, and all committed code are out of bounds.
- Propose, confirm, then write — never overwrite a brand the owner didn't ask changed.
- Colors are the owner's call: derive and propose, don't dictate.
- Never publishes, never touches queue items or images already attached to them.
