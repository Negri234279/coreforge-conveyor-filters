import type { APIContext, APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../../db/client'

export const prerender = false

function back(redirect: APIContext['redirect'], error?: string): Response {
    return redirect(error ? `/org?error=${encodeURIComponent(error)}` : '/org', 303)
}

export const POST: APIRoute = ({ locals, redirect }) => {
    const user = locals.user!
    if (!user.orgId) return back(redirect, 'You are not in a clan.')
    if (user.orgRole !== 'owner') return back(redirect, 'Only the owner can delete the clan.')

    const orgId = user.orgId
    db.transaction((tx) => {
        // Unset shared flags for every member's filters / categories / open cores.
        const members = tx
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(eq(schema.users.orgId, orgId))
            .all()
        for (const m of members) {
            tx.update(schema.filters)
                .set({ sharedWithOrg: 0 })
                .where(eq(schema.filters.userId, m.id))
                .run()
            tx.update(schema.categories)
                .set({ sharedWithOrg: 0 })
                .where(eq(schema.categories.userId, m.id))
                .run()
            tx.update(schema.openCores)
                .set({ sharedWithOrg: 0 })
                .where(eq(schema.openCores.userId, m.id))
                .run()
        }
        tx.update(schema.users)
            .set({ orgId: null, orgRole: null })
            .where(eq(schema.users.orgId, orgId))
            .run()
        tx.delete(schema.organizations).where(eq(schema.organizations.id, orgId)).run()
    })
    return back(redirect)
}
