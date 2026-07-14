import { Router } from 'express';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { REPO_ROOT } from '../../profile/loader';

interface DiscoveredEntry {
  name: string;                 // frontmatter `name`, else the dir/file basename
  description: string;          // frontmatter `description`, else ''
  kind: 'skill' | 'agent';      // which directory it came from
  invocation: string;           // the text injected into the pty
}

const router = Router();

const SKILLS_DIR = resolve(REPO_ROOT, '.claude', 'skills');
const AGENTS_DIR = resolve(REPO_ROOT, '.claude', 'agents');

// Split "---\n...\n---\nbody" and parse only the frontmatter block.
function frontmatter(path: string): Record<string, unknown> {
  const text = readFileSync(path, 'utf8');
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return {};
  const fm = parse(m[1]);
  return fm && typeof fm === 'object' ? (fm as Record<string, unknown>) : {};
}

function scanSkills(): DiscoveredEntry[] {
  if (!existsSync(SKILLS_DIR)) return [];
  return readdirSync(SKILLS_DIR)
    .filter((d) => statSync(resolve(SKILLS_DIR, d)).isDirectory())        // dirs only
    .map((d) => ({ dir: d, file: resolve(SKILLS_DIR, d, 'SKILL.md') }))
    .filter((e) => existsSync(e.file))                                    // must hold a SKILL.md
    .map((e) => {
      const fm = frontmatter(e.file);
      const name = typeof fm.name === 'string' ? fm.name : e.dir;
      const description = typeof fm.description === 'string' ? fm.description : '';
      return { name, description, kind: 'skill' as const, invocation: `/${name}` };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function scanAgents(): DiscoveredEntry[] {
  if (!existsSync(AGENTS_DIR)) return [];
  return readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const fm = frontmatter(resolve(AGENTS_DIR, f));
      const name = typeof fm.name === 'string' ? fm.name : f.replace(/\.md$/, '');
      const description = typeof fm.description === 'string' ? fm.description : '';
      return { name, description, kind: 'agent' as const, invocation: `Dispatch the ${name} agent` };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

router.get('/', (_req, res) => {
  res.json([...scanSkills(), ...scanAgents()]);
});

export default router;
