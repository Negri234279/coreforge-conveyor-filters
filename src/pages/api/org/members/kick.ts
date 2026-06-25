import type { APIContext, APIRoute } from 'astro'
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../../../../db/client'
import { logEvent } from '../../../../lib/events'

export const prerender = false

function back(redirect: APIContext['redirect'], error?: string): Response {
    return redirect(error ? `/org?error=${encodeURIComponent(error)}` : '/org', 303)
}

export const POST: APIRoute = async ({ locals, request, redirect }) => {
    const user = locals.user!
    if (!user.orgId) return back(redirect, 'You are not in a clan.')
    if (user.orgRole !== 'owner' && user.orgRole !== 'admin') {
        return back(redirect, 'Only owners and admins can remove members.')
    }

    const form = await request.formData()
    const userId = form.get('userId')
    if (typeof userId !== 'string' || !userId) return back(redirect, 'Missing member.')
    if (userId === user.id)
        return back(redirect, "You can't remove yourself. Leave the clan instead.")

    const target = db
        .select({
            id: schema.users.id,
            username: schema.users.username,
            orgRole: schema.users.orgRole,
        })
        .from(schema.users)
        .where(and(eq(schema.users.id, userId), eq(schema.users.orgId, user.orgId)))
        .get()

    if (!target) return back(redirect, 'Member not found in your clan.')
    if (target.orgRole === 'owner') return back(redirect, "The owner can't be removed.")
    if (target.orgRole === 'admin' && user.orgRole !== 'owner') {
        return back(redirect, 'Only the owner can remove an admin.')
    }

    const orgId = user.orgId
    const now = Date.now()

    db.transaction((tx) => {
        // Strip any "shared" flags from the kicked member's filters/categories/
        // open cores — they no longer belong to this clan. Mirrors /api/org/leave.
        tx.update(schema.filters)
            .set({ sharedWithOrg: 0, updatedAt: now })
            .where(eq(schema.filters.userId, target.id))
            .run()
        tx.update(schema.categories)
            .set({ sharedWithOrg: 0, updatedAt: now })
            .where(eq(schema.categories.userId, target.id))
            .run()
        tx.update(schema.openCores)
            .set({ sharedWithOrg: 0, updatedAt: now })
            .where(eq(schema.openCores.userId, target.id))
            .run()
        tx.update(schema.users)
            .set({ orgId: null, orgRole: null })
            .where(eq(schema.users.id, target.id))
            .run()
    })

    logEvent('org_kick', {
        userId: user.id,
        userName: user.username,
        targetId: orgId,
        metadata: { kickedUserId: target.id, kickedUserName: target.username },
    })
    
    return back(redirect)
}
