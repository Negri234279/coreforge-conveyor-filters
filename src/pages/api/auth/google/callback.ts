import type { APIRoute } from 'astro'
import { decodeIdToken } from 'arctic'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../../../../db/client'
import { setSessionCookie } from '../../../../lib/auth/cookie'
import { logEvent } from '../../../../lib/events'
import { google } from '../../../../lib/oauth'
import { createSession } from '../../../../lib/auth/session'

export const prerender = false

interface GoogleClaims {
    sub: string
    email: string
    name: string
    picture: string
}

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
    const storedState = cookies.get('google_oauth_state')?.value
    const storedVerifier = cookies.get('google_oauth_verifier')?.value
    const stateParam = url.searchParams.get('state')
    const code = url.searchParams.get('code')

    cookies.delete('google_oauth_state', { path: '/' })
    cookies.delete('google_oauth_verifier', { path: '/' })

    if (!storedState || !storedVerifier || !stateParam || !code || storedState !== stateParam) {
        return redirect('/login?error=OAuth+state+mismatch', 303)
    }

    // --- Link flow: user is already logged in and wants to attach Google ---
    const linkUserId = cookies.get('link_user_id')?.value
    cookies.delete('link_user_id', { path: '/' })

    if (linkUserId) {
        try {
            const tokens = await google.validateAuthorizationCode(code, storedVerifier)
            const claims = decodeIdToken(tokens.idToken()) as GoogleClaims
            const { sub: googleId, email, picture: avatarUrl } = claims

            // Reject if this Google account is already linked to a different user
            const existing = db
                .select({ id: schema.users.id })
                .from(schema.users)
                .where(eq(schema.users.googleId, googleId))
                .get()
            if (existing && existing.id !== linkUserId) {
                return redirect('/account?link_error=already_used', 303)
            }

            const currentUser = db
                .select({ username: schema.users.username })
                .from(schema.users)
                .where(eq(schema.users.id, linkUserId))
                .get()

            const updates: Record<string, string | null> = { googleId, avatarUrl }
            // Only set email if the account doesn't already have one
            if (email) {
                const currentEmail = db
                    .select({ email: schema.users.email })
                    .from(schema.users)
                    .where(eq(schema.users.id, linkUserId))
                    .get()
                if (!currentEmail?.email) updates.email = email
            }

            db.update(schema.users).set(updates).where(eq(schema.users.id, linkUserId)).run()
            logEvent('user_link_google', {
                userId: linkUserId,
                userName: currentUser?.username ?? null,
                targetId: googleId,
                metadata: { provider: 'google' },
            })

            return redirect('/account?linked=true', 303)
        } catch (err) {
            console.error('[google oauth link]', err)
            return redirect('/account?link_error=failed', 303)
        }
    }

    // --- Normal login / register flow ---
    try {
        const tokens = await google.validateAuthorizationCode(code, storedVerifier)
        const claims = decodeIdToken(tokens.idToken()) as GoogleClaims
        const { sub: googleId, email, name, picture: avatarUrl } = claims

        const now = Date.now()
        let user = db.select().from(schema.users).where(eq(schema.users.googleId, googleId)).get()

        if (user) {
            // Update avatar if Google changed it
            if (user.avatarUrl !== avatarUrl) {
                db.update(schema.users).set({ avatarUrl }).where(eq(schema.users.id, user.id)).run()
            }
        } else {
            // Try to link to an existing account by email
            if (email) {
                user = db.select().from(schema.users).where(eq(schema.users.email, email)).get()
                if (user) {
                    db.update(schema.users)
                        .set({ googleId, avatarUrl })
                        .where(eq(schema.users.id, user.id))
                        .run()
                }
            }
        }

        if (!user) {
            const id = nanoid()
            const rawName = name || email?.split('@')[0] || `user_${id.slice(0, 8)}`
            let username = rawName
            let usernameLower = rawName.toLowerCase().replace(/\s+/g, '_')

            const taken = db
                .select({ id: schema.users.id })
                .from(schema.users)
                .where(eq(schema.users.usernameLower, usernameLower))
                .get()
            if (taken) {
                const suffix = id.slice(0, 6)
                username = `${rawName}_${suffix}`
                usernameLower = `${usernameLower}_${suffix}`
            }

            db.insert(schema.users)
                .values({
                    id,
                    username,
                    usernameLower,
                    email: email ?? null,
                    passwordHash: null,
                    googleId,
                    avatarUrl,
                    orgId: null,
                    orgRole: null,
                    createdAt: now,
                })
                .run()

            logEvent('user_register', { userId: id, userName: username })
            user = db.select().from(schema.users).where(eq(schema.users.id, id)).get()!
        }

        const session = createSession(user.id)
        setSessionCookie(cookies, session.token, session.expiresAt)
        logEvent('user_login_google', {
            userId: user.id,
            userName: user.username,
            targetId: googleId,
            metadata: { provider: 'google' },
        })
        logEvent('user_login', { userId: user.id, userName: user.username })

        return redirect('/', 303)
    } catch (err) {
        console.error('[google oauth]', err)
        return redirect('/login?error=Authentication+failed', 303)
    }
}
