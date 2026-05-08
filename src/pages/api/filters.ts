import type { APIRoute } from 'astro'
import { promises as fs } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Category } from '../../types'

export const prerender = false

const FILE_NAME = import.meta.env.DEV ? 'filters.dev.json' : 'filters.prod.json'
const DATA_DIR = process.env.DATA_DIR ?? resolve(process.cwd(), 'src/data')
const FILE_PATH = resolve(DATA_DIR, FILE_NAME)

interface PersistedState {
    categories: Category[]
}

async function readState(): Promise<PersistedState> {
    try {
        const raw = await fs.readFile(FILE_PATH, 'utf8')
        if (!raw.trim()) return { categories: [] }
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) return { categories: parsed }
        if (parsed && Array.isArray(parsed.categories)) {
            return { categories: parsed.categories }
        }
        return { categories: [] }
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return { categories: [] }
        }
        throw err
    }
}

async function writeState(state: PersistedState): Promise<void> {
    const out = JSON.stringify(state, null, 2) + '\n'
    await fs.mkdir(dirname(FILE_PATH), { recursive: true })
    await fs.writeFile(FILE_PATH, out, 'utf8')
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
        },
    })
}

export const GET: APIRoute = async () => {
    const state = await readState()
    return jsonResponse({ ...state, source: FILE_NAME })
}

export const PUT: APIRoute = async ({ request }) => {
    let payload: unknown
    try {
        payload = await request.json()
    } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    if (
        !payload ||
        typeof payload !== 'object' ||
        !Array.isArray((payload as PersistedState).categories)
    ) {
        return jsonResponse({ error: 'Body must be { categories: Category[] }' }, 400)
    }

    const state: PersistedState = {
        categories: (payload as PersistedState).categories,
    }
    await writeState(state)
    return jsonResponse({ ok: true, source: FILE_NAME })
}
