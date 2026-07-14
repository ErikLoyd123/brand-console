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
show candidates, let them choose or redirect. Never attach an image they haven't seen
described (composed/screenshot) or listed (Unsplash picks).

## 0. Read the idea and its piece

Read the queue idea and whatever is written on it (the latest draft for a post idea, the
article body for a `web` idea) — the image must serve the piece's actual argument, not its
topic in general:

```bash
npx tsx -e "import('./src/db/client.js').then(async ({db})=>{const {ideaQueueItems,drafts,articles}=await import('./src/db/schema.js');const {eq,desc}=await import('drizzle-orm');const idea=db.select().from(ideaQueueItems).where(eq(ideaQueueItems.id,process.argv[1])).get();const draft=idea?db.select().from(drafts).where(eq(drafts.ideaId,idea.id)).orderBy(desc(drafts.createdAt)).get():null;const article=idea?db.select().from(articles).where(eq(articles.ideaId,idea.id)).get():null;console.log(JSON.stringify({idea,draft,article},null,2))})" "<ideaId>"
```

Also list what's already attached (`GET http://localhost:5174/api/images?ideaId=<id>` or
the same query via tsx) so you extend, not duplicate.

## 1. Load the brand guidelines

Read the active profile's `brand/` folder — `brand.yaml` for the explicit rules,
**every image in `brand/refs/`** (view them with the Read tool; they are the "make it feel
like this" examples), and **every brand document** (`docPaths` — any `.md`/`.html` the
owner dropped in `brand/`: a company brand book, tone guide, or messaging doc; read them
in full). Everything you produce must sit inside this look and tone: the palette, the
fonts, the style notes, the mood of the refs, the rules in the docs. (For the *writing*,
the voice card stays the authority — brand docs inform imagery and visual judgment here.)
When the folder is missing, the neutral default applies — say so, and mention that the
`brand` skill sets it up (or by hand in `brand/`; see `profile.example/brand/` for the
documented shape).

```bash
npx tsx -e "import('./src/profile/brand.js').then(m => console.log(JSON.stringify(m.loadBrand(), null, 2)))"
```

## 2. Propose, let the owner pick

From the piece and the platform, propose 1-3 image concepts, each naming its source:

- **Composed graphic** (`quote` / `stat` / `headline` card) — when the piece has one line,
  number, or claim worth staging. Deterministic, brand-exact.
- **Annotated screenshot** — when the piece points at something real on a live page
  (a product surface, a dashboard, a docs page): capture + highlight box / click ripple /
  arrow, privacy-blur anything personal. The scroll-composite variant stitches several
  scroll stops into one tall image for "here's the whole flow" moments.
- **Unsplash photo** — when the piece wants atmosphere, not information. Requires
  `UNSPLASH_ACCESS_KEY` in `.env` (say so if unconfigured, and continue with the other
  sources).
- **Curate from an example** — when the owner points at a reference ("like this")
  mid-run: view it, extract what defines it (palette, composition, mood), apply that
  through one of the sources above, and offer to save it into `brand/refs/` so future runs
  match it too.

One short ask; the owner picks or redirects. If they asked for something specific already,
skip the menu and do that.

## 3. Produce — per source

All producers are payload-file CLIs (multi-line text never fights shell escaping); each
prints the stored image row as JSON. **Alt text is mandatory everywhere** — write what the
image shows, plainly, as part of producing it.

### Composed graphic

```bash
cat > .image-payload.json <<'JSON'
{
  "ideaId": "<ideaId>",
  "template": "quote",
  "inputs": { "text": "<the line>", "attribution": "<who, optional>" },
  "alt": "<what the card says/shows>"
}
JSON
npx tsx src/images/compose-image.ts .image-payload.json
rm .image-payload.json
```

Templates and their inputs: `quote` (text, attribution) · `stat` (value, label, context) ·
`headline` (kicker, title, subtitle). Default canvas 1600x900; pass width/height to
override. Colors/fonts/logo come from the brand guidelines automatically. When the brand
carries several logo variants (`logoPaths`, under `brand/logos/`), pick per occasion with
the `"logo"` payload key — a brand-relative path (e.g. the reversed variant on a dark
card, the icon in a tight square) or `"none"`; omitted means brand.yaml's default.

### Annotated screenshot — the look-then-annotate loop

Never eyeball annotation coordinates blind. Three steps:

1. **Preview** — capture without storing (`"out"` mode). Deep options when needed:
   `viewport` (default 1600x1000), `deviceScaleFactor` (default 2 — keep it),
   `fullPage`, `clip`, `hideSelectors` (strip dev badges/banners), `waitForSelector`,
   `waitMs`, `scrollTo` (y px or a selector). Scroll-composite: `stitchStops` (array of
   option overrides, one per stop) + `stitchGap`.

```bash
cat > .image-payload.json <<'JSON'
{ "url": "<page>", "out": "/tmp/preview.png" }
JSON
npx tsx src/images/capture-image.ts .image-payload.json
```

2. **Look** — view the preview PNG with the Read tool and measure where the marks go, in
   **percent** of the image (`unit: "percent"` survives scale changes).

3. **Annotate and store** — bake the marks and attach:

```bash
cat > .image-payload.json <<'JSON'
{
  "ideaId": "<ideaId>",
  "file": "/tmp/preview.png",
  "url": "<page>",
  "alt": "<what the screenshot shows>",
  "marks": [
    { "kind": "box", "unit": "percent", "x": 24, "y": 25, "w": 52, "h": 22 },
    { "kind": "blur", "unit": "percent", "x": 10, "y": 6, "w": 20, "h": 4 }
  ]
}
JSON
npx tsx src/images/annotate-image.ts .image-payload.json
rm .image-payload.json
```

Mark kinds: `box` (rounded highlight rect), `click` (cursor + ripple on a control),
`arrow` (`x,y` tail → `x2,y2` head), `blur` (privacy — **always blur names, emails,
account ids, anything personal that isn't the owner's to publish**). Color defaults to the
brand primary. A capture with no marks needed can skip the loop and run
`capture-image.ts` with `ideaId`/`alt`/`marks` directly.

4. **Verify** — view the stored file (its row's `path` under `data/images/`) once; a
   misplaced box ships misinformation. Delete and redo if wrong
   (`DELETE /api/images/<id>`).

### Unsplash photo

```bash
cat > .image-payload.json <<'JSON'
{ "query": "<search terms>", "orientation": "landscape" }
JSON
npx tsx src/images/unsplash-image.ts .image-payload.json
```

Show the owner the top candidates (photographer + description + preview URL), let them
pick, then attach with `{ "ideaId": "…", "photoId": "…", "alt": "…" }` through the same
CLI. Attribution (photographer, page URL) is recorded on the row automatically — for a
web article, credit the photographer in the caption or nearby text.

## 4. Place it in the piece

Where an image *goes* depends on the lane:

- **LinkedIn post** — there is no inline placement: LinkedIn attaches images below the
  post text. The Publish modal offers every card image as a pick, and picking several
  makes a multi-photo post. Nothing to write into the draft.
- **Reddit post** — copy-paste channel: the owner downloads the image from the card's
  strip and attaches it on Reddit themselves. Nothing to write into the draft.
- **Web article** — images live **inline in the markdown body**. After storing, agree
  with the owner where each one sits (propose a spot — usually right after the section
  it illustrates, or above the first heading as a hero), then insert a reference at that
  spot and save the body through the article CLI:

  ```markdown
  ![<the image's alt text>](image:<imageId>)
  ```

  Write the body back with `npx tsx src/articles/update-article.ts <payload.json>`
  (`{ "id": "<articleId>", "body": "<body with the ref inserted>" }`). The
  `image:<imageId>` form is canonical — export rewrites it to the bundled file's
  relative path (`images/<slug>/<file>`). Several images means several refs, each where
  it belongs. An attached image with no ref still exports (bundled + listed in the
  frontmatter) — that is the right shape for a hero the consuming site places itself;
  say which images are inline and which are frontmatter-only when reporting.

## 5. Report and stop

Report what was attached (source, dimensions, alt text), where it was placed (inline
spot for a web article; "offered at Publish" for LinkedIn; "download from the strip" for
Reddit), and that it shows on the idea's **Queue card**, where the owner can review or
delete it. Publish ships it with the piece — the owner's click, never this procedure's.

## Rules

- Alt text on every image, no exceptions.
- Brand guidelines load before anything is produced; refs get viewed, not skipped.
- deviceScaleFactor 2 and PNG intermediates for screenshots; single compression pass;
  never upscale.
- Blur anything personal in a screenshot that isn't the owner's to publish.
- The owner picks the image; candidates are shown, never silently attached.
- Never publishes, never edits the piece's text (that's the draft/revise procedures).
