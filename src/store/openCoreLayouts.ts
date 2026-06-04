import { signal } from '@preact/signals'

import type { CreateLayoutBody, OpenCoreLayout, UpdateLayoutBody } from '../types'

export const layoutSaveError = signal<string | null>(null)

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(url, { ...init, cache: 'no-store' })

    if (!res.ok) {
        let message = `Request failed (${res.status})`

        try {
            const body = await res.json()
            if (
                body &&
                typeof body === 'object' &&
                typeof (body as Record<string, unknown>).error === 'string'
            ) {
                message = (body as Record<string, string>).error
            }
        } catch {
            // ignore parse error
        }

        throw new Error(message)
    }

    return res
}

export async function fetchLayoutsForOpenCore(openCoreId: string): Promise<OpenCoreLayout[]> {
    const res = await apiFetch(`/api/opencore-layouts?openCoreId=${encodeURIComponent(openCoreId)}`)
    const data: { layouts: OpenCoreLayout[] } = await res.json()

    return data.layouts
}

export async function fetchLayout(id: string): Promise<OpenCoreLayout> {
    const res = await apiFetch(`/api/opencore-layouts/${encodeURIComponent(id)}`)
    const data: { layout: OpenCoreLayout } = await res.json()

    return data.layout
}

export async function createLayout(body: CreateLayoutBody): Promise<OpenCoreLayout> {
    const res = await apiFetch('/api/opencore-layouts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
    const data: { layout: OpenCoreLayout } = await res.json()

    return data.layout
}

export async function saveLayout(id: string, body: UpdateLayoutBody): Promise<void> {
    await apiFetch(`/api/opencore-layouts/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
}

/** Replace an existing layout's base file in place (keeps its assignments), then
 *  return the refreshed layout. Avoids piling up duplicate rows on re-upload. */
export async function replaceLayoutSource(
    id: string,
    body: { name: string; sourceJson: string },
): Promise<OpenCoreLayout> {
    await saveLayout(id, body)
    return fetchLayout(id)
}

export async function deleteLayout(id: string): Promise<void> {
    await apiFetch(`/api/opencore-layouts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// Module-level debounce state: one timer + one pending body per layout id.
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()
const pendingBodies = new Map<string, UpdateLayoutBody>()
const pendingCallbacks = new Map<string, ((err: Error | null) => void) | undefined>()

const DEBOUNCE_MS = 800

/**
 * Debounced (~800 ms), fire-and-forget save. Coalesces rapid assignment
 * changes; on failure sets layoutSaveError. Optional onSettled callback fires
 * with null on success or an Error on failure — only the last registered
 * callback per id is called (earlier ones are superseded by rapid updates).
 */
export function saveLayoutDebounced(
    id: string,
    body: UpdateLayoutBody,
    onSettled?: (err: Error | null) => void,
): void {
    pendingBodies.set(id, body)
    pendingCallbacks.set(id, onSettled)

    const existing = pendingTimers.get(id)
    if (existing !== undefined) clearTimeout(existing)

    const timer = setTimeout(async () => {
        pendingTimers.delete(id)

        const latest = pendingBodies.get(id)
        const callback = pendingCallbacks.get(id)

        pendingBodies.delete(id)
        pendingCallbacks.delete(id)

        if (!latest) return

        try {
            await saveLayout(id, latest)
            layoutSaveError.value = null
            callback?.(null)
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Save failed')
            layoutSaveError.value = error.message
            callback?.(error)
        }
    }, DEBOUNCE_MS)

    pendingTimers.set(id, timer)
}
