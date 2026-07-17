// src/images/recommend.ts
// The single source of truth for "which model should make THIS image?".
//
// Both the imagery skill and the console read this, so the recommendation the skill
// speaks and the one the console pre-selects can never drift apart.
//
// It is a SCORED MATRIX, not a verdict. Every (type, model) pair carries a 1-10 score and
// a one-line reason, so the skill gets the whole picture and can reason instead of obeying:
// it recommends the best-scoring model that's actually installed, but it can still honour
// "no, use Claude for the photo" — while saying plainly that it'll score 2/10 and why.
// Nothing here refuses on the owner's behalf. It advises; the owner decides.
//
// The scores are empirical. Every one comes from putting the SAME prompt through every
// model across ten kinds of image and comparing the results side by side. The evidence is
// in the console: System → Image models (the renders) and Docs → Choosing an image model
// (the plain-language version). The one-line summary of the whole matrix:
//
//   Diffusion cannot spell. Claude cannot photograph.
//
// Availability only ever constrains diffusion. The composed path is Claude authoring an
// HTML document in-session that Chromium rasterizes locally, so it needs no download and
// no key — a read-it type always has a 10/10 option, even on a fresh clone.
//
// CLI (what the skill calls):
//   npx tsx src/images/recommend.ts            # every type, scored, with live availability
//   npx tsx src/images/recommend.ts data-figure

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generatorConfigured,
  loadGeneratorConfig,
  modelEnabled,
  modelWeightsCached,
  type GeneratorConfig,
  type ModelConfig,
} from './generate';
import { unsplashConfigured } from './unsplash';

// ---- scoring vocabulary ----

// The producers we have actually measured. A config entry maps onto one of these by its
// model IDENTIFIER (not its config key), so a bring-your-own entry named anything still
// scores correctly when it's a model we've tested. Anything we haven't tested scores
// `null` — honestly unknown, never guessed.
export type ScoredModel = 'flux2-klein' | 'flux1-schnell' | 'claude' | 'unsplash';

export interface Score {
  // 1-10. See BANDS for what the numbers mean.
  score: number;
  // Why — written to be said out loud by the skill.
  note: string;
}

// What a score means. The skill uses these words so its advice is consistent.
export const BANDS = [
  { min: 9, label: 'excellent', gloss: 'the right tool for this' },
  { min: 7, label: 'good', gloss: 'solid; minor compromises' },
  { min: 4, label: 'workable', gloss: 'it works, with visible weaknesses' },
  { min: 1, label: 'poor', gloss: "it will disappoint — don't use it unless you mean to" },
] as const;

export function band(score: number): (typeof BANDS)[number] {
  return BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1];
}

// The score at or below which we actively advise against a pick, even while doing it.
export const DISCOURAGED_AT = 3;

// Where an UNMEASURED model ranks. It keeps `score: null` in the output — we never invent
// a measurement — but it has to sort somewhere, and "we've never tested this" must not
// rank below "we tested this and it cannot do the job". A bring-your-own model and the
// Draw Things entry are both unmeasured by construction (the entry names no model, or
// names one we never ran), and sorting them under a 1/10 meant recommending Claude to
// photograph while ignoring the working diffusion model the owner actually installed.
//
// 5 = the midpoint of the 'workable' band: unknown, so neither trusted nor written off.
// It never displaces a measured 7+ (a known-good model still wins) and never beats
// Claude's 10 on a read-it type (the doctrine holds), but it does beat a measured ≤4.
export const UNMEASURED_PRIOR = 5;

// ---- the type roster + the matrix ----

// How the image gets made and WHERE it runs — 'diffusion' is a model on this machine,
// 'cloud' is a model on someone else's. That distinction is the repo's whole privacy
// story, so it lives in the family and never gets blurred into "generated".
export type ImageFamily = 'diffusion' | 'cloud' | 'composed' | 'photo-library' | 'capture';

export type ImageTypeId =
  | 'generated-photo'
  | 'abstract-metaphor'
  | 'illustration'
  | 'explainer-diagram'
  | 'data-figure'
  | 'comparison-table'
  | 'quote-card'
  | 'annotated-screenshot'
  | 'unsplash-photo';

export interface ImageTypeMeta {
  id: ImageTypeId;
  label: string;
  job: string;
  // Does the reader have to READ something in it? The question that drives the scores.
  readable: boolean;
  producer: string;
  // 1-10 per measured producer. A producer absent from this map simply doesn't apply
  // to the type (e.g. Unsplash can't make a diagram).
  scores: Partial<Record<ScoredModel, Score>>;
}

export const IMAGE_TYPES: ImageTypeMeta[] = [
  {
    id: 'generated-photo',
    label: 'Generated photo',
    job: 'A real-world moment, person, place, or object. Photoreal.',
    readable: false,
    producer: 'generate-image.ts',
    scores: {
      'flux2-klein': {
        score: 8,
        note: 'Photographs properly, and holds the brief — it was the only model to satisfy every spatial constraint in our flat-lay test, and it gets hands and light direction right.',
      },
      'flux1-schnell': {
        score: 7,
        note: 'A real photograph too, just 3x slower at ~36 GB peak, and it drifts on stated details (it lit the portrait from the wrong side).',
      },
      unsplash: {
        score: 7,
        note: "Actual photography, so it's real in a way nothing generated is — but you take what exists rather than the exact shot you described.",
      },
      claude: {
        score: 1,
        note: 'It cannot photograph. You get an uncanny CSS/SVG figure — flat shading, mitten hands, no depth of field. This is the single worst cell in the matrix.',
      },
    },
  },
  {
    id: 'abstract-metaphor',
    label: 'Abstract metaphor',
    job: 'A mood or concept with no text — drift, pressure, scale, momentum.',
    readable: false,
    producer: 'generate-image.ts',
    scores: {
      'flux2-klein': {
        score: 9,
        note: 'Diffusion at its best: no text to get wrong. This produced the single strongest image in the whole bake-off.',
      },
      'flux1-schnell': {
        score: 6,
        note: 'Capable but less faithful — it read "grid" as neon tubes and drifted from the brief.',
      },
      claude: {
        score: 5,
        note: 'Genuinely competes — it can build a fraying grid in SVG — but it reads busier and less cinematic than diffusion.',
      },
      unsplash: {
        score: 4,
        note: 'Stock abstracts exist but rarely match a specific metaphor; expect to settle.',
      },
    },
  },
  {
    id: 'illustration',
    label: 'Illustration',
    job: 'A stylized drawing — flat vector, or textured/painterly.',
    readable: false,
    producer: 'generate-image.ts / render-image.ts',
    scores: {
      claude: {
        score: 8,
        note: 'For FLAT VECTOR it beat both diffusion models outright — it holds the idea together across the canvas (it was the only one to read "a sea of stars" as an actual sea). It has no grain or paint, so score this ~3 if you want texture.',
      },
      'flux2-klein': {
        score: 7,
        note: 'Strong on texture and grain — the things CSS simply cannot do — but it renders a vibe rather than an idea.',
      },
      'flux1-schnell': { score: 6, note: 'Similar to FLUX.2 here, slower, and looser on the brief.' },
      unsplash: { score: 2, note: "It's a photo library; it doesn't draw." },
    },
  },
  {
    id: 'explainer-diagram',
    label: 'Explainer diagram',
    job: 'Teach structure — a flow, a decision path, a comparison.',
    readable: true,
    producer: 'render-image.ts',
    scores: {
      claude: {
        score: 10,
        note: 'Real typesetting in a real browser: labels are exactly what you wrote, and it honours the exact colours asked for.',
      },
      'flux1-schnell': {
        score: 4,
        note: 'It can spell SHORT uppercase words, so a three-box diagram sometimes survives — but it ignored the requested colours.',
      },
      'flux2-klein': {
        score: 3,
        note: 'Gets colours right, then misspells the labels — it produced "INGSEST" and "PUBLISSH". A diagram with a typo is a broken diagram.',
      },
    },
  },
  {
    id: 'data-figure',
    label: 'Data figure',
    job: 'One clean stat, proportion, or trend as a bare figure.',
    readable: true,
    producer: 'render-image.ts',
    scores: {
      claude: {
        score: 10,
        note: 'The axis is truthful and the numbers are the numbers. This is the widest gap in the matrix.',
      },
      'flux1-schnell': {
        score: 1,
        note: 'It invents the axis. Ours read 1500, 500, 400, 500, 250, 200 with months labelled "Jam, Uarm, Sun, Surn, Mott, Jun". A chart that lies is worse than no chart.',
      },
      'flux2-klein': {
        score: 1,
        note: 'Same failure: it drew three bars instead of six, rising when the brief said falling, with a garbled axis. Not fixable by re-prompting.',
      },
    },
  },
  {
    id: 'comparison-table',
    label: 'Comparison table',
    job: 'A tidy side-by-side of two sets.',
    readable: true,
    producer: 'render-image.ts',
    scores: {
      claude: {
        score: 10,
        note: 'Real columns, real cells, correct text — publishable as-is.',
      },
      'flux2-klein': {
        score: 1,
        note: 'Unusable: it scattered row labels into the wrong columns and titled it "Reserved vs On-Domd".',
      },
      'flux1-schnell': {
        score: 1,
        note: 'Unusable: it left the entire right-hand column empty and rendered cells as "Cnrilmeet:".',
      },
    },
  },
  {
    id: 'quote-card',
    label: 'Quote card',
    job: 'A sentence rendered exactly — a pull quote or a big number.',
    readable: true,
    producer: 'render-image.ts',
    scores: {
      claude: {
        score: 10,
        note: 'A sentence rendered exactly, which is the entire job.',
      },
      'flux2-klein': {
        score: 2,
        note: 'A full sentence destroys it: "Most cloud wase is a forrecstuing problem, not an engginesnening problomm."',
      },
      'flux1-schnell': {
        score: 2,
        note: 'Same — it duplicated words and mangled the rest. Short words sometimes survive; sentences never do.',
      },
    },
  },
  {
    id: 'annotated-screenshot',
    label: 'Annotated screenshot',
    job: 'Point at something real on a live page.',
    readable: true,
    producer: 'capture-image.ts + annotate-image.ts',
    // A real screenshot of a real page — no model makes it, so there is nothing to score.
    scores: {},
  },
  {
    id: 'unsplash-photo',
    label: 'Unsplash photo',
    job: 'Real photography for pure atmosphere (needs UNSPLASH_ACCESS_KEY).',
    readable: false,
    producer: 'unsplash-image.ts',
    scores: {
      unsplash: { score: 8, note: 'Real photography, free of any generated-image tell.' },
    },
  },
];

// ---- mapping this machine's config onto the scored producers ----

const IDENTITY: { match: RegExp; as: ScoredModel }[] = [
  { match: /flux2[-_]?klein/i, as: 'flux2-klein' },
  { match: /schnell/i, as: 'flux1-schnell' },
];

export function scoredModelFor(entry: ModelConfig): ScoredModel | null {
  const id = entry.model ?? '';
  return IDENTITY.find((i) => i.match.test(id))?.as ?? null;
}

// Where a config entry RUNS. Every generative backend competes for the same jobs, but
// only some of them are local — and calling the one cloud backend "Local" in a menu the
// skill reads aloud would be a lie about the only boundary that matters here.
export function familyFor(entry: ModelConfig): Extract<ImageFamily, 'diffusion' | 'cloud'> {
  return entry.backend === 'gemini' ? 'cloud' : 'diffusion';
}

// The menu label. Names where the model runs, because the owner is choosing that too.
function labelFor(name: string, family: ImageFamily): string {
  return family === 'cloud' ? `Cloud · Google · ${name}` : `Local · ${name}`;
}

// What we say about a model we've never put through the bake-off. Honest about the gap,
// and — for the cloud entry — about the wire.
function unmeasuredNote(family: ImageFamily): string {
  const base =
    "We have no measurements on this model — it wasn't in the bake-off, so we can't score " +
    'it. Ranked as an unknown, not as a recommendation: treat this as your call, not ours.';
  return family === 'cloud'
    ? `${base} It is also the one CLOUD backend: the prompt leaves this machine and goes to Google.`
    : base;
}

export interface ModelAvailability {
  // The config key (what you pass as "model" in a generate-image payload).
  name: string;
  backend: string;
  model: string | null;
  available: boolean;
  // Owner intent: false = switched off in the config, so it's offered nowhere.
  enabled: boolean;
  weightsCached: boolean | null;
  isDefault: boolean;
  // Which measured producer this entry IS, or null when we've never tested it.
  scoredAs: ScoredModel | null;
  // Local model vs cloud call. Carried here so every consumer gets the same answer.
  family: Extract<ImageFamily, 'diffusion' | 'cloud'>;
}

export async function readAvailability(
  config: GeneratorConfig = loadGeneratorConfig(),
): Promise<ModelAvailability[]> {
  return Promise.all(
    Object.entries(config.models).map(async ([name, entry]) => ({
      name,
      backend: entry.backend,
      model: entry.model ?? null,
      available: await generatorConfigured(config, name),
      enabled: modelEnabled(entry),
      weightsCached: modelWeightsCached(entry),
      isDefault: name === config.default,
      scoredAs: scoredModelFor(entry),
      family: familyFor(entry),
    })),
  );
}

// ---- the scored options for a type ----

export interface Option {
  // What to pass to the producer: a config key for a local model, or 'claude'/'unsplash'.
  pick: string;
  label: string;
  family: ImageFamily;
  // The config entry's backend ('mflux' | 'drawthings' | 'gemini'), or null for the
  // producers that aren't config entries (Claude, Unsplash). Drives what we tell the
  // owner to DO when this option is the one they're missing.
  backend: string | null;
  // 1-10, or null when this is a model we've never measured. Null is NOT a low score —
  // see `rank` for how it sorts.
  score: number | null;
  band: string | null;
  note: string;
  // What we sorted on: `score` when measured, UNMEASURED_PRIOR when not. Exposed so the
  // ordering is inspectable rather than magic — but never say it out loud as a score.
  rank: number;
  installed: boolean;
  // True when picking this pays a one-time multi-GB weights download first.
  willDownload: boolean;
  // True when score <= DISCOURAGED_AT: allowed, but say so before doing it.
  discouraged: boolean;
}

export interface Recommendation {
  type: ImageTypeId;
  label: string;
  job: string;
  readable: boolean;
  producer: string;
  // Best-scoring INSTALLED option. null only when nothing at all can make this type.
  recommended: Option | null;
  // The best option that exists, installed or not — what we'd use in a perfect world.
  bestPossible: Option | null;
  // True when `recommended` isn't `bestPossible` because the better one isn't installed.
  degraded: boolean;
  // Everything, best score first, installed or not. The skill's menu; an override picks
  // from here with its eyes open.
  options: Option[];
  // One line the skill can say verbatim.
  guidance: string;
}

export interface RecommendInputs {
  models: ModelAvailability[];
  unsplashConfigured: boolean;
}

function optionsFor(type: ImageTypeMeta, inputs: RecommendInputs): Option[] {
  const out: Option[] = [];

  // Does diffusion apply to this type at all? (A screenshot is a screenshot; no model
  // makes it.) Anything we've never measured is only offerable where diffusion belongs —
  // otherwise an unscored BYO entry would show up as a candidate for every type.
  const diffusionApplies = 'flux2-klein' in type.scores || 'flux1-schnell' in type.scores;

  // Generative model entries (local diffusion or the cloud one), scored by what they are.
  for (const m of inputs.models) {
    // Switched off in the config: not an option, and not something to nag about either.
    // Dropped here rather than filtered later so it can never become `bestPossible` and
    // trigger a "you don't have X, install it" line about a model you've ruled out.
    if (!m.enabled) continue;
    const s = m.scoredAs ? type.scores[m.scoredAs] : undefined;
    // A model we've never measured is still offerable — we just say we don't know.
    const unknown = m.scoredAs === null;
    if (unknown && !diffusionApplies) continue; // a generated image has no business here
    if (!unknown && !s) continue; // measured, but doesn't apply to this type
    out.push({
      pick: m.name,
      label: labelFor(m.name, m.family),
      family: m.family,
      backend: m.backend,
      score: s?.score ?? null,
      band: s ? band(s.score).label : null,
      note: s?.note ?? unmeasuredNote(m.family),
      rank: s?.score ?? UNMEASURED_PRIOR,
      installed: m.available,
      willDownload: m.weightsCached === false,
      discouraged: s ? s.score <= DISCOURAGED_AT : false,
    });
  }

  // Claude — always installed, because the composed path IS this session.
  const cs = type.scores.claude;
  if (cs) {
    out.push({
      pick: 'claude',
      label: 'Claude (composed)',
      family: 'composed',
      backend: null,
      score: cs.score,
      band: band(cs.score).label,
      note: cs.note,
      rank: cs.score,
      installed: true,
      willDownload: false,
      discouraged: cs.score <= DISCOURAGED_AT,
    });
  }

  // Unsplash — needs a key.
  const us = type.scores.unsplash;
  if (us) {
    out.push({
      pick: 'unsplash',
      label: 'Unsplash',
      family: 'photo-library',
      backend: null,
      score: us.score,
      band: band(us.score).label,
      note: us.note,
      rank: us.score,
      installed: inputs.unsplashConfigured,
      willDownload: false,
      discouraged: us.score <= DISCOURAGED_AT,
    });
  }

  // Best first by `rank` — measured score, or UNMEASURED_PRIOR for a model we've never
  // tested (which is why this sorts on rank and not on `score`: an unmeasured model must
  // not fall below one we measured as unusable). Ties break toward something already
  // installed, so we never recommend a download over an equal option.
  return out.sort((a, b) => b.rank - a.rank || Number(b.installed) - Number(a.installed));
}

// Why the best option isn't usable here, in the owner's terms. "Not installed" is only
// true of a local model — the others are blocked by a key, an app, or a bill, and saying
// "you don't have unsplash installed" sends someone looking for the wrong fix.
// How we say an option's standing out loud. An unmeasured model has no score and must
// never be given one — but it still has to read as a sentence.
function scorePhrase(o: Option): string {
  return o.score !== null ? `${o.score}/10` : 'unscored (never in our bake-off)';
}

function missingWhy(best: Option): string {
  const s = best.score !== null ? ` (${best.score}/10 here)` : '';
  switch (best.family) {
    case 'photo-library':
      return `Unsplash would be better${s}, but it needs UNSPLASH_ACCESS_KEY set.`;
    case 'cloud':
      return `${best.pick} would be an option${s}, but it needs GEMINI_API_KEY set (and billing on the Google project) — and note it's a cloud call.`;
    default:
      // A Draw Things entry is never "not installed" — the app just isn't answering.
      return best.backend === 'drawthings'
        ? `${best.pick} would be better${s}, but the Draw Things app isn't answering — open it and enable Advanced → API Server (HTTP, port 7860, localhost).`
        : `You don't have ${best.pick} installed${s}.`;
  }
}

export function recommendForType(type: ImageTypeMeta, inputs: RecommendInputs): Recommendation {
  const options = optionsFor(type, inputs);
  const installed = options.filter((o) => o.installed);
  const recommended = installed[0] ?? null;
  const bestPossible = options[0] ?? null;
  const degraded = Boolean(
    recommended && bestPossible && recommended.pick !== bestPossible.pick,
  );

  let guidance: string;
  if (!options.length) {
    // Fixed-producer types (a screenshot is a screenshot).
    guidance = `No model makes this — ${type.producer} does. Nothing to choose.`;
  } else if (!recommended) {
    // Name the actual blocker rather than reflexively suggesting a model install — the
    // only thing standing between you and an Unsplash photo is an API key.
    const onlyUnsplash = options.every((o) => o.family === 'photo-library');
    guidance = onlyUnsplash
      ? `Unsplash needs UNSPLASH_ACCESS_KEY set before this type can be used.`
      : `Nothing that can make a ${type.label.toLowerCase()} is set up right now. Run \`make image-model\` to install a local model.`;
  } else {
    const b = scorePhrase(recommended);
    // Why the better option isn't available decides what the owner should DO about it —
    // an API key, an app to open, and a 13 GB download are not the same errand.
    const lead = degraded
      ? `${missingWhy(bestPossible!)} The best you have is ${recommended.pick} (${b}).`
      : `Use ${recommended.pick} — ${b}.`;
    const warn = recommended.discouraged
      ? ` Be aware this is a poor fit: ${recommended.note} I'll still do it if you want it.`
      : '';
    // Only an mflux entry has weights to fetch. Unsplash and the cloud entry want keys,
    // and Draw Things manages its own models in-app — `make image-model` is the fix for
    // exactly one of these, and offering it for the others just wastes the owner's time.
    const fix =
      degraded && bestPossible && bestPossible.backend === 'mflux'
        ? ` Installing it (\`make image-model MODEL=${bestPossible.pick}\`) would be a real upgrade.`
        : '';
    guidance = `${lead}${warn}${fix}`;
  }

  return {
    type: type.id,
    label: type.label,
    job: type.job,
    readable: type.readable,
    producer: type.producer,
    recommended,
    bestPossible,
    degraded,
    options,
    guidance,
  };
}

export function recommendAll(inputs: RecommendInputs): Recommendation[] {
  return IMAGE_TYPES.map((t) => recommendForType(t, inputs));
}

// ---- CLI ----

async function main() {
  const wanted = process.argv[2];
  const models = await readAvailability();
  const inputs: RecommendInputs = {
    models,
    // Ask unsplash.ts rather than reading the env directly: it self-loads .env for its
    // own key, which a plain `npx tsx` run otherwise never does.
    unsplashConfigured: unsplashConfigured(),
  };

  if (wanted) {
    const type = IMAGE_TYPES.find((t) => t.id === wanted);
    if (!type) {
      console.error(
        `unknown image type "${wanted}" — known types: ${IMAGE_TYPES.map((t) => t.id).join(', ')}`,
      );
      process.exit(1);
    }
    console.log(JSON.stringify(recommendForType(type, inputs), null, 2));
    return;
  }

  console.log(
    JSON.stringify(
      {
        bands: BANDS,
        discouragedAt: DISCOURAGED_AT,
        models,
        unsplashConfigured: inputs.unsplashConfigured,
        recommendations: recommendAll(inputs),
      },
      null,
      2,
    ),
  );
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  main().catch((e) => {
    console.error((e as Error).message);
    process.exit(1);
  });
}
