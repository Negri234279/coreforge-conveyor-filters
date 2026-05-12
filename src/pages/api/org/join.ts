import type { APIContext, APIRoute } from 'astro'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../../db/client'
import { clientIp, rateLimit } from '../../../lib/auth/rate-limit'

export const prerender = false

// Rate-limit guessing of invite codes.
const JOIN_LIMIT = 20
const JOIN_WINDOW_MS = 60 * 60 * 1000

function back(redirect: APIContext['redirect'], error?: string): Response {
    return redirect(error ? `/org?error=${encodeURIComponent(error)}` : '/org', 303)
}

export const POST: APIRoute = async ({ locals, request, redirect }) => {
    const user = locals.user!
    if (user.orgId) return back(redirect, 'You are already in a clan. Leave it first.')

    const ip = clientIp(request)
    const rl = rateLimit(`org-join:${ip}`, JOIN_LIMIT, JOIN_WINDOW_MS)
    if (!rl.ok) return back(redirect, `Too many attempts. Try again in ${rl.retryAfter}s.`)

    const form = await request.formData()
    const raw = form.get('code')
    if (typeof raw !== 'string') return back(redirect, 'Enter an invite code.')
    const code = raw.trim().toUpperCase()
    if (!code) return back(redirect, 'Enter an invite code.')

    const org = db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.inviteCode, code))
        .get()
    if (!org) return back(redirect, 'Invalid invite code.')

    db.update(schema.users)
        .set({ orgId: org.id, orgRole: 'member' })
        .where(eq(schema.users.id, user.id))
        .run()
    return back(redirect)
}
