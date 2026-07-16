// src/images/generate-image.ts
// CLI the imagery procedure invokes for the LOCAL GENERATIVE source. The model
// comes from image-generation.config.json's named `models` (FLUX.2 [klein] by
// default; FLUX.1 [schnell], Draw Things, or any bring-your-own mflux entry), run
// fully locally. No API key. Two modes, both via a JSON payload file (mirrors
// render-image.ts / unsplash-image.ts):
//
//   npx tsx src/images/generate-image.ts <payload.json>
//
// Preview (no ideaId — writes the PNG to `out`, prints {out,width,height}, does NOT
// store; this is the show-a-batch-and-let-the-owner-pick loop):
//   { "prompt": "photorealistic ...", "out": "/tmp/scene.png", "width"?: 1024,
//     "seed"?: 42, "model"?: "flux2-klein" }
//
// Attach (stores the chosen image against the idea; alt is mandatory):
//   { "ideaId": "<queue idea id>", "alt": "<what the image shows>", "prompt": "…",
//     "width"?: 1024, "seed"?: 42, "model"?: "flux2-klein" }
//
// `model` names an entry in the config's `models` map; omitted = the config's
// default. When the requested model isn't available the CLI exits with a clear
// message the skill catches, then continues offering the other image types.

import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateImage } from './generate';
import { requireIdea, storeImage } from './store';

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error('usage: tsx src/images/generate-image.ts <payload.json>');
  process.exit(1);
}

interface Payload {
  prompt?: string;
  // Named model entry from image-generation.config.json; omitted = its default.
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  ideaId?: string;
  alt?: string;
  out?: string;
}

async function main() {
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8')) as Payload;
  const preview = typeof payload.out === 'string' && payload.out !== '';

  if (!payload.prompt || payload.prompt.trim() === '') {
    throw new Error('payload needs a non-empty "prompt"');
  }

  if (preview) {
    const shot = await generateImage({
      prompt: payload.prompt,
      model: payload.model,
      width: payload.width,
      height: payload.height,
      steps: payload.steps,
      seed: payload.seed,
      outPath: payload.out!,
    });
    // Backend-agnostic: some backends write outPath themselves, some return only a
    // buffer — persist it either way so the preview file always exists.
    writeFileSync(payload.out!, shot.buffer);
    console.log(JSON.stringify({ out: payload.out, width: shot.width, height: shot.height }, null, 2));
    return;
  }

  if (!payload.ideaId) throw new Error('payload needs an "ideaId" (or "out" for preview mode)');
  if (!payload.alt || payload.alt.trim() === '') {
    throw new Error('payload needs non-empty "alt" text — every image ships with alt text');
  }

  const idea = requireIdea(payload.ideaId);
  const tmp = join(tmpdir(), `gen-${process.pid}-${Date.now()}.png`);
  try {
    const shot = await generateImage({
      prompt: payload.prompt,
      model: payload.model,
      width: payload.width,
      height: payload.height,
      steps: payload.steps,
      seed: payload.seed,
      outPath: tmp,
    });
    const row = storeImage({
      profileId: idea.profileId,
      ideaId: idea.id,
      source: 'generated',
      buffer: shot.buffer,
      ext: 'png',
      alt: payload.alt.trim(),
      width: shot.width,
      height: shot.height,
      params: shot.params,
    });
    console.log(JSON.stringify(row, null, 2));
  } finally {
    try {
      rmSync(tmp, { force: true });
    } catch {
      /* temp file may already be gone */
    }
  }
}

main().catch((e) => {
  console.error(`generate-image: ${(e as Error).message}`);
  process.exit(1);
});
