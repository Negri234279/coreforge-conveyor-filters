import type { APIContext, APIRoute } from 'astro'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../../db/client'
import { hashPassword } from '../../../lib/auth/password'
import { createSession } from '../../../lib/auth/session'
import { setSessionCookie } from '../../../lib/auth/cookie'
import { clientIp, rateLimit } from '../../../lib/auth/rate-limit'
import { validateEmail, validatePassword, validateUsername } from '../../../lib/auth/validate'
import { logEvent } from '../../../lib/events'

export const prerender = false

// Generous-but-bounded: registration is rare per IP. CSRF is handled in
// middleware; we only need to defend against credential-stuffing-style flooding.
const REGISTER_LIMIT = 5
const REGISTER_WINDOW_MS = 60 * 60 * 1000

function backToForm(redirect: APIContext['redirect'], error: string, username?: string): Response {
    const qs = new URLSearchParams({ error })
    if (username) qs.set('username', username)
    return redirect(`/register?${qs.toString()}`, 303)
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
    const ip = clientIp(request)
    const rl = rateLimit(`register:${ip}`, REGISTER_LIMIT, REGISTER_WINDOW_MS)
    if (!rl.ok) {
        return backToForm(redirect, `Too many attempts. Try again in ${rl.retryAfter}s.`)
    }

    const form = await request.formData()
    const rawUsername = form.get('username')
    const rawPassword = form.get('password')
    const rawConfirm = form.get('password_confirm')
    const rawEmail = form.get('email')

    const u = validateUsername(rawUsername)
    if (!u.ok) {
        return backToForm(
            redirect,
            u.error,
            typeof rawUsername === 'string' ? rawUsername : undefined,
        )
    }

    const p = validatePassword(rawPassword)
    if (!p.ok) return backToForm(redirect, p.error, u.value)

    if (typeof rawConfirm === 'string' && rawConfirm !== rawPassword) {
        return backToForm(redirect, 'Passwords do not match.', u.value)
    }

    const e = validateEmail(rawEmail)
    if (!e.ok) return backToForm(redirect, e.error, u.value)

    const usernameLower = u.value.toLowerCase()

    // Uniqueness check. There's a unique index too, so the INSERT will fail
    // hard if two requests race past this; the catch below handles that.
    const existing = db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.usernameLower, usernameLower))
        .get()
    if (existing) {
        return backToForm(redirect, 'That username is taken.', u.value)
    }

    const passwordHash = await hashPassword(p.value)
    const id = nanoid()
    const now = Date.now()

    try {
        db.insert(schema.users)
            .values({
                id,
                username: u.value,
                usernameLower,
                email: e.value,
                passwordHash,
                orgId: null,
                orgRole: null,
                createdAt: now,
            })
            .run()
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/UNIQUE/i.test(msg)) {
            return backToForm(redirect, 'That username is taken.', u.value)
        }
        throw err
    }

    const session = createSession(id)
    setSessionCookie(cookies, session.token, session.expiresAt)
    logEvent('user_register', { userId: id, userName: u.value })

    return redirect('/', 303)
}
