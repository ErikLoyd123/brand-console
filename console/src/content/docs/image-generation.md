---
title: Local image generation
category: Setup
order: 6
---

The imagery skill can make **generated images** — a photoreal scene, an editorial illustration, a watercolor, an isometric render, any style one prompt can describe — by running an open image model **locally on your Mac**. No API key, no cloud, nothing leaves your machine, and it's commercial-safe (FLUX.1 [schnell], Apache-2.0).

It's **optional but recommended**. Without it, the imagery skill still offers its other types (diagrams, data figures, comparison tables, annotated screenshots, Unsplash) — the generated type is simply left off the menu. The `setup` skill offers this setup once during onboarding (and once to existing installs); answer **"don't ask again"** and it stays quiet for good — you can still opt back in any time from this page's steps or by asking the setup skill. Setup is a one-time thing.

> Requires an **Apple Silicon** Mac (the default `mflux` backend runs on Apple's MLX). On other hardware, use the Draw Things backend below, or skip generation.

## Option A — mflux (headless, the default)

Fully headless — no app to keep open.

**1. Install the tool** (needs [`uv`](https://docs.astral.sh/uv/)):

```bash
uv tool install mflux
```

`uv` picks a compatible Python automatically.

**2. Get access to the FLUX weights.** They're free (Apache-2.0) but gated on Hugging Face, so you accept the terms once and authenticate:

- Accept the license: open <https://huggingface.co/black-forest-labs/FLUX.1-schnell> and click **"Agree and access repository"** (create a free HF account if needed).
- Create a **Read** token: <https://huggingface.co/settings/tokens>.
- Log in locally (saves the token to `~/.cache/huggingface`, outside the repo — never committed):

```bash
uv tool install huggingface_hub    # if you don't have `hf`
hf auth login                      # paste the token
```

**3. Configure.** Copy the example config and leave the default backend:

```bash
cp image-generation.config.example.json image-generation.config.json
```

The real config is gitignored (machine-specific). Default `"backend": "mflux"` is all you need; `steps`, `width`, `height`, and `quantize` are adjustable there.

**4. First run downloads the model** (~24 GB, one time) and then it's fast. The imagery skill triggers this automatically; the download runs before the first image.

> **Two gotchas, both handled for you:** the FLUX repo is *gated* (step 2 covers it), and Hugging Face's new "Xet" download backend currently crashes on these large files — the pipeline sets `HF_HUB_DISABLE_XET=1` automatically. If you ever run `mflux-generate` by hand, prefix it with `HF_HUB_DISABLE_XET=1`.

## Option B — Draw Things (reuse a model you already have)

If you already run [Draw Things](https://drawthings.ai/) and downloaded FLUX.1 [schnell] there, you can drive it instead of a second download:

1. In Draw Things: **Advanced → API Server → enable** (HTTP, port 7860, localhost), with FLUX.1 [schnell] selected.
2. In `image-generation.config.json`, set `"backend": "drawthings"`.

The app must be running when the skill generates. (Note: Draw Things' `.ckpt` model files can't be shared with `mflux` — they're different formats — so it's one backend or the other, not a shared download.)

## Using it

On any queue idea, run the **imagery** skill (or the card's *Image with AI* button) and pick the **generated image** type. The skill proposes **2–3 candidate prompts in different styles**, written from your piece's actual argument — you pick one (or edit it), it generates a few takes, and you choose or tweak.

**It takes a few minutes — watch the card, not just the terminal.** Each image takes roughly one to a few minutes, and candidates appear live in the **Images strip on the queue card** as they finish (the strip shows a "session running" note while it works). The very first image also downloads the model weights (~24 GB, one time) before it can generate, which can take a lot longer — the skill tells you when that's happening. Nothing attaches until you pick.

On-screen text in a generated image will be garbled — that's expected; the skill can composite a crisp brand card onto a screen in the scene so the text is legible.
