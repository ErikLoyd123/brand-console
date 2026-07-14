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
//   // logo override: "none" for no logo, or a brand/-relative path to a
//   // specific variant (e.g. "logos/logo_reversed.png" on a dark card).
//   // Omitted → brand.yaml's default logo.
//   "logo"?: "none" | "logos/<file>",
//   // preview mode: write the render to this file and print its dimensions
//   // WITHOUT storing — used by the brand skill to show a test card in the
//   // profile's look. ideaId/alt are not needed; brand comes from the active
//   // profile.
//   "out"?: "/abs/path/preview.png"
// }
//
// Brand colors/fonts/logo come from the idea's profile brand guidelines
// (profiles/<slug>/brand/, defaults when absent). Prints the stored image row as JSON.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { profiles } from '../db/schema';
import { brandDir, loadBrand } from '../profile/brand';
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
  logo?: string;
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

  // Per-card logo pick: "none" drops the logo, a brand/-relative path swaps in
  // a specific variant (reversed on dark grounds, icon in tight squares).
  if (payload.logo) {
    if (payload.logo === 'none') {
      brand.logoPath = null;
    } else {
      const dir = brandDir(profile?.slug);
      const abs = resolve(dir, payload.logo);
      if (abs !== dir && !abs.startsWith(dir + sep)) {
        throw new Error('"logo" must stay inside the brand/ folder');
      }
      if (!existsSync(abs)) throw new Error(`no logo file at ${payload.logo}`);
      brand.logoPath = abs;
    }
  }

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
