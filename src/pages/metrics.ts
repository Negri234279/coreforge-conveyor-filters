// Prometheus scrape endpoint (prom-client default registry). Reachable only
// from inside the docker network / localhost — src/middleware.ts 404s any
// request that arrives through the public proxy.

import type { APIRoute } from 'astro'
import { register } from '../lib/metrics'

export const GET: APIRoute = async () => {
    const body = await register.metrics()
    return new Response(body, {
        headers: {
            'content-type': register.contentType,
            'cache-control': 'no-store',
        },
    })
}
