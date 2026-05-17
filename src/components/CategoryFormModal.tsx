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
            class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel()
            }}
        >
            <form
                onSubmit={submit}
                class="w-full max-w-md rounded-lg border border-slate-800 border-l-2 border-l-amber-500/30 bg-[#0d1117] p-5 shadow-[0_0_60px_rgba(0,0,0,0.8),0_0_30px_rgba(245,158,11,0.05)]"
            >
                {/* Header */}
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <div class="mb-0.5 font-mono text-[11px] uppercase tracking-widest text-amber-500/50">
                            {mode === 'create' ? 'New' : 'Edit'}
                        </div>
                        <h3
                            class="text-2xl text-slate-100"
                            style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                        >
                            Category
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        class="rounded p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-amber-400"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Name */}
                <div class="mt-5">
                    <label class="block font-mono text-[11px] uppercase tracking-widest text-amber-500/50">
                        Name <span class="text-rose-400">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        autoFocus
                        value={name}
                        onInput={(e) => setName((e.target as HTMLInputElement).value)}
                        class="mt-1.5 w-full rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
                        placeholder="e.g. Metal, Components"
                    />
                </div>

                {/* Open Core picker */}
                {!locked ? (
                    <div class="mt-4">
                        <label class="block font-mono text-[11px] uppercase tracking-widest text-amber-500/50">
                            Open Core
                        </label>
                        <select
                            value={openCoreId}
                            onChange={(e) => setOpenCoreId((e.target as HTMLSelectElement).value)}
                            class="mt-1.5 w-full appearance-none rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
                        >
                            <option value="">— None (loose category) —</option>
                            {openCores.map((oc) => (
                                <option key={oc.id} value={oc.id}>
                                    {oc.name}
                                </option>
                            ))}
                        </select>
                        <p class="mt-1 font-mono text-[11px] text-slate-600">
                            Group this category under an Open Core, or leave it loose.
                        </p>
                    </div>
                ) : null}

                {/* Share with clan */}
                {canShareWithOrg ? (
                    <div class="mt-4">
                        <label class="flex cursor-pointer items-start gap-2.5 text-sm text-slate-300">
                            <input
                                type="checkbox"
                                checked={shared}
                                onChange={(e) =>
                                    setShared((e.target as HTMLInputElement).checked)
                                }
                                class="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 accent-amber-500 focus:ring-1 focus:ring-amber-500/30"
                            />
                            <span>
                                Share with clan
                                <span class="mt-0.5 block font-mono text-[11px] text-slate-600">
                                    All clan members will see this category and can clone it.
                                </span>
                            </span>
                        </label>
                    </div>
                ) : null}

                {/* Validation error */}
                {error ? (
                    <div class="mt-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-[11px] text-rose-300">
                        {error}
                    </div>
                ) : null}

                {/* Actions */}
                <div class="mt-5 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        class="rounded px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        class="rounded bg-amber-500 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-slate-950 transition-colors hover:bg-amber-400"
                    >
                        {mode === 'create' ? 'Create' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    )
}
