import { useEffect, useState } from 'preact/hooks'
import type { OpenCore } from '../types'

interface Props {
    open: boolean
    mode: 'create' | 'edit'
    initialName?: string
    initialOpenCoreId?: string | null
    initialSharedWithOrg?: boolean
    /** Available Open Cores to assign this category to. */
    openCores?: OpenCore[]
    /** When set, the Open Core picker is hidden and the category is locked to this Open Core. */
    lockedOpenCoreId?: string | null
    /** Show the "Share with clan" toggle (caller must be in an org). */
    canShareWithOrg?: boolean
    onCancel: () => void
    onSubmit: (values: {
        name: string
        openCoreId: string | null
        sharedWithOrg: boolean
    }) => void
    validateName?: (name: string) => string | null
}

export default function CategoryFormModal({
    open,
    mode,
    initialName = '',
    initialOpenCoreId = null,
    initialSharedWithOrg = false,
    openCores = [],
    lockedOpenCoreId,
    canShareWithOrg = false,
    onCancel,
    onSubmit,
    validateName,
}: Props) {
    const locked = lockedOpenCoreId !== undefined
    const [name, setName] = useState(initialName)
    const [openCoreId, setOpenCoreId] = useState<string>(initialOpenCoreId ?? '')
    const [shared, setShared] = useState<boolean>(initialSharedWithOrg)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setName(initialName)
        setOpenCoreId((locked ? lockedOpenCoreId : initialOpenCoreId) ?? '')
        setShared(initialSharedWithOrg)
        setError(null)
    }, [open, initialName, initialOpenCoreId, initialSharedWithOrg, locked, lockedOpenCoreId])

    if (!open) return null

    function submit(e: Event) {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) {
            setError('Name is required.')
            return
        }
        if (validateName) {
            const msg = validateName(trimmed)
            if (msg) {
                setError(msg)
                return
            }
        }
        const oc = locked ? (lockedOpenCoreId ?? null) : openCoreId || null
        onSubmit({ name: trimmed, openCoreId: oc, sharedWithOrg: canShareWithOrg && shared })
    }

    return (
        <div
            class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel()
            }}
        >
            <form
                onSubmit={submit}
                class="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl"
            >
                <div class="flex items-start justify-between gap-4">
                    <h3 class="text-base font-semibold text-slate-100">
                        {mode === 'create' ? 'New category' : 'Edit category'}
                    </h3>
                    <button
                        type="button"
                        onClick={onCancel}
                        class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <div class="mt-4">
                    <label class="block text-xs font-semibold tracking-wider text-slate-400 uppercase">
                        Name <span class="text-rose-400">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        autoFocus
                        value={name}
                        onInput={(e) => setName((e.target as HTMLInputElement).value)}
                        class="mt-1 w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/40"
                        placeholder="e.g. Metal, Components"
                    />
                </div>

                {!locked ? (
                    <div class="mt-4">
                        <label class="block text-xs font-semibold tracking-wider text-slate-400 uppercase">
                            Open Core
                        </label>
                        <select
                            value={openCoreId}
                            onChange={(e) => setOpenCoreId((e.target as HTMLSelectElement).value)}
                            class="mt-1 w-full appearance-none rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-500/60 focus:ring-1 focus:ring-teal-500/40"
                        >
                            <option value="">— None (loose category) —</option>
                            {openCores.map((oc) => (
                                <option key={oc.id} value={oc.id}>
                                    {oc.name}
                                </option>
                            ))}
                        </select>
                        <p class="mt-1 text-xs text-slate-500">
                            Group this category under an Open Core, or leave it loose.
                        </p>
                    </div>
                ) : null}

                {canShareWithOrg ? (
                    <div class="mt-4">
                        <label class="flex cursor-pointer items-start gap-2 text-sm text-slate-200">
                            <input
                                type="checkbox"
                                checked={shared}
                                onChange={(e) =>
                                    setShared((e.target as HTMLInputElement).checked)
                                }
                                class="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-teal-500/40"
                            />
                            <span>
                                Share with clan
                                <span class="mt-0.5 block text-xs text-slate-500">
                                    All clan members will see this category and can clone it.
                                </span>
                            </span>
                        </label>
                    </div>
                ) : null}

                {error ? (
                    <div class="mt-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                        {error}
                    </div>
                ) : null}

                <div class="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        class="rounded-md px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        class="rounded-md bg-teal-500/90 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-teal-400"
                    >
                        {mode === 'create' ? 'Create' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    )
}
