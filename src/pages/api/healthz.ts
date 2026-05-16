// Liveness probe for Docker/orchestrator healthchecks. Intentionally trivial:
// no DB read, no auth, no session lookup, no allocations beyond the Response
// object. If this endpoint stops responding the process is genuinely stuck.
//
// Whitelisted in src/middleware.ts so it returns 200 even for an unauth'd
// container-internal caller.

import type { APIRoute } from 'astro'

export const prerender = false

export const GET: APIRoute = () =>
    new Response('ok', {
        status: 200,
        headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' },
    })
