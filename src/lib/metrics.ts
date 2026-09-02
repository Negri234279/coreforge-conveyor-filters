// Prometheus metrics (prom-client) — pull-based: the observability stack's
// Prometheus scrapes GET /metrics (src/pages/metrics.ts, gated in
// src/middleware.ts). Traces are the only push-based telemetry (OTLP → Tempo).
//
// Everything registers on prom-client's default global registry. The
// globalThis guard makes module re-evaluation (Vite HMR in dev) a no-op —
// prom-client throws on duplicate metric names otherwise.

import { Counter, Gauge, Histogram, collectDefaultMetrics, register } from 'prom-client'
import { sql } from 'drizzle-orm'
import { db } from '../db/client'
import pkg from '../../package.json'
import type { EventType } from './events'

export { register }

type AppMetrics = {
    httpRequestDuration: Histogram<'method' | 'route' | 'status'>
    eventsTotal: Counter<'type'>
    eventPersistFailures: Counter<string>
}

function scalarQuery(query: string): number {
    try {
        const row = db.get<{ c: number }>(sql.raw(query))
        return row?.c ?? 0
    } catch {
        // Never let a scrape break on a missing/locked table.
        return 0
    }
}

function countRows(table: string): number {
    return scalarQuery(`SELECT count(*) AS c FROM ${table}`)
}

function deploymentEnvironment(): string {
    // OTEL_RESOURCE_ATTRIBUTES: 'service.namespace=coreforge,deployment.environment=production'
    const attrs = process.env.OTEL_RESOURCE_ATTRIBUTES ?? ''
    const match = attrs.match(/deployment\.environment=([^,]+)/)
    if (match) return match[1]
    return process.env.NODE_ENV === 'production' ? 'production' : 'development'
}

function createMetrics(): AppMetrics {
    collectDefaultMetrics()

    // Release pin — constant 1, lets dashboards/alerts correlate behaviour
    // changes with deploys.
    new Gauge({
        name: 'coreforge_build_info',
        help: 'Build/release info (constant 1)',
        labelNames: ['version', 'service', 'environment'],
    }).set(
        {
            version: pkg.version,
            service: process.env.OTEL_SERVICE_NAME ?? 'coreforge',
            environment: deploymentEnvironment(),
        },
        1,
    )

    // Live business totals, read from SQLite on every scrape. count(*) on
    // these tables is O(rows-in-index) and the tables are small — cheap at a
    // 15s scrape interval.
    const businessGauges = [
        { name: 'coreforge_users_total', help: 'Registered users', table: 'users' },
        { name: 'coreforge_filters_total', help: 'Conveyor filters', table: 'filters' },
        { name: 'coreforge_categories_total', help: 'Categories', table: 'categories' },
        { name: 'coreforge_orgs_total', help: 'Organizations (clans)', table: 'organizations' },
        { name: 'coreforge_subcategories_total', help: 'Subcategories', table: 'subcategories' },
        { name: 'coreforge_open_cores_total', help: 'Open cores', table: 'open_cores' },
        {
            name: 'coreforge_opencore_layouts_total',
            help: 'Open Core layouts',
            table: 'open_core_layouts',
        },
        {
            name: 'coreforge_events_rows_total',
            help: 'Rows in the append-only events table',
            table: 'events',
        },
    ] as const

    for (const { name, help, table } of businessGauges) {
        new Gauge({
            name,
            help,
            collect() {
                this.set(countRows(table))
            },
        })
    }

    // Engagement: users whose throttled last_seen_at falls inside the window.
    // The label set is fixed (3 windows), so cardinality stays bounded.
    const activeWindows = { '1d': 1, '7d': 7, '30d': 30 } as const

    new Gauge({
        name: 'coreforge_active_users',
        help: 'Users seen within the window (users.last_seen_at)',
        labelNames: ['window'],
        collect() {
            const now = Date.now()
            for (const [window, days] of Object.entries(activeWindows)) {
                const since = now - days * 86_400_000
                this.set(
                    { window },
                    scalarQuery(`SELECT count(*) AS c FROM users WHERE last_seen_at > ${since}`),
                )
            }
        },
    })

    new Gauge({
        name: 'coreforge_sessions_active',
        help: 'Unexpired sessions',
        collect() {
            this.set(
                scalarQuery(`SELECT count(*) AS c FROM sessions WHERE expires_at > ${Date.now()}`),
            )
        },
    })

    // Clan-feature adoption: rows opted into org sharing, per content kind.
    const sharedKinds = {
        filters: 'filters',
        categories: 'categories',
        open_cores: 'open_cores',
        layouts: 'open_core_layouts',
    } as const
    
    new Gauge({
        name: 'coreforge_shared_with_org_total',
        help: 'Rows shared with an org (shared_with_org = 1)',
        labelNames: ['kind'],
        collect() {
            for (const [kind, table] of Object.entries(sharedKinds)) {
                this.set(
                    { kind },
                    scalarQuery(`SELECT count(*) AS c FROM ${table} WHERE shared_with_org = 1`),
                )
            }
        },
    })

    new Gauge({
        name: 'coreforge_db_size_bytes',
        help: 'SQLite main database size (page_count × page_size, excludes WAL)',
        collect() {
            this.set(
                scalarQuery(
                    'SELECT page_count * page_size AS c FROM pragma_page_count(), pragma_page_size()',
                ),
            )
        },
    })

    return {
        httpRequestDuration: new Histogram({
            name: 'http_request_duration_seconds',
            help: 'Inbound HTTP request duration',
            labelNames: ['method', 'route', 'status'],
            buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        }),
        eventsTotal: new Counter({
            name: 'coreforge_events_total',
            help: 'Business events, same taxonomy as logEvent',
            labelNames: ['type'],
        }),
        eventPersistFailures: new Counter({
            name: 'coreforge_events_persist_failures_total',
            help: 'logEvent rows that failed to persist to SQLite',
        }),
    }
}

const globals = globalThis as typeof globalThis & { __cfMetrics?: AppMetrics }
const metrics = globals.__cfMetrics ?? (globals.__cfMetrics = createMetrics())

export function observeHttpRequest(
    method: string,
    route: string,
    status: number,
    seconds: number,
): void {
    metrics.httpRequestDuration.observe({ method, route, status: String(status) }, seconds)
}

export function countEvent(type: EventType): void {
    metrics.eventsTotal.inc({ type })
}

export function countEventPersistFailure(): void {
    metrics.eventPersistFailures.inc()
}
