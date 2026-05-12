import type { APIContext, APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../../../db/client'
import { generateInviteCode } from '../../../../lib/auth/invite'

export const prerender = false

function back(redirect: APIContext['redirect'], error?: string): Response {
    return redirect(error ? `/org?error=${encodeURIComponent(error)}` : '/org', 303)
}

export const POST: APIRoute = ({ locals, redirect }) => {
    const user = locals.user!
    if (!user.orgId) return back(redirect, 'You are not in a clan.')
    if (user.orgRole !== 'owner')
        return back(redirect, 'Only the owner can rotate the invite code.')

    let code = generateInviteCode()
    for (let i = 0; i < 5; i++) {
        const exists = db
            .select({ id: schema.organizations.id })
            .from(schema.organizations)
            .where(eq(schema.organizations.inviteCode, code))
            .get()
        if (!exists) break
        code = generateInviteCode()
    }
    db.update(schema.organizations)
        .set({ inviteCode: code })
        .where(eq(schema.organizations.id, user.orgId))
        .run()
    return back(redirect)
}
