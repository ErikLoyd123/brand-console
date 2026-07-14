// src/images/compose-image.ts
// CLI the imagery procedure invokes to compose a brand-styled graphic and attach it
// to a queue idea. Reads a JSON payload file (like update-article.ts, so multi-line
// text never fights shell escaping):
//
//   npx tsx src/images/compose-image.ts <payload.json>
//
// payload: {
//   "ideaId": "<queue idea id>",
//   "template": "quote" | "stat" | "headline",
//   "inputs": { ...ComposeInputs for that template },
//   "alt": "<alt text — required>",
//   "width"?: 1600, "height"?: 900,
//   // preview mode: write the render to this file and print its dimensions
//   // WITHOUT storing — used by the brand skill to show a test card in the
//   // profile's look. ideaId/alt are not needed; brand comes from the active
//   // profile.
//   "out"?: "/abs/path/preview.png"
// }
//
// Brand colors/fonts/logo come from the idea's profile brand guidelines
// (profiles/<slug>/brand/, defaults when absent). Prints the stored image row as JSON.

import { readFileSync, writeFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { profiles } from '../db/schema';
import { loadBrand } from '../profile/brand';
import { composeImage, type ComposeInputs, type ComposeTemplate } from './compose';
import { requireIdea, storeImage } from './store';

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error('usage: tsx src/images/compose-image.ts <payload.json>');
  process.exit(1);
}

interface Payload {
  ideaId?: string;
  template?: ComposeTemplate;
  inputs?: ComposeInputs;
  alt?: string;
  width?: number;
  height?: number;
  out?: string;
}

async function main() {
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8')) as Payload;
  const preview = typeof payload.out === 'string' && payload.out !== '';
  if (!payload.template || !['quote', 'stat', 'headline'].includes(payload.template)) {
    throw new Error('payload needs a "template": quote | stat | headline');
  }
  if (!preview) {
    if (!payload.ideaId) throw new Error('payload needs an "ideaId" (or "out" for preview mode)');
    if (!payload.alt || payload.alt.trim() === '') {
      throw new Error('payload needs non-empty "alt" text — every image ships with alt text');
    }
  }

  const idea = preview ? null : requireIdea(payload.ideaId!);
  const profile = idea
    ? db.select().from(profiles).where(eq(profiles.id, idea.profileId)).get()
    : undefined;
  // Preview mode has no idea to anchor to: the active profile's brand applies.
  const brand = loadBrand(profile?.slug);

  const composed = await composeImage({
    template: payload.template,
    inputs: payload.inputs ?? {},
    brand,
    width: payload.width,
    height: payload.height,
  });

  if (preview) {
    writeFileSync(payload.out!, composed.buffer);
    console.log(
      JSON.stringify({ out: payload.out, width: composed.width, height: composed.height }, null, 2),
    );
    return;
  }

  const row = storeImage({
    profileId: idea!.profileId,
    ideaId: idea!.id,
    source: 'composed',
    buffer: composed.buffer,
    ext: 'png',
    alt: payload.alt!.trim(),
    width: composed.width,
    height: composed.height,
    params: { template: payload.template, inputs: payload.inputs ?? {} },
  });

  console.log(JSON.stringify(row, null, 2));
}

main().catch((e) => {
  console.error(`compose-image: ${(e as Error).message}`);
  process.exit(1);
});
