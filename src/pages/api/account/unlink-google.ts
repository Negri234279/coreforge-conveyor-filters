import type { APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
import { db } from '../../../db/client'
import { users } from '../../../db/schema'
import { logEvent } from '../../../lib/events'

export const POST: APIRoute = async ({ locals }) => {
    if (!locals.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const row = db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, locals.user.id))
        .get()

    if (!row?.passwordHash) {
        return new Response(
            JSON.stringify({ error: 'Set a password before unlinking Google.' }),
            { status: 400 },
        )
    }

    db.update(users)
        .set({ googleId: null, avatarUrl: null })
        .where(eq(users.id, locals.user.id))
        .run()

    logEvent('user_unlink_google', {
        userId: locals.user.id,
        userName: locals.user.username,
    })

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
}
