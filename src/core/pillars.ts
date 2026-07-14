// src/core/pillars.ts
// Pillars are per-user identity, read from the loaded profile. Code keeps only a
// widened type and profile-backed accessors; the previously hardcoded taxonomy
// constants moved to identity.yaml. See design 04-config-driven-discovery.

import { tryLoadIdentity } from '../profile/loader';

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
