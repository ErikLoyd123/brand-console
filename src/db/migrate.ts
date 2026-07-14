import { mkdirSync } from 'node:fs';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

mkdirSync('data', { recursive: true });

const sqlite = new Database('data/brand.db');
// This better-sqlite3 build compiles SQLite with foreign_keys ON by default, and SQLite
// rejects ALTER TABLE ... ADD COLUMN with a REFERENCES clause + non-NULL default on a
// populated table while enforcement is on. Migrations always run with enforcement off
// (per-connection setting; the app connection in client.ts still turns it on).
sqlite.pragma('foreign_keys = OFF');
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: 'drizzle' });
sqlite.close();

console.log('migrations applied');
