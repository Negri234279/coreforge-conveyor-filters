// Tiny in-memory sliding-window rate limiter. Single-process; fine for one
// app container. Buckets self-expire on lookup so there's no background timer
// to manage.

interface Bucket {
    count: number
    resetAt: number
}

const buckets = new Map<string, Bucket>()
// Soft cap so a flood of distinct keys (e.g. random IPs) can't grow memory
// without bound. When we hit it, drop the oldest expired entries first; if
// that doesn't free enough, drop ~10% of entries at random.
const MAX_KEYS = 10_000

function pruneIfNeeded(now: number): void {
    if (buckets.size < MAX_KEYS) return
    for (const [k, v] of buckets) {
        if (v.resetAt < now) buckets.delete(k)
        if (buckets.size < MAX_KEYS * 0.9) return
    }
    let drop = Math.ceil(buckets.size * 0.1)
    for (const k of buckets.keys()) {
        if (drop-- <= 0) break
        buckets.delete(k)
    }
}

export interface RateLimitResult {
    ok: boolean
    /** Seconds the caller should wait before retrying. 0 if ok. */
    retryAfter: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now()
    pruneIfNeeded(now)
    const b = buckets.get(key)
    if (!b || b.resetAt < now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs })
        return { ok: true, retryAfter: 0 }
    }
    if (b.count >= limit) {
        return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) }
    }
    b.count++
    return { ok: true, retryAfter: 0 }
}

/** Clear the bucket — call on successful auth so good actors aren't penalised. */
export function rateLimitReset(key: string): void {
    buckets.delete(key)
}

/** Best-effort client IP. Honours X-Forwarded-For only if present (our nginx sets it). */
export function clientIp(request: Request): string {
    const xff = request.headers.get('x-forwarded-for')
    if (xff) {
        const first = xff.split(',')[0]?.trim()
        if (first) return first
    }
    return request.headers.get('x-real-ip') ?? 'unknown'
}
