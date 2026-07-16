---
title: Choosing an image model
category: Reference
order: 6
---

Image with AI offers several models. This page says which one to pick for which kind of
image, and why. The imagery skill uses these same rules to propose a model for you — this
is the reasoning behind its pick, and the reference if you want to override it.

**Every claim here comes from images you can look at.** The same prompt was put through
every model, and the results are on [System → Image models](#/imagemodels) — 40 images
across 10 kinds of image, side by side. If you only read one thing, look at the data chart
row there; it makes the argument faster than this page can.

## The one question that decides it

**Does the reader have to *read* anything in the image?**

That single question routes you, and it matters far more than which model is "best".

- **Yes — words, numbers, labels, axes.** Use a **Claude** model. It writes an HTML/CSS
  document that is rasterized by a real browser, so the text is typeset, not drawn. Every
  character is exactly what you wrote.
- **No — a mood, a scene, a texture, a metaphor.** Use a **local diffusion model**
  (FLUX.2 [klein] by default). It makes photographs and paintings; Claude cannot.

Getting this wrong is not a near miss, it's an unusable image. The two families fail in
opposite directions, and neither failure is fixable by re-prompting.

## The scoreboard

Every model scored 1–10 for every kind of image, from the test below. **Image with AI reads
this table live** — it picks the best-scoring model you actually have installed, tells you
what it picked and why, and will still do it your way if you override it.

**9–10** the right tool · **7–8** solid · **4–6** works, with visible weaknesses ·
**1–3** it will disappoint

| Image type | Reader reads it? | FLUX.2 [klein] | FLUX.1 [schnell] | Claude | Unsplash |
|---|---|:---:|:---:|:---:|:---:|
| **Data figure** (chart, axis, values) | yes | 1 | 1 | **10** | — |
| **Comparison table** | yes | 1 | 1 | **10** | — |
| **Quote card** (a sentence, a big number) | yes | 2 | 2 | **10** | — |
| **Explainer diagram** (labeled boxes, arrows) | yes | 3 | 4 | **10** | — |
| **Illustration** (flat vector) | no | 7 | 6 | **8** | 2 |
| **Illustration** (textured / painterly) | no | **7** | 6 | 3 | 2 |
| **Abstract metaphor** (no text) | no | **9** | 6 | 5 | 4 |
| **Photoreal scene / object / flat-lay** | no | **8** | 7 | 1 | 7 |
| **Portrait / people** | no | **8** | 7 | 1 | 7 |

**Read the gaps, not just the winners.** Where a row is 10-vs-1 there's nothing to weigh:
using diffusion for a chart doesn't give you a rougher chart, it gives you a *wrong* one.
Where a row is close — illustration at 8/7/6, abstract at 9/6/5 — it's a real judgment call
and the treatment decides it.

**Illustration is the interesting one.** Flat vector is squarely in SVG's wheelhouse, and
Claude wins it outright — it holds an idea together across the whole canvas where diffusion
renders a vibe. But it has no texture: ask for grain or paint and Claude drops to a 3. Pick
by whether the illustration's value is *the concept* or *the surface*.

**Claude scoring 1 on photos doesn't mean it refuses.** If you ask it for a photo it will
make one — it'll just tell you first that you're getting an uncanny vector figure with
mitten hands. The score is advice, not a lock.

## The models

| | FLUX.2 [klein] | FLUX.1 [schnell] | Claude Opus | Claude Sonnet |
|---|---|---|---|---|
| Makes | A picture | A picture | A document, rasterized | A document, rasterized |
| Text in image | Unreliable | Unreliable | **Exact** | **Exact** |
| Photoreal | **Yes** | **Yes** | No | No |
| Speed | ~10 s | ~30 s | Authoring time + ~2 s render | Authoring time + ~2 s render |
| Peak memory | ~18 GB | ~36 GB | None (local render only) | None |
| Runs offline | **Yes** | **Yes** | No | No |

**FLUX.2 [klein] is the right local default.** It's ~3x faster than FLUX.1 at half the
memory, and it follows the brief more reliably — layout, count, color, and lighting
direction. FLUX.1 is worth keeping only if its weights are already downloaded; it's more
saturated and dramatic, which occasionally suits a landscape.

**Opus over Sonnet when the figure carries weight.** Both typeset perfectly and both beat
diffusion on every read-it type, so Sonnet is fine for a simple chart or table. Opus is
better when the image has to *hold an idea together*: richer tables, better use of the
canvas, and it doesn't drop elements of the brief.

## Why these rules say what they say

Every model above was given the same ten prompts at the same size, one prompt per model,
and the results compared side by side.

- On a bar chart, both Claude tiers produced a correct figure: six bars, correctly ordered,
  a monotonic axis, the value printed. Both diffusion models produced a chart whose y-axis
  read `1500, 500, 400, 500, 250, 200` with months labeled `Jam, Uarm, Sun, Surn, Mott, Jun`.
- On a comparison table, diffusion left an entire column empty and scattered row labels
  into the wrong cells. Claude's table was publishable.
- On a pull quote, diffusion rendered *"Most cloud wase is a forrecstuing problem, not an
  engginesnening problomm."* Short uppercase words sometimes survive; a sentence never does.
- On a photoreal portrait, Claude produced an uncanny geometric figure — no skin, no depth
  of field. That's the 1/10 above: not a near miss, a different tool.
- On an abstract metaphor with no text, FLUX.2 produced the best image in the whole test.

The short version: **diffusion cannot spell, and Claude cannot photograph.** Everything
else is detail.

## Caveats worth knowing

- The diffusion results are at **4 steps**, the shipped default. More steps may improve
  their text, but not enough to change any recommendation here — a mis-rendered axis is a
  wrong figure, not a blurry one.
- Claude's "~2 s" is only the render. The authoring step costs a model call, so a composed
  graphic is not necessarily faster end to end — it's just *correct*.
- Claude models need a network connection. If you're offline, the local FLUX models are
  your only option, and read-it images are off the table until you're back.

Models are managed on [Connections](#/connections). Local model entries and the default
live in `image-generation.config.json` — see [Local image generation](#docs/image-generation).
