// src/profile/init-default-profile.ts
// One-time, idempotent backfill that carries a pre-multi-profile install into the
// plural-profile world. Run once via `npx tsx src/profile/init-default-profile.ts`
// (or `npm run db:init-profiles`) after `npm run db:migrate`. Safe to re-run: it
// no-ops once any profiles row exists. Reads the gitignored profile/ dir at runtime
// and commits no user data. See design
// 2026-07-13-multi-profile-longform-lane/01-profile-model (Migration path, step 2).

import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { appSettings, profiles } from '../db/schema';
import { REPO_ROOT, parseIdentity } from './loader';

// Lowercase kebab-case slug derived from a display name; falls back to 'default'.
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'default';
}

function main(): void {
  // 1. Already migrated (or a fresh setup created a profile) — nothing to do.
  const existing = db.select().from(profiles).all();
  if (existing.length > 0) {
    console.log('init-default-profile: a profiles row already exists; nothing to do.');
    return;
  }

  // 2. Fresh clone: no legacy profile/ to migrate. Onboarding + setup create the first.
  const legacyDir = resolve(REPO_ROOT, 'profile');
  if (!existsSync(legacyDir)) {
    console.log('init-default-profile: no profile/ directory found; nothing to migrate.');
    return;
  }

  // 3. Read the legacy identity, derive display_name + slug, insert the 'default' row —
  // the same id every step-1-backfilled content row already points at.
  const identity = parseIdentity(readFileSync(resolve(legacyDir, 'identity.yaml'), 'utf8'));
  const displayName = identity.display_name.trim() || 'Default';
  const slug = slugify(displayName);
  db.insert(profiles)
    .values({ id: 'default', slug, displayName, kind: 'personal' })
    .run();

  // 4. Move profile/ -> profiles/<slug>/.
  const targetParent = resolve(REPO_ROOT, 'profiles');
  mkdirSync(targetParent, { recursive: true });
  renameSync(legacyDir, resolve(targetParent, slug));

  // 5. Seed the active-profile pointer if unset — the migrated profile starts active.
  const active = db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, 'active_profile_id'))
    .all();
  if (active.length === 0) {
    db.insert(appSettings).values({ key: 'active_profile_id', value: 'default' }).run();
  }

  console.log(
    `init-default-profile: migrated profile/ -> profiles/${slug}/ (profile id 'default', active).`,
  );
}

main();
