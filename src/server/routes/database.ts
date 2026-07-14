import { Router } from 'express';
import { rawDb } from '../../db/client';

// Read-only database browser. Everything here is SELECT-only: it introspects the
// local SQLite file and returns rows for inspection. Table and column names can
// never be parameterized in SQL, so they are always validated against the live
// schema (an allowlist) before being interpolated, and values go through bound
// parameters. This is a single-user local tool, but the guards hold regardless.

const router = Router();

// Human-facing metadata: which group a table belongs to, its label, and a plain
// description. Tables not listed here still appear (under "Other") so the browser
// never hides anything, but the known ones read nicely.
interface TableMeta {
  category: string;
  label: string;
  description: string;
}
const META: Record<string, TableMeta> = {
  sources: {
    category: 'Sources & discovery',
    label: 'Sources',
    description: 'Configured inputs the discovery layer watches (RSS feeds, scan targets).',
  },
  feed_items: {
    category: 'Sources & discovery',
    label: 'Feed items',
    description: 'Raw items pulled from sources, awaiting triage in the discovery inbox.',
  },
  idea_queue_items: {
    category: 'Pipeline',
    label: 'Idea queue',
    description: 'Candidate post ideas: promoted feed items and captured sparks, scored for triage.',
  },
  drafts: {
    category: 'Pipeline',
    label: 'Drafts',
    description: 'Posts being written in your voice, with hooks, body, and review status.',
  },
  scheduled_posts: {
    category: 'Pipeline',
    label: 'Scheduled posts',
    description: 'Approved drafts queued for you to publish by hand.',
  },
  published_posts: {
    category: 'Pipeline',
    label: 'Published posts',
    description: 'Posts that went live, kept as the archive of what shipped.',
  },
  sparks: {
    category: 'Capture',
    label: 'Sparks',
    description: 'Your lowest-friction captures: a raw one-liner dropped in anytime.',
  },
  tags: {
    category: 'Tagging',
    label: 'Tags',
    description: 'The tag vocabulary used to categorize discovery items.',
  },
  feed_item_tags: {
    category: 'Tagging',
    label: 'Feed item tags',
    description: 'Join table linking feed items to their tags (many-to-many).',
  },
};

const CATEGORY_ORDER = ['Pipeline', 'Sources & discovery', 'Capture', 'Tagging', 'Other'];

interface ColumnInfo {
  name: string;
  type: string;
  notnull: boolean;
  pk: boolean;
}

// The set of real, browsable tables. Recomputed per request so a fresh migration
// shows up without a restart, and used as the allowlist for every interpolation.
function listTables(): string[] {
  const rows = rawDb
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name NOT LIKE '__drizzle%'
       ORDER BY name`,
    )
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

function columnsOf(table: string): ColumnInfo[] {
  const rows = rawDb.prepare(`PRAGMA table_info("${table}")`).all() as {
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }[];
  return rows.map((c) => ({ name: c.name, type: c.type || 'TEXT', notnull: !!c.notnull, pk: !!c.pk }));
}

function rowCount(table: string): number {
  const row = rawDb.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number };
  return row.n;
}

function metaFor(name: string): TableMeta {
  return (
    META[name] ?? {
      category: 'Other',
      label: name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: '',
    }
  );
}

// GET /api/database/tables -> the left-panel list with counts, grouped.
router.get('/tables', (_req, res) => {
  const tables = listTables().map((name) => {
    const meta = metaFor(name);
    return { name, label: meta.label, category: meta.category, description: meta.description, rowCount: rowCount(name) };
  });
  tables.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.label.localeCompare(b.label);
  });
  res.json({ tables, categoryOrder: CATEGORY_ORDER });
});

// GET /api/database/tables/:name -> columns + a filtered/sorted/paginated page.
// Query: limit, offset, sort (column), dir (asc|desc), and f.<col>=<substring>.
router.get('/tables/:name', (req, res) => {
  const table = req.params.name;
  const tables = listTables();
  if (!tables.includes(table)) return res.status(404).json({ error: 'unknown table' });

  const columns = columnsOf(table);
  const colNames = new Set(columns.map((c) => c.name));

  // Per-column substring filters, allowlisted by real column name.
  const whereParts: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(req.query)) {
    if (!key.startsWith('f.') || typeof value !== 'string' || value === '') continue;
    const col = key.slice(2);
    if (!colNames.has(col)) continue;
    whereParts.push(`CAST("${col}" AS TEXT) LIKE ?`);
    params.push(`%${value}%`);
  }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  // Sorting, allowlisted by real column name.
  const sort = typeof req.query.sort === 'string' && colNames.has(req.query.sort) ? req.query.sort : null;
  const dir = req.query.dir === 'desc' ? 'DESC' : 'ASC';
  const orderBy = sort ? `ORDER BY "${sort}" ${dir}` : '';

  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const filtered = (
    rawDb.prepare(`SELECT COUNT(*) AS n FROM "${table}" ${where}`).get(...params) as { n: number }
  ).n;
  const rows = rawDb
    .prepare(`SELECT * FROM "${table}" ${where} ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  const meta = metaFor(table);
  res.json({
    name: table,
    label: meta.label,
    category: meta.category,
    description: meta.description,
    columns,
    rowCount: rowCount(table),
    filteredCount: filtered,
    rows,
    limit,
    offset,
  });
});

// POST /api/database/query { sql } -> run a single read-only statement.
// Rejects anything that is not a reader (SELECT / WITH ... SELECT / PRAGMA read).
// Errors are returned in the body with a 200 so the client shows the real
// message (a non-2xx would trip the console's mock fallback and mask it).
router.post('/query', (req, res) => {
  const fail = (error: string) => res.json({ columns: [], rows: [], truncated: false, error });
  const sql = typeof req.body?.sql === 'string' ? req.body.sql.trim() : '';
  if (!sql) return fail('empty query');
  if (/;\s*\S/.test(sql)) return fail('run one statement at a time');
  if (!/^(select|with)\b/i.test(sql)) {
    return fail('read-only: only SELECT / WITH queries are allowed');
  }
  try {
    const stmt = rawDb.prepare(sql);
    // better-sqlite3 flags statements that return rows; refuse anything else.
    if (!stmt.reader) return fail('read-only: query must return rows');
    const rows = (stmt.all() as Record<string, unknown>[]).slice(0, 1000);
    const columns = rows.length ? Object.keys(rows[0]) : [];
    res.json({ columns, rows, truncated: rows.length === 1000 });
  } catch (e) {
    fail((e as Error).message);
  }
});

export default router;
