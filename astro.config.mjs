// @ts-check
import { defineConfig } from 'astro/config'

import tailwindcss from '@tailwindcss/vite'
import preact from '@astrojs/preact'
import node from '@astrojs/node'

// https://astro.build/config
export default defineConfig({
    site: 'https://coreforge-conveyor-filters.negri.es',
    output: 'server',
    // We run our own CSRF/Origin check in src/middleware.ts (compares the
    // Origin/Referer host against the Host header — proxy-tolerant, scheme-
    // agnostic). Astro's built-in check compares full origins including scheme
    // and would 403 legit POSTs behind the TLS-terminating proxy / over HTTP.
    security: { checkOrigin: false },
    adapter: node({ mode: 'standalone' }),
    vite: {
        plugins: [tailwindcss()],
        server: {
            // Dev-only: the observability stack's Prometheus scrapes the
            // host-run dev server as host.docker.internal:4300 (see
            // infra/dev/scrape.d/app.yml); Vite 403s unknown Hosts otherwise.
            allowedHosts: ['host.docker.internal'],
            // Dockerized dev (infra/dev, profile `app`): file events don't
            // cross the Windows bind mount, so the container sets this env
            // var and Vite falls back to polling to keep HMR working.
            // Polling cost scales with file count — skip the huge static
            // asset trees (public/ is served from disk per request in dev
            // anyway, no watch needed) and keep the interval modest.
            watch:
                process.env.CHOKIDAR_USEPOLLING === 'true'
                    ? {
                          usePolling: true,
                          interval: 1000,
                          ignored: ['**/public/**', '**/dist/**', '**/.git/**'],
                      }
                    : undefined,
        },
    },
    integrations: [preact()],
})
