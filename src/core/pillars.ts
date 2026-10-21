// src/core/pillars.ts
// Pillars are per-user identity, read from the loaded profile. Code keeps only a
// widened type and profile-backed accessors; the previously hardcoded taxonomy
// constants moved to identity.yaml. See design 04-config-driven-discovery.

import { tryLoadIdentity } from '../profile/loader';
import { getSilos, type Silo } from './silos';
import { getDefaultPlatform, type Platform } from './registers';

/**
 * A pillar key. Pillar keys are user-defined in identity.yaml and validated at load
 * time, so the compile-time type is a documented `string` alias rather than a union.
 */
export type Pillar = string;

/** The profile's pillar keys, in declared order. Empty for a not-yet-set-up profile. */
export function getPillars(): Pillar[] {
  return tryLoadIdentity()?.pillars.map((p) => p.key) ?? [];
}

/** The human-readable label for a pillar key, falling back to the key itself if unknown. */
export function getPillarLabel(key: Pillar): string {
  const match = tryLoadIdentity()?.pillars.find((p) => p.key === key);
  return match ? match.label : key;
}

/** The pillar's guidance note, '' if unset or the key is unknown. */
export function getPillarNote(key: Pillar): string {
  const match = tryLoadIdentity()?.pillars.find((p) => p.key === key);
  return match ? match.note : '';
}

/**
 * The pillar's default silo for a platform: its declared default_silo when that key is
 * in the platform's roster, else null. A pillar is platform-agnostic, so a default that
 * belongs to another platform's roster is simply not applied here. Never throws for an
 * unknown pillar.
 */
export function getPillarDefaultSilo(
  key: Pillar,
  platform: Platform = getDefaultPlatform(),
): Silo | null {
  const match = tryLoadIdentity()?.pillars.find((p) => p.key === key);
  const declared = match?.default_silo ?? null;
  if (!declared) return null;
  return (getSilos(platform) as string[]).includes(declared) ? (declared as Silo) : null;
}
