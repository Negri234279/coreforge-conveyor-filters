import Database from 'better-sqlite3'
import { existsSync, renameSync, unlinkSync } from 'node:fs'

/**
 * @param {import('better-sqlite3').Database} sqlite
 * @param {{ dbPath: string, log: { info: (m: string, a?: object) => void, warn: (m: string, a?: object) => void, error: (m: string, a?: object) => void }, version: string }} ctx
 */
export default function migrate(sqlite, { dbPath, log }) {
    const tmpPath = dbPath + '.vacuum.tmp'

    // Remove leftover tmp file from a previous interrupted run.
    if (existsSync(tmpPath)) unlinkSync(tmpPath)

    // VACUUM INTO rebuilds the entire file from scratch, copying only reachable
    // data. This repairs the corrupted filter_items pages introduced by the
    // buggy re-running migration that was removed in v1.11.0.
    log.info('VACUUM INTO to repair corrupted filter_items pages', {
        'app.migration.step': 'vacuum_into',
    })

    sqlite.exec(`VACUUM INTO '${tmpPath}'`)
    sqlite.close()

    // Work on the clean copy with FK enforcement off so cascade is manual.
    const clean = new Database(tmpPath)
    clean.pragma('journal_mode = WAL')
    clean.pragma('foreign_keys = OFF')

    const purge = clean.transaction(() => {
        const r1 = clean.prepare(`DELETE FROM filter_items`).run()
        const r2 = clean.prepare(`DELETE FROM filters`).run()
        const r3 = clean.prepare(`DELETE FROM subcategories`).run()
        const r4 = clean.prepare(`DELETE FROM categories`).run()
        const r5 = clean.prepare(`DELETE FROM open_cores`).run()

        log.info('purged corrupted content tables', {
            'app.migration.step': 'purge',
            'app.migration.purged.filter_items': r1.changes,
            'app.migration.purged.filters': r2.changes,
            'app.migration.purged.subcategories': r3.changes,
            'app.migration.purged.categories': r4.changes,
            'app.migration.purged.open_cores': r5.changes,
        })
    })

    purge()

    clean.pragma('foreign_keys = ON')
    clean.close()

    // Remove stale WAL/SHM sidecars so the new DB starts with a clean slate.
    // Non-fatal: on Windows another process may hold the file open (e.g. dev
    // MCP tool). SQLite validates WAL frames via a salt embedded in both files,
    // so a mismatched stale WAL is silently ignored on next open anyway.
    for (const ext of ['-wal', '-shm']) {
        try {
            const f = dbPath + ext
            if (existsSync(f)) unlinkSync(f)
        } catch {
            // ignore EBUSY / EACCES
        }
    }

    // On Windows, renameSync over an existing open file fails with EPERM.
    // Unlinking the destination first creates a delete-pending tombstone that
    // lets the rename succeed even while another process (e.g. MCP dev server)
    // holds the file open.
    try {
        if (existsSync(dbPath)) unlinkSync(dbPath)
    } catch {
        // best-effort; if it fails the rename below will throw a clear error
    }

    renameSync(tmpPath, dbPath)

    log.info('database replaced with clean copy', {
        'app.migration.step': 'replace_db_file',
    })

    return { dbReplaced: true }
}
