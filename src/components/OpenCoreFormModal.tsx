import { useEffect, useState } from 'preact/hooks'

interface Props {
    open: boolean
    mode: 'create' | 'edit'
    initialName?: string
    onCancel: () => void
    onSubmit: (values: { name: string }) => void
    validateName?: (name: string) => string | null
}

export default function OpenCoreFormModal({
    open,
    mode,
    initialName = '',
    onCancel,
    onSubmit,
    validateName,
}: Props) {
    const [name, setName] = useState(initialName)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setName(initialName)
        setError(null)
    }, [open, initialName])

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
        onSubmit({ name: trimmed })
    }

    return (
        <div
            class="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel()
            }}
        >
            <form
                onSubmit={submit}
                class="w-full max-w-md rounded-lg border border-slate-800 p-5 shadow-xl"
                style="background:rgba(15,23,42,0.97); border-left:2px solid rgba(245,158,11,0.32)"
            >
                <div class="flex items-start justify-between gap-4">
                    <h3
                        class="text-xl text-slate-100"
                        style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.05em"
                    >
                        {mode === 'create' ? 'New Open Core' : 'Rename Open Core'}
                    </h3>
                    <button
                        type="button"
                        onClick={onCancel}
                        class="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <div class="mt-4">
                    <label class="block font-mono text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
                        Name <span class="text-rose-400">*</span>
                    </label>
                    <input
                        type="text"
                        required
                        autoFocus
                        value={name}
                        onInput={(e) => setName((e.target as HTMLInputElement).value)}
                        class="mt-1 w-full rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition-colors outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20"
                        placeholder="e.g. Main Base, Outpost Farm"
                    />
                </div>

                {error ? (
                    <div class="mt-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                        {error}
                    </div>
                ) : null}

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
                        class="rounded bg-amber-500 px-3 py-1.5 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400"
                    >
                        {mode === 'create' ? 'Create' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    )
}
