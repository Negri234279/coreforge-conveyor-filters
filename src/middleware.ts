// Single middleware pipeline:
//   1. Apply CSRF defence (Origin check) to mutating requests.
//   2. Resolve the session cookie → Astro.locals.user (or null).
//   3. Refresh the cookie if the session was sliding-renewed.
//   4. Gate non-public routes — redirect to /login (pages) or 401 (API).
//   5. Stamp a small set of security headers onto every response.

import { defineMiddleware } from 'astro:middleware'
import { checkOrigin, expectedHost, isSafeMethod } from './lib/auth/origin'
import { clearSessionCookie, getSessionToken, setSessionCookie } from './lib/auth/cookie'
import { loadSession } from './lib/auth/session'
import type { SafeUser } from './env'

const PUBLIC_PAGES = new Set(['/login', '/register'])
const PUBLIC_API_PREFIXES = ['/api/auth/login', '/api/auth/register']

function isPublicPath(pathname: string): boolean {
    if (PUBLIC_PAGES.has(pathname)) return true
    if (PUBLIC_API_PREFIXES.some((p) => pathname === p)) return true
    // Static assets served by Astro / Node adapter
    if (pathname.startsWith('/_astro/') || pathname.startsWith('/_image')) return true
    if (
        pathname.startsWith('/items/') ||
        pathname.startsWith('/boxes/') ||
        pathname === '/favicon.svg' ||
        pathname === '/favicon.ico' ||
        pathname.endsWith('.webp') ||
        pathname.endsWith('.png') ||
        pathname.endsWith('.svg')
    ) {
        return true
    }
    return false
}

function jsonError(status: number, message: string): Response {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
}

const SECURITY_HEADERS: Record<string, string> = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
}

function applySecurityHeaders(res: Response): Response {
    // Responses from Response.redirect() (and a few others) carry an immutable
    // Headers object — mutating it throws. Try in place; on failure, rebuild
    // the response around a mutable copy. Don't clobber values already set.
    try {
        for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
            if (!res.headers.has(k)) res.headers.set(k, v)
        }
        return res
    } catch {
        const headers = new Headers(res.headers)
        for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
            if (!headers.has(k)) headers.set(k, v)
        }
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
    }
}

export const onRequest = defineMiddleware(async (ctx, next) => {
    const { request, url, cookies, locals, redirect } = ctx
    const isApi = url.pathname.startsWith('/api/')

    // --- 1. CSRF (Origin) check for mutating requests --------------------
    if (!isSafeMethod(request.method)) {
        const ok = checkOrigin(request, expectedHost(request))
        if (!ok) {
            return applySecurityHeaders(jsonError(403, 'Bad Origin'))
        }
    }

    // --- 2. Session hydration --------------------------------------------
    const token = getSessionToken(cookies)
    const session = loadSession(token)
    const user: SafeUser | null = session
        ? {
              id: session.user.id,
              username: session.user.username,
              email: session.user.email ?? null,
              orgId: session.user.orgId ?? null,
              orgRole: session.user.orgRole ?? null,
          }
        : null
    locals.user = user

    // Sliding renewal: re-issue the cookie with the new expiry so the browser
    // keeps it in sync.
    if (session?.renewed && token && session.newExpiresAt) {
        setSessionCookie(cookies, token, session.newExpiresAt)
    }
    // Clean up an obviously-stale cookie so it doesn't keep coming back.
    if (token && !session) {
        clearSessionCookie(cookies)
    }

    // --- 3. Auth gating ---------------------------------------------------
    if (!user && !isPublicPath(url.pathname)) {
        if (isApi) {
            return applySecurityHeaders(jsonError(401, 'Authentication required'))
        }
        const next = encodeURIComponent(url.pathname + url.search)
        return redirect(`/login?next=${next}`)
    }

    // Logged-in users hitting /login or /register go home.
    if (user && (url.pathname === '/login' || url.pathname === '/register')) {
        return redirect('/')
    }

    const res = await next()
    return applySecurityHeaders(res)
})
