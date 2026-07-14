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
//   "width"?: 1600, "height"?: 900
// }
//
// Brand colors/fonts/logo come from the idea's profile brand guidelines
// (profiles/<slug>/brand/, defaults when absent). Prints the stored image row as JSON.

import { readFileSync } from 'node:fs';
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
}

async function main() {
  const payload = JSON.parse(readFileSync(payloadPath, 'utf8')) as Payload;
  if (!payload.ideaId) throw new Error('payload needs an "ideaId"');
  if (!payload.template || !['quote', 'stat', 'headline'].includes(payload.template)) {
    throw new Error('payload needs a "template": quote | stat | headline');
  }
  if (!payload.alt || payload.alt.trim() === '') {
    throw new Error('payload needs non-empty "alt" text — every image ships with alt text');
  }

  const idea = requireIdea(payload.ideaId);
  const profile = db.select().from(profiles).where(eq(profiles.id, idea.profileId)).get();
  const brand = loadBrand(profile?.slug);

  const composed = await composeImage({
    template: payload.template,
    inputs: payload.inputs ?? {},
    brand,
    width: payload.width,
    height: payload.height,
  });

  const row = storeImage({
    profileId: idea.profileId,
    ideaId: idea.id,
    source: 'composed',
    buffer: composed.buffer,
    ext: 'png',
    alt: payload.alt.trim(),
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
