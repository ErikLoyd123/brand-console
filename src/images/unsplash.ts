// src/images/unsplash.ts
// Bring-your-own-key Unsplash source. The access key lives server-side only
// (UNSPLASH_ACCESS_KEY in .env, per the secrets boundary) — the console reaches
// search through /api/images/unsplash/search, never with the key in the browser.
//
// API etiquette per Unsplash guidelines: downloads go through the photo's
// download_location endpoint (this credits the photographer's download count),
// and every stored photo carries photographer attribution in its params so the
// console and any published caption can credit correctly.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from '../profile/loader';

const API_BASE = 'https://api.unsplash.com';

// The API server gets .env via node's --env-file-if-exists flag, but the
// skill-facing CLIs (unsplash-image.ts etc.) run through plain `npx tsx`, which
// loads nothing. Fill that gap here: when the key is absent, pull in the repo's
// .env once at module load. loadEnvFile never overrides variables already set.
if (!process.env.UNSPLASH_ACCESS_KEY) {
  const envPath = resolve(REPO_ROOT, '.env');
  if (existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      /* unreadable .env — the configured check below reports it plainly */
    }
  }
}

export interface UnsplashPhoto {
  id: string;
  description: string;
  altDescription: string;
  width: number;
  height: number;
  // Ready-to-display preview (small) and the page URL for attribution links.
  thumbUrl: string;
  previewUrl: string;
  htmlUrl: string;
  photographer: string;
  photographerUsername: string;
}

export function unsplashConfigured(): boolean {
  return typeof process.env.UNSPLASH_ACCESS_KEY === 'string' && process.env.UNSPLASH_ACCESS_KEY !== '';
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` };
}

interface RawPhoto {
  id: string;
  description: string | null;
  alt_description: string | null;
  width: number;
  height: number;
  urls: { raw: string; full: string; regular: string; small: string; thumb: string };
  links: { html: string; download_location: string };
  user: { name: string; username: string };
}

function simplify(raw: RawPhoto): UnsplashPhoto {
  return {
    id: raw.id,
    description: raw.description ?? '',
    altDescription: raw.alt_description ?? '',
    width: raw.width,
    height: raw.height,
    thumbUrl: raw.urls.thumb,
    previewUrl: raw.urls.small,
    htmlUrl: raw.links.html,
    photographer: raw.user.name,
    photographerUsername: raw.user.username,
  };
}

export async function searchUnsplash(
  query: string,
  options?: { page?: number; perPage?: number; orientation?: 'landscape' | 'portrait' | 'squarish' },
): Promise<{ total: number; results: UnsplashPhoto[] }> {
  if (!unsplashConfigured()) {
    throw new Error('Unsplash is not configured. Add UNSPLASH_ACCESS_KEY to .env.');
  }
  const params = new URLSearchParams({
    query,
    page: String(options?.page ?? 1),
    per_page: String(options?.perPage ?? 12),
  });
  if (options?.orientation) params.set('orientation', options.orientation);

  const res = await fetch(`${API_BASE}/search/photos?${params}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Unsplash search failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { total: number; results: RawPhoto[] };
  return { total: json.total, results: json.results.map(simplify) };
}

export interface DownloadedUnsplashPhoto {
  buffer: Buffer;
  ext: 'jpg';
  width: number;
  height: number;
  alt: string;
  // Provenance for the images row: photo id, photographer credit, page URL.
  params: Record<string, unknown>;
}

export async function downloadUnsplashPhoto(photoId: string): Promise<DownloadedUnsplashPhoto> {
  if (!unsplashConfigured()) {
    throw new Error('Unsplash is not configured. Add UNSPLASH_ACCESS_KEY to .env.');
  }
  const photoRes = await fetch(`${API_BASE}/photos/${encodeURIComponent(photoId)}`, {
    headers: authHeaders(),
  });
  if (!photoRes.ok) {
    throw new Error(`Unsplash photo lookup failed: HTTP ${photoRes.status}`);
  }
  const raw = (await photoRes.json()) as RawPhoto;

  // Required flow: hit download_location (registers the download with Unsplash),
  // which returns the actual file URL to fetch.
  const dlRes = await fetch(raw.links.download_location, { headers: authHeaders() });
  if (!dlRes.ok) {
    throw new Error(`Unsplash download registration failed: HTTP ${dlRes.status}`);
  }
  const { url } = (await dlRes.json()) as { url: string };
  const fileRes = await fetch(url);
  if (!fileRes.ok) {
    throw new Error(`Unsplash file fetch failed: HTTP ${fileRes.status}`);
  }
  const buffer = Buffer.from(await fileRes.arrayBuffer());

  return {
    buffer,
    ext: 'jpg',
    width: raw.width,
    height: raw.height,
    alt: raw.alt_description ?? raw.description ?? '',
    params: {
      unsplashId: raw.id,
      photographer: raw.user.name,
      photographerUsername: raw.user.username,
      photoUrl: raw.links.html,
      attribution: `Photo by ${raw.user.name} on Unsplash`,
    },
  };
}
