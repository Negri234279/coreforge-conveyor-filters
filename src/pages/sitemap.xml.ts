import type { APIRoute } from 'astro'

// Dynamic sitemap. The app is SSR (`output: 'server'`) and almost every route
// is auth-gated, so there's nothing for @astrojs/sitemap to crawl at build
// time — we hand-list the genuinely public, indexable pages instead. Keep this
// in sync with PUBLIC_PAGES in src/middleware.ts and the Allow rules in
// public/robots.txt: login/register are Disallow'd and everything else needs a
// session, so only the landing page and the legal page belong here.
const PUBLIC_ROUTES: { path: string; changefreq: string; priority: string }[] = [
    { path: '/', changefreq: 'weekly', priority: '1.0' },
    { path: '/legal', changefreq: 'yearly', priority: '0.3' },
]

export const GET: APIRoute = ({ site }) => {
    // `site` comes from astro.config.mjs → always defined here, but fall back to
    // the canonical origin so a missing config can never emit relative URLs.
    const origin = (site ?? new URL('https://coreforge-conveyor-filters.negri.es')).origin
    const lastmod = new Date().toISOString()

    const urls = PUBLIC_ROUTES.map(
        ({ path, changefreq, priority }) => `    <url>
        <loc>${origin}${path}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>${changefreq}</changefreq>
        <priority>${priority}</priority>
    </url>`,
    ).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${urls}
        </urlset>
    `

    return new Response(xml, {
        headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'public, max-age=3600',
        },
    })
}
