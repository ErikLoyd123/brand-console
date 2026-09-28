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
import { getLengthBand, type PostLength } from "../core/lengths";

export interface VoiceCheckOptions {
  isProductAdjacent: boolean;
  protectedRelationships?: string[];
  products?: string[];
  // The draft's silo. When present, product-adjacency is derived from it: only the
  // teach-shaped intents and LinkedIn's promote may be product-adjacent, so a
  // conversation/win/curate post can never carry an ask no matter what the caller passes.
  // Absent for legacy callers, which fall back to the raw `isProductAdjacent` flag.
  silo?: Silo;
  // The owner's take and beats for the idea the draft came from. When either is present,
  // seed retention runs; absent (take-only scans, legacy callers) it is skipped.
  // See design 2026-09-28-strategy-pillars-anti-slop/03-anti-slop-checks.
  seed?: string;
  points?: string[];
  // The draft's close, separately from `text` (the body). When present, the aphorism
  // check runs; absent, it is skipped.
  close?: string;
  // The length band the post was drafted for (src/core/lengths.ts). When present, the
  // band check runs against the body; absent, it is skipped.
  length?: PostLength;
}

// Only the teach-shaped intent of each platform ('teach' on LinkedIn, 'help' on Reddit,
// 'how-to' on web) and LinkedIn's 'promote' may be product-adjacent. A silo-derived
// `false` overrides any caller `true`, so the strict no-ask path is unbypassable from
// the caller side.
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

// Specifics: the concrete things a seed names that a draft must carry by name. Numerals
// with their unit, capitalized terms not at sentence or paragraph start, all-caps
// acronyms, and the items of a parenthesized capitalized list (each item matches on its
// own, after the "(" or the ", "). See design 03-anti-slop-checks, Check A.
const NUMERAL = /\$?\d[\d,.]*(?:-\d[\d,.]*)?(?:%|x|k|m|ms|s)?\b/gi;
const ACRONYM = /\b[A-Z][A-Z0-9]{1,5}\b/g;
// A capitalized run must follow a space, "(" or "," and must not sit at the start of a
// sentence (".!?" plus whitespace) or of a line (a newline plus indentation), since
// those capitals are grammar, not names. Runs continue across spaces only, never across
// a line break.
const CAPITALIZED_RUN =
  /(?<![.!?]\s+)(?<!\n[ \t]*)(?<=\s|\(|,)((?:[A-Z][a-zA-Z0-9'\u2019-]*)(?:[ \t][A-Z][a-zA-Z0-9'\u2019-]*)*)/g;
// "I'm", "I've", "I'd": a pronoun contraction, never a specific.
const PRONOUN_CONTRACTION = /^I['\u2019]/;
const SPECIFIC_STOPLIST = new Set([
  "I", "The", "A", "An", "But", "And", "So", "Then", "Here", "This", "That", "What", "Why",
  "How", "When", "If", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  "Sunday", "January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December",
]);

function isBareSingleDigit(token: string): boolean {
  return /^\d$/.test(token);
}

export function extractSpecifics(...sources: (string | undefined)[]): string[] {
  const found = new Set<string>();
  for (const source of sources) {
    if (!source) continue;
    for (const m of source.matchAll(NUMERAL)) {
      if (!isBareSingleDigit(m[0])) found.add(m[0]);
    }
    for (const m of source.matchAll(ACRONYM)) {
      if (!SPECIFIC_STOPLIST.has(m[0])) found.add(m[0]);
    }
    for (const m of source.matchAll(CAPITALIZED_RUN)) {
      const term = m[1].trim();
      if (!term || SPECIFIC_STOPLIST.has(term) || PRONOUN_CONTRACTION.test(term)) continue;
      found.add(term);
    }
  }
  return [...found];
}

// A specific is retained when it appears in the body with word boundaries, allowing an
// s/es plural on a word (not on a numeral or acronym) and ignoring thousands separators
// in numerals.
function bodyHasSpecific(body: string, specific: string): boolean {
  const normalizedBody = body.replace(/(\d),(\d)/g, "$1$2");
  const normalized = specific.replace(/(\d),(\d)/g, "$1$2");
  const plural = /[a-z]$/i.test(normalized) && !ACRONYM.test(normalized) ? "(?:e?s)?" : "";
  ACRONYM.lastIndex = 0;
  const pattern = new RegExp(`(?<![\\w-])${escapeRegExp(normalized)}${plural}(?![\\w-])`, "i");
  return pattern.test(normalizedBody);
}

// A numeral that is more than a bare single digit ("step 1" is not an anchor; "6 minutes"
// and "$40" are). Uses matchAll so the shared global regex keeps no state between calls.
function hasRealNumeral(text: string): boolean {
  return [...text.matchAll(NUMERAL)].some((m) => !isBareSingleDigit(m[0]));
}

// Check A: every specific in the seed and points must survive into the body.
export function checkSeedRetention(
  body: string,
  seed?: string,
  points?: string[],
): Finding | null {
  if (!seed?.trim() && !(points && points.length > 0)) return null;
  const specifics = extractSpecifics(seed, ...(points ?? []));
  const missing = specifics.filter((s) => !bodyHasSpecific(body, s));
  if (missing.length === 0) return null;
  return {
    rule: "seed-retention",
    severity: "fail",
    message: `Dropped ${missing.length} specific(s) from your seed. Every concrete thing you gave the drafter is load-bearing; put it back by name or edit the seed.`,
    matches: missing,
  };
}

// Check B: a close must carry an anchor: a numeral, a capitalized term or acronym also
// in the body, a product name, a [FILL] marker, or (conversation/discuss only) a question.
export function checkAphorismClose(
  close: string | undefined,
  body: string,
  silo?: Silo,
  products: string[] = [],
): Finding | null {
  const trimmed = close?.trim() ?? "";
  if (trimmed === "") return null;
  if (hasRealNumeral(trimmed)) return null;
  if (/\[FILL:/i.test(trimmed)) return null;
  const lower = trimmed.toLowerCase();
  if (products.some((p) => p.trim() !== "" && lower.includes(p.toLowerCase()))) return null;
  const anchors = extractSpecifics(trimmed).filter((s) => bodyHasSpecific(body, s));
  if (anchors.length > 0) return null;
  if ((silo === "conversation" || silo === "discuss") && trimmed.includes("?")) return null;
  return {
    rule: "aphorism-close",
    severity: "warn",
    message: "The close carries nothing concrete from the post. End on a specific thing you said, or (for a conversation post) a real question. Not a moral.",
    matches: [trimmed],
  };
}

// Check C: teach posts built on list scaffolding. Ordinal paragraph openers, count
// announcements, and numbered lines. Suppressed (except numbered lines) when the owner's
// own points are a list of three or more.
const ORDINAL_OPENER = /^(First|Second|Third|Fourth|Fifth|Next|Finally|Lastly)[,.:]/;
const COUNT_ANNOUNCEMENT =
  /\b(?:(?:two|three|four|five|\d+)\s+(?:things|ways|reasons|lessons|rules|tips)|here are (?:two|three|four|five|\d+))\b/gi;
const NUMBERED_LINE = /^\s*\d+[.)]\s/;

export function checkListCadence(
  body: string,
  silo?: Silo,
  points: string[] = [],
): Finding | null {
  if (silo !== "teach") return null;
  const ownerListed = points.filter((p) => p.trim() !== "").length >= 3;
  const matches: string[] = [];
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p !== "");
  if (!ownerListed) {
    const ordinal = paragraphs.filter((p) => ORDINAL_OPENER.test(p));
    if (ordinal.length >= 2) matches.push(...ordinal.map((p) => p.split(/\s/)[0]));
    for (const m of body.matchAll(COUNT_ANNOUNCEMENT)) matches.push(m[0]);
  }
  const numbered = body.split("\n").filter((l) => NUMBERED_LINE.test(l));
  if (numbered.length >= 3) matches.push(...numbered.map((l) => l.trim()));
  if (matches.length === 0) return null;
  return {
    rule: "list-cadence",
    severity: "warn",
    message: "Teach post is built on list scaffolding (First/Second/Third, 'three things', numbered lines). Explain one mechanism in prose; a list only when your own points are a list.",
    matches,
  };
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

// Length band: the body should land inside the band the post was drafted for. Soft on
// purpose (a few characters either side is not a defect); the reviewer decides.
export function checkLengthBand(body: string, length?: PostLength): Finding | null {
  if (!length) return null;
  const band = getLengthBand(length);
  if (!band) return null;
  const chars = body.trim().length;
  if (chars >= band.min && chars <= band.max) return null;
  const direction = chars < band.min ? "under" : "over";
  return {
    rule: "length-band",
    severity: "warn",
    message: `Body is ${chars} characters, ${direction} the ${band.label.toLowerCase()} band (${band.min} to ${band.max}). ${chars < band.min ? "Either the idea needs a longer band or the body is missing its mechanism." : "Either the idea needs a longer band or the body is carrying more than one idea."}`,
    matches: [`${chars} chars`],
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
  const seedRetention = checkSeedRetention(text, opts.seed, opts.points);
  if (seedRetention) findings.push(seedRetention);
  const aphorism = checkAphorismClose(opts.close, text, opts.silo, opts.products ?? []);
  if (aphorism) findings.push(aphorism);
  const listCadence = checkListCadence(text, opts.silo, opts.points ?? []);
  if (listCadence) findings.push(listCadence);
  const lengthBand = checkLengthBand(text, opts.length);
  if (lengthBand) findings.push(lengthBand);
  return findings;
}
