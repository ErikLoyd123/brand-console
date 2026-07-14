import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

mkdirSync('data', { recursive: true });

const sqlite = new Database('data/brand.db');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// The raw better-sqlite3 handle, exported for read-only introspection (the
// database browser). Application code should prefer the typed `db` below.
export const rawDb = sqlite;

export const db = drizzle(sqlite, { schema });
