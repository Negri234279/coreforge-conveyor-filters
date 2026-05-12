import type { APIRoute } from 'astro'
import { clearSessionCookie, getSessionToken } from '../../../lib/auth/cookie'
import { destroySession } from '../../../lib/auth/session'

export const prerender = false

export const POST: APIRoute = ({ cookies, redirect }) => {
    const token = getSessionToken(cookies)
    destroySession(token)
    clearSessionCookie(cookies)
    return redirect('/login', 303)
}
