import { useEffect, useState } from 'preact/hooks'

interface Props {
    open: boolean
    mode: 'create' | 'edit'
    initialName?: string
    onCancel: () => void
    onSubmit: (values: { name: string }) => void
    validateName?: (name: string) => string | null
}

export default function SubcategoryFormModal({
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
                        {mode === 'create' ? 'New subcategory' : 'Rename subcategory'}
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
                        placeholder="e.g. ROW 1, Common"
                    />
                </div>

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
