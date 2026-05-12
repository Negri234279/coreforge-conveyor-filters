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
    },
    integrations: [preact()],
})
