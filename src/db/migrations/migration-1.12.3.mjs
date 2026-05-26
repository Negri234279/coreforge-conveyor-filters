import Database from 'better-sqlite3'
import { existsSync, renameSync, unlinkSync } from 'node:fs'

/**
 * @param {import('better-sqlite3').Database} sqlite
 * @param {{ dbPath: string }} ctx
 */
export default function migrate(sqlite, { dbPath }) {
    const tmpPath = dbPath + '.vacuum.tmp'

    // Remove leftover tmp file from a previous interrupted run.
    if (existsSync(tmpPath)) unlinkSync(tmpPath)

    // VACUUM INTO rebuilds the entire file from scratch, copying only reachable
    // data. This repairs the corrupted filter_items pages introduced by the
    // buggy re-running migration that was removed in v1.11.0.
    console.log('[migration] VACUUM INTO to repair corrupted filter_items pages...')
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
        
        console.log(
            `[migration] purged: filter_items=${r1.changes} filters=${r2.changes} ` +
                `subcategories=${r3.changes} categories=${r4.changes} open_cores=${r5.changes}`,
        )
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
    console.log('[migration] database replaced with clean copy')

    return { dbReplaced: true }
}
