// src/core/resolve-register.ts
// Resolves the register (platform + tone) that a post should be shaped in, folding
// three inputs together: the committed menu (src/core/registers.ts), the user's
// per-profile selection (the profile's identity.yaml platforms), and any per-item pin
// (idea_queue_items.platform/tone, set by spark). The result is what a drafter reads
// to color a draft in the right tone — soft guidance, never a hard rule.
// See design 2026-07-03-content-spine-register-axis/01-register-axis.

import {
  getRegister,
  getDefaultPlatform,
  getPlatforms,
  type Platform,
} from './registers';
import { loadIdentity, type Identity } from '../profile/loader';

export interface ResolvedRegister {
  platform: string;
  platformLabel: string;
  /** Resolved tone key, or null if the platform ships no tones. */
  tone: string | null;
  toneLabel: string | null;
  /** The tone's shipped guidance, or the user's note for a custom tone. Null if none. */
  toneGuidance: string | null;
  /** The owner's per-tone personalization note from identity.yaml, if any. */
  toneNote: string | null;
  /** Soft platform format hint (approx length, threading). Never enforced. */
  format: string;
  /** Where the platform came from, for transparent reporting. */
  source: 'pinned' | 'profile-default' | 'shipped-default';
}

/**
 * Resolve the register for a post.
 * @param identity the loaded profile identity (for platform/tone selection).
 * @param pinnedPlatform the item's pinned platform, or null/undefined for none.
 * @param pinnedTone the item's pinned tone, or null/undefined for none.
 */
export function resolveRegister(
  identity: Identity,
  pinnedPlatform?: string | null,
  pinnedTone?: string | null,
): ResolvedRegister {
  const valid = getPlatforms();
  const active = (identity.platforms ?? []).filter((p) => p.active);

  // Platform: pinned (if valid) → profile default (or first active) → shipped default.
  let platform: string;
  let source: ResolvedRegister['source'];
  if (pinnedPlatform && valid.includes(pinnedPlatform as Platform)) {
    platform = pinnedPlatform;
    source = 'pinned';
  } else {
    const def = active.find((p) => p.default) ?? active[0];
    if (def && valid.includes(def.key as Platform)) {
      platform = def.key;
      source = 'profile-default';
    } else {
      platform = getDefaultPlatform();
      source = 'shipped-default';
    }
  }

  const register = getRegister(platform as Platform);
  const platformSel = active.find((p) => p.key === platform);

  // Tone: pinned → user's first listed tone for this platform → shipped first tone.
  let tone: string | null = null;
  if (pinnedTone) tone = pinnedTone;
  else if (platformSel && platformSel.tones.length > 0) tone = platformSel.tones[0].key;
  else if (register && register.tones.length > 0) tone = register.tones[0].key;

  // Guidance: prefer the shipped tone's guidance; for a custom tone key fall back to the
  // owner's note. The note (if any) is always surfaced as the personalization layer.
  let toneLabel: string | null = null;
  let toneGuidance: string | null = null;
  let toneNote: string | null = null;
  if (tone) {
    const shipped = register?.tones.find((t) => t.key === tone);
    const userTone = platformSel?.tones.find((t) => t.key === tone);
    toneLabel = shipped?.label ?? tone;
    toneNote = userTone?.note ? userTone.note : null;
    toneGuidance = shipped?.guidance ?? toneNote;
  }

  return {
    platform,
    platformLabel: register?.label ?? platform,
    tone,
    toneLabel,
    toneGuidance,
    toneNote,
    format: register?.format ?? '',
    source,
  };
}

/** Convenience: resolve against the active profile's identity.yaml. */
export function resolveRegisterFromProfile(
  pinnedPlatform?: string | null,
  pinnedTone?: string | null,
): ResolvedRegister {
  return resolveRegister(loadIdentity(), pinnedPlatform, pinnedTone);
}
