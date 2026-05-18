import type { APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
import { db } from '../../../db/client'
import { users } from '../../../db/schema'
import { hashPassword, verifyPassword } from '../../../lib/auth/password'
import { validatePassword } from '../../../lib/auth/validate'

export const PATCH: APIRoute = async ({ locals, request }) => {
    if (!locals.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 })
    }

    const { currentPassword, newPassword, confirmPassword } = body as Record<string, unknown>

    const row = db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, locals.user.id))
        .get()

    if (!row) {
        return new Response(JSON.stringify({ error: 'User not found.' }), { status: 400 })
    }

    if (!row.passwordHash) {
        // Google-only account: allow setting a password without a current one
        const validation = validatePassword(newPassword)
        if (!validation.ok) {
            return new Response(JSON.stringify({ error: validation.error }), { status: 400 })
        }
        if (newPassword !== confirmPassword) {
            return new Response(JSON.stringify({ error: 'Passwords do not match.' }), {
                status: 400,
            })
        }
        const newHash = await hashPassword(validation.value)
        db.update(users).set({ passwordHash: newHash }).where(eq(users.id, locals.user.id)).run()
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    if (typeof currentPassword !== 'string' || !currentPassword) {
        return new Response(JSON.stringify({ error: 'Current password is required.' }), {
            status: 400,
        })
    }

    const valid = await verifyPassword(row.passwordHash, currentPassword)
    if (!valid) {
        return new Response(JSON.stringify({ error: 'Current password is incorrect.' }), {
            status: 400,
        })
    }

    const validation = validatePassword(newPassword)
    if (!validation.ok) {
        return new Response(JSON.stringify({ error: validation.error }), { status: 400 })
    }

    if (newPassword !== confirmPassword) {
        return new Response(JSON.stringify({ error: 'Passwords do not match.' }), { status: 400 })
    }

    const newHash = await hashPassword(validation.value)
    db.update(users).set({ passwordHash: newHash }).where(eq(users.id, locals.user.id)).run()

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
