// Reusable, testable voice checks for the content engine.
// Loaded by content-reviewer, draft, and the brand-console.
// Mechanical checks only. Soft rules (show-don't-tell, hero framing,
// generous-not-corrective) stay human judgment in content-reviewer.

export type Severity = "fail" | "warn";

export interface Finding {
  rule: string;
  severity: Severity;
  message: string;
  matches: string[];
}

import { siloMayBeProductAdjacent, type Silo } from "../core/silos";

export interface VoiceCheckOptions {
  isProductAdjacent: boolean;
  protectedRelationships?: string[];
  products?: string[];
  // The draft's silo. When present, product-adjacency is derived from it: only `teach`
  // may be product-adjacent, so a `conversation`/`win`/`curate` post can never carry an
  // ask no matter what the caller passes. Absent for legacy callers, which fall back to
  // the raw `isProductAdjacent` flag. See design 04-silo-aware-review.
  silo?: Silo;
}

// Only the teach-shaped intent of each platform ('teach' on LinkedIn, 'help' on Reddit)
// may be product-adjacent. A silo-derived `false` overrides any caller `true`, so the
// strict no-ask path is unbypassable from the caller side.
function effectiveAdjacency(opts: VoiceCheckOptions): boolean {
  if (!opts.silo) return opts.isProductAdjacent;
  return siloMayBeProductAdjacent(opts.silo) ? opts.isProductAdjacent : false;
}

// The AI-tells blocklist from the voice card. Single words are matched on
// word boundaries; multi-word phrases are matched as written.
export const AI_TELLS: string[] = [
  "leverage",
  "delve",
  "in today's fast-paced world",
  "navigate the landscape",
  "testament to",
  "elevate",
  "unlock",
  "robust",
  "seamless",
  "seamlessly",
  "game-changer",
  "game changer",
  "in the ever-evolving",
  "agree? comment below",
  "thoughts? comment below",
  "let that sink in",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contextsFor(text: string, pattern: RegExp): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const start = Math.max(0, index - 20);
    const end = Math.min(text.length, index + match[0].length + 20);
    out.push(text.slice(start, end).replace(/\s+/g, " ").trim());
  }
  return out;
}

// Hard rule 1: no em dashes. Also flags en dashes and spaced double hyphens
// used as sentence punctuation, since both read as the same tell.
export function scanEmDashes(text: string): Finding | null {
  const matches = contextsFor(text, /—|–|(?<=\s)--(?=\s)/g);
  if (matches.length === 0) return null;
  return {
    rule: "no-em-dashes",
    severity: "fail",
    message: `Found ${matches.length} em dash or dash-as-punctuation use. Replace with commas, periods, colons, or parentheses.`,
    matches,
  };
}

// AI-tells blocklist scan.
export function scanAiTells(text: string): Finding | null {
  const hits: string[] = [];
  for (const tell of AI_TELLS) {
    const pattern = new RegExp(`\\b${escapeRegExp(tell)}\\b`, "i");
    if (pattern.test(text)) hits.push(tell);
  }
  if (hits.length === 0) return null;
  return {
    rule: "ai-tells",
    severity: "warn",
    message: `Found ${hits.length} AI-tell word or phrase. Rewrite in plain language.`,
    matches: hits,
  };
}

// Ask phrases that count as a CTA. Product-specific asks are composed from
// the profile's product names in checkCtaRule; only product-agnostic asks
// are listed here.
export const CTA_PATTERNS: string[] = [
  "book a demo",
  "book a call",
  "schedule a demo",
  "sign up",
  "signup",
  "get started",
  "try it free",
  "start your free trial",
  "dm me",
  "reach out",
  "contact us",
  "learn more",
  "link in bio",
  "link in the comments",
];

// Blame-framing language. A finding fires only when this co-occurs with an
// employer reference, so accountability-about-myself stories pass clean.
export const BLAME_TERMS: string[] = [
  "his fault",
  "their fault",
  "the ceo's fault",
  "blame",
  "blamed",
  "if he had",
  "if he hadn't",
  "if they had",
  "if they hadn't",
  "wouldn't listen",
  "refused to",
  "bad leadership",
  "mismanaged",
  "screwed up",
  "ruined",
];

// Hard rule 6: personal posts carry no ask; product-adjacent posts carry at
// most one soft line. Product-specific ask phrases ("try <product>",
// "check out <product>") are composed from the profile's product names so
// the module lists no product literally.
export function checkCtaRule(
  text: string,
  isProductAdjacent: boolean,
  products: string[],
): Finding | null {
  const lower = text.toLowerCase();
  const productPatterns = products.flatMap((product) => {
    const name = product.toLowerCase();
    return [`try ${name}`, `check out ${name}`];
  });
  const patterns = [...CTA_PATTERNS, ...productPatterns];
  const hits = patterns.filter((pattern) => lower.includes(pattern));
  if (hits.length === 0) return null;
  if (!isProductAdjacent) {
    return {
      rule: "cta-rule",
      severity: "fail",
      message: "Personal-brand post carries an ask. Personal posts must have no CTA. Remove it, or mark the post product-adjacent if it genuinely is.",
      matches: hits,
    };
  }
  if (hits.length > 1) {
    return {
      rule: "cta-rule",
      severity: "warn",
      message: "Product-adjacent post carries more than one ask. Keep it to a single soft, honest line.",
      matches: hits,
    };
  }
  return null;
}

// The protected-relationship guardrail. Fires when a protected entity is
// referenced near blame language. The entity list is supplied by the caller
// (from identity.yaml); the module never reads the profile itself. An empty
// list means no protected entities are configured, so the check never fires.
export function flagProtectedRelationshipRisk(
  text: string,
  protectedRelationships: string[],
): Finding | null {
  if (protectedRelationships.length === 0) return null;
  const lower = text.toLowerCase();
  const entityHits = protectedRelationships.filter((entity) =>
    lower.includes(entity.toLowerCase()),
  );
  if (entityHits.length === 0) return null;
  const blameHits = BLAME_TERMS.filter((term) => lower.includes(term));
  if (blameHits.length === 0) return null;
  return {
    rule: "protected-relationship-risk",
    severity: "fail",
    message: `Draft references a protected relationship (${entityHits.join(", ")}) near blame language. A protected-relationship story must stay self-accountable, never criticism of the named entity. Reframe as self-accountable, or remove.`,
    matches: [...entityHits, ...blameHits],
  };
}

// Curate guardrail: a `curate` post must add the owner's own framing, never a bare
// link. Reddit treats bare link-drops as spam, and the curate intent is shared by both
// platforms, so this runs for every caller. Mechanical floor only: strip URLs and count
// the substantive words that remain; fewer than 8 means the body is effectively just a
// URL. Whether present framing is genuinely substantive stays content-reviewer judgment.
export function checkCurateBareLink(text: string, silo?: Silo): Finding | null {
  if (silo !== "curate") return null;
  const urls = text.match(/https?:\/\/[^\s)]+/gi) ?? [];
  if (urls.length === 0) return null;
  const framing = text
    .replace(/https?:\/\/[^\s)]+/gi, " ")
    .replace(/[[\]()>*_#`~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = framing ? framing.split(" ").filter((w) => /[a-z0-9]/i.test(w)) : [];
  if (words.length >= 8) return null;
  return {
    rule: "curate-bare-link",
    severity: "fail",
    message:
      "Curate post is effectively a bare link. A curate post must add your own framing around the link, never paste a URL alone. Add at least a sentence of substantive context.",
    matches: urls,
  };
}

// Aggregator: runs every mechanical check and returns all findings. An empty
// array means the mechanical checks pass. Soft rules are content-reviewer's job.
export function runVoiceChecks(
  text: string,
  opts: VoiceCheckOptions = { isProductAdjacent: false },
): Finding[] {
  const findings: Finding[] = [];
  const emDashes = scanEmDashes(text);
  if (emDashes) findings.push(emDashes);
  const aiTells = scanAiTells(text);
  if (aiTells) findings.push(aiTells);
  const cta = checkCtaRule(text, effectiveAdjacency(opts), opts.products ?? []);
  if (cta) findings.push(cta);
  const protectedRisk = flagProtectedRelationshipRisk(
    text,
    opts.protectedRelationships ?? [],
  );
  if (protectedRisk) findings.push(protectedRisk);
  const curateBareLink = checkCurateBareLink(text, opts.silo);
  if (curateBareLink) findings.push(curateBareLink);
  return findings;
}
