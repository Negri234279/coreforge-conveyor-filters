// GET /api/admin/stats — aggregated metrics for the admin dashboard.
// Gated on locals.user.isAdmin. Returns a single big JSON payload built from
// ~10 small indexed SQL queries; pulls everything in one round-trip so the
// dashboard renders with no client-side joining.

import type { APIRoute } from 'astro'
import { sql } from 'drizzle-orm'
import { db } from '../../../db/client'

export const prerender = false

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
}

// Small helper: drizzle's `db.all(sql\`...\`)` returns `unknown[]`. We assert
// the row shape per call since the SQL is hand-written and tested.
function rows<T>(query: ReturnType<typeof sql>): T[] {
    return db.all(query) as T[]
}
function row<T>(query: ReturnType<typeof sql>): T | undefined {
    return db.get(query) as T | undefined
}

const DAY_MS = 86_400_000

export const GET: APIRoute = ({ locals }) => {
    const user = locals.user!
    if (!user.isAdmin) {
        // 404 (not 403) — don't acknowledge the route exists to non-admins.
        return json({ error: 'Not found' }, 404)
    }

    const now = Date.now()
    const dayAgo = now - DAY_MS
    const weekAgo = now - 7 * DAY_MS
    const monthAgo = now - 30 * DAY_MS

    // ----- Users ---------------------------------------------------------
    const totalUsers = row<{ n: number }>(sql`SELECT COUNT(*) as n FROM users`)?.n ?? 0
    const newToday =
        row<{ n: number }>(sql`SELECT COUNT(*) as n FROM users WHERE created_at >= ${dayAgo}`)?.n ??
        0
    const newWeek =
        row<{ n: number }>(sql`SELECT COUNT(*) as n FROM users WHERE created_at >= ${weekAgo}`)
            ?.n ?? 0
    const newMonth =
        row<{ n: number }>(sql`SELECT COUNT(*) as n FROM users WHERE created_at >= ${monthAgo}`)
            ?.n ?? 0

    const dau =
        row<{ n: number }>(sql`SELECT COUNT(*) as n FROM users WHERE last_seen_at >= ${dayAgo}`)
            ?.n ?? 0
    const wau =
        row<{ n: number }>(sql`SELECT COUNT(*) as n FROM users WHERE last_seen_at >= ${weekAgo}`)
            ?.n ?? 0
    const mau =
        row<{ n: number }>(sql`SELECT COUNT(*) as n FROM users WHERE last_seen_at >= ${monthAgo}`)
            ?.n ?? 0

    const withOrg =
        row<{ n: number }>(sql`SELECT COUNT(*) as n FROM users WHERE org_id IS NOT NULL`)?.n ?? 0
    const withEmail =
        row<{ n: number }>(
            sql`SELECT COUNT(*) as n FROM users WHERE email IS NOT NULL AND email != ''`,
        )?.n ?? 0

    // Registrations by day, last 30 days. Group by day bucket (ms / 86400000).
    const registrationsByDay = rows<{ day: number; n: number }>(
        sql`SELECT CAST(created_at / ${DAY_MS} AS INTEGER) as day, COUNT(*) as n
            FROM users WHERE created_at >= ${monthAgo}
            GROUP BY day ORDER BY day ASC`,
    )

    // ----- Organisations -------------------------------------------------
    const totalOrgs = row<{ n: number }>(sql`SELECT COUNT(*) as n FROM organizations`)?.n ?? 0
    const topOrgsByMembers = rows<{ id: string; name: string; members: number }>(
        sql`SELECT o.id, o.name, COUNT(u.id) as members
            FROM organizations o
            LEFT JOIN users u ON u.org_id = o.id
            GROUP BY o.id ORDER BY members DESC LIMIT 10`,
    )

    // ----- Content -------------------------------------------------------
    const totalCategories = row<{ n: number }>(sql`SELECT COUNT(*) as n FROM categories`)?.n ?? 0
    const totalSubcategories =
        row<{ n: number }>(sql`SELECT COUNT(*) as n FROM subcategories`)?.n ?? 0
    const totalFilters = row<{ n: number }>(sql`SELECT COUNT(*) as n FROM filters`)?.n ?? 0
    const totalOpenCores = row<{ n: number }>(sql`SELECT COUNT(*) as n FROM open_cores`)?.n ?? 0
    const totalFilterItems = row<{ n: number }>(sql`SELECT COUNT(*) as n FROM filter_items`)?.n ?? 0

    const filtersNewWeek =
        row<{ n: number }>(sql`SELECT COUNT(*) as n FROM filters WHERE created_at >= ${weekAgo}`)
            ?.n ?? 0
    const filtersEditedWeek =
        row<{ n: number }>(
            sql`SELECT COUNT(*) as n FROM filters WHERE updated_at >= ${weekAgo} AND updated_at > created_at`,
        )?.n ?? 0

    const filtersByDay = rows<{ day: number; n: number }>(
        sql`SELECT CAST(created_at / ${DAY_MS} AS INTEGER) as day, COUNT(*) as n
            FROM filters WHERE created_at >= ${monthAgo}
            GROUP BY day ORDER BY day ASC`,
    )

    const avgItems = row<{ avg: number | null; max: number | null }>(
        sql`SELECT AVG(c) as avg, MAX(c) as max FROM (
                SELECT filter_id, COUNT(*) as c FROM filter_items GROUP BY filter_id
            )`,
    ) ?? { avg: 0, max: 0 }
    const filtersAtCap =
        row<{ n: number }>(
            sql`SELECT COUNT(*) as n FROM (
                SELECT filter_id FROM filter_items GROUP BY filter_id HAVING COUNT(*) >= 30
            )`,
        )?.n ?? 0

    const deploymentTotals = row<{ boxes: number; conveyors: number; storage: number }>(
        sql`SELECT
                COALESCE(SUM(box_count), 0) as boxes,
                COALESCE(SUM(conveyor_count), 0) as conveyors,
                COALESCE(SUM(storage_adaptor_count), 0) as storage
                FROM filters`,
    ) ?? { boxes: 0, conveyors: 0, storage: 0 }

    const sharedCounts = row<{ filters: number; categories: number; openCores: number }>(
        sql`SELECT
                (SELECT COUNT(*) FROM filters WHERE shared_with_org = 1) as filters,
                (SELECT COUNT(*) FROM categories WHERE shared_with_org = 1) as categories,
                (SELECT COUNT(*) FROM open_cores WHERE shared_with_org = 1) as openCores`,
    ) ?? { filters: 0, categories: 0, openCores: 0 }

    const topItems = rows<{ shortname: string; filters: number }>(
        sql`SELECT shortname, COUNT(DISTINCT filter_id) as filters
            FROM filter_items GROUP BY shortname
            ORDER BY filters DESC LIMIT 20`,
    )

    const topBoxes = rows<{ boxImagePath: string; n: number }>(
        sql`SELECT box_image_path as boxImagePath, COUNT(*) as n
            FROM filters WHERE box_image_path IS NOT NULL AND box_image_path != ''
            GROUP BY box_image_path ORDER BY n DESC LIMIT 10`,
    )

    // ----- Top users -----------------------------------------------------
    const topUsersByFilters = rows<{
        id: string
        username: string
        filters: number
    }>(
        sql`SELECT u.id, u.username, COUNT(f.id) as filters
            FROM users u LEFT JOIN filters f ON f.user_id = u.id
            GROUP BY u.id HAVING filters > 0
            ORDER BY filters DESC LIMIT 10`,
    )
    const topUsersByCategories = rows<{
        id: string
        username: string
        categories: number
    }>(
        sql`SELECT u.id, u.username, COUNT(c.id) as categories
            FROM users u LEFT JOIN categories c ON c.user_id = u.id
            GROUP BY u.id HAVING categories > 0
            ORDER BY categories DESC LIMIT 10`,
    )

    // ----- Recent users / activity --------------------------------------
    const recentUsers = rows<{
        id: string
        username: string
        email: string | null
        orgRole: string | null
        createdAt: number
        lastSeenAt: number | null
    }>(
        sql`SELECT id, username, email, org_role as orgRole,
                   created_at as createdAt, last_seen_at as lastSeenAt
            FROM users ORDER BY created_at DESC LIMIT 20`,
    )

    const recentlyActiveUsers = rows<{
        id: string
        username: string
        lastSeenAt: number | null
    }>(
        sql`SELECT id, username, last_seen_at as lastSeenAt
            FROM users WHERE last_seen_at IS NOT NULL
            ORDER BY last_seen_at DESC LIMIT 10`,
    )

    // ----- Events --------------------------------------------------------
    const eventCountsWeek = rows<{ type: string; n: number }>(
        sql`SELECT type, COUNT(*) as n FROM events WHERE created_at >= ${weekAgo}
            GROUP BY type ORDER BY n DESC`,
    )
    const eventCountsMonth = rows<{ type: string; n: number }>(
        sql`SELECT type, COUNT(*) as n FROM events WHERE created_at >= ${monthAgo}
            GROUP BY type ORDER BY n DESC`,
    )
    const recentEvents = rows<{
        id: number
        userId: string | null
        username: string | null
        type: string
        targetId: string | null
        metadata: string | null
        createdAt: number
    }>(
        sql`SELECT e.id, e.user_id as userId, u.username, e.type,
                   e.target_id as targetId, e.metadata, e.created_at as createdAt
            FROM events e LEFT JOIN users u ON u.id = e.user_id
            ORDER BY e.created_at DESC LIMIT 50`,
    )
    const totalEvents = row<{ n: number }>(sql`SELECT COUNT(*) as n FROM events`)?.n ?? 0

    // ----- Schema migrations --------------------------------------------
    // Pre-tracking rows are backfilled with applied_at = 0; surface them as
    // such so the UI can render "historic" instead of a bogus epoch date.
    const migrations = rows<{
        name: string
        appliedAt: number
        appVersion: string | null
    }>(
        sql`SELECT name, applied_at as appliedAt, app_version as appVersion
            FROM schema_migrations ORDER BY applied_at ASC, name ASC`,
    )

    return json({
        generatedAt: now,
        users: {
            total: totalUsers,
            newToday,
            newWeek,
            newMonth,
            dau,
            wau,
            mau,
            withOrg,
            withoutOrg: Math.max(totalUsers - withOrg, 0),
            withEmail,
            registrationsByDay,
            recent: recentUsers,
            recentlyActive: recentlyActiveUsers,
            topByFilters: topUsersByFilters,
            topByCategories: topUsersByCategories,
        },
        orgs: {
            total: totalOrgs,
            top: topOrgsByMembers,
        },
        content: {
            categories: totalCategories,
            subcategories: totalSubcategories,
            filters: totalFilters,
            openCores: totalOpenCores,
            filterItems: totalFilterItems,
            filtersNewWeek,
            filtersEditedWeek,
            filtersByDay,
            avgItemsPerFilter: avgItems.avg ?? 0,
            maxItemsInOneFilter: avgItems.max ?? 0,
            filtersAtCap,
            deployment: deploymentTotals,
            shared: sharedCounts,
            topItems,
            topBoxes,
        },
        events: {
            total: totalEvents,
            countsWeek: eventCountsWeek,
            countsMonth: eventCountsMonth,
            recent: recentEvents,
        },
        migrations,
    })
}
