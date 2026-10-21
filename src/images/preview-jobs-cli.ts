// src/images/preview-jobs-cli.ts
// CLI the imagery procedure uses to generate candidate previews through the API
// server's job queue (src/images/preview-jobs.ts) instead of a background shell. The
// server owns the jobs, so they survive the calling session ending — which a headless
// console session always does when its run finishes.
//
//   npx tsx src/images/preview-jobs-cli.ts start <payload.json>
//     payload: { "ideaId", "prompt", "seeds"?: number[], "seed"?, "name"?, "model"?,
//                "width"?, "height"?, "steps"? }
//     Queues the wave and prints the queued jobs. Returns immediately.
//
//   npx tsx src/images/preview-jobs-cli.ts wait <ideaId> [maxSeconds]
//     Polls until no job for the idea is queued or running (or maxSeconds passes,
//     default 480 so it fits a 10-minute shell timeout), then prints
//     { done: [names], failed: [{ name, error }], pending: [names] }. Run it again to
//     keep waiting when `pending` is non-empty.
//
// Exits 2 with a plain message when the API is not reachable, so the caller can fall
// back (an interactive terminal session can still run generate-image.ts in the
// background; a console session cannot, since the API is what runs it).

import { readFileSync } from 'node:fs';

const API = process.env.BRAND_API_URL ?? 'http://localhost:5174';

interface Job {
  name: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  error?: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    console.error(
      `preview-jobs: the API is not reachable at ${API}. Start it with \`npm run server\`, ` +
        'or (interactive terminal sessions only) run src/images/generate-image.ts in the background.',
    );
    process.exit(2);
  }
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {
      /* not JSON — keep the raw text */
    }
    throw new Error(`${res.status} ${message}`);
  }
  return JSON.parse(text) as T;
}

async function start(payloadPath: string | undefined): Promise<void> {
  if (!payloadPath) throw new Error('usage: preview-jobs-cli.ts start <payload.json>');
  const payload = readFileSync(payloadPath, 'utf8');
  const jobs = await api<Job[]>('/images/previews/generate', { method: 'POST', body: payload });
  console.log(JSON.stringify(jobs.map((j) => ({ name: j.name, status: j.status })), null, 2));
}

async function wait(ideaId: string | undefined, maxSecondsArg: string | undefined): Promise<void> {
  if (!ideaId) throw new Error('usage: preview-jobs-cli.ts wait <ideaId> [maxSeconds]');
  const maxSeconds = maxSecondsArg ? Number(maxSecondsArg) : 480;
  const deadline = Date.now() + maxSeconds * 1000;
  let jobs: Job[] = [];
  for (;;) {
    jobs = await api<Job[]>(`/images/previews/jobs?ideaId=${encodeURIComponent(ideaId)}`);
    const active = jobs.some((j) => j.status === 'queued' || j.status === 'running');
    if (!active || Date.now() >= deadline) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log(
    JSON.stringify(
      {
        done: jobs.filter((j) => j.status === 'done').map((j) => j.name),
        failed: jobs.filter((j) => j.status === 'failed').map((j) => ({ name: j.name, error: j.error })),
        pending: jobs.filter((j) => j.status === 'queued' || j.status === 'running').map((j) => j.name),
      },
      null,
      2,
    ),
  );
}

const [cmd, a, b] = process.argv.slice(2);
(cmd === 'start' ? start(a) : cmd === 'wait' ? wait(a, b) : Promise.reject(new Error('usage: preview-jobs-cli.ts start|wait …')))
  .catch((e) => {
    console.error(`preview-jobs: ${(e as Error).message}`);
    process.exit(1);
  });
