// Server-side helper: builds the client RUM config injected into pages as
// `window.__cf_faro` (Layout.astro and the unauthenticated landing in
// index.astro). Empty/unset FARO_COLLECTOR_URL = RUM disabled.

import pkg from '../../package.json'

export type FaroClientConfig = {
    url: string
    appName: string
    appVersion: string
    environment: string
}

function deploymentEnvironment(): string {
    const attrs = process.env.OTEL_RESOURCE_ATTRIBUTES ?? ''
    const match = attrs.match(/deployment\.environment=([^,]+)/)
    if (match) return match[1]
    
    return process.env.NODE_ENV === 'production' ? 'production' : 'development'
}

export function faroClientConfig(): FaroClientConfig | null {
    const url = process.env.FARO_COLLECTOR_URL
    if (!url) return null

    return {
        url,
        appName: process.env.FARO_APP_NAME ?? 'coreforge-web',
        appVersion: pkg.version,
        environment: deploymentEnvironment(),
    }
}
