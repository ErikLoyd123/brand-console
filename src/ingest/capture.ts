// src/ingest/capture.ts
// Low-friction spark intake. The user's one-liner drops straight into the queue as a
// seeded needs-your-take idea item. This is the only discovery path that originates
// with the user. See design 03-discovery-layer "capture" and the take-origination guardrail.

import { nanoid } from 'nanoid';
import { db } from '../db/client';
import { sparks, ideaQueueItems } from '../db/schema';
import { getPillars, type Pillar } from '../core/pillars';
import { getSilos, type Silo } from '../core/silos';
import { getDefaultPlatform, type Platform } from '../core/registers';
import { getActiveProfileId } from '../profile/loader';

export type CaptureResult = { sparkId: string; ideaId: string };

/**
 * Options for a spark-origin write.
 * - `silo` defaults to 'conversation': a spark is the owner's own thought, and a
 *   lightbulb thought is a conversation post, not a reaction to a feed item.
 * - `seed` overrides the stored seed. `capture` stores the raw text verbatim; `spark`
 *   passes the refined thought the owner converged on. See design
 *   2026-07-02-content-silos/02-spark-skill "The store hook".
 * - `platform` / `tone` pin the register the spark was shaped for. `spark` passes them
 *   from the resolved register selection; `capture` leaves them undefined (null in the
 *   row → drafting uses the profile default). See design
 *   2026-07-03-content-spine-register-axis/01-register-axis.
 */
export type CaptureOptions = {
  silo?: Silo;
  seed?: string;
  platform?: string;
  tone?: string;
  // Developed points — the beats of the argument. `capture` leaves them empty (a raw
  // spark has none yet); `spark`/`develop` may pass them when the walk drew them out.
  points?: string[];
};

/** The default capture pillar: the first pillar declared in the profile. */
function defaultCapturePillar(): Pillar {
  const pillars = getPillars();
  if (pillars.length === 0) throw new Error('captureSpark: profile defines no pillars');
  return pillars[0];
}

/**
 * Store a spark and its linked, already-seeded idea-queue item.
 * @param text the user's raw spark, used verbatim as the seed.
 * @param pillar optional pillar; defaults to the profile's first pillar.
 */
export async function captureSpark(
  text: string,
  pillar?: Pillar,
  opts: CaptureOptions = {},
): Promise<CaptureResult> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('captureSpark: text is empty');

  const chosenPillar = pillar ?? defaultCapturePillar();
  const silo = opts.silo ?? 'conversation';
  // The raw spark is always what lands in the `sparks` row; only the idea's seed can be
  // a refined thought (spark), otherwise it is the verbatim spark (capture).
  const seed = opts.seed?.trim() ? opts.seed.trim() : trimmed;

  const now = Date.now();
  const profileId = getActiveProfileId();
  const sparkId = nanoid();
  await db.insert(sparks).values({ id: sparkId, profileId, text: trimmed, createdAt: now });

  const ideaId = nanoid();
  await db.insert(ideaQueueItems).values({
    id: ideaId,
    profileId,
    pillar: chosenPillar,
    silo,
    // Nullable register columns: undefined opts leave them null (capture's path);
    // spark passes the resolved platform/tone.
    platform: opts.platform?.trim() ? opts.platform.trim() : null,
    tone: opts.tone?.trim() ? opts.tone.trim() : null,
    tag: 'needs-your-take',
    sourceRef: `spark:${sparkId}`,
    proposedAngle: seed.slice(0, 240),
    seed,
    points: (opts.points ?? []).map((p) => p.trim()).filter((p) => p !== ''),
    score: 60, // the user's own spark starts mid-queue; the agent can rescore during a pass
    status: 'seeded',
    createdAt: now,
  });

  return { sparkId, ideaId };
}

// CLI: tsx src/ingest/capture.ts "your spark text" [pillar] [--seed "refined thought"]
//        [--silo <conversation|teach|win|curate>] [--platform <key>] [--tone <key>]
// `capture` uses the two-positional form: silo defaults to 'conversation', seed is the
// verbatim text, and no platform/tone are pinned. `spark` passes --seed with the refined
// thought plus --silo/--platform/--tone from the register it resolved.
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);

  // Pull each `--flag value` pair out; whatever is left is positional.
  const flags: Record<string, string> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      flags[arg.slice(2)] = argv[i + 1] ?? '';
      i++; // consume the value
    } else {
      positionals.push(arg);
    }
  }

  const text = positionals[0];
  const pillar = positionals[1] as Pillar | undefined;
  const seed = flags.seed;
  const silo = flags.silo as Silo | undefined;
  const platform = flags.platform;
  const tone = flags.tone;

  // The intent roster is platform-keyed, so --silo validates against the item's
  // resolved platform: the parsed --platform when given, else the shipped default.
  const resolvedPlatform: Platform =
    platform && platform.trim() ? (platform.trim() as Platform) : getDefaultPlatform();

  const usage =
    `usage: tsx src/ingest/capture.ts "your spark text" [pillar] [--seed "refined thought"] [--silo <${getSilos(resolvedPlatform).join('|')}>] [--platform <key>] [--tone <key>]`;
  if (!text) {
    console.error(usage);
    process.exit(1);
  }
  if (silo !== undefined && !getSilos(resolvedPlatform).includes(silo)) {
    console.error(`invalid --silo "${silo}"; must be one of: ${getSilos(resolvedPlatform).join(', ')}`);
    process.exit(1);
  }

  captureSpark(text, pillar, { seed, silo, platform, tone })
    .then((r) => {
      console.log(`captured spark ${r.sparkId} -> idea ${r.ideaId} (needs-your-take, seeded)`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
