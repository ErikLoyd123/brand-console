// src/images/generate.ts
// Local generative image source. Two backends, chosen in the config file
// (image-generation.config.json at the repo root — see the .example):
//
//   * "mflux" (default) — shell out to the `mflux` CLI (FLUX.1 [schnell] via MLX).
//     Fully headless (no app open); downloads its own Hugging Face copy of the
//     weights on first use (Draw Things' .ckpt format is not mflux-readable).
//   * "drawthings" — POST to the Draw Things app's local HTTP API
//     (A1111-compatible /sdapi/v1/txt2img). Reuses the model you already
//     downloaded and selected in Draw Things (e.g. FLUX.1 [schnell]) — ONE copy,
//     no extra download. Enable it in Draw Things → Advanced → API Server
//     (HTTP, port 7860, localhost).
//
// Both are local-only, need no API key, and are commercial-safe with FLUX.1
// [schnell] (Apache-2.0). When the active backend isn't reachable/installed the
// call throws a clear, catchable message so the imagery skill can offer another
// image type instead.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import sharp from 'sharp';
import { REPO_ROOT } from '../profile/loader';

// ---- config ----

export type GeneratorBackend = 'drawthings' | 'mflux';

export interface GeneratorConfig {
  backend: GeneratorBackend;
  steps: number;
  width: number;
  height: number;
  drawThings: { apiUrl: string; model?: string };
  mflux: { model: string; modelPath?: string | null; quantize?: number | null };
}

const DEFAULT_CONFIG: GeneratorConfig = {
  backend: 'mflux',
  steps: 4,
  width: 1024,
  height: 1024,
  drawThings: { apiUrl: 'http://localhost:7860' },
  mflux: { model: 'schnell', modelPath: null, quantize: null },
};

const CONFIG_PATH = resolve(REPO_ROOT, 'image-generation.config.json');

// Read the repo-root config file over the defaults. Absent or unreadable → all
// defaults (headless mflux, FLUX.1 schnell), so a fresh clone works with no config
// file at all once `uv tool install mflux` has run.
export function loadGeneratorConfig(): GeneratorConfig {
  if (!existsSync(CONFIG_PATH)) return DEFAULT_CONFIG;
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Partial<GeneratorConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      drawThings: { ...DEFAULT_CONFIG.drawThings, ...(raw.drawThings ?? {}) },
      mflux: { ...DEFAULT_CONFIG.mflux, ...(raw.mflux ?? {}) },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

// ---- shared ----

export interface GenerateOptions {
  prompt: string;
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

// The active backend's "is it usable" check, so the skill can degrade. Draw Things
// availability is a live ping (the app may be closed / API server off); mflux is a
// PATH check.
export async function generatorConfigured(config = loadGeneratorConfig()): Promise<boolean> {
  if (config.backend === 'mflux') return findOnPath('mflux-generate') !== null;
  return drawThingsReachable(config.drawThings.apiUrl);
}

// Route to the active backend.
export async function generateImage(
  opts: GenerateOptions,
  config = loadGeneratorConfig(),
): Promise<GeneratedImage> {
  const merged = {
    prompt: opts.prompt,
    width: opts.width ?? config.width,
    height: opts.height ?? config.height,
    steps: opts.steps ?? config.steps,
    seed: opts.seed ?? Math.floor(Math.random() * 1_000_000_000),
    outPath: opts.outPath,
  };
  return config.backend === 'mflux'
    ? generateWithMflux(merged, config)
    : generateWithDrawThings(merged, config);
}

type Merged = Required<Omit<GenerateOptions, 'width' | 'height' | 'steps' | 'seed'>> & {
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
  `→ enable (HTTP, port 7860, localhost), with FLUX.1 [schnell] selected as the model.`;

async function generateWithDrawThings(m: Merged, config: GeneratorConfig): Promise<GeneratedImage> {
  const base = config.drawThings.apiUrl.replace(/\/$/, '');
  if (!(await drawThingsReachable(base))) throw new Error(DT_UNREACHABLE(base));

  // A1111-compatible payload; runs on the model currently selected in the app
  // (optionally overridden by config.drawThings.model). Draw Things ignores CFG for
  // FLUX schnell, so we don't send it.
  const body: Record<string, unknown> = {
    prompt: m.prompt,
    negative_prompt: '',
    width: m.width,
    height: m.height,
    steps: m.steps,
    seed: m.seed,
  };
  if (config.drawThings.model) body.model = config.drawThings.model;

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
      model: config.drawThings.model ?? 'FLUX.1-schnell (app-selected)',
      prompt: m.prompt,
      steps: m.steps,
      seed: m.seed,
    },
  };
}

// ---- mflux backend ----

function findOnPath(bin: string): string | null {
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

const MFLUX_NOT_INSTALLED =
  'The mflux backend is selected but mflux is not installed. Install it (`uv tool install mflux`) ' +
  'or switch "backend" to "drawthings" in image-generation.config.json.';

async function generateWithMflux(m: Merged, config: GeneratorConfig): Promise<GeneratedImage> {
  if (findOnPath('mflux-generate') === null) throw new Error(MFLUX_NOT_INSTALLED);

  const args = [
    '--model', config.mflux.model,
    '--prompt', m.prompt,
    '--steps', String(m.steps),
    '--seed', String(m.seed),
    '--height', String(m.height),
    '--width', String(m.width),
    '--output', m.outPath,
  ];
  if (config.mflux.modelPath) args.push('--path', config.mflux.modelPath);
  if (config.mflux.quantize) args.push('--quantize', String(config.mflux.quantize));

  const run = spawnSync('mflux-generate', args, {
    encoding: 'utf8',
    // Generous: the FIRST run downloads the FLUX schnell weights (~24 GB) before it
    // can generate, which can take well over 15 minutes on a slow link.
    timeout: 60 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
    // Disable Hugging Face's Xet transfer backend: hf_xet currently crashes on some
    // large FLUX downloads ("Unable to parse string as hex hash value"). The classic
    // HTTP download path is reliable (slightly slower). Drop this once hf_xet is fixed.
    env: { ...process.env, HF_HUB_DISABLE_XET: '1' },
  });
  if (run.error) {
    const err = run.error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') throw new Error(MFLUX_NOT_INSTALLED);
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
      model: `FLUX.1-${config.mflux.model}`,
      prompt: m.prompt,
      steps: m.steps,
      seed: m.seed,
    },
  };
}
