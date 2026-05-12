// CSRF defence: for state-changing methods we require the Origin (or, as a
// fallback for legacy clients, Referer) host to match the Host header on the
// request. SameSite=Lax already blocks cross-site cookie sends for non-top-
// level navigations, but this is the belt-and-braces check.

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function isSafeMethod(method: string): boolean {
    return SAFE_METHODS.has(method.toUpperCase())
}

function hostOf(value: string | null): string | null {
    if (!value) return null
    try {
        return new URL(value).host
    } catch {
        return null
    }
}

/**
 * Returns true if the request is safe (read-only method) OR its Origin/Referer
 * host matches the expected host. Returns false otherwise — caller should
 * reject with 403.
 */
export function checkOrigin(request: Request, expectedHost: string): boolean {
    if (isSafeMethod(request.method)) return true

    const originHost = hostOf(request.headers.get('origin'))
    if (originHost) return originHost === expectedHost

    // Some browsers / privacy tools strip Origin on same-origin POSTs. Fall
    // back to Referer, which the browser populates from the page that issued
    // the request. If neither is present we refuse — we can't verify.
    const refererHost = hostOf(request.headers.get('referer'))
    if (refererHost) return refererHost === expectedHost

    return false
}

/** The host the proxy thinks we are. Trusted because nginx sets it. */
export function expectedHost(request: Request): string {
    return request.headers.get('host') ?? ''
}
