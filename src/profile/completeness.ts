// src/profile/completeness.ts
// The completeness predicate from design 01-profile-model. A profile is
// "complete enough" to run when: the three files exist and are non-empty;
// identity.yaml parses; display_name is present; there is at least one pillar
// with a non-empty key, a non-empty label, and a numeric weight, and pillar
// keys are unique; every feed group is internally consistent; and voice-card.md
// carries a hard-rules section and at least one anchor voice sample. Optional
// fields (products, protected_relationships, cta_policy, enabled_lenses, and
// lenses) all have working defaults and never block completeness. Returns a
// structured result the onboarding gate consumes. Reads profile/ only.

import { readFileSync } from 'node:fs';
import {
  fileExistsNonEmpty,
  identityPath,
  interviewPath,
  parseIdentity,
  voiceCardPath,
  type Identity,
} from './loader';

export interface CompletenessResult {
  complete: boolean;
  missing: string[];
}

export function checkCompleteness(slug?: string): CompletenessResult {
  const missing: string[] = [];

  // 1. All three files exist and are non-empty.
  if (!fileExistsNonEmpty(voiceCardPath(slug))) {
    missing.push('profile/voice-card.md is missing or empty');
  }
  if (!fileExistsNonEmpty(interviewPath(slug))) {
    missing.push('profile/interview.md is missing or empty');
  }
  const identityPresent = fileExistsNonEmpty(identityPath(slug));
  if (!identityPresent) {
    missing.push('profile/identity.yaml is missing or empty');
  }

  // 2. identity.yaml parses, and its required fields hold.
  let identity: Identity | null = null;
  if (identityPresent) {
    try {
      identity = parseIdentity(readFileSync(identityPath(slug), 'utf8'));
    } catch (err) {
      missing.push(
        `profile/identity.yaml does not parse as valid YAML: ${(err as Error).message}`,
      );
    }
  }

  if (identity) {
    if (identity.display_name.trim().length === 0) {
      missing.push('identity.yaml display_name is required and must be non-empty');
    }

    // pillars: at least one entry; each with non-empty key + label and a
    // numeric weight; keys unique.
    if (identity.pillars.length === 0) {
      missing.push('identity.yaml pillars must have at least one entry');
    } else {
      const seenKeys = new Set<string>();
      identity.pillars.forEach((pillar, index) => {
        if (pillar.key.trim().length === 0) {
          missing.push(`identity.yaml pillars[${index}] has an empty key`);
        } else if (seenKeys.has(pillar.key)) {
          missing.push(
            `identity.yaml pillars[${index}] key "${pillar.key}" is duplicated; keys must be unique`,
          );
        } else {
          seenKeys.add(pillar.key);
        }
        if (pillar.label.trim().length === 0) {
          missing.push(`identity.yaml pillars[${index}] has an empty label`);
        }
        if (!Number.isFinite(pillar.weight)) {
          missing.push(`identity.yaml pillars[${index}] weight must be a number`);
        }
      });
    }

    // feed_groups: where present, internally consistent. Zero groups is valid.
    const pillarKeys = new Set(identity.pillars.map((pillar) => pillar.key));
    identity.feed_groups.forEach((group, index) => {
      if (!pillarKeys.has(group.pillar)) {
        missing.push(
          `identity.yaml feed_groups[${index}] pillar "${group.pillar}" does not match any declared pillar key`,
        );
      }
      if (group.sources.length === 0) {
        missing.push(`identity.yaml feed_groups[${index}] must have at least one source`);
      }
      group.sources.forEach((source, sourceIndex) => {
        if (source.name.trim().length === 0) {
          missing.push(
            `identity.yaml feed_groups[${index}].sources[${sourceIndex}] is missing a name`,
          );
        }
        if (source.url.trim().length === 0) {
          missing.push(
            `identity.yaml feed_groups[${index}].sources[${sourceIndex}] is missing a url`,
          );
        }
      });
    });
  }

  // 3. voice-card.md carries a hard-rules section and an anchor voice sample.
  if (fileExistsNonEmpty(voiceCardPath(slug))) {
    const card = readFileSync(voiceCardPath(slug), 'utf8');
    if (!/hard rules/i.test(card)) {
      missing.push('profile/voice-card.md is missing a hard-rules section');
    }
    if (!/anchor sample/i.test(card)) {
      missing.push('profile/voice-card.md is missing an anchor voice sample');
    }
  }

  return { complete: missing.length === 0, missing };
}
