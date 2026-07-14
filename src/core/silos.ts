// src/core/silos.ts
// A silo is a post's intent — the job it does and the response it is built to earn —
// orthogonal to its pillar (its topic). Unlike pillars, which are per-user identity read
// from identity.yaml, the silo roster is product behavior: it drives drafting and review
// branching, so it must be stable and uniform across every profile. The roster is a fixed
// code-level enum, and it is platform-keyed — symmetric with the register roster: each
// platform declares its own intent menu.
// See design 2026-07-03-reddit-publishing-channel/01-content-axes.

import { getDefaultPlatform, type Platform } from './registers';

/**
 * The full set of intent keys across every platform. LinkedIn: conversation, teach,
 * win, curate. Reddit: discuss, help, share, ask, curate. Web: how-to, explainer,
 * comparison, thought-piece, whitepaper. `curate` is intentionally shared by both
 * LinkedIn and Reddit; every other key belongs to exactly one platform, so a stored
 * key is unambiguous about which roster it came from without also storing the platform.
 */
export type Silo =
  | 'conversation' | 'teach' | 'win'                                        // LinkedIn-only
  | 'discuss' | 'help' | 'share' | 'ask'                                    // Reddit-only
  | 'how-to' | 'explainer' | 'comparison' | 'thought-piece' | 'whitepaper' // web-only
  | 'curate';                                                              // shared (LinkedIn + Reddit)

export interface SiloDef {
  key: Silo;
  label: string;
  /** One-line drafting/review guidance for this intent on its platform. */
  guidance: string;
}

export interface PlatformSilos {
  platform: Platform; // from src/core/registers.ts
  silos: SiloDef[]; // canonical order for that platform
}

const SILO_ROSTERS: PlatformSilos[] = [
  {
    platform: 'linkedin',
    silos: [
      {
        key: 'conversation',
        label: 'Conversation',
        guidance: 'Open a real conversation. Pose the honest question you are chewing on and invite replies, not applause.',
      },
      {
        key: 'teach',
        label: 'Teach',
        guidance: 'Lead with the takeaway, then the steps so the reader leaves able to do it. The only LinkedIn intent that may be product-adjacent.',
      },
      {
        key: 'win',
        label: 'Win',
        guidance: 'Tell a real result as a story, not a flex. The reader should learn from it, not just clap.',
      },
      {
        key: 'curate',
        label: 'Curate',
        guidance: "Point at someone else's work with your own framing and credit. Never a bare link.",
      },
    ],
  },
  {
    platform: 'reddit',
    silos: [
      {
        key: 'discuss',
        label: 'Discuss',
        guidance: "Open a genuine discussion — pose the real question you're chewing on, invite disagreement.",
      },
      {
        key: 'help',
        label: 'Help',
        guidance: 'Answer a concrete problem as a service. This is the teach-analog: the only Reddit intent that may be product-adjacent.',
      },
      {
        key: 'share',
        label: 'Share',
        guidance: 'Recount a first-person experience or result, plainly, with no flex. This is where a LinkedIn win relocates, stripped of the brag.',
      },
      {
        key: 'ask',
        label: 'Ask',
        guidance: "Solicit the community's input, recommendations, or gut-check.",
      },
      {
        key: 'curate',
        label: 'Curate',
        guidance: "Point at someone else's work with your own framing — never a bare link.",
      },
    ],
  },
  {
    platform: 'web',
    silos: [
      {
        key: 'how-to',
        label: 'How-to',
        guidance: 'Walk the reader through one task in ordered steps, so they finish able to do it themselves. The web teach-analog: the only web intent that may be product-adjacent.',
      },
      {
        key: 'explainer',
        label: 'Explainer',
        guidance: 'Make one concept clear from the ground up — define it, show why it matters, leave the reader able to reason about it.',
      },
      {
        key: 'comparison',
        label: 'Comparison',
        guidance: 'Weigh two or more options against stated criteria, plainly and fairly, so the reader can choose.',
      },
      {
        key: 'thought-piece',
        label: 'Thought piece',
        guidance: 'Stake a considered position on where the field is heading and defend it with reasoning, not hype.',
      },
      {
        key: 'whitepaper',
        label: 'Whitepaper',
        guidance: 'Make a thorough, evidence-backed case on a substantial topic, structured with sections and a short summary.',
      },
    ],
  },
];

/**
 * The intent keys for one platform, in canonical order. `platform` defaults to the
 * shipped default (LinkedIn); real callers pass the item's resolved platform explicitly.
 */
export function getSilos(platform: Platform = getDefaultPlatform()): Silo[] {
  const roster = SILO_ROSTERS.find((r) => r.platform === platform);
  return roster ? roster.silos.map((s) => s.key) : [];
}

/**
 * The human-readable label for any intent key, searched across every roster, falling
 * back to the key itself if unknown. `curate` is shared, so its label is identical in
 * both rosters (a roster invariant); the first match is returned.
 */
export function getSiloLabel(key: Silo): string {
  for (const roster of SILO_ROSTERS) {
    const match = roster.silos.find((s) => s.key === key);
    if (match) return match.label;
  }
  return key;
}

/**
 * The one-line drafting/review guidance for any intent key, searched across every
 * roster like getSiloLabel, falling back to an empty string if unknown.
 */
export function getSiloGuidance(key: Silo): string {
  for (const roster of SILO_ROSTERS) {
    const match = roster.silos.find((s) => s.key === key);
    if (match) return match.guidance;
  }
  return '';
}

/**
 * Product-adjacency is allowed only for the teach-shaped intent of each platform:
 * 'teach' on LinkedIn, 'help' on Reddit, 'how-to' on web. Because intent keys are
 * globally unique, this stays platform-free.
 */
export function siloMayBeProductAdjacent(silo: Silo): boolean {
  return silo === 'teach' || silo === 'help' || silo === 'how-to';
}
