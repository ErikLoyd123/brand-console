// src/images/preview-jobs.ts
// Server-owned generation jobs for candidate previews. Local generation takes minutes,
// and a headless console session (src/server/skill-engine.ts) tears down everything it
// spawned the moment its run ends — so a candidate wave launched as a background shell
// inside that session died with it, and the card's Images strip waited forever. Jobs
// queued here belong to the API process instead: the session (or anything else) asks
// the server to generate, can end its run right away, and each candidate still lands in
// data/images/previews/<ideaId>/ where the strip picks it up.
//
// Each job runs the generate-image.ts CLI as a child process of the API rather than
// calling the generator in-process: the mflux backend shells out synchronously, which
// would freeze the whole API (every route, the console's polling) for the length of a
// generation. Jobs run one at a time, oldest first: local models are GPU-bound, and
// running a wave in parallel only makes every candidate slower (and can exhaust memory).
// State is in-memory on purpose: a job is transient like the preview file it writes,
// and a restarted server simply has none running.

import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { nanoid } from 'nanoid';
import { REPO_ROOT } from '../profile/loader';
import { previewDirForIdea, requireIdea } from './store';

const GENERATE_CLI = resolve(REPO_ROOT, 'src', 'images', 'generate-image.ts');

// One safe filename segment: no separators, no dotfiles (mirrors the previews routes).
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type PreviewJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface PreviewJob {
  id: string;
  ideaId: string;
  // The preview filename the job writes, e.g. candidate-seed42.png.
  name: string;
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  status: PreviewJobStatus;
  error?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface PreviewJobRequest {
  ideaId: string;
  prompt: string;
  name?: string;
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
}

// Finished jobs linger this long so a poller (the strip, the skill's wait) can see how
// they ended; after that they are dropped.
const FINISHED_TTL_MS = 30 * 60 * 1000;

const jobs: PreviewJob[] = [];
let running = false;

function prune(): void {
  const cutoff = Date.now() - FINISHED_TTL_MS;
  for (let i = jobs.length - 1; i >= 0; i--) {
    const j = jobs[i];
    if ((j.status === 'done' || j.status === 'failed') && (j.finishedAt ?? 0) < cutoff) {
      jobs.splice(i, 1);
    }
  }
}

function optionalNumber(v: unknown, field: string): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`"${field}" must be a number`);
  return v;
}

// Validate and enqueue one candidate. Throws with a plain message on a bad request
// (unknown idea, empty prompt, unsafe filename) so the route can return it as a 400.
export function enqueuePreviewJob(req: PreviewJobRequest): PreviewJob {
  if (typeof req.ideaId !== 'string' || !SAFE_SEGMENT.test(req.ideaId)) {
    throw new Error('a valid "ideaId" is required');
  }
  requireIdea(req.ideaId);
  if (typeof req.prompt !== 'string' || req.prompt.trim() === '') {
    throw new Error('"prompt" must be a non-empty string');
  }
  const seed = optionalNumber(req.seed, 'seed');
  const name = req.name ?? `candidate-seed${seed ?? nanoid(6)}.png`;
  if (!SAFE_SEGMENT.test(name) || !/\.png$/i.test(name)) {
    throw new Error('"name" must be a simple .png filename (letters, digits, . _ -)');
  }
  if (
    jobs.some(
      (j) => j.ideaId === req.ideaId && j.name === name && (j.status === 'queued' || j.status === 'running'),
    )
  ) {
    throw new Error(`a job for ${name} is already queued or running`);
  }

  prune();
  const job: PreviewJob = {
    id: nanoid(),
    ideaId: req.ideaId,
    name,
    prompt: req.prompt.trim(),
    model: typeof req.model === 'string' && req.model !== '' ? req.model : undefined,
    width: optionalNumber(req.width, 'width'),
    height: optionalNumber(req.height, 'height'),
    steps: optionalNumber(req.steps, 'steps'),
    seed,
    status: 'queued',
    createdAt: Date.now(),
  };
  jobs.push(job);
  void drain();
  return job;
}

export function listPreviewJobs(ideaId: string): PreviewJob[] {
  prune();
  return jobs.filter((j) => j.ideaId === ideaId);
}

// Run queued jobs one at a time until none are left. A failure marks that job and moves
// on; it never stops the queue or throws into the server.
async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const job = jobs.find((j) => j.status === 'queued');
      if (!job) return;
      job.status = 'running';
      job.startedAt = Date.now();
      try {
        const dir = previewDirForIdea(job.ideaId);
        mkdirSync(dir, { recursive: true });
        await runGenerateCli(job, join(dir, job.name));
        job.status = 'done';
      } catch (e) {
        job.status = 'failed';
        job.error = e instanceof Error ? e.message : String(e);
      } finally {
        job.finishedAt = Date.now();
      }
    }
  } finally {
    running = false;
  }
}

// Run generate-image.ts in preview mode for one job and resolve when it exits. A
// non-zero exit rejects with the CLI's own one-line error (e.g. "mflux is not
// installed"), which the job carries so the strip and the skill can show why.
function runGenerateCli(job: PreviewJob, outPath: string): Promise<void> {
  const payloadPath = join(tmpdir(), `preview-job-${job.id}.json`);
  writeFileSync(
    payloadPath,
    JSON.stringify({
      prompt: job.prompt,
      model: job.model,
      width: job.width,
      height: job.height,
      steps: job.steps,
      seed: job.seed,
      out: outPath,
    }),
  );
  return new Promise<void>((resolvePromise, reject) => {
    let stderr = '';
    const child = spawn(process.execPath, ['--import', 'tsx', GENERATE_CLI, payloadPath], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-4000);
    });
    const cleanup = () => rmSync(payloadPath, { force: true });
    child.on('error', (e) => {
      cleanup();
      reject(e);
    });
    child.on('close', (code) => {
      cleanup();
      if (code === 0) return resolvePromise();
      const lines = stderr.trim().split('\n').filter((l) => l.trim() !== '');
      const last = lines[lines.length - 1] ?? `exited with code ${code}`;
      reject(new Error(last.replace(/^generate-image:\s*/, '')));
    });
  });
}
