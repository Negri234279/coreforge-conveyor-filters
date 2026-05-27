// SQLite + Drizzle singleton. Bootstraps the schema idempotently on first
// import. The DB file lives in DATA_DIR (the prod volume) — same place as the
// legacy filters.*.json. Dev/prod use separate files so you can hack on dev
// data without touching the prod DB.

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { version as APP_VERSION } from '../../package.json'
import { log } from '../lib/logger'
import * as schema from './schema'
// `?raw` makes Vite bundle the file as a string, so the SQL ships with the
// SSR build instead of needing to live on disk in the runtime image.
import schemaSql from './schema.sql?raw'

const DB_FILE = import.meta.env.DEV ? 'coreforge.dev.db' : 'coreforge.prod.db'
const DATA_DIR = process.env.DATA_DIR ?? resolve(process.cwd(), 'src/data')
const DB_PATH = resolve(DATA_DIR, DB_FILE)

/** A named forward-migration. `run` only fires the first time this name lands
 *  in `schema_migrations`; on every subsequent boot we no-op. Steps must be
 *  internally idempotent anyway (defensive in case the DB row is wiped).
 *
 *  LEGACY — do NOT add new steps here. New schema changes go in a versioned
 *  script under `src/db/migrations/migration-X.Y.Z.mjs` run via `npm run
 *  migrate`, which writes to the same `schema_migrations` ledger and emits
 *  structured logs to stdout (and from there to SigNoz). The entries below
 *  predate that flow and are kept so existing prod DBs keep booting cleanly. */
interface Migration {
    name: string
    run: (sqlite: Database.Database) => void
}

function hasColumn(sqlite: Database.Database, table: string, col: string): boolean {
    const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    return rows.some((r) => r.name === col)
}

/** Ordered list of forward migrations. Append-only — never rename or remove an
 *  entry once it has shipped, or existing DBs will re-run the step. */
const MIGRATIONS: Migration[] = [
    {
        name: '2025_categories_open_core_id',
        run: (sqlite) => {
            if (!hasColumn(sqlite, 'categories', 'open_core_id')) {
                sqlite.exec(`ALTER TABLE categories ADD COLUMN open_core_id TEXT`)
            }
            sqlite.exec(
                `CREATE INDEX IF NOT EXISTS categories_open_core_idx ON categories(open_core_id)`,
            )
        },
    },
    {
        name: '2025_categories_shared_with_org',
        run: (sqlite) => {
            if (!hasColumn(sqlite, 'categories', 'shared_with_org')) {
                sqlite.exec(
                    `ALTER TABLE categories ADD COLUMN shared_with_org INTEGER NOT NULL DEFAULT 0`,
                )
            }
        },
    },
    {
        name: '2025_filters_deployment_counts',
        run: (sqlite) => {
            // Per-filter deployment counts (boxes / conveyors / storage adaptors).
            // Existing rows backfill to 1 via the column default.
            if (!hasColumn(sqlite, 'filters', 'box_count')) {
                sqlite.exec(`ALTER TABLE filters ADD COLUMN box_count INTEGER NOT NULL DEFAULT 1`)
            }
            if (!hasColumn(sqlite, 'filters', 'conveyor_count')) {
                sqlite.exec(
                    `ALTER TABLE filters ADD COLUMN conveyor_count INTEGER NOT NULL DEFAULT 1`,
                )
            }
            if (!hasColumn(sqlite, 'filters', 'storage_adaptor_count')) {
                sqlite.exec(
                    `ALTER TABLE filters ADD COLUMN storage_adaptor_count INTEGER NOT NULL DEFAULT 1`,
                )
            }
        },
    },
    {
        name: '2025_users_backfill_org_role',
        run: (sqlite) => {
            // Clan roles: introduce 'admin' alongside 'owner' | 'member'. Backfill any
            // existing user that belongs to an org but has a null/empty role to 'member'
            // so the owner-managed role UI has a valid value to display and update.
            sqlite.exec(
                `UPDATE users SET org_role = 'member' WHERE org_id IS NOT NULL AND (org_role IS NULL OR org_role = '')`,
            )
        },
    },
    {
        name: '2025_users_is_admin',
        run: (sqlite) => {
            // App-wide super-admin flag (independent of org_role). Powers /admin.
            // Auto-promote the sole owner account on first run.
            if (!hasColumn(sqlite, 'users', 'is_admin')) {
                sqlite.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`)
            }
            sqlite.exec(`UPDATE users SET is_admin = 1 WHERE username_lower = 'negri234279'`)
        },
    },
    {
        name: '2025_users_last_seen_at',
        run: (sqlite) => {
            if (!hasColumn(sqlite, 'users', 'last_seen_at')) {
                sqlite.exec(`ALTER TABLE users ADD COLUMN last_seen_at INTEGER`)
            }
            // Index lives here (not schema.sql) so it can run *after* the ALTER on
            // existing DBs without erroring out on first boot.
            sqlite.exec(`CREATE INDEX IF NOT EXISTS users_last_seen_idx ON users(last_seen_at)`)
        },
    },
    {
        name: '2025_content_updated_at',
        run: (sqlite) => {
            // updated_at on content tables. Backfill from created_at so existing rows
            // get a sane initial value.
            for (const table of ['filters', 'categories', 'subcategories', 'open_cores']) {
                if (!hasColumn(sqlite, table, 'updated_at')) {
                    sqlite.exec(
                        `ALTER TABLE ${table} ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`,
                    )
                }
                sqlite.exec(`UPDATE ${table} SET updated_at = created_at WHERE updated_at = 0`)
            }
        },
    },
    {
        name: '2025_users_google_oauth',
        run: (sqlite) => {
            // Google OAuth: make password_hash nullable, add google_id + avatar_url.
            // SQLite can't DROP NOT NULL in-place, so we recreate the users table when
            // the constraint is still present (legacy DBs). Fresh DBs already have the
            // correct schema from schema.sql and skip this branch.
            const userCols = sqlite.prepare(`PRAGMA table_info(users)`).all() as {
                name: string
                notnull: number
            }[]
            const pwdCol = userCols.find((r) => r.name === 'password_hash')
            if (pwdCol?.notnull === 1) {
                sqlite
                    .transaction(() => {
                        sqlite.exec(`ALTER TABLE users RENAME TO _users_pre_google`)
                        sqlite.exec(`
                            CREATE TABLE users (
                                id              TEXT PRIMARY KEY,
                                username        TEXT NOT NULL,
                                username_lower  TEXT NOT NULL,
                                email           TEXT,
                                password_hash   TEXT,
                                google_id       TEXT,
                                avatar_url      TEXT,
                                org_id          TEXT,
                                org_role        TEXT,
                                is_admin        INTEGER NOT NULL DEFAULT 0,
                                last_seen_at    INTEGER,
                                created_at      INTEGER NOT NULL
                            )
                        `)
                        sqlite.exec(`
                            INSERT INTO users
                                (id, username, username_lower, email, password_hash,
                                 org_id, org_role, is_admin, last_seen_at, created_at)
                            SELECT
                                id, username, username_lower, email, password_hash,
                                org_id, org_role, is_admin, last_seen_at, created_at
                            FROM _users_pre_google
                        `)
                        sqlite.exec(`DROP TABLE _users_pre_google`)
                        sqlite.exec(
                            `CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uq ON users(username_lower)`,
                        )
                        sqlite.exec(
                            `CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_uq ON users(google_id)`,
                        )
                        sqlite.exec(
                            `CREATE INDEX IF NOT EXISTS users_last_seen_idx ON users(last_seen_at)`,
                        )
                        sqlite.exec(
                            `UPDATE users SET is_admin = 1 WHERE username_lower = 'negri234279'`,
                        )
                    })
                    .call(sqlite)
            } else {
                // Table already migrated; add columns individually if still missing
                // (covers DBs that were recreated but never had google_id/avatar_url).
                if (!hasColumn(sqlite, 'users', 'google_id')) {
                    sqlite.exec(`ALTER TABLE users ADD COLUMN google_id TEXT`)
                }
                if (!hasColumn(sqlite, 'users', 'avatar_url')) {
                    sqlite.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT`)
                }
                sqlite.exec(
                    `CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_uq ON users(google_id)`,
                )
            }
        },
    },
]

/** Walk MIGRATIONS in order. Each step runs only if its name is not yet present
 *  in schema_migrations; applied steps are logged to SigNoz (and recorded in
 *  the DB for the admin panel). Failure of one step aborts the rest — better
 *  to crash on boot than to silently leave the DB half-migrated. */
function migrate(sqlite: Database.Database): void {
    // The applied-set is loaded once; the table itself is created by schema.sql.
    const appliedRows = sqlite
        .prepare(`SELECT name FROM schema_migrations`)
        .all() as { name: string }[]
    const applied = new Set(appliedRows.map((r) => r.name))

    const insertApplied = sqlite.prepare(
        `INSERT OR IGNORE INTO schema_migrations (name, applied_at, app_version)
         VALUES (?, ?, ?)`,
    )

    // One-time backfill: a pre-existing DB has all current migrations applied
    // historically (the old migrate() ran them already, just without tracking).
    // Mark them as applied with applied_at = 0 so the loop below skips them and
    // we don't claim they were applied "just now". Heuristic: schema_migrations
    // is empty AND the DB has at least one user row (i.e. not a fresh install).
    if (applied.size === 0) {
        const userCount =
            (sqlite.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }).n
        if (userCount > 0) {
            for (const m of MIGRATIONS) {
                insertApplied.run(m.name, 0, null)
                applied.add(m.name)
            }
            log.info({
                message: 'db: backfilled schema_migrations for pre-existing DB',
                attrs: {
                    'app.migration.backfilled': MIGRATIONS.length,
                    'app.version': APP_VERSION,
                },
            })
        }
    }

    for (const m of MIGRATIONS) {
        if (applied.has(m.name)) continue

        const startedAt = Date.now()
        try {
            m.run(sqlite)
            insertApplied.run(m.name, Date.now(), APP_VERSION)
            log.info({
                message: `db: migration applied ${m.name}`,
                attrs: {
                    'app.migration.name': m.name,
                    'app.migration.duration_ms': Date.now() - startedAt,
                    'app.version': APP_VERSION,
                },
            })
        } catch (err) {
            log.error({
                message: `db: migration failed ${m.name}`,
                attrs: {
                    'app.migration.name': m.name,
                    'app.version': APP_VERSION,
                },
                err,
            })
            throw err
        }
    }
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
