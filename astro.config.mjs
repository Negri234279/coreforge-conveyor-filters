// @ts-check
import { defineConfig } from 'astro/config'

import tailwindcss from '@tailwindcss/vite'
import preact from '@astrojs/preact'
import node from '@astrojs/node'

// https://astro.build/config
export default defineConfig({
    site: 'https://coreforge-conveyor-filters.negri.es',
    output: 'server',
    adapter: node({ mode: 'standalone' }),
    vite: {
        plugins: [tailwindcss()],
    },
    integrations: [preact()],
})
