import type { APIRoute } from 'astro'
import { generateCodeVerifier, generateState } from 'arctic'
import { google } from '../../../../lib/oauth'

export const prerender = false

const SECURE = !import.meta.env.DEV

export const GET: APIRoute = ({ url, cookies, redirect, locals }) => {
    const state = generateState()
    const codeVerifier = generateCodeVerifier()
    const authUrl = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email'])

    const opts = {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: SECURE,
        path: '/',
        maxAge: 60 * 10,
    }
    cookies.set('google_oauth_state', state, opts)
    cookies.set('google_oauth_verifier', codeVerifier, opts)

    if (url.searchParams.get('mode') === 'link' && locals.user) {
        cookies.set('link_user_id', locals.user.id, opts)
    }

    return redirect(authUrl.toString(), 302)
}
