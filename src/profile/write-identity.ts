// src/profile/write-identity.ts
// Comment-preserving writes to profile/identity.yaml for the config sections the console
// can edit (pillars, platforms). Uses yaml's Document API so replacing one section leaves
// the rest of the file — including its comments — intact. Validation mirrors the
// completeness contract (src/profile/completeness.ts) and the register menu
// (src/core/registers.ts). See design 2026-07-03-content-spine-register-axis.

import { readFileSync, writeFileSync } from 'node:fs';
import { parseDocument, type Document } from 'yaml';
import { identityPath } from './loader';
import { getPlatforms, type Platform } from '../core/registers';

export interface PillarInput {
  key: string;
  label: string;
  weight: number;
}

export interface ToneInput {
  key: string;
  note?: string;
}

export interface PlatformInput {
  key: string;
  active?: boolean;
  default?: boolean;
  tones?: ToneInput[];
  themes?: ToneInput[];
}

// Thrown for any caller-fixable problem; routes map it to a 400 with the message.
export class ValidationError extends Error {}

function loadDoc(): Document {
  return parseDocument(readFileSync(identityPath(), 'utf8'));
}

function saveDoc(doc: Document): void {
  // lineWidth: 0 disables yaml's default 80-col wrapping, and flowCollectionPadding: false
  // drops the inner-bracket spaces yaml adds by default — together they keep an edit to one
  // section from reflowing or restyling unrelated lines (e.g. a long inline keywords: [...]).
  writeFileSync(identityPath(), doc.toString({ lineWidth: 0, flowCollectionPadding: false }), 'utf8');
}

function cleanTones(tones: ToneInput[] | undefined): { key: string; note: string }[] {
  if (!Array.isArray(tones)) return [];
  const out: { key: string; note: string }[] = [];
  for (const t of tones) {
    const key = String(t?.key ?? '').trim();
    if (!key) continue;
    out.push({ key, note: String(t?.note ?? '').trim() });
  }
  return out;
}

// Replace the whole pillars list. At least one pillar with a unique key, a label, and a
// numeric weight is required, matching the completeness contract.
export function writePillars(pillars: PillarInput[]): PillarInput[] {
  if (!Array.isArray(pillars) || pillars.length === 0) {
    throw new ValidationError('At least one pillar is required.');
  }
  const seen = new Set<string>();
  const clean = pillars.map((p, i) => {
    const key = String(p?.key ?? '').trim();
    const label = String(p?.label ?? '').trim();
    const weight = Number(p?.weight);
    if (!key) throw new ValidationError(`Pillar ${i + 1} needs a key.`);
    if (!label) throw new ValidationError(`Pillar "${key}" needs a label.`);
    if (!Number.isFinite(weight) || weight < 0) {
      throw new ValidationError(`Pillar "${key}" needs a numeric weight of 0 or more.`);
    }
    if (seen.has(key)) throw new ValidationError(`Duplicate pillar key "${key}".`);
    seen.add(key);
    return { key, label, weight };
  });

  const doc = loadDoc();
  doc.set('pillars', clean);
  saveDoc(doc);
  return clean;
}

// Replace the whole platforms selection. Every key must match a Platform in the shipped
// registers menu; at most one active platform may be the default. An empty list is valid
// (the engine falls back to the shipped default platform).
export function writePlatforms(platforms: PlatformInput[]): PlatformInput[] {
  if (!Array.isArray(platforms)) throw new ValidationError('platforms must be a list.');
  const valid = new Set<string>(getPlatforms());
  const seen = new Set<string>();
  let activeDefaults = 0;

  const clean = platforms.map((p) => {
    const key = String(p?.key ?? '').trim();
    if (!key) throw new ValidationError('A platform entry needs a key.');
    if (!valid.has(key)) {
      throw new ValidationError(`Unknown platform "${key}". Known: ${[...valid].join(', ')}.`);
    }
    if (seen.has(key)) throw new ValidationError(`Duplicate platform "${key}".`);
    seen.add(key);
    const active = p.active !== false;
    const isDefault = p.default === true;
    if (active && isDefault) activeDefaults++;
    return {
      key: key as Platform,
      active,
      default: isDefault,
      tones: cleanTones(p.tones),
      themes: cleanTones(p.themes),
    };
  });

  if (activeDefaults > 1) {
    throw new ValidationError('Only one active platform can be the default.');
  }

  const doc = loadDoc();
  doc.set('platforms', clean);
  saveDoc(doc);
  return clean;
}

// Upsert a single platform's selection, leaving every other platform's entry intact.
// The register skill configures one platform per walk, so this is its write primitive:
// it merges the one entry into the stored list and delegates to writePlatforms for the
// same validation and comment-preserving save. When the incoming entry is the default,
// it clears default on the others first (mirroring the console's single-default radio),
// so the "one active default" rule is upheld by moving the default, never by erroring.
export function writePlatform(input: PlatformInput): PlatformInput[] {
  const key = String(input?.key ?? '').trim();
  if (!key) throw new ValidationError('A platform entry needs a key.');

  const currentNode = loadDoc().get('platforms');
  const current = (currentNode ? (currentNode as { toJSON(): unknown }).toJSON() : []) as PlatformInput[];
  const incomingDefault = input.default === true;

  const merged: PlatformInput[] = [];
  let replaced = false;
  for (const p of Array.isArray(current) ? current : []) {
    if (String(p?.key ?? '').trim() === key) {
      merged.push(input);
      replaced = true;
    } else {
      merged.push(incomingDefault ? { ...p, default: false } : p);
    }
  }
  if (!replaced) merged.push(input);

  return writePlatforms(merged);
}

// Set a single tone/theme's note in place, leaving everything else untouched. This is the
// register walk's *progressive* write: as the user confirms how each tone sounds, the skill
// calls this so that one "how it sounds in your voice" field lands immediately (the console
// refetches mid-walk), without disturbing the other leans. If the tone/theme key isn't in
// the platform's list yet (a newly-leaned shipped tone, or a just-named custom one), it's
// appended; the platform entry is created if absent. The authoritative full selection is
// still written once at the end via writePlatform. Reuses writePlatforms for validation.
export function writeRegisterNote(
  platformKey: string,
  kind: 'tones' | 'themes',
  key: string,
  note: string,
): PlatformInput[] {
  const pk = String(platformKey ?? '').trim();
  const tk = String(key ?? '').trim();
  if (!pk) throw new ValidationError('A platform key is required.');
  if (kind !== 'tones' && kind !== 'themes') {
    throw new ValidationError('kind must be "tones" or "themes".');
  }
  if (!tk) throw new ValidationError('A tone/theme key is required.');

  const currentNode = loadDoc().get('platforms');
  const current = (currentNode ? (currentNode as { toJSON(): unknown }).toJSON() : []) as PlatformInput[];
  const list: PlatformInput[] = (Array.isArray(current) ? current : []).map((p) => ({ ...p }));

  let entry = list.find((p) => String(p?.key ?? '').trim() === pk);
  if (!entry) {
    entry = { key: pk, active: true, default: false, tones: [], themes: [] };
    list.push(entry);
  }
  const items: ToneInput[] = Array.isArray(entry[kind]) ? [...(entry[kind] as ToneInput[])] : [];
  const existing = items.find((t) => String(t?.key ?? '').trim() === tk);
  if (existing) existing.note = note;
  else items.push({ key: tk, note });
  entry[kind] = items;

  return writePlatforms(list);
}
