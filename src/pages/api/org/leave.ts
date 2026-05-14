import type { APIContext, APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../../db/client'
import { logEvent } from '../../../lib/events'

export const prerender = false

function back(redirect: APIContext['redirect'], error?: string): Response {
    return redirect(error ? `/org?error=${encodeURIComponent(error)}` : '/org', 303)
}

export const POST: APIRoute = ({ locals, redirect }) => {
    const user = locals.user!
    if (!user.orgId) return back(redirect, 'You are not in a clan.')
    if (user.orgRole === 'owner') {
        return back(redirect, 'Owners cannot leave. Delete the clan instead.')
    }

    const leftOrgId = user.orgId
    const now = Date.now()
    db.transaction((tx) => {
        // Strip any "shared" flags from this user's filters/categories/open cores
        // — they no longer have an org for the flag to be meaningful against.
        tx.update(schema.filters)
            .set({ sharedWithOrg: 0, updatedAt: now })
            .where(eq(schema.filters.userId, user.id))
            .run()
        tx.update(schema.categories)
            .set({ sharedWithOrg: 0, updatedAt: now })
            .where(eq(schema.categories.userId, user.id))
            .run()
        tx.update(schema.openCores)
            .set({ sharedWithOrg: 0, updatedAt: now })
            .where(eq(schema.openCores.userId, user.id))
            .run()
        tx.update(schema.users)
            .set({ orgId: null, orgRole: null })
            .where(eq(schema.users.id, user.id))
            .run()
    })
    logEvent('org_leave', { userId: user.id, targetId: leftOrgId })
    return back(redirect)
}
