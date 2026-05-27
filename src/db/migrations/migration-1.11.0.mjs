/**
 * v1.11.0 — Reset shared_with_org on personal Open Cores.
 *
 * The old share endpoint flipped shared_with_org=1 directly on the user's own
 * record. The new flow clones the OC into an independent clan copy, so personal
 * OCs must stay private (shared_with_org=0).
 *
 * @param {import('better-sqlite3').Database} sqlite
 * @param {{ dbPath: string, log: { info: (m: string, a?: object) => void, warn: (m: string, a?: object) => void, error: (m: string, a?: object) => void }, version: string }} ctx
 */
export default function migrate(sqlite, { log }) {
    const r = sqlite
        .prepare(`UPDATE open_cores SET shared_with_org = 0 WHERE shared_with_org = 1`)
        .run()

    log.info('reset shared_with_org on personal Open Cores', {
        'app.migration.step': 'reset_shared_with_org',
        'app.migration.affected_rows': r.changes,
    })
}
