// src/images/generate.ts
// Local generative image source. The config file (image-generation.config.json at
// the repo root — see the .example) declares a set of NAMED MODELS and a default;
// every entry picks one of two backends:
//
//   * "mflux" (default) — shell out to an mflux CLI command via MLX. Fully headless
//     (no app open); downloads its own Hugging Face copy of the weights on first
//     use. mflux ships one command per model family (`mflux-generate` for FLUX.1,
//     `mflux-generate-flux2` for FLUX.2 [klein], `mflux-generate-qwen`,
//     `mflux-generate-z-image`, …), so a model entry names its `command` and the
//     `model` identifier that command accepts — which is what makes bring-your-own
//     -model possible: any model mflux can run is one config entry away.
//   * "drawthings" — POST to the Draw Things app's local HTTP API
//     (A1111-compatible /sdapi/v1/txt2img). Reuses the model you already
//     downloaded and selected in Draw Things — ONE copy, no extra download.
//     Enable it in Draw Things → Advanced → API Server (HTTP, port 7860, localhost).
//
// Both are local-only, need no API key, and are commercial-safe with the shipped
// defaults (FLUX.2 [klein] and FLUX.1 [schnell] are both Apache-2.0). When the
// requested model's backend isn't reachable/installed the call throws a clear,
// catchable message so the imagery skill can offer another image type instead.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import sharp from 'sharp';
import { REPO_ROOT } from '../profile/loader';

// ---- config ----

export type GeneratorBackend = 'drawthings' | 'mflux';

// Shared by every model entry regardless of backend.
export interface ModelCommon {
  // false = switch this entry off: it stops being offered, recommended, or nagged about
  // anywhere (the imagery skill's menu, the console's picker). Default true.
  //
  // This is the difference between "I can't use this" and "I don't want this". A model
  // that's simply not installed still deserves a mention — "you don't have FLUX.2 (8/10),
  // installing it would be an upgrade" is useful. But a model you've deliberately ruled
  // out (a cloud backend you won't pay for, a local model you won't download) should go
  // quiet rather than nag forever. Set enabled:false and it disappears.
  enabled?: boolean;
}

// One named model the generator can run. `backend` picks the mechanism; the rest
// is per-model tuning (a distilled model wants few steps, a base model wants more).
export interface MfluxModelConfig extends ModelCommon {
  backend: 'mflux';
  // Which mflux CLI runs this model family (mflux-generate, mflux-generate-flux2, …).
  command?: string;
  // The --model identifier that command accepts (schnell, flux2-klein-4b, …).
  model: string;
  steps?: number;
  // Local weights dir (or pre-quantized mflux repo) passed as --path.
  modelPath?: string | null;
  // 3/4/5/6/8 — trades quality for lower memory.
  quantize?: number | null;
  // Escape hatch for model-specific flags (e.g. ["--guidance", "3.5"]), appended
  // verbatim — this is what keeps arbitrary bring-your-own models expressible
  // without schema changes.
  extraArgs?: string[];
}

export interface DrawThingsModelConfig extends ModelCommon {
  backend: 'drawthings';
  apiUrl?: string;
  // null = whatever the app currently has selected.
  model?: string | null;
  steps?: number;
}

// Google's Gemini image models ("Nano Banana"). The one entry in this file that is NOT
// local: the prompt goes to Google and the image comes back over the wire. It needs
// GEMINI_API_KEY in the server-side env (never the browser) and is opt-in — absent key,
// the entry simply reads as unavailable and the skill offers something else.
export interface GeminiModelConfig extends ModelCommon {
  backend: 'gemini';
  // e.g. gemini-3.1-flash-image (Nano Banana 2), gemini-3-pro-image (Nano Banana Pro),
  // gemini-2.5-flash-image (the original).
  model: string;
  // '512px' | '1K' | '2K' | '4K'. Omitted/null = derived from the requested width.
  imageSize?: string | null;
  // Overrides the aspect ratio derived from width/height (e.g. '1:1', '16:9').
  aspectRatio?: string | null;
}

export type ModelConfig = MfluxModelConfig | DrawThingsModelConfig | GeminiModelConfig;

export interface GeneratorConfig {
  // Name (key into `models`) of the model used when a call doesn't pick one.
  default: string;
  width: number;
  height: number;
  models: Record<string, ModelConfig>;
}

// The API server gets .env via node's --env-file-if-exists flag, but the skill-facing
// CLIs (generate-image.ts etc.) run through plain `npx tsx`, which loads nothing. Fill
// that gap here so the Gemini entries work from the CLI too — same pattern as
// unsplash.ts. loadEnvFile never overrides variables already set.
if (!process.env.GEMINI_API_KEY) {
  const envPath = resolve(REPO_ROOT, '.env');
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      /* unreadable .env — geminiConfigured() then reports it plainly */
    }
  }
}

const DEFAULT_STEPS = 4;

const DEFAULT_CONFIG: GeneratorConfig = {
  default: 'flux2-klein',
  width: 1024,
  height: 1024,
  models: {
    // FLUX.2 [klein] 4B (Apache-2.0): the recommended default — smaller download
    // (~13 GB vs ~24 GB), faster, and far better at readable in-image text than
    // FLUX.1 [schnell]. Needs mflux >= 0.18 (which ships mflux-generate-flux2).
    'flux2-klein': {
      backend: 'mflux',
      command: 'mflux-generate-flux2',
      model: 'flux2-klein-4b',
      steps: DEFAULT_STEPS,
    },
    // FLUX.1 [schnell] (Apache-2.0): the previous default, kept for anyone who
    // already downloaded its weights.
    'flux1-schnell': {
      backend: 'mflux',
      command: 'mflux-generate',
      model: 'schnell',
      steps: DEFAULT_STEPS,
    },
    drawthings: {
      backend: 'drawthings',
      apiUrl: 'http://localhost:7860',
      steps: DEFAULT_STEPS,
    },
  },
};

const CONFIG_PATH = resolve(REPO_ROOT, 'image-generation.config.json');

// The pre-models config shape (single backend + one mflux/drawThings block), still
// honored so an existing local config keeps working untouched.
interface LegacyGeneratorConfig {
  backend?: GeneratorBackend;
  steps?: number;
  width?: number;
  height?: number;
  drawThings?: { apiUrl?: string; model?: string };
  mflux?: { model?: string; modelPath?: string | null; quantize?: number | null };
}

function fromLegacy(raw: LegacyGeneratorConfig): GeneratorConfig {
  const steps = raw.steps ?? DEFAULT_STEPS;
  return {
    default: raw.backend === 'drawthings' ? 'drawthings' : 'mflux',
    width: raw.width ?? DEFAULT_CONFIG.width,
    height: raw.height ?? DEFAULT_CONFIG.height,
    models: {
      mflux: {
        backend: 'mflux',
        command: 'mflux-generate',
        model: raw.mflux?.model ?? 'schnell',
        steps,
        modelPath: raw.mflux?.modelPath ?? null,
        quantize: raw.mflux?.quantize ?? null,
      },
      drawthings: {
        backend: 'drawthings',
        apiUrl: raw.drawThings?.apiUrl ?? 'http://localhost:7860',
        model: raw.drawThings?.model ?? null,
        steps,
      },
    },
  };
}

// Read the repo-root config file over the defaults. Absent or unreadable → all
// defaults (headless mflux, FLUX.2 klein), so a fresh clone works with no config
// file at all once `uv tool install mflux` has run. A config without a `models`
// map is the legacy single-backend shape and is normalized, not rejected.
export function loadGeneratorConfig(): GeneratorConfig {
  if (!existsSync(CONFIG_PATH)) return DEFAULT_CONFIG;
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Record<string, unknown>;
    if (!raw.models || typeof raw.models !== 'object') {
      return fromLegacy(raw as LegacyGeneratorConfig);
    }
    const models = raw.models as Record<string, ModelConfig>;
    const names = Object.keys(models);
    if (names.length === 0) return DEFAULT_CONFIG;
    // Fall back to the first ENABLED entry, not just the first: a config that lists a
    // switched-off entry first (the shipped example has disabled cloud entries) and omits
    // `default` would otherwise make a model the owner ruled out the one we reach for.
    // An explicit `default` is honoured either way — naming it is intent, even if odd.
    const def =
      typeof raw.default === 'string' && models[raw.default]
        ? raw.default
        : (names.find((n) => modelEnabled(models[n])) ?? names[0]);
    return {
      default: def,
      width: typeof raw.width === 'number' ? raw.width : DEFAULT_CONFIG.width,
      height: typeof raw.height === 'number' ? raw.height : DEFAULT_CONFIG.height,
      models,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

// Resolve a model entry by name (default when omitted), with an error that names
// the valid choices — the message surfaces verbatim in the imagery session.
export function resolveModel(
  config: GeneratorConfig,
  name?: string,
): { name: string; entry: ModelConfig } {
  const chosen = name ?? config.default;
  const entry = config.models[chosen];
  if (!entry) {
    throw new Error(
      `unknown image model "${chosen}" — image-generation.config.json defines: ` +
        Object.keys(config.models).join(', '),
    );
  }
  return { name: chosen, entry };
}

// ---- shared ----

export interface GenerateOptions {
  prompt: string;
  // Named model entry from the config; omitted = the config's default.
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  outPath: string;
}

export interface GeneratedImage {
  buffer: Buffer; // PNG
  width: number;
  height: number;
  params: Record<string, unknown>;
}

async function imageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height) throw new Error('generated image has no readable dimensions');
  return { width: meta.width, height: meta.height };
}

// "Is this model usable?" so the skill/console can degrade. Draw Things
// availability is a live ping (the app may be closed / API server off); mflux is a
// PATH check on the entry's command — an older mflux without that command reads as
// unavailable, which is honest (upgrade mflux to get it).
export async function generatorConfigured(
  config = loadGeneratorConfig(),
  modelName?: string,
): Promise<boolean> {
  try {
    const { entry } = resolveModel(config, modelName);
    if (entry.backend === 'mflux') return findOnPath(mfluxCommand(entry)) !== null;
    // Gemini needs no install — just the key. We don't spend a live request probing it;
    // a wrong key surfaces as a clear error on first use.
    if (entry.backend === 'gemini') return geminiConfigured();
    return drawThingsReachable(entry.apiUrl ?? 'http://localhost:7860');
  } catch {
    return false;
  }
}

export function geminiConfigured(): boolean {
  return typeof process.env.GEMINI_API_KEY === 'string' && process.env.GEMINI_API_KEY !== '';
}

// Owner intent, deliberately NOT folded into generatorConfigured(): "switched off" and
// "not usable on this machine" are different facts and get different words. A disabled
// entry is hidden from menus; an unavailable one may still be worth mentioning. Absent
// field = on, so every existing config keeps working untouched.
export function modelEnabled(entry: ModelConfig): boolean {
  return entry.enabled !== false;
}

// "Are this model's weights already on disk?" — the difference between a fast
// first image and a surprise multi-GB download. Advisory (a heuristic over the
// Hugging Face cache), so consumers should phrase it as guidance, not a gate:
//   true  → weights found, first generation is fast
//   false → tool may be installed but the first run will download weights
//   null  → not knowable here (Draw Things manages its own models in-app)
export function modelWeightsCached(entry: ModelConfig): boolean | null {
  // Non-mflux backends manage their own models (Draw Things in-app) or have no weights
  // to cache at all (Gemini runs on Google's hardware) — nothing to report either way.
  if (entry.backend !== 'mflux') return null;
  if (entry.modelPath) return existsSync(entry.modelPath);
  const hub = join(homedir(), '.cache', 'huggingface', 'hub');
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(entry.model);
  try {
    for (const dir of readdirSync(hub)) {
      if (!dir.startsWith('models--')) continue;
      // Cache dirs are "models--<org>--<repo>"; match against the repo name
      // (org stripped) in either direction so both alias shapes work: a short
      // mflux alias ("schnell") contained in the repo name, or a fuller alias
      // ("flux2-klein-4b") containing the repo's distinctive part.
      const repo = norm(dir.split('--').slice(2).join('--'));
      if (!(repo.includes(target) || (repo.length >= 4 && target.includes(repo)))) continue;
      // A snapshot with content = a completed (or at least resumable) download.
      const snaps = join(hub, dir, 'snapshots');
      if (existsSync(snaps) && readdirSync(snaps).length > 0) return true;
    }
  } catch {
    /* no hub cache yet — nothing downloaded */
  }
  return false;
}

// Route to the requested model's backend.
export async function generateImage(
  opts: GenerateOptions,
  config = loadGeneratorConfig(),
): Promise<GeneratedImage> {
  const { name, entry } = resolveModel(config, opts.model);
  const merged = {
    prompt: opts.prompt,
    width: opts.width ?? config.width,
    height: opts.height ?? config.height,
    // Not every backend has a step count (Gemini doesn't expose one) — carry a value
    // anyway so the shared shape holds; the backends that ignore it simply ignore it.
    steps: opts.steps ?? ('steps' in entry ? entry.steps : undefined) ?? DEFAULT_STEPS,
    seed: opts.seed ?? Math.floor(Math.random() * 1_000_000_000),
    outPath: opts.outPath,
  };
  if (entry.backend === 'mflux') return generateWithMflux(merged, name, entry);
  if (entry.backend === 'gemini') return generateWithGemini(merged, name, entry);
  return generateWithDrawThings(merged, name, entry);
}

type Merged = Required<Omit<GenerateOptions, 'model' | 'width' | 'height' | 'steps' | 'seed'>> & {
  width: number;
  height: number;
  steps: number;
  seed: number;
};

// ---- Draw Things backend ----

async function drawThingsReachable(apiUrl: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl.replace(/\/$/, '') + '/', {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const DT_UNREACHABLE = (url: string) =>
  `Draw Things API server isn't reachable at ${url}. In Draw Things: Advanced → API Server ` +
  `→ enable (HTTP, port 7860, localhost), with your image model selected in the app.`;

async function generateWithDrawThings(
  m: Merged,
  name: string,
  entry: DrawThingsModelConfig,
): Promise<GeneratedImage> {
  const base = (entry.apiUrl ?? 'http://localhost:7860').replace(/\/$/, '');
  if (!(await drawThingsReachable(base))) throw new Error(DT_UNREACHABLE(base));

  // A1111-compatible payload; runs on the model currently selected in the app
  // (optionally overridden by the entry's `model`). Draw Things ignores CFG for
  // few-step FLUX models, so we don't send it.
  const body: Record<string, unknown> = {
    prompt: m.prompt,
    negative_prompt: '',
    width: m.width,
    height: m.height,
    steps: m.steps,
    seed: m.seed,
  };
  if (entry.model) body.model = entry.model;

  let res: Response;
  try {
    res = await fetch(`${base}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15 * 60 * 1000),
    });
  } catch (e) {
    throw new Error(`${DT_UNREACHABLE(base)} (${(e as Error).message})`);
  }
  if (!res.ok) {
    throw new Error(`Draw Things generation failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { images?: string[] };
  const b64 = json.images?.[0];
  if (!b64) throw new Error('Draw Things returned no image');
  // The API may return a bare base64 string or a data URI; handle both.
  const buffer = Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  const dims = await imageDimensions(buffer);

  return {
    buffer,
    width: dims.width,
    height: dims.height,
    params: {
      generator: 'draw-things',
      modelEntry: name,
      model: entry.model ?? 'app-selected',
      prompt: m.prompt,
      steps: m.steps,
      seed: m.seed,
    },
  };
}

// ---- Gemini backend ("Nano Banana") ----

export const GEMINI_NO_KEY =
  'GEMINI_API_KEY is not set, so the Gemini image models are unavailable. Get a key at ' +
  'aistudio.google.com/apikey and put it in .env (see .env.example). Note this model is a ' +
  'CLOUD call — unlike the local models, the prompt leaves your machine.';

// Gemini takes an aspect ratio, not pixel dimensions. Snap the requested w:h onto the
// nearest ratio it supports so a caller asking for 1024x1024 gets a square rather than
// an error, and say what we did in `params` so the mismatch is never silent.
const GEMINI_RATIOS: { label: string; value: number }[] = [
  { label: '1:1', value: 1 },
  { label: '3:2', value: 3 / 2 },
  { label: '2:3', value: 2 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '4:3', value: 4 / 3 },
  { label: '4:5', value: 4 / 5 },
  { label: '5:4', value: 5 / 4 },
  { label: '9:16', value: 9 / 16 },
  { label: '16:9', value: 16 / 9 },
  { label: '21:9', value: 21 / 9 },
];

export function nearestGeminiRatio(width: number, height: number): string {
  const target = width / height;
  return GEMINI_RATIOS.reduce((best, r) =>
    Math.abs(r.value - target) < Math.abs(best.value - target) ? r : best,
  ).label;
}

// The API's size buckets, not free pixels: pick the smallest bucket that covers the
// longest requested edge.
export function geminiImageSize(width: number, height: number): string {
  const longest = Math.max(width, height);
  if (longest <= 512) return '512px';
  if (longest <= 1024) return '1K';
  if (longest <= 2048) return '2K';
  return '4K';
}

// Walk the interactions response for the first image block. Defensive on shape: the
// response nests images under steps[].content[], and we'd rather throw a readable error
// than a TypeError if that ever changes.
function geminiImageFromResponse(json: unknown): string | null {
  const root = json as {
    output_image?: { data?: string };
    steps?: { type?: string; content?: { type?: string; data?: string }[] }[];
  };
  if (typeof root?.output_image?.data === 'string') return root.output_image.data;
  for (const step of root?.steps ?? []) {
    for (const block of step?.content ?? []) {
      if (block?.type === 'image' && typeof block.data === 'string') return block.data;
    }
  }
  return null;
}

async function generateWithGemini(
  m: Merged,
  name: string,
  entry: GeminiModelConfig,
): Promise<GeneratedImage> {
  if (!geminiConfigured()) throw new Error(GEMINI_NO_KEY);

  const aspectRatio = entry.aspectRatio ?? nearestGeminiRatio(m.width, m.height);
  const imageSize = entry.imageSize ?? geminiImageSize(m.width, m.height);

  let res: Response;
  try {
    res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: entry.model,
        input: [{ type: 'text', text: m.prompt }],
        response_format: {
          // JPEG only — the API rejects image/png outright ("Supported values:
          // 'image/jpeg'"), so we take JPEG and transcode to PNG below to match every
          // other producer. That means Gemini output has one generation of JPEG loss
          // baked in before we ever see it; nothing we can do from this side.
          type: 'image',
          mime_type: 'image/jpeg',
          aspect_ratio: aspectRatio,
          image_size: imageSize,
        },
      }),
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });
  } catch (e) {
    throw new Error(`Gemini request failed (network): ${(e as Error).message}`);
  }

  if (!res.ok) {
    const body = (await res.text()).slice(0, 400);
    // 429 is the free tier's most likely failure and deserves to be named, not buried.
    const hint =
      res.status === 429
        ? ' — that\'s the rate limit; wait a moment or check your quota at aistudio.google.com'
        : res.status === 400 || res.status === 403
          ? ' — check GEMINI_API_KEY is valid and the model name exists'
          : '';
    throw new Error(`Gemini generation failed: HTTP ${res.status}${hint}. ${body}`);
  }

  const json = (await res.json()) as unknown;
  const b64 = geminiImageFromResponse(json);
  if (!b64) {
    // A safety block or a text-only reply lands here; show a slice so it's diagnosable.
    throw new Error(
      `Gemini returned no image (it may have refused the prompt): ${JSON.stringify(json).slice(0, 400)}`,
    );
  }

  // Transcode the JPEG the API insists on into the PNG the rest of the pipeline stores.
  const buffer = await sharp(Buffer.from(b64, 'base64')).png().toBuffer();
  const dims = await imageDimensions(buffer);

  return {
    buffer,
    width: dims.width,
    height: dims.height,
    params: {
      generator: 'gemini',
      modelEntry: name,
      model: entry.model,
      prompt: m.prompt,
      // Recorded because Gemini ignores exact pixels: this is what we actually asked for.
      aspectRatio,
      imageSize,
      // No seed is accepted by this API, so runs are not reproducible the way mflux is.
      seed: null,
      cloud: true,
      // Honest provenance: it arrived as JPEG and we re-encoded it.
      transcodedFrom: 'image/jpeg',
    },
  };
}

// ---- mflux backend ----

export function findOnPath(bin: string): string | null {
  const path = process.env.PATH ?? '';
  for (const dir of path.split(delimiter)) {
    if (dir === '') continue;
    const candidate = join(dir, bin);
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    } catch {
      /* unreadable dir on PATH — skip */
    }
  }
  return null;
}

// The entry's mflux CLI, constrained to mflux's own command family so a config
// typo can never point generation at an arbitrary binary.
export function mfluxCommand(entry: MfluxModelConfig): string {
  const command = entry.command ?? 'mflux-generate';
  if (!/^mflux-[a-z0-9-]+$/.test(command)) {
    throw new Error(`invalid mflux command "${command}" in image-generation.config.json`);
  }
  return command;
}

export const MFLUX_NOT_INSTALLED = (command: string) =>
  `The selected image model runs via \`${command}\`, which isn't on PATH. Install or update ` +
  'mflux (`uv tool install mflux` / `uv tool upgrade mflux`), or pick another model in ' +
  'image-generation.config.json.';

async function generateWithMflux(
  m: Merged,
  name: string,
  entry: MfluxModelConfig,
): Promise<GeneratedImage> {
  const command = mfluxCommand(entry);
  if (findOnPath(command) === null) throw new Error(MFLUX_NOT_INSTALLED(command));

  const args = [
    '--model', entry.model,
    '--prompt', m.prompt,
    '--steps', String(m.steps),
    '--seed', String(m.seed),
    '--height', String(m.height),
    '--width', String(m.width),
    '--output', m.outPath,
  ];
  if (entry.modelPath) args.push('--path', entry.modelPath);
  if (entry.quantize) args.push('--quantize', String(entry.quantize));
  if (entry.extraArgs?.length) args.push(...entry.extraArgs);

  const run = spawnSync(command, args, {
    encoding: 'utf8',
    // Generous: the FIRST run downloads the model's weights (13-24 GB for the
    // shipped FLUX defaults) before it can generate, which can take well over 15
    // minutes on a slow link.
    timeout: 60 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
    // Disable Hugging Face's Xet transfer backend: hf_xet currently crashes on some
    // large FLUX downloads ("Unable to parse string as hex hash value"). The classic
    // HTTP download path is reliable (slightly slower). Drop this once hf_xet is fixed.
    env: { ...process.env, HF_HUB_DISABLE_XET: '1' },
  });
  if (run.error) {
    const err = run.error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') throw new Error(MFLUX_NOT_INSTALLED(command));
    throw new Error(`mflux could not be launched: ${err.message}`);
  }
  if (run.status !== 0) {
    throw new Error(`mflux generation failed (exit ${run.status}): ${(run.stderr || '').trim().slice(-600)}`);
  }
  if (!existsSync(m.outPath)) throw new Error('mflux reported success but wrote no image file');

  const buffer = readFileSync(m.outPath);
  const dims = await imageDimensions(buffer);
  return {
    buffer,
    width: dims.width,
    height: dims.height,
    params: {
      generator: 'mflux',
      modelEntry: name,
      model: entry.model,
      prompt: m.prompt,
      steps: m.steps,
      seed: m.seed,
    },
  };
}
