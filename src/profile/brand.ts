// src/profile/brand.ts
// Brand guidelines loader. Each profile may carry a gitignored brand/ folder:
//
//   profiles/<slug>/brand/brand.yaml   — colors, fonts, logo, style notes
//   profiles/<slug>/brand/logos/       — the logo set (variants for different
//                                        occasions: primary, reversed, icon…);
//                                        brand.yaml's `logo:` picks the default
//                                        composited onto composed cards
//   profiles/<slug>/brand/refs/        — example images the owner wants matched
//                                        (palette, mood, annotation style)
//   profiles/<slug>/brand/*.md|*.html  — brand documents (a company brand book,
//                                        tone guide, messaging doc). Entirely
//                                        optional; skills that produce anything
//                                        brand-facing read whatever is here.
//
// The imagery pipeline (src/images/*) reads this before composing a graphic or
// annotating a screenshot, so everything it produces lands in the profile's look
// rather than a hardcoded one. Absent file or fields fall back to a neutral
// default palette — a profile without brand guidelines still gets clean images.
// Like identity.yaml this is per-user data: never committed, resolved per call
// through the active profile.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { profileDirBySlug, resolveActiveProfileDir } from './loader';

export interface BrandColors {
  // The signature color — annotation strokes, accent bars, highlights.
  primary: string;
  // A supporting color for secondary accents.
  accent: string;
  // Card background.
  background: string;
  // Main text on the background.
  foreground: string;
  // De-emphasized text (attributions, labels).
  muted: string;
}

export interface BrandFonts {
  // CSS font-family strings (rendered by sharp's SVG engine via system fonts).
  heading: string;
  body: string;
}

export interface BrandGuidelines {
  colors: BrandColors;
  fonts: BrandFonts;
  // The default logo composited onto composed cards (brand.yaml `logo:`,
  // resolved to an absolute path), or null for no logo.
  logoPath: string | null;
  // Every logo variant on disk (absolute paths, recursive scan of brand/logos/).
  // Consumers pick per occasion — reversed on dark grounds, icon in tight
  // squares — via the compose CLI's `logo` override.
  logoPaths: string[];
  // Freeform prose the imagery procedure reads for judgment calls the yaml
  // can't encode ("always light backgrounds", "no stock-photo people", ...).
  styleNotes: string;
  // Absolute paths of reference images under brand/refs/ — examples of the
  // look the owner wants matched.
  refPaths: string[];
  // Absolute paths of brand documents (.md / .html) dropped directly in brand/ —
  // a company brand book, tone guide, or messaging doc. Optional; consuming
  // skills read them in full for tone and style judgment the yaml can't encode.
  docPaths: string[];
}

// Neutral placeholder look, deliberately unbranded. A real profile overrides it
// in brand.yaml; profile.example ships a fictional one.
export const DEFAULT_BRAND: BrandGuidelines = {
  colors: {
    primary: '#2f6f9c',
    accent: '#e8a33d',
    background: '#f7f8fa',
    foreground: '#1c2733',
    muted: '#6b7684',
  },
  fonts: {
    heading: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    body: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  logoPath: null,
  logoPaths: [],
  styleNotes: '',
  refPaths: [],
  docPaths: [],
};

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const DOC_EXTS = new Set(['.md', '.html', '.htm']);

export function brandDir(slug?: string): string {
  return resolve(slug ? profileDirBySlug(slug) : resolveActiveProfileDir(), 'brand');
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function listRefs(dir: string): string[] {
  const refsDir = resolve(dir, 'refs');
  if (!existsSync(refsDir) || !statSync(refsDir).isDirectory()) return [];
  return readdirSync(refsDir)
    .filter((name) => IMAGE_EXTS.has(name.slice(name.lastIndexOf('.')).toLowerCase()))
    .sort()
    .map((name) => resolve(refsDir, name));
}

// Every image under brand/logos/, subfolders included (svg sources often live
// in logos/svg/).
function listLogos(dir: string): string[] {
  const logosDir = resolve(dir, 'logos');
  if (!existsSync(logosDir) || !statSync(logosDir).isDirectory()) return [];
  return readdirSync(logosDir, { recursive: true })
    .map(String)
    .filter((name) => IMAGE_EXTS.has(name.slice(name.lastIndexOf('.')).toLowerCase()))
    .sort()
    .map((name) => resolve(logosDir, name));
}

// Brand documents: .md / .html files sitting directly in brand/ (refs/ holds
// images only, so this never picks up a refs README).
function listDocs(dir: string): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((name) => DOC_EXTS.has(name.slice(name.lastIndexOf('.')).toLowerCase()))
    .sort()
    .map((name) => resolve(dir, name));
}

// Tolerant load: missing folder, missing yaml, or partial yaml all resolve to a
// complete BrandGuidelines with defaults filled in — the imagery pipeline never
// has to branch on "brand configured?".
export function loadBrand(slug?: string): BrandGuidelines {
  let dir: string;
  try {
    dir = brandDir(slug);
  } catch {
    return { ...DEFAULT_BRAND };
  }

  const yamlPath = resolve(dir, 'brand.yaml');
  let raw: Record<string, unknown> = {};
  if (existsSync(yamlPath)) {
    try {
      raw = (parse(readFileSync(yamlPath, 'utf8')) as Record<string, unknown>) ?? {};
    } catch {
      raw = {};
    }
  }

  const colors = (raw.colors ?? {}) as Record<string, unknown>;
  const fonts = (raw.fonts ?? {}) as Record<string, unknown>;
  const logo = asString(raw.logo, '');
  const logoAbs = logo ? resolve(dir, logo) : '';

  return {
    colors: {
      primary: asString(colors.primary, DEFAULT_BRAND.colors.primary),
      accent: asString(colors.accent, DEFAULT_BRAND.colors.accent),
      background: asString(colors.background, DEFAULT_BRAND.colors.background),
      foreground: asString(colors.foreground, DEFAULT_BRAND.colors.foreground),
      muted: asString(colors.muted, DEFAULT_BRAND.colors.muted),
    },
    fonts: {
      heading: asString(fonts.heading, DEFAULT_BRAND.fonts.heading),
      body: asString(fonts.body, DEFAULT_BRAND.fonts.body),
    },
    logoPath: logoAbs && existsSync(logoAbs) ? logoAbs : null,
    logoPaths: listLogos(dir),
    styleNotes: asString(raw.style_notes, ''),
    refPaths: listRefs(dir),
    docPaths: listDocs(dir),
  };
}
