import type { AstroCookies } from 'astro'

export const SESSION_COOKIE = 'cf_session'

// Single source of truth for the `Secure` flag: on in production (served over
// HTTPS behind the proxy), off in dev (plain http://localhost, where a Secure
// cookie would be dropped). Vite inlines `import.meta.env.DEV` at build time.
const SECURE = !import.meta.env.DEV

export function getSessionToken(cookies: AstroCookies): string | undefined {
    return cookies.get(SESSION_COOKIE)?.value
}

export function setSessionCookie(cookies: AstroCookies, token: string, expiresAt: number): void {
    cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: SECURE,
        path: '/',
        expires: new Date(expiresAt),
    })
}

export function clearSessionCookie(cookies: AstroCookies): void {
    cookies.set(SESSION_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: SECURE,
        path: '/',
        maxAge: 0,
    })
}
