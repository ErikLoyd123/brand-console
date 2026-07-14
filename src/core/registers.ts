// src/core/registers.ts
// A register is how a post sounds and where it ships — a platform plus a tone,
// orthogonal to its pillar (topic) and silo (intent). Like the silo roster, the
// menu is product behavior: it is fixed in code and uniform across every profile.
// Per-user platform/tone selection layers on top in the profile's identity.yaml.
// See design 2026-07-03-content-spine-register-axis/01-register-axis.

/**
 * A platform key. The roster is fixed in code; adding a platform is a committed-code
 * change (a PR), so this is a narrow string-literal union. LinkedIn and Reddit ship now.
 */
export type Platform = 'linkedin' | 'reddit' | 'web';

export interface Tone {
  key: string;
  label: string;
  guidance: string;
}

export interface Theme {
  key: string;
  label: string;
  guidance: string;
}

export interface PlatformRegister {
  key: Platform;
  label: string;
  tones: Tone[];
  themes: Theme[];
  /** Soft guidance only — approx length, threading note. Never enforced. */
  format: string;
}

const REGISTERS: PlatformRegister[] = [
  {
    key: 'linkedin',
    label: 'LinkedIn',
    format:
      'Single post, roughly 100-250 words. Lead with the hook line; blank lines ' +
      'between short paragraphs. Thread only when a second beat truly needs room.',
    tones: [
      {
        key: 'plain-professional',
        label: 'Plain professional',
        guidance: 'Direct and unadorned. No hype, no jargon. Say the true thing plainly.',
      },
      {
        key: 'contrarian',
        label: 'Contrarian',
        guidance: 'Name the common belief, then the sharper counter you actually hold.',
      },
      {
        key: 'warm-story',
        label: 'Warm story',
        guidance: 'Open on a concrete moment or person; let the point land through it.',
      },
      {
        key: 'straight-teach',
        label: 'Straight teach',
        guidance: 'Lead with the takeaway, then the steps. Reader leaves able to do it.',
      },
    ],
    // Neutral, universal starter themes only. A user's own domain-specific
    // themes are per-user nuance and live in the profile's identity.yaml, never here —
    // committed code carries no user-specific themes. See the structural/nuance
    // split in design 00-overview.
    themes: [
      {
        key: 'lessons-learned',
        label: 'Lessons learned',
        guidance: 'A hard-won lesson from real work, framed so the reader can use it.',
      },
      {
        key: 'behind-the-scenes',
        label: 'Behind the scenes',
        guidance: 'How the work actually happens — the unglamorous, real version.',
      },
      {
        key: 'industry-take',
        label: 'Industry take',
        guidance: 'A pointed observation on where your field is heading or getting wrong.',
      },
    ],
  },
  {
    key: 'reddit',
    label: 'Reddit',
    format:
      'A title plus a markdown self-post body. Write the title as a plain, ' +
      'specific statement or question — no clickbait. Body in real markdown ' +
      '(paragraphs, lists, code fences). Per-subreddit length and flair rules ' +
      'are checked by the publish preflight, not here.',
    tones: [
      {
        key: 'plain-direct',
        label: 'Plain direct',
        guidance: 'Say the true thing straight. No marketing voice, no hedging, no hook-bait.',
      },
      {
        key: 'first-person-experience',
        label: 'First-person experience',
        guidance: 'Speak from what you actually did or saw. "I tried X, here is what happened."',
      },
      {
        key: 'helpful-plain',
        label: 'Helpful plain',
        guidance: 'Answer the question as a favor to a stranger. Concrete steps, no upsell.',
      },
      {
        key: 'dry-wit',
        label: 'Dry wit',
        guidance: 'Understated, deadpan. Earn the room with restraint, never try-hard jokes.',
      },
    ],
    // Neutral universal starter themes only — mirror the LinkedIn starters. A user's own
    // domain themes live in the profile's identity.yaml per the structural/nuance split.
    themes: [
      {
        key: 'lessons-learned',
        label: 'Lessons learned',
        guidance: 'A hard-won lesson from real work, framed so the reader can use it.',
      },
      {
        key: 'behind-the-scenes',
        label: 'Behind the scenes',
        guidance: 'How the work actually happens — the unglamorous, real version.',
      },
      {
        key: 'industry-take',
        label: 'Industry take',
        guidance: 'A pointed observation on where your field is heading or getting wrong.',
      },
    ],
  },
  {
    key: 'web',
    label: 'Web (long-form)',
    format:
      'A long-form article published to a site, exported as markdown with SEO ' +
      'frontmatter. Typical lengths by kind: how-to and comparison ~800-1500 words, ' +
      'explainer ~1000-2000, thought piece ~800-1500, whitepaper ~2000-4000. Structure ' +
      'with descriptive H2/H3 headings, an opening that states what the reader will get, ' +
      'and a short closing takeaway. Soft guidance only — the artifact carries the real ' +
      'depth/length setting and the ordered sections.',
    tones: [
      {
        key: 'authoritative-plain',
        label: 'Authoritative, plain',
        guidance: 'Speak with earned authority and zero hype. State what is true and why it holds; no marketing gloss.',
      },
      {
        key: 'practitioner',
        label: 'Practitioner',
        guidance: 'Write as someone who has done the work. Concrete detail, real tradeoffs, no theory-only claims.',
      },
      {
        key: 'educational',
        label: 'Educational',
        guidance: 'Teach from first principles. Define terms, build up in order, leave the reader able to reason about it.',
      },
      {
        key: 'analytical',
        label: 'Analytical',
        guidance: 'Weigh options and evidence in the open. Compare, quantify where you can, name the tradeoffs plainly.',
      },
      {
        key: 'measured-opinion',
        label: 'Measured opinion',
        guidance: 'Stake a clear position and defend it with reasoning, not volume. Concede the honest counterpoint.',
      },
    ],
    // Neutral universal starter themes only — mirror the LinkedIn/Reddit starters. A user's own
    // domain themes live in the profile's identity.yaml per the structural/nuance split.
    themes: [
      {
        key: 'foundational-guide',
        label: 'Foundational guide',
        guidance: 'An evergreen explainer of a core concept the audience keeps needing.',
      },
      {
        key: 'state-of-the-practice',
        label: 'State of the practice',
        guidance: 'Where a field actually stands today, honestly assessed.',
      },
      {
        key: 'decision-guide',
        label: 'Decision guide',
        guidance: 'Help the reader make a specific choice, with the tradeoffs laid out.',
      },
    ],
  },
];

/** All platform keys, in canonical order. */
export function getPlatforms(): Platform[] {
  return REGISTERS.map((r) => r.key);
}

/** The full register for a platform key, or undefined if unknown. */
export function getRegister(key: Platform): PlatformRegister | undefined {
  return REGISTERS.find((r) => r.key === key);
}

/** The platform assumed when a caller specifies none. First in the roster. */
export function getDefaultPlatform(): Platform {
  return REGISTERS[0].key;
}
