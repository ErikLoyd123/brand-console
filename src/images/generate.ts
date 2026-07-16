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

// One named model the generator can run. `backend` picks the mechanism; the rest
// is per-model tuning (a distilled model wants few steps, a base model wants more).
export interface MfluxModelConfig {
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

export interface DrawThingsModelConfig {
  backend: 'drawthings';
  apiUrl?: string;
  // null = whatever the app currently has selected.
  model?: string | null;
  steps?: number;
}

export type ModelConfig = MfluxModelConfig | DrawThingsModelConfig;

export interface GeneratorConfig {
  // Name (key into `models`) of the model used when a call doesn't pick one.
  default: string;
  width: number;
  height: number;
  models: Record<string, ModelConfig>;
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
    const def = typeof raw.default === 'string' && models[raw.default] ? raw.default : names[0];
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
    return drawThingsReachable(entry.apiUrl ?? 'http://localhost:7860');
  } catch {
    return false;
  }
}

// "Are this model's weights already on disk?" — the difference between a fast
// first image and a surprise multi-GB download. Advisory (a heuristic over the
// Hugging Face cache), so consumers should phrase it as guidance, not a gate:
//   true  → weights found, first generation is fast
//   false → tool may be installed but the first run will download weights
//   null  → not knowable here (Draw Things manages its own models in-app)
export function modelWeightsCached(entry: ModelConfig): boolean | null {
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
    steps: opts.steps ?? entry.steps ?? DEFAULT_STEPS,
    seed: opts.seed ?? Math.floor(Math.random() * 1_000_000_000),
    outPath: opts.outPath,
  };
  return entry.backend === 'mflux'
    ? generateWithMflux(merged, name, entry)
    : generateWithDrawThings(merged, name, entry);
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
