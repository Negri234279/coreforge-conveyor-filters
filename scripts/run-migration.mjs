import Database from 'better-sqlite3'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const { version } = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'))

const DB_FILE = process.env.NODE_ENV === 'production' ? 'coreforge.prod.db' : 'coreforge.dev.db'
const DATA_DIR = process.env.DATA_DIR ?? resolve(process.cwd(), 'src/data')
const DB_PATH = resolve(DATA_DIR, DB_FILE)

// Structured JSON-on-stdout logger. The Astro runtime's OTel SDK is not loaded
// in this CLI context, so we can't go through src/lib/logger.ts. Instead we
// emit one JSON line per event — Docker captures stdout, and any log shipper
// (Promtail / OTel collector) indexes the attrs as columns in SigNoz.
function emit(severity, message, attrs = {}) {
    const line = JSON.stringify({
        severity,
        message,
        'app.component': 'migration-runner',
        'app.version': version,
        ...attrs,
    })
    if (severity === 'ERROR') process.stderr.write(line + '\n')
    else process.stdout.write(line + '\n')
}
const log = {
    info: (msg, attrs) => emit('INFO', msg, attrs),
    warn: (msg, attrs) => emit('WARN', msg, attrs),
    error: (msg, attrs) => emit('ERROR', msg, attrs),
}

if (!existsSync(DB_PATH)) {
    log.info('fresh install — no existing database, skipping')
    process.exit(0)
}

let sqlite = new Database(DB_PATH)

// Unified migration ledger. Matches the table created by src/db/schema.sql
// (the Astro server creates it on boot); we re-declare it here in case the
// server has never run against this DB yet (e.g. CLI-only ops box).
const TRACKING_DDL = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
        name        TEXT PRIMARY KEY,
        applied_at  INTEGER NOT NULL,
        app_version TEXT
    )
`
sqlite.exec(TRACKING_DDL)

// One-time backfill from the legacy _applied_migrations table (pre-unification).
// Copy any rows we don't already have, then leave the old table alone as an
// audit trail — dropping it would erase history if something needs forensics.
const hasLegacyTable = sqlite
    .prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='_applied_migrations'`)
    .get()
if (hasLegacyTable) {
    const legacyRows = sqlite.prepare(`SELECT name, applied_at FROM _applied_migrations`).all()
    if (legacyRows.length > 0) {
        const insert = sqlite.prepare(
            `INSERT OR IGNORE INTO schema_migrations (name, applied_at, app_version)
             VALUES (?, ?, NULL)`,
        )

        const tx = sqlite.transaction((rows) => {
            for (const r of rows) insert.run(r.name, r.applied_at)
        })
        tx(legacyRows)

        log.info('backfilled legacy _applied_migrations rows', {
            'app.migration.backfilled': legacyRows.length,
        })
    }
}

const migrationName = `migration-${version}`
const migrationFile = resolve(__dirname, `../src/db/migrations/${migrationName}.mjs`)

const alreadyApplied = sqlite
    .prepare('SELECT 1 FROM schema_migrations WHERE name = ?')
    .get(migrationName)

if (alreadyApplied) {
    log.info('migration already applied, skipping', {
        'app.migration.name': migrationName,
    })

    sqlite.close()
    process.exit(0)
}

if (!existsSync(migrationFile)) {
    log.info('no migration file for this version, skipping', {
        'app.migration.name': migrationName,
    })

    sqlite.close()
    process.exit(0)
}

log.info('running migration', { 'app.migration.name': migrationName })
const startedAt = Date.now()

try {
    const mod = await import(pathToFileURL(migrationFile).href)
    // Pass the structured logger via ctx so migration scripts emit JSON too,
    // instead of reimplementing the pattern with console.log.
    const result = mod.default(sqlite, { dbPath: DB_PATH, log, version })

    // A migration may close the DB and replace the file on disk (e.g. VACUUM).
    // Detect this via the return value or by checking sqlite.open, then reopen.
    if (result?.dbReplaced || !sqlite.open) {
        sqlite = new Database(DB_PATH)
        sqlite.exec(TRACKING_DDL)
    }

    sqlite
        .prepare(
            `INSERT INTO schema_migrations (name, applied_at, app_version)
             VALUES (?, ?, ?)`,
        )
        .run(migrationName, Date.now(), version)

    log.info('migration applied successfully', {
        'app.migration.name': migrationName,
        'app.migration.duration_ms': Date.now() - startedAt,
    })

    sqlite.close()
} catch (err) {
    log.error('migration failed', {
        'app.migration.name': migrationName,
        'app.migration.duration_ms': Date.now() - startedAt,
        'exception.type': err?.name ?? 'Error',
        'exception.message': err?.message ?? String(err),
        'exception.stacktrace': err?.stack,
    })
    
    if (sqlite.open) sqlite.close()
    process.exit(1)
}
