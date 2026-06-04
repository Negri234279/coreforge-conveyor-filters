import type { APIRoute } from 'astro'
import { and, count, eq, or } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db, schema } from '../../../db/client'
import { logEvent } from '../../../lib/events'
import { canEditLayout } from '../../../lib/openCore/access'
import type { BoxAssignment, OpenCoreLayout } from '../../../types'

export const prerender = false

const MAX_SOURCE_JSON_BYTES = 2 * 1024 * 1024 // 2 MB
const MAX_NAME = 120

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
        },
    })
}

function trimStr(v: unknown, max = MAX_NAME): string {
    if (typeof v !== 'string') return ''
    return v.trim().slice(0, max)
}

function buildLayout(
    row: typeof schema.openCoreLayouts.$inferSelect,
    owner: { id: string; username: string },
    canEdit: boolean,
): OpenCoreLayout {
    let assignments: BoxAssignment[] = []
    try {
        const parsed = JSON.parse(row.assignmentsJson)
        if (Array.isArray(parsed)) assignments = parsed as BoxAssignment[]
    } catch {
        assignments = []
    }
    return {
        id: row.id,
        openCoreId: row.openCoreId ?? null,
        name: row.name,
        sharedWithOrg: row.sharedWithOrg === 1,
        sourceJson: row.sourceJson,
        assignments,
        owner,
        canEdit,
        createdAt: new Date(row.createdAt).toISOString(),
        updatedAt: new Date(row.updatedAt).toISOString(),
    }
}

export const GET: APIRoute = ({ locals, url }) => {
    const user = locals.user!
    const openCoreId = url.searchParams.get('openCoreId')

    if (openCoreId) {
        // Visibility comes from the open core's sharedWithOrg, not the layout's own flag.
        // Return: own layouts, OR layouts whose linked open core is shared with the user's org.
        const joined = db
            .select({
                layout: schema.openCoreLayouts,
                ownerUsername: schema.users.username,
                ownerOrgId: schema.users.orgId,
                ocSharedWithOrg: schema.openCores.sharedWithOrg,
            })
            .from(schema.openCoreLayouts)
            .innerJoin(schema.users, eq(schema.openCoreLayouts.userId, schema.users.id))
            .leftJoin(schema.openCores, eq(schema.openCoreLayouts.openCoreId, schema.openCores.id))
            .where(
                and(
                    eq(schema.openCoreLayouts.openCoreId, openCoreId),
                    user.orgId
                        ? or(
                              eq(schema.openCoreLayouts.userId, user.id),
                              and(
                                  eq(schema.openCores.sharedWithOrg, 1),
                                  eq(schema.users.orgId, user.orgId),
                              ),
                          )
                        : eq(schema.openCoreLayouts.userId, user.id),
                ),
            )
            .orderBy(schema.openCoreLayouts.position)
            .all()

        const layouts = joined.map(({ layout: r, ownerUsername, ownerOrgId, ocSharedWithOrg }) => {
            const isShared = r.sharedWithOrg === 1 || (ocSharedWithOrg ?? 0) === 1
            const isEdit = canEditLayout({
                layoutUserId: r.userId,
                layoutSharedWithOrg: isShared,
                ownerOrgId: ownerOrgId ?? null,
                user: { id: user.id, orgId: user.orgId, orgRole: user.orgRole },
            })
            return buildLayout(r, { id: r.userId, username: ownerUsername }, isEdit)
        })
        return json({ layouts })
    }

    const rows = db
        .select()
        .from(schema.openCoreLayouts)
        .where(eq(schema.openCoreLayouts.userId, user.id))
        .orderBy(schema.openCoreLayouts.position)
        .all()

    const owner = { id: user.id, username: user.username }
    const layouts = rows.map((r) => buildLayout(r, owner, true))
    return json({ layouts })
}

export const POST: APIRoute = async ({ locals, request }) => {
    const user = locals.user!

    // Size guard before reading body
    const contentLength = request.headers.get('content-length')
    if (contentLength && Number(contentLength) > MAX_SOURCE_JSON_BYTES) {
        return json({ error: 'Payload too large (max 2 MB)' }, 413)
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return json({ error: 'Invalid JSON body' }, 400)
    }

    if (!body || typeof body !== 'object') {
        return json({ error: 'Body must be an object' }, 400)
    }

    const b = body as Record<string, unknown>

    // sourceJson: must be a string containing a valid entities array
    const sourceJson = trimStr(b.sourceJson, MAX_SOURCE_JSON_BYTES)
    if (!sourceJson) return json({ error: 'sourceJson is required' }, 400)
    if (sourceJson.length > MAX_SOURCE_JSON_BYTES) {
        return json({ error: 'Payload too large (max 2 MB)' }, 413)
    }
    try {
        const parsed = JSON.parse(sourceJson)
        if (
            !parsed ||
            typeof parsed !== 'object' ||
            !Array.isArray((parsed as Record<string, unknown>).entities)
        ) {
            return json(
                { error: 'sourceJson must be a CopyPaste export with an "entities" array' },
                400,
            )
        }
    } catch {
        return json({ error: 'sourceJson is not valid JSON' }, 400)
    }

    // name
    const rawName = trimStr(b.name)
    const name = rawName.length > 0 ? rawName : 'Untitled layout'

    // openCoreId — verify ownership
    let openCoreId: string | null = null
    const rawOcId = trimStr(b.openCoreId as string | null | undefined, 64)
    if (rawOcId) {
        const oc = db
            .select({ id: schema.openCores.id })
            .from(schema.openCores)
            .where(and(eq(schema.openCores.id, rawOcId), eq(schema.openCores.userId, user.id)))
            .get()
        if (!oc) return json({ error: 'openCoreId not found or not owned by you' }, 400)
        openCoreId = rawOcId
    }

    // sharedWithOrg
    const sharedWithOrg = user.orgId ? (b.sharedWithOrg === true ? 1 : 0) : 0

    // position = current count for this user
    const countResult = db
        .select({ n: count() })
        .from(schema.openCoreLayouts)
        .where(eq(schema.openCoreLayouts.userId, user.id))
        .get()
    const position = countResult?.n ?? 0

    const id = nanoid()
    const now = Date.now()

    db.insert(schema.openCoreLayouts)
        .values({
            id,
            userId: user.id,
            openCoreId,
            name,
            sourceJson,
            assignmentsJson: '[]',
            sharedWithOrg,
            position,
            createdAt: now,
            updatedAt: now,
        })
        .run()

    logEvent('opencore_layout_create', {
        userId: user.id,
        userName: user.username,
        targetId: id,
        metadata: { openCoreId },
    })

    const row = db
        .select()
        .from(schema.openCoreLayouts)
        .where(eq(schema.openCoreLayouts.id, id))
        .get()!

    const layout = buildLayout(row, { id: user.id, username: user.username }, true)
    return json({ layout }, 201)
}
