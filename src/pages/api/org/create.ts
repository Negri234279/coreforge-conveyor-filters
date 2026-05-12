import type { APIContext, APIRoute } from 'astro'
import { nanoid } from 'nanoid'
import { eq, sql } from 'drizzle-orm'
import { db, schema } from '../../../db/client'
import { validateOrgName } from '../../../lib/auth/validate'
import { generateInviteCode } from '../../../lib/auth/invite'

export const prerender = false

function back(redirect: APIContext['redirect'], error?: string): Response {
    return redirect(error ? `/org?error=${encodeURIComponent(error)}` : '/org', 303)
}

export const POST: APIRoute = async ({ locals, request, redirect }) => {
    const user = locals.user!
    if (user.orgId) return back(redirect, 'You are already in a clan.')

    const form = await request.formData()
    const v = validateOrgName(form.get('name'))
    if (!v.ok) return back(redirect, v.error)

    // Clan names are unique, case-insensitive. There's a unique index too, so
    // the INSERT below still wins if two requests race past this check.
    const dup = db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(sql`lower(${schema.organizations.name}) = ${v.value.toLowerCase()}`)
        .get()
    if (dup) return back(redirect, 'That clan name is taken.')

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

    const orgId = nanoid()
    const now = Date.now()
    try {
        db.transaction((tx) => {
            tx.insert(schema.organizations)
                .values({
                    id: orgId,
                    name: v.value,
                    inviteCode: code,
                    ownerId: user.id,
                    createdAt: now,
                })
                .run()
            tx.update(schema.users)
                .set({ orgId, orgRole: 'owner' })
                .where(eq(schema.users.id, user.id))
                .run()
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/UNIQUE/i.test(msg)) return back(redirect, 'That clan name is taken.')
        throw err
    }
    return back(redirect)
}
