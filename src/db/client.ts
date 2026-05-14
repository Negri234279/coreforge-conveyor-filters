// SQLite + Drizzle singleton. Bootstraps the schema idempotently on first
// import. The DB file lives in DATA_DIR (the prod volume) — same place as the
// legacy filters.*.json. Dev/prod use separate files so you can hack on dev
// data without touching the prod DB.

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import * as schema from './schema'
// `?raw` makes Vite bundle the file as a string, so the SQL ships with the
// SSR build instead of needing to live on disk in the runtime image.
import schemaSql from './schema.sql?raw'

const DB_FILE = import.meta.env.DEV ? 'coreforge.dev.db' : 'coreforge.prod.db'
const DATA_DIR = process.env.DATA_DIR ?? resolve(process.cwd(), 'src/data')
const DB_PATH = resolve(DATA_DIR, DB_FILE)

/** Tiny forward migrations for columns added after a DB was first created.
 *  (CREATE TABLE IF NOT EXISTS in schema.sql won't add columns to existing tables.) */
function migrate(sqlite: Database.Database): void {
    const hasColumn = (table: string, col: string): boolean => {
        const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
        return rows.some((r) => r.name === col)
    }
    if (!hasColumn('categories', 'open_core_id')) {
        sqlite.exec(`ALTER TABLE categories ADD COLUMN open_core_id TEXT`)
        sqlite.exec(
            `CREATE INDEX IF NOT EXISTS categories_open_core_idx ON categories(open_core_id)`,
        )
    }
    // Per-category clan sharing flag.
    if (!hasColumn('categories', 'shared_with_org')) {
        sqlite.exec(
            `ALTER TABLE categories ADD COLUMN shared_with_org INTEGER NOT NULL DEFAULT 0`,
        )
    }
    // Per-filter deployment counts (boxes / conveyors / storage adaptors).
    // Existing rows backfill to 1 via the column default.
    if (!hasColumn('filters', 'box_count')) {
        sqlite.exec(`ALTER TABLE filters ADD COLUMN box_count INTEGER NOT NULL DEFAULT 1`)
    }
    if (!hasColumn('filters', 'conveyor_count')) {
        sqlite.exec(`ALTER TABLE filters ADD COLUMN conveyor_count INTEGER NOT NULL DEFAULT 1`)
    }
    if (!hasColumn('filters', 'storage_adaptor_count')) {
        sqlite.exec(
            `ALTER TABLE filters ADD COLUMN storage_adaptor_count INTEGER NOT NULL DEFAULT 1`,
        )
    }
    // Clan roles: introduce 'admin' alongside 'owner' | 'member'. Backfill any
    // existing user that belongs to an org but has a null/empty role to 'member'
    // so the new owner-managed role UI has a valid value to display and update.
    sqlite.exec(
        `UPDATE users SET org_role = 'member' WHERE org_id IS NOT NULL AND (org_role IS NULL OR org_role = '')`,
    )
}

function bootstrap(): Database.Database {
    mkdirSync(DATA_DIR, { recursive: true })

    const sqlite = new Database(DB_PATH)
    // WAL gives non-blocking reads, much friendlier for SSR fanout.
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('synchronous = NORMAL')
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec(schemaSql)
    migrate(sqlite)
    return sqlite
}

// HMR-safe singleton. Vite reloads this module on edit; we don't want to spawn
// a second SQLite handle each time.
const g = globalThis as unknown as { __cf_db?: Database.Database }
const sqlite: Database.Database = g.__cf_db ?? (g.__cf_db = bootstrap())

export const db = drizzle(sqlite, { schema })
export { schema }
export type DB = typeof db
