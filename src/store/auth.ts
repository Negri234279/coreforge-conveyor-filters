// Tiny read-only window onto the current user. The Astro Layout injects
// `window.__cf_user` (just the fields the UI needs) on every server render,
// so client components can branch on "am I in an org? am I owner?" without
// an extra round-trip.

export interface ClientUser {
    id: string
    username: string
    orgId: string | null
    orgRole: 'owner' | 'member' | null
}

export function getCurrentUser(): ClientUser | null {
    if (typeof window === 'undefined') return null
    return (window as unknown as { __cf_user?: ClientUser | null }).__cf_user ?? null
}
