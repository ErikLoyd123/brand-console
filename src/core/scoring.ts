// src/core/scoring.ts
// Single 0-100 score for an IdeaQueueItem. Relevance dominates, then freshness,
// then the user's likely interest. See design 03-discovery-layer "Tagging and prioritization".

const WEIGHTS = { relevance: 0.5, freshness: 0.3, interest: 0.2 } as const;

/** Clamp any number into the 0..1 range. */
function unit(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Blend three 0..1 signals into an integer 0..100.
 * @param relevance how cleanly the item fits its pillar
 * @param freshness how timely the material is
 * @param interest how much the user would actually want to post it
 */
export function score(relevance: number, freshness: number, interest: number): number {
  const blended =
    WEIGHTS.relevance * unit(relevance) +
    WEIGHTS.freshness * unit(freshness) +
    WEIGHTS.interest * unit(interest);
  return Math.round(blended * 100);
}

const FRESH_WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // 14 days to full decay

/**
 * Derive a 0..1 freshness signal from a publish time. Today is 1.0, linearly
 * decaying to 0 at 14 days old. Missing/invalid dates score a neutral 0.5.
 */
export function freshnessScore(publishedAt: number | null | undefined, now: number = Date.now()): number {
  if (publishedAt == null || Number.isNaN(publishedAt)) return 0.5;
  const ageMs = now - publishedAt;
  if (ageMs <= 0) return 1;
  return unit(1 - ageMs / FRESH_WINDOW_MS);
}
