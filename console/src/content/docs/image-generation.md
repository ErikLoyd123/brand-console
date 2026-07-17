---
title: Local image generation
category: Setup
order: 6
---

The imagery skill can make **generated images** — a photoreal scene, an editorial illustration, a watercolor, an isometric render, any style one prompt can describe — by running an open image model **locally on your Mac**. No API key, no cloud, nothing leaves your machine, and the shipped defaults are commercial-safe (FLUX.2 [klein] and FLUX.1 [schnell], both Apache-2.0).

> **One exception, and it ships switched off.** The optional `gemini` backend ("Nano Banana") is the only entry here that is *not* local: it sends your prompt to Google. It needs `GEMINI_API_KEY` in `.env` plus billing on the Google Cloud project, and every `gemini` entry in the example config carries `"enabled": false`. Everything else on this page is local and key-free. See [Choosing an image model](#/docs/choosing-an-image-model) for where it fits.

It's **optional but recommended**. Without it, the imagery skill still offers its other types (diagrams, data figures, comparison tables, annotated screenshots, Unsplash) — the generated type is simply left off the menu. The `setup` skill offers this setup once during onboarding (and once to existing installs); answer **"don't ask again"** and it stays quiet for good — you can still opt back in any time from this page's steps or by asking the setup skill. Setup is a one-time thing.

> Requires an **Apple Silicon** Mac (the default `mflux` backend runs on Apple's MLX). On other hardware, use the Draw Things backend below, or skip generation.

## The models are yours to pick

`image-generation.config.json` (repo root, gitignored, machine-specific) declares a set of **named models** and a `default` — the one *Image with AI* uses. Out of the box:

| Entry | What it is | Why |
|-------|-----------|-----|
| `flux2-klein` *(default)* | FLUX.2 [klein] 4B via `mflux-generate-flux2` | Fast, ~13 GB download, strong at readable in-image text, Apache-2.0 |
| `flux1-schnell` | FLUX.1 [schnell] via `mflux-generate` | The previous default (~24 GB); keep it if the weights are already downloaded |
| `drawthings` | The Draw Things app's local API | Reuses a model you already have in the app |

**Bring your own model:** add an entry. Any model mflux can run works — mflux ships one CLI per family (`mflux-generate`, `mflux-generate-flux2`, `mflux-generate-qwen`, `mflux-generate-z-image`, …), so an entry names its `command`, the `model` identifier that command accepts, and per-model tuning (`steps`, `quantize`, `modelPath`, raw `extraArgs`). Change `default` to switch what Image with AI uses. The Connections page shows the whole roster with per-model availability.

## Option A — mflux (headless, the default)

Fully headless — no app to keep open.

**1. Install the tools** (needs [`uv`](https://docs.astral.sh/uv/)):

```bash
make image-gen            # installs mflux + the Hugging Face CLI
# or by hand: uv tool install mflux   (upgrade: uv tool upgrade mflux)
```

`uv` picks a compatible Python automatically. The FLUX.2 [klein] default needs **mflux ≥ 0.18** (which ships `mflux-generate-flux2`) — upgrade if yours is older.

**2. Hugging Face access — only for gated models.** The Apache-2.0 FLUX defaults normally download without a token. If you add a *gated* model (its Hugging Face page shows "Agree and access repository"), accept its license there, create a **Read** token at <https://huggingface.co/settings/tokens>, and log in locally (saves the token to `~/.cache/huggingface`, outside the repo — never committed):

```bash
uv tool install huggingface_hub    # if you don't have `hf`
hf auth login                      # paste the token
```

**3. Configure (optional).** Without a config file the FLUX.2 [klein] default applies. To pick models or tune settings, copy the example and edit:

```bash
cp image-generation.config.example.json image-generation.config.json
```

**4. Download the weights — now (recommended) or on first use.** Each model's weights download once (~13 GB for FLUX.2 [klein], ~24 GB for FLUX.1 [schnell]) into `~/.cache/huggingface`, then every image is fast. Fetch them up front so your first real image doesn't have to wait:

```bash
make image-model                          # asks which models (Enter = default, or several, or "all")
make image-model MODEL=flux1-schnell      # non-interactive: one entry by its config name
make image-model MODEL=all                # non-interactive: every entry
```

It even installs mflux + the `hf` CLI first if they're missing (so on a fresh machine with `uv`, this one command is the whole setup), and each model ends with a tiny test render — a clean finish proves the whole install works. Skipping this is safe — it's the failsafe path: the first generated image triggers the same one-time download automatically before it can render, which makes that first run much longer (the skill tells you when that's happening).

You can always see where you stand: the queue card's model picker marks an installed-but-not-downloaded model with **"needs download"** (and shows a warning with the exact command when you select one), and the **Connections** page's model roster shows the same per-model state.

> **Gotcha, handled for you:** Hugging Face's new "Xet" download backend currently crashes on these large files — the pipeline sets `HF_HUB_DISABLE_XET=1` automatically. If you ever run an mflux command by hand, prefix it with `HF_HUB_DISABLE_XET=1`.

## Option B — Draw Things (reuse a model you already have)

If you already run [Draw Things](https://drawthings.ai/) and downloaded an image model there, you can drive it instead of a second download:

1. In Draw Things: **Advanced → API Server → enable** (HTTP, port 7860, localhost), with your model selected.
2. In `image-generation.config.json`, set `"default": "drawthings"`.

The app must be running when the skill generates. (Note: Draw Things' `.ckpt` model files can't be shared with `mflux` — they're different formats — so a model lives in one backend or the other, not a shared download.)

## Using it

On any queue idea, the card's *Image with AI* button runs the imagery skill against the model chosen in the small picker next to it — every usable local entry is listed (the config's default pre-selected), plus **Claude Fable / Opus / Sonnet** for composed graphics — figures Claude authors itself; the pick sets which Claude model runs that whole imagery session. The skill proposes **2–3 candidate prompts in different styles**, written from your piece's actual argument — you pick one (or edit it), it generates a few takes, and you choose or tweak.

**It takes a few minutes — watch the card, not just the terminal.** Each image takes roughly one to a few minutes, and candidates appear live in the **Images strip on the queue card** as they finish (the strip shows a "session running" note while it works). A model's very first image also downloads its weights (one time) before it can generate, which can take a lot longer — the skill tells you when that's happening. Nothing attaches until you pick.

On-screen text in a generated image can come out garbled (FLUX.2 is markedly better than FLUX.1, but don't depend on it) — the skill can composite a crisp brand card onto a screen in the scene so the text is legible, and anything the reader must *read* (charts, tables, labeled diagrams) is better served by the composed graphic type.
