// src/images/download-model.ts
// Pre-download model weights DURING SETUP so the owner's first real image
// doesn't pay the multi-GB fetch. The lazy path still exists — a model whose
// weights were never pre-downloaded fetches them on its first generation — but
// that is the failsafe; this is the front door (`make image-model`).
//
//   npx tsx src/images/download-model.ts               # interactive picker (default model when not a TTY)
//   npx tsx src/images/download-model.ts <name> [...]  # specific entries from image-generation.config.json
//   npx tsx src/images/download-model.ts all           # every entry
//
// Self-sufficient for a fresh clone: if the needed mflux CLI isn't installed
// and `uv` is available, it installs the tools itself (the same thing
// `make image-gen` does) before downloading. For an mflux entry it then runs a
// tiny 1-step warm-up render through the entry's own CLI, which makes mflux
// download exactly the weights that entry needs (same repo, same quantization,
// same modelPath) — Hugging Face progress streams straight to the terminal, and
// a successful render doubles as an end-to-end install check. Draw Things
// entries manage their own models inside the app, so there is nothing to fetch.

import { rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import {
  findOnPath,
  loadGeneratorConfig,
  mfluxCommand,
  resolveModel,
  type GeneratorConfig,
  type ModelConfig,
} from './generate';

const SIZE_HINTS: Record<string, string> = {
  'flux2-klein': '~13 GB',
  'flux1-schnell': '~24 GB',
};

function describe(config: GeneratorConfig, name: string): string {
  const entry = config.models[name];
  const bits = [entry.backend === 'mflux' ? `mflux · ${entry.model}` : 'Draw Things app'];
  if (SIZE_HINTS[name]) bits.push(SIZE_HINTS[name]);
  if (name === config.default) bits.push('default');
  return bits.join(' · ');
}

// No names given and we have a real terminal: ask which weights to fetch.
async function pickInteractively(config: GeneratorConfig): Promise<string[]> {
  const names = Object.keys(config.models);
  console.log('Which model weights do you want to download?');
  console.log('');
  names.forEach((n, i) => console.log(`  ${i + 1}. ${n}  (${describe(config, n)})`));
  console.log('');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (
    await rl.question(`Pick numbers or names (space/comma separated), "all", or Enter for the default [${config.default}]: `)
  ).trim();
  rl.close();
  if (answer === '') return [config.default];
  if (answer.toLowerCase() === 'all') return names;
  return answer
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((tok) => {
      const idx = Number(tok);
      if (Number.isInteger(idx) && idx >= 1 && idx <= names.length) return names[idx - 1];
      return tok;
    });
}

// A fresh clone shouldn't need `make image-gen` first: when the chosen entries'
// mflux CLI is missing, install the tools here (exactly what image-gen does).
// Requires uv — without it, point at the install docs and stop.
function ensureTools(entries: Array<{ name: string; entry: ModelConfig }>): void {
  const missing = entries
    .filter((e) => e.entry.backend === 'mflux')
    .map((e) => mfluxCommand(e.entry as Extract<ModelConfig, { backend: 'mflux' }>))
    .filter((cmd, i, all) => all.indexOf(cmd) === i && findOnPath(cmd) === null);
  if (missing.length === 0) return;

  if (findOnPath('uv') === null) {
    console.error(
      `\`${missing.join('`, `')}\` isn't installed and neither is \`uv\`, which installs it. ` +
        'Install uv first (https://docs.astral.sh/uv/), then re-run this — or run `make image-gen`.',
    );
    process.exit(1);
  }

  console.log(`\`${missing.join('`, `')}\` isn't on PATH — installing the tools first (same as \`make image-gen\`)…`);
  for (const args of [
    ['tool', 'install', '--upgrade', 'mflux'],
    ['tool', 'install', 'huggingface_hub'],
  ]) {
    const run = spawnSync('uv', args, { stdio: 'inherit' });
    if (run.error || run.status !== 0) {
      console.error(`\`uv ${args.join(' ')}\` failed — fix that, then re-run (or run \`make image-gen\`).`);
      process.exit(1);
    }
  }
  const stillMissing = missing.filter((cmd) => findOnPath(cmd) === null);
  if (stillMissing.length > 0) {
    console.error(
      `mflux installed, but \`${stillMissing.join('`, `')}\` still isn't available — ` +
        'your mflux may be too old for this model family (`uv tool upgrade mflux`).',
    );
    process.exit(1);
  }
  console.log('');
}

function downloadOne(name: string, entry: ModelConfig): boolean {
  if (entry.backend === 'drawthings') {
    console.log(
      `"${name}" runs on the Draw Things app, which downloads and manages its own models — ` +
        'nothing to fetch here. In Draw Things: pick/download a model, then Advanced → API Server ' +
        '→ enable (HTTP, port 7860, localhost).',
    );
    return true;
  }

  if (entry.backend === 'gemini') {
    console.log(
      `"${name}" runs on Google's servers (model ${entry.model}) — there are no weights to ` +
        'download. All it needs is GEMINI_API_KEY in .env (aistudio.google.com/apikey). Note it ' +
        'is the one cloud entry: prompts sent to it leave this machine.',
    );
    return true;
  }

  const command = mfluxCommand(entry);
  console.log(`Fetching weights for "${name}" (model ${entry.model}, via ${command}).`);
  console.log(
    `First download can be large (${SIZE_HINTS[name] ?? 'multiple GB for most models'}) and lands in ` +
      '~/.cache/huggingface — progress streams below. If the weights are already cached this ' +
      'finishes in under a minute with a tiny test render.',
  );
  console.log('');

  const scratch = join(tmpdir(), `image-model-warmup-${process.pid}-${name}.png`);
  const args = [
    '--model', entry.model,
    '--prompt', 'warm-up test render, plain gray background',
    // 2, not 1: the flow-match scheduler spreads timesteps over (steps - 1), so a
    // single-step render divides by zero.
    '--steps', '2',
    '--seed', '1',
    '--width', '512',
    '--height', '512',
    '--output', scratch,
  ];
  if (entry.modelPath) args.push('--path', entry.modelPath);
  if (entry.quantize) args.push('--quantize', String(entry.quantize));
  if (entry.extraArgs?.length) args.push(...entry.extraArgs);

  // stdio inherit so the Hugging Face download progress is live in the terminal —
  // a silent hour-long spawn would read as a hang. Same Xet workaround as
  // generate.ts: hf_xet still crashes on some large FLUX files.
  const run = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, HF_HUB_DISABLE_XET: '1' },
  });

  try {
    rmSync(scratch, { force: true });
  } catch {
    /* scratch render already gone */
  }

  if (run.error || run.status !== 0) {
    console.error('');
    console.error(
      `Weights download / warm-up for "${name}" failed` +
        (run.error ? `: ${run.error.message}` : ` (exit ${run.status})`) +
        '. If the model is GATED on Hugging Face: accept its license on the model page, create a ' +
        'Read token at https://huggingface.co/settings/tokens, then `hf auth login` and re-run. ' +
        'See Docs → Setup → Local image generation.',
    );
    return false;
  }

  console.log('');
  console.log(`✓ "${name}" is ready — weights cached, test render succeeded.`);
  return true;
}

async function main() {
  const config = loadGeneratorConfig();
  let requested = process.argv.slice(2).map((s) => s.trim()).filter(Boolean);

  if (requested.length === 1 && requested[0].toLowerCase() === 'all') {
    requested = Object.keys(config.models);
  } else if (requested.length === 0) {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      requested = await pickInteractively(config);
    } else {
      // Scripted/non-interactive (e.g. run by a skill in the background): the
      // config's default, exactly what Image with AI would use.
      requested = [config.default];
    }
  }

  // Resolve every name up front so a typo fails before anything downloads.
  const chosen: Array<{ name: string; entry: ModelConfig }> = [];
  for (const req of requested) {
    const { name, entry } = resolveModel(config, req); // the error names the valid entries
    if (!chosen.some((c) => c.name === name)) chosen.push({ name, entry });
  }

  ensureTools(chosen);

  const failed: string[] = [];
  for (const { name, entry } of chosen) {
    if (!downloadOne(name, entry)) failed.push(name);
    console.log('');
  }

  if (failed.length > 0) {
    console.error(`Done with failures: ${failed.join(', ')} — see the messages above.`);
    process.exit(1);
  }
  console.log(
    chosen.length > 1
      ? `✓ All ${chosen.length} entries handled. First real image will be fast.`
      : 'First real image will be fast.',
  );
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
