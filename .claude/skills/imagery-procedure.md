# Imagery procedure (shared reference)

This is a shared, **non-invokable** procedure — the single written source for putting an
image onto a queue idea's card. It is referenced by the `imagery` skill (the standalone
entry point) and offered by `queue`/`spark`/`discovery` after a piece is written; it is
never a hidden step inside drafting. Input is a queue idea (usually with its piece already
written); output is one or more rows in the `images` table with files under gitignored
`data/images/`, visible on the idea's Queue card. It never publishes — Publish on the card
ships the image with the piece (LinkedIn upload / web export bundling), and that click is
the owner's.

**The owner picks the image.** Like the take, the visual is theirs: propose concepts,
show candidates, let them choose or redirect. Never attach an image they haven't seen —
concepts are described in a sentence, but a produced image is shown as the image itself
before it attaches, and Unsplash picks are listed with previews.

## THE RULE: supporting visuals, not covers

**The image is the content, not a cover for it.** A chart, a diagram, a photo, a
screenshot — the thing itself, sitting *next to* the post. The post's text is already the
headline; an image that restates that headline in big type (a poster, a title card, a
quote in giant letters) is the failure mode. Every type below is a *supporting visual*.
When you catch yourself typesetting the piece's title or a lone number as the whole image,
stop — that's a book cover, not a supporting visual.

## 0. Read the idea and its piece

Read the queue idea and whatever is written on it (the latest draft for a post idea, the
article body for a `web` idea) — the image must serve the piece's actual argument, not its
topic in general:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {ideaQueueItems,drafts,articles}=await import('./src/db/schema.js');const {eq,desc}=await import('drizzle-orm');const idea=db.select().from(ideaQueueItems).where(eq(ideaQueueItems.id,process.argv[1])).get();const draft=idea?db.select().from(drafts).where(eq(drafts.ideaId,idea.id)).orderBy(desc(drafts.createdAt)).get():null;const article=idea?db.select().from(articles).where(eq(articles.ideaId,idea.id)).get():null;console.log(JSON.stringify({idea,draft,article},null,2))})" "<ideaId>"
```

Also list what's already attached (`GET http://localhost:5174/api/images?ideaId=<id>`) so
you extend, not duplicate.

## 1. Load the brand guidelines

Read the active profile's `brand/` folder — `brand.yaml`, **every image in `brand/refs/`**,
and **every brand document**:

```bash
npx tsx -e "import('./src/profile/brand.js').then(m => console.log(JSON.stringify(m.loadBrand(), null, 2)))"
```

**Branch on the two flags in the output — they are the difference between a brand and a
fallback:**

- **`lookSaved: true`** — a saved look. Everything you produce sits inside it: palette and
  fonts in composed figures, treatments and colors steering generated prompts, refs and
  docs read in full.
- **`lookSaved: false`** — **no look is saved; do not manufacture one.** The colors/fonts
  in the output are only a neutral *rendering* fallback for composed figures (which need
  some palette to exist) — never present them as "your brand," and **never steer a
  generated image by them**: no fallback palette in FLUX prompts, no accent-colored borders
  or frames, no brand-styled treatments. A generated image's style comes from the piece's
  argument and the chosen treatment alone. Two sub-cases:
  - **`exists: true`** — material is attached (logos / refs / docs) without a saved look:
    still read the refs and docs for mood and judgment; only the fallback palette is
    off-limits. Mention the Brand page's AI setup can derive the look from that material.
  - **`exists: false`** — nothing at all: fully unbranded. Say once, plainly, that no brand
    is set up and the Brand page (or the `brand` skill) creates one.

## 2. Propose from the six-type menu

An image does one of a few **jobs** for a piece. Read the piece, then propose the 1-3 types
that genuinely fit *this* argument — each in one plain sentence saying what the viewer sees
and how it serves the piece (not the topic in general). **Always mark one as recommended,
with a one-line why** — a menu with no point of view makes the owner do the thinking; the
recommendation is advice, never a default that self-selects. One short ask; the owner picks
or redirects. If they already asked for something specific, skip the menu and do it.

**A pre-picked producer skips the menu entirely.** The console's Image with AI action
carries a model picker, and when the opening message says the owner pre-picked the
producer, that choice is final: **local** means every image in the run is a generated image
from the named model entry the message gives (pass it as `"model"` in each generate-image
payload); **claude** means every image is a composed figure you author. Do not re-open the
type question or switch producers or models on your own judgment. If the pick fights the
content (e.g. a text-dense table forced into a generated image), say so in one line while
proceeding — flag, never veto.

**A web article gets an image *plan*, not a single image.** Long-form pieces carry several
images inline, so before the type menu, read the article's sections and ask **how many
images it should carry and where** — one line per proposed image naming the section it
supports and what the viewer would see, **with a recommended count and why** ("six
sections; I recommend three — the storage-types comparison, the pricing walk, and the
defaults trap"). The owner sets the plan (more, fewer, different spots — all fine). Every
planned image then runs through the type/candidate flow below, **and each one gets at
least two candidates to pick between.** A post normally takes one image; several on one
idea is fine when asked.

Two axes: the **type** is the job the image does; the **treatment** is the look it wears
(editorial, terminal, hand-drawn, brand-styled…). Pick the type from the piece's job, and
the treatment from the brand look and deliberate variety, so successive posts don't all
look the same.

| Type | The job it does | Producer |
|------|-----------------|----------|
| **Generated image** | Atmosphere, a real-world moment, or a stylized visual metaphor — photoreal *or* illustrated, any treatment. Not precise information. | `generate-image.ts` (local model) |
| **Explainer diagram** | Teach structure — a flow, a decision path, a comparison. | `render-image.ts` (composed) |
| **Data figure** | One clean stat/proportion/trend as a bare figure — bar, dot plot, donut, split bar. | `render-image.ts` (composed) |
| **Comparison table** | A tidy side-by-side of two sets. | `render-image.ts` (composed) |
| **Annotated screenshot** | Point at something real on a live page. | `capture-image.ts` + `annotate-image.ts` |
| **Unsplash photo** | Real photography for pure atmosphere (needs `UNSPLASH_ACCESS_KEY`). | `unsplash-image.ts` |

The composed types (diagram / figure / table) are **bare figures** — a small functional
title at most, no slogan, no ornament, no headline. A generated scene can be upgraded
with a **scene + UI composite** when the piece wants a legible screen in the shot (see
below).

**Check availability before proposing.** The generated type only goes on the menu when its
backend is actually usable (and Unsplash only when its key is set) — check first, so the menu
never offers something that will fail:

```bash
npx tsx -e "import('./src/images/generate.js').then(async m => { const c = m.loadGeneratorConfig(); const models = {}; for (const n of Object.keys(c.models)) models[n] = { available: await m.generatorConfigured(c, n), weightsCached: m.modelWeightsCached(c.models[n]) }; console.log(JSON.stringify({ default: c.default, configured: models[c.default]?.available ?? false, models })) })"
```

A model that is `available` but `weightsCached: false` still works — its first generation
just starts with the one-time multi-GB weights download. Say that plainly **before**
generating with it, and offer `make image-model MODEL=<name>` (or doing the download now in
this session) as the deliberate alternative to stumbling into it.

If the generator is **not** configured, read the one-time opt-out before saying anything:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {appSettings}=await import('./src/db/schema.js');const {eq}=await import('drizzle-orm');const r=db.select().from(appSettings).where(eq(appSettings.key,'image_gen_setup')).get();console.log(r?.value ?? 'unset')})"
```

- `deferred` → leave the generated type off the menu silently (at most one line: "local
  generation is switched off — say the word and I'll set it up").
- anything else → offer it **once**, alongside the menu, in one short ask: set it up now
  (`make image-model` — it installs the tools if missing and pre-downloads the chosen
  weights; plus the one-time Hugging Face steps for gated models; Docs → Setup → *Local
  image generation*), skip it this run, or **don't ask again**. On "don't ask again",
  persist it:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {appSettings}=await import('./src/db/schema.js');db.insert(appSettings).values({key:'image_gen_setup',value:'deferred'}).onConflictDoUpdate({target:appSettings.key,set:{value:'deferred'}}).run();console.log('image_gen_setup=deferred')})"
```

Never block the run on this — every other type keeps working regardless of the answer.

## 3. Produce — per type

All producers are payload-file CLIs; each prints the stored image row as JSON. **Alt text
is mandatory everywhere** — write what the image shows, plainly.

### Generated image — local model (the generative path)

`generate-image.ts` runs a local model — no key, no cloud. Models are **named entries** in
`image-generation.config.json` (FLUX.2 [klein] via headless **`mflux`** by default, with
FLUX.1 [schnell], **`drawthings`** driving the Draw Things app's local API, or any
bring-your-own mflux model as further entries); the payload's optional `"model"` names an
entry, omitted = the config's default. Use the default unless the owner asks for a specific
one. (Availability and the install/defer offer are handled in step 2 — by the time you're
here the default model works.)

**Not everything is photoreal.** One model does every treatment: photoreal photography,
editorial illustration, watercolor, flat vector-style, isometric 3D, collage. Pick treatments
from the brand look and deliberate variety, exactly like the composed types.

**Offer prompt candidates; the owner picks.** Author **2–3 candidate prompts from the piece's
actual argument** — not its topic in general — each in a *different* style or angle, and put
them to the owner as one short ask: for each, a plain sentence of what the viewer would see,
then the prompt itself. **Mark one as recommended and say why in a line** (fit with the
argument, the brand look, variety against recent images) — the owner still picks freely.
Prompts are natural descriptive sentences (not keyword soup): subject, setting, lighting or
materials, mood, treatment. Image models **garble text** (FLUX.2 less than FLUX.1, but never
depend on it), so don't rely on legible words in the image. The owner picks one, edits one,
or redirects.

**Generate in the background; previews land on the card.** A generation takes roughly one to
a few minutes per image — and a model whose weights were never pre-downloaded (setup's
`make image-model`) **fetches them on its first-ever run as a failsafe (~13–24 GB for the
FLUX defaults), which can take much longer**. Two hard rules:

- **Never run generation as a plain foreground command** — the default shell timeout will
  kill it mid-run. Launch it in the background, keep talking, and report as each candidate
  lands. Before starting, tell the owner the expected wait (and the one-time download, if
  this is the first run) so silence never reads as broken — and scale the estimate to the
  wave: a three-image plan at two candidates each is six generations, say that math.
- **Write previews into `data/images/previews/<ideaId>/`** (create the folder first; simple
  safe filenames like `candidate-1-seed42.png`). The console's Images strip polls that folder
  during the session, so candidates appear on the idea's card as they finish — say so.

```bash
# One candidate: repeat with a different "seed" (and filename) for a small batch of the
# winning prompt — output swings run-to-run, so give the owner 2-3 takes to pick from.
mkdir -p data/images/previews/<ideaId>
cat > .image-payload.json <<'JSON'
{ "prompt": "<the winning prompt>", "width": 1024, "seed": 42,
  "out": "data/images/previews/<ideaId>/candidate-1-seed42.png" }
JSON
npx tsx src/images/generate-image.ts .image-payload.json   # ← run in the background
```

Look at each candidate with the Read tool as it lands. When the batch is in, put the pick to
the owner as **one gallery ask showing every candidate**: one option per candidate with that
candidate's file path on the option's `imageFile` (they all render side by side, labeled —
never show just one image for a three-candidate pick), **plus one explicit escape option**
along the lines of *"None of these — start over"* (description: iterate on one candidate's
prompt or seed, write a fresh prompt, or switch to another image type). A tweak or restart
regenerates in the background into the same previews folder; iterate until the owner picks —
their taste decides, not the batch.

**Multi-image plans pick per slot, never across slots.** When the plan has several images
(a web article), launch **every slot's candidates in one background wave** — name the
previews by slot (`slot1-a.png`, `slot1-b.png`, `slot2-a.png`, …) so the card's strip reads
sensibly — then run **one gallery ask per planned image**, in article order, each showing
only that slot's candidates (its two-plus takes side by side, plus the same start-over
escape, naming the section it's for). Ask as each slot's batch completes rather than
holding everything for the slowest; three planned images means three picks of two, never
one six-way pick. Attach each winner as its slot resolves. Attach a winner (same payload
with `ideaId` + `alt` added, `out` removed):

```bash
cat > .image-payload.json <<'JSON'
{ "ideaId": "<ideaId>", "alt": "<what the image shows>", "prompt": "<the winning prompt>", "seed": <the winning seed>, "width": 1024 }
JSON
npx tsx src/images/generate-image.ts .image-payload.json
```

Then **delete the previews folder** (`rm -rf data/images/previews/<ideaId>`) — also when the
owner walks away without attaching — so stale candidates never linger on the card. The same
end-of-run sweep removes the scratch files: payloads and working HTML are always written at
the repo root as `.image-payload*.json` / `.image-graphic*.html` / `.image-card*.html`
(numbered variants when candidates run in parallel — each background run needs its own
payload file). They are gitignored, but leaving them behind is still litter — `rm -f
.image-payload*.json .image-graphic*.html .image-card*.html` when the run ends.

**If generation still fails** (the backend went away mid-session), the CLI exits with a clear
one-line fix (install `mflux`, or enable Draw Things → Advanced → API Server, HTTP :7860).
Relay it, offer another type, and continue — never block the run.

### Scene + UI composite — legible screen in a photo

When the scene should show a real, correct screen (a dashboard, a chart), let the model make the
scene and stamp a crisp card onto the monitor with `compose-scene.ts` (perspective-correct,
via the Playwright renderer — see design 03). Never eyeball corners blind:

1. **Generate** the scene (above), prompted to include a clearly visible, roughly
   front-facing monitor.
2. **Look** at the scene preview and read the screen's **four corners** as percentages of
   the image, order **TL, TR, BR, BL**.
3. **Author the card** as a bare supporting-visual HTML/CSS document (a figure — not a
   poster).
4. **Composite and look:**

```bash
cat > .image-card.html <<'HTML'
<!-- the crisp card: a bare figure -->
HTML
cat > .image-payload.json <<'JSON'
{ "scenePath": "data/images/previews/<ideaId>/candidate-1-seed42.png", "cardHtmlFile": ".image-card.html",
  "corners": [ {"x":12,"y":18}, {"x":48,"y":15}, {"x":50,"y":55}, {"x":14,"y":52} ],
  "out": "data/images/previews/<ideaId>/composite-1.png" }
JSON
npx tsx src/images/compose-scene.ts .image-payload.json
```

Look at the result; if the card is misplaced, re-read the corners and redo (a misaligned
overlay ships a broken image). Attach with `ideaId` + `alt`, `out` removed.

### Composed supporting visual — diagram / figure / table

Author a **bare figure** in HTML/CSS in the brand's language — a diagram, chart, or table
that *is* the content. No headline slogan, no kicker/footer manifesto, no ornament: a small
functional title at most. Render, **look at the preview with the Read tool (mandatory)**,
fix what fails, re-render, look again. It is done only when it depicts the idea, text fits,
the composition is balanced, and color is functional (neutrals carry structure, the primary
marks the focal point). Then show the owner and attach.

```bash
cat > .image-graphic.html <<'HTML'
<!-- the bare figure -->
HTML
cat > .image-payload.json <<'JSON'
{ "htmlFile": ".image-graphic.html", "width": 1200, "out": "/tmp/graphic-preview.png" }
JSON
npx tsx src/images/render-image.ts .image-payload.json
# attach: same payload with "ideaId" + "alt", "out" removed
```

### Annotated screenshot — the look-then-annotate loop

Never eyeball annotation coordinates blind. Preview (`capture-image.ts` with `out`), look at
the PNG and measure marks in **percent** (`unit: "percent"`), then annotate and store
(`annotate-image.ts`). Mark kinds: `box` · `click` · `arrow` · `blur` (**always blur names,
emails, account ids, anything personal that isn't the owner's to publish**). Verify the
stored file once; a misplaced box ships misinformation.

### Unsplash photo

`unsplash-image.ts`: `{ "query": "…", "orientation": "landscape" }` searches; show the top
candidates (photographer + description + preview URL); attach the pick with
`{ "ideaId", "photoId", "alt" }`. Attribution is recorded automatically. Requires
`UNSPLASH_ACCESS_KEY`; if unset, say so and continue with the other types.

## 4. Place it in the piece

- **LinkedIn post** — no inline placement; the Publish modal offers every card image as a
  pick (several makes a multi-photo post). Nothing to write into the draft.
- **Reddit post** — copy-paste channel: the owner downloads the image from the card's strip
  and attaches it on Reddit. Nothing to write into the draft.
- **Web article** — images live **inline in the markdown body**. Agree where each sits,
  insert `![<alt>](image:<imageId>)` at that spot, and save the body with
  `npx tsx src/articles/update-article.ts <payload.json>`. Export rewrites `image:<id>` to
  the bundled file path. An attached image with no ref still exports (frontmatter-only —
  right for a hero the site places itself); say which are inline and which are
  frontmatter-only when reporting.

## 5. Report and stop

Report what was attached (type, dimensions, alt text), where it was placed, and that it
shows on the idea's **Queue card**, where the owner can review or delete it. Publish ships
it with the piece — the owner's click, never this procedure's.

## Rules

- **The image depicts the piece's idea; it is a supporting visual, never a cover.** No
  typeset-a-headline cards, no lone-number posters, no logos on content images unless asked.
- **Every render gets looked at before it attaches** — composed figures, composites, and
  screenshots alike; a render that fails the eye gets fixed, not shipped.
- **Image models garble text and swing run-to-run** — never depend on legible words in a raw
  scene; generate a batch of seeds and let the owner pick the best. And generation is not only
  photoreal — propose illustrated/stylized treatments too, per the brand look and variety.
- **Generation runs in the background, never foreground into the default shell timeout,**
  with previews written to `data/images/previews/<ideaId>/` so they appear live on the
  Queue card; tell the owner the expected wait up front, and delete the folder once a pick
  is attached (or the owner moves on).
- **Graceful degradation.** Source availability is checked in step 2, before the menu. A
  missing generator triggers the one-time set-up-or-defer offer (persisted as
  `image_gen_setup=deferred` in app settings — deferred means omit silently); a missing
  `UNSPLASH_ACCESS_KEY` just drops the stock type with a one-line mention. Never block.
- Alt text on every image, no exceptions.
- Brand guidelines load before anything is produced; refs get viewed, not skipped. And
  `lookSaved: false` means **no look**: the neutral fallback may render a composed figure,
  but it never styles a generated prompt or gets presented as the owner's look (attached
  refs/docs remain fair game for judgment when they exist).
- deviceScaleFactor 2 and PNG intermediates for composed renders; never upscale a photo.
- Blur anything personal in a screenshot that isn't the owner's to publish.
- The owner picks the image; candidates are shown, never silently attached — and "shown"
  means the actual image: a single image rides the ask's `imageFile`; a batch puts each
  candidate's path on its own option's `imageFile` so **all of them** render as a labeled
  gallery. Every batch ask carries a "none of these — start over" escape (iterate on a
  candidate, new prompt, or different type).
- Never publishes, never edits the piece's text (that's the draft/revise procedures).
