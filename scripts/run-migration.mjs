import Database from 'better-sqlite3'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const { version } = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'))

const DB_FILE =
    process.env.NODE_ENV === 'production' ? 'coreforge.prod.db' : 'coreforge.dev.db'
const DATA_DIR = process.env.DATA_DIR ?? resolve(process.cwd(), 'src/data')
const DB_PATH = resolve(DATA_DIR, DB_FILE)

if (!existsSync(DB_PATH)) {
    console.log(`[migration] fresh install — no existing database, skipping`)
    process.exit(0)
}

let sqlite = new Database(DB_PATH)

const TRACKING_DDL = `
    CREATE TABLE IF NOT EXISTS _applied_migrations (
        name       TEXT PRIMARY KEY,
        applied_at INTEGER NOT NULL
    )
`
sqlite.exec(TRACKING_DDL)

const migrationName = `migration-${version}`
const migrationFile = resolve(__dirname, `../src/db/migrations/${migrationName}.mjs`)

const alreadyApplied = sqlite
    .prepare('SELECT 1 FROM _applied_migrations WHERE name = ?')
    .get(migrationName)

if (alreadyApplied) {
    console.log(`[migration] ${migrationName} already applied, skipping`)
    sqlite.close()
    process.exit(0)
}

if (!existsSync(migrationFile)) {
    console.log(`[migration] no migration file for v${version}, skipping`)
    sqlite.close()
    process.exit(0)
}

console.log(`[migration] running ${migrationName}`)
const mod = await import(pathToFileURL(migrationFile).href)
const result = mod.default(sqlite, { dbPath: DB_PATH })

// A migration may close the DB and replace the file on disk (e.g. VACUUM).
// Detect this via the return value or by checking sqlite.open, then reopen.
if (result?.dbReplaced || !sqlite.open) {
    sqlite = new Database(DB_PATH)
    sqlite.exec(TRACKING_DDL)
}

sqlite
    .prepare('INSERT INTO _applied_migrations (name, applied_at) VALUES (?, ?)')
    .run(migrationName, Date.now())

console.log(`[migration] ${migrationName} applied successfully`)
sqlite.close()
