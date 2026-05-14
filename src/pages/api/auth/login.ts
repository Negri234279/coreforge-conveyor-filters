import type { APIContext, APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../../db/client'
import { verifyPassword } from '../../../lib/auth/password'
import { createSession } from '../../../lib/auth/session'
import { setSessionCookie } from '../../../lib/auth/cookie'
import { clientIp, rateLimit, rateLimitReset } from '../../../lib/auth/rate-limit'
import { logEvent } from '../../../lib/events'

export const prerender = false

// Brute-force defence is two-layer: per-IP catches a single attacker, per-
// username catches credential-stuffing where one account is targeted from
// many IPs. Both window 15 min, both relatively tight.
const LOGIN_LIMIT_IP = 20
const LOGIN_LIMIT_USER = 8
const LOGIN_WINDOW_MS = 15 * 60 * 1000

const GENERIC_ERROR = 'Invalid username or password.'

function backToForm(
    redirect: APIContext['redirect'],
    error: string,
    next: string | null,
    username?: string,
): Response {
    const qs = new URLSearchParams({ error })
    if (next) qs.set('next', next)
    if (username) qs.set('username', username)
    return redirect(`/login?${qs.toString()}`, 303)
}

function safeNext(raw: unknown): string | null {
    if (typeof raw !== 'string' || !raw) return null
    // Only allow same-origin, single-leading-slash paths. Prevents open redirect.
    if (!raw.startsWith('/') || raw.startsWith('//')) return null
    if (raw.length > 512) return null
    return raw
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const ip = clientIp(request)
    const ipRl = rateLimit(`login-ip:${ip}`, LOGIN_LIMIT_IP, LOGIN_WINDOW_MS)
    if (!ipRl.ok) {
        return backToForm(redirect, `Too many attempts. Try again in ${ipRl.retryAfter}s.`, null)
    }

    const form = await request.formData()
    const rawUsername = form.get('username')
    const rawPassword = form.get('password')
    const next = safeNext(form.get('next'))

    if (typeof rawUsername !== 'string' || typeof rawPassword !== 'string') {
        return backToForm(redirect, GENERIC_ERROR, next)
    }
    const username = rawUsername.trim()
    const usernameLower = username.toLowerCase()

    const userRl = rateLimit(`login-user:${usernameLower}`, LOGIN_LIMIT_USER, LOGIN_WINDOW_MS)
    if (!userRl.ok) {
        return backToForm(
            redirect,
            `Too many attempts. Try again in ${userRl.retryAfter}s.`,
            next,
            username,
        )
    }

    const user = db
        .select()
        .from(schema.users)
        .where(eq(schema.users.usernameLower, usernameLower))
        .get()

    // Always run the password hash, even when the user is unknown, so the
    // total response time doesn't reveal account existence. Use a sacrificial
    // hash for the "no user" branch.
    const SACRIFICIAL =
        '$argon2id$v=19$m=19456,t=2,p=1$YWFhYWFhYWFhYWFhYWFhYQ$JqVI/J5+1u4l0vZqVw7B5wPfwjsv7Pj0bJqzC5cdEv0'
    const stored = user?.passwordHash ?? SACRIFICIAL
    const ok = await verifyPassword(stored, rawPassword)

    if (!user || !ok) {
        return backToForm(redirect, GENERIC_ERROR, next, username)
    }

    // Success — reset bad-attempt buckets so good actors aren't penalised.
    rateLimitReset(`login-ip:${ip}`)
    rateLimitReset(`login-user:${usernameLower}`)

    const session = createSession(user.id)
    setSessionCookie(cookies, session.token, session.expiresAt)
    logEvent('user_login', { userId: user.id })

    return redirect(next ?? '/', 303)
}
