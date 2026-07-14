// src/review/seo-checks.ts
// Mechanical SEO sanity checks for long-form web articles — a sibling of voice-checks.ts, kept
// separate so voice-checks stays short-form-clean (no SEO fields in its input). The
// content-reviewer runs these ONLY when the piece under review is a web article. Returns the
// same Finding[] shape voice-checks.ts uses; a `warn` is a recommendation, a `fail` makes the
// article reviewStatus 'failed'. Length-target proximity is guidance, never a gate. See design
// 2026-07-13-multi-profile-longform-lane/04-articles-artifact-and-pipeline.

import type { Finding } from './voice-checks';

export interface SeoCheckSection {
  heading: string;
  body: string;
}

export interface SeoCheckInput {
  title: string;
  /** Legacy structured sections (pre-restructure rows). Used only when `body` is absent. */
  sections: SeoCheckSection[];
  /** The whole article as one markdown document — the editing surface since the
   *  queue-workbench restructure. When present, headings are read from its `##` lines. */
  body?: string;
  targetKeyword: string;
  metaDescription: string;
}

// The lead heading: the first markdown `##`/`###` line of the body when the article is a
// single document, else the first structured section's heading (legacy rows).
function firstHeadingOf(input: SeoCheckInput): string {
  const body = (input.body ?? '').trim();
  if (body !== '') {
    const m = body.match(/^#{2,3}\s+(.+)$/m);
    return m ? m[1].trim() : '';
  }
  return input.sections.length > 0 ? input.sections[0].heading : '';
}

function includesInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function runSeoChecks(input: SeoCheckInput): Finding[] {
  const findings: Finding[] = [];
  const keyword = input.targetKeyword.trim();
  const meta = input.metaDescription ?? '';

  // Target keyword present in the title — fail if absent (or if no keyword is set at all).
  if (keyword === '' || !includesInsensitive(input.title, keyword)) {
    findings.push({
      rule: 'seo-keyword-in-title',
      severity: 'fail',
      message:
        keyword === ''
          ? 'No target keyword set. Set the target keyword so it can appear in the title.'
          : `Target keyword "${keyword}" is not in the title. Work it into the title.`,
      matches: keyword === '' ? [] : [keyword],
    });
  }

  // Keyword present in the lead heading — warn if absent.
  const firstHeading = firstHeadingOf(input);
  if (keyword !== '' && !includesInsensitive(firstHeading, keyword)) {
    findings.push({
      rule: 'seo-keyword-in-first-heading',
      severity: 'warn',
      message: `Target keyword "${keyword}" is not in the first section heading. Consider working it into the lead heading.`,
      matches: [keyword],
    });
  }

  // Keyword present in the meta description — warn if absent.
  if (keyword !== '' && !includesInsensitive(meta, keyword)) {
    findings.push({
      rule: 'seo-keyword-in-meta',
      severity: 'warn',
      message: `Target keyword "${keyword}" is not in the meta description. Consider including it.`,
      matches: [keyword],
    });
  }

  // Meta description length — fail if empty, warn if outside 150-160 characters.
  const metaLen = meta.trim().length;
  if (metaLen === 0) {
    findings.push({
      rule: 'seo-meta-length',
      severity: 'fail',
      message: 'Meta description is empty. Write a 150-160 character meta description.',
      matches: [],
    });
  } else if (metaLen < 150 || metaLen > 160) {
    findings.push({
      rule: 'seo-meta-length',
      severity: 'warn',
      message: `Meta description is ${metaLen} characters; aim for 150-160.`,
      matches: [`${metaLen} chars`],
    });
  }

  return findings;
}
