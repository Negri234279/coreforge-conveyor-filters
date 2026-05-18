import type { APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
import { db } from '../../../db/client'
import { users } from '../../../db/schema'
import { validateUsername } from '../../../lib/auth/validate'

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

    const validation = validateUsername((body as Record<string, unknown>).username)
    if (!validation.ok) {
        return new Response(JSON.stringify({ error: validation.error }), { status: 400 })
    }

    const newUsername = validation.value
    const newUsernameLower = newUsername.toLowerCase()

    if (newUsernameLower === locals.user.username.toLowerCase()) {
        return new Response(JSON.stringify({ error: 'That is already your username.' }), {
            status: 400,
        })
    }

    const existing = db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.usernameLower, newUsernameLower))
        .get()

    if (existing) {
        return new Response(JSON.stringify({ error: 'That username is taken.' }), { status: 400 })
    }

    db.update(users)
        .set({ username: newUsername, usernameLower: newUsernameLower })
        .where(eq(users.id, locals.user.id))
        .run()

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
