/**
 * v1.11.0 — Reset shared_with_org on personal Open Cores.
 *
 * The old share endpoint flipped shared_with_org=1 directly on the user's own
 * record. The new flow clones the OC into an independent clan copy, so personal
 * OCs must stay private (shared_with_org=0).
 *
 * @param {import('better-sqlite3').Database} sqlite
 */
export default function migrate(sqlite) {
    sqlite.exec(`UPDATE open_cores SET shared_with_org = 0 WHERE shared_with_org = 1`)
}
