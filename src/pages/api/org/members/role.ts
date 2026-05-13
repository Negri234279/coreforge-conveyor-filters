import type { APIContext, APIRoute } from 'astro'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../db/client'

export const prerender = false

const ASSIGNABLE_ROLES = new Set(['admin', 'member'])

function back(redirect: APIContext['redirect'], error?: string): Response {
    return redirect(error ? `/org?error=${encodeURIComponent(error)}` : '/org', 303)
}

export const POST: APIRoute = async ({ locals, request, redirect }) => {
    const user = locals.user!
    if (!user.orgId) return back(redirect, 'You are not in a clan.')
    if (user.orgRole !== 'owner') return back(redirect, 'Only the owner can change roles.')

    const form = await request.formData()
    const userId = form.get('userId')
    const role = form.get('role')
    if (typeof userId !== 'string' || !userId) return back(redirect, 'Missing member.')
    if (typeof role !== 'string' || !ASSIGNABLE_ROLES.has(role)) {
        return back(redirect, 'Invalid role.')
    }
    if (userId === user.id) return back(redirect, "You can't change your own role.")

    const target = db
        .select({ id: schema.users.id, orgRole: schema.users.orgRole })
        .from(schema.users)
        .where(and(eq(schema.users.id, userId), eq(schema.users.orgId, user.orgId)))
        .get()
    if (!target) return back(redirect, 'Member not found in your clan.')
    if (target.orgRole === 'owner') return back(redirect, "The owner's role can't be changed.")

    db.update(schema.users)
        .set({ orgRole: role })
        .where(and(eq(schema.users.id, userId), eq(schema.users.orgId, user.orgId)))
        .run()
    return back(redirect)
}
