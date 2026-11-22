import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const filename = process.env.DB_PATH || './data/leads.sqlite';
if (!process.env.DATABASE_URL && filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });

export const db = process.env.DATABASE_URL ? null : new DatabaseSync(filename);
if (db) db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 3000;
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    company TEXT NOT NULL,
    source TEXT NOT NULL CHECK(source IN ('Website', 'Referral', 'LinkedIn', 'Cold Outreach', 'Other')),
    status TEXT NOT NULL DEFAULT 'New' CHECK(status IN ('New', 'Contacted', 'Qualified', 'Lost')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  CREATE INDEX IF NOT EXISTS idx_leads_name ON leads(name COLLATE NOCASE);
  CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
`);
