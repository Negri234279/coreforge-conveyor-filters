// Validation rules for credentials & org names. Server-side is the source of
// truth — the forms in /register and /login also enforce these client-side
// just for UX.

export const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128 // argon2 inputs are bounded; this is plenty
export const ORG_NAME_MIN = 2
export const ORG_NAME_MAX = 48
export const EMAIL_MAX = 254 // RFC 5321

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateUsername(
    raw: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
    if (typeof raw !== 'string') return { ok: false, error: 'Username is required.' }
    const v = raw.trim()
    if (!USERNAME_RE.test(v)) {
        return { ok: false, error: 'Username must be 3–32 chars: letters, digits, _ or -.' }
    }
    return { ok: true, value: v }
}

export function validatePassword(
    raw: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
    if (typeof raw !== 'string') return { ok: false, error: 'Password is required.' }
    if (raw.length < PASSWORD_MIN) {
        return { ok: false, error: `Password must be at least ${PASSWORD_MIN} characters.` }
    }
    if (raw.length > PASSWORD_MAX) {
        return { ok: false, error: `Password must be at most ${PASSWORD_MAX} characters.` }
    }
    return { ok: true, value: raw }
}

export function validateEmail(
    raw: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
    if (raw == null || raw === '') return { ok: true, value: null }
    if (typeof raw !== 'string') return { ok: false, error: 'Email must be a string.' }
    const v = raw.trim().toLowerCase()
    if (v.length > EMAIL_MAX || !EMAIL_RE.test(v)) {
        return { ok: false, error: 'That email doesn’t look right.' }
    }
    return { ok: true, value: v }
}

export function validateOrgName(
    raw: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
    if (typeof raw !== 'string') return { ok: false, error: 'Name is required.' }
    const v = raw.trim()
    if (v.length < ORG_NAME_MIN || v.length > ORG_NAME_MAX) {
        return { ok: false, error: `Name must be ${ORG_NAME_MIN}–${ORG_NAME_MAX} characters.` }
    }
    return { ok: true, value: v }
}
