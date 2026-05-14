// Session = random 32-byte token in a cookie + sha256(token) row in `sessions`.
// Storing the hash (not the raw token) means a DB leak doesn't hand out live
// sessions, but verifying a cookie is still a single indexed lookup.

import { randomBytes, createHash } from 'node:crypto'
import { and, eq, lt } from 'drizzle-orm'
import { db, schema } from '../../db/client'
import type { DbUser } from '../../db/schema'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const SLIDING_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000 // refresh if < 7 days left

function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

export function newSessionToken(): string {
    return randomBytes(32).toString('base64url')
}

export interface CreatedSession {
    token: string
    expiresAt: number
}

export function createSession(userId: string): CreatedSession {
    const token = newSessionToken()
    const id = hashToken(token)
    const now = Date.now()
    const expiresAt = now + SESSION_TTL_MS
    db.insert(schema.sessions).values({ id, userId, expiresAt, createdAt: now }).run()
    return { token, expiresAt }
}

export interface LoadedSession {
    user: DbUser
    expiresAt: number
    /** True if the session was sliding-renewed during this load. */
    renewed: boolean
    newExpiresAt?: number
}

export function loadSession(token: string | undefined): LoadedSession | null {
    if (!token) return null
    const id = hashToken(token)

    const row = db
        .select({
            sessionExpires: schema.sessions.expiresAt,
            user: schema.users,
        })
        .from(schema.sessions)
        .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
        .where(eq(schema.sessions.id, id))
        .get()

    if (!row) return null
    const now = Date.now()
    if (row.sessionExpires < now) {
        // Expired — opportunistically clean up.
        db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run()
        return null
    }

    // Sliding renewal: if less than the threshold remains, extend.
    let renewed = false
    let newExpiresAt: number | undefined
    if (row.sessionExpires - now < SLIDING_THRESHOLD_MS) {
        newExpiresAt = now + SESSION_TTL_MS
        db.update(schema.sessions)
            .set({ expiresAt: newExpiresAt })
            .where(eq(schema.sessions.id, id))
            .run()
        renewed = true
    }

    return {
        user: row.user,
        expiresAt: newExpiresAt ?? row.sessionExpires,
        renewed,
        newExpiresAt,
    }
}

export function destroySession(token: string | undefined): void {
    if (!token) return
    const id = hashToken(token)
    db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run()
}

/** Invalidate every session for a user (used when changing password). */
export function destroyAllUserSessions(userId: string): void {
    db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run()
}

/** Cheap maintenance: drop any sessions past their expiry. */
export function purgeExpiredSessions(): void {
    db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, Date.now())).run()
}

/** Stamp the user's last_seen_at. Middleware calls this throttled to ~60s. */
export function touchLastSeen(userId: string, now: number): void {
    db.update(schema.users).set({ lastSeenAt: now }).where(eq(schema.users.id, userId)).run()
}

export const SESSION_TTL_S = SESSION_TTL_MS / 1000
// re-exported so middleware can reuse the and() import without pulling drizzle directly
export const _re = { and }
