import { useRef, useState } from 'preact/hooks'
import ConfirmDeleteModal from './ConfirmDeleteModal'

export default function DeleteClanButton({ clanName }: { clanName: string }) {
    const [open, setOpen] = useState(false)
    const formRef = useRef<HTMLFormElement | null>(null)

    return (
        <form ref={formRef} method="POST" action="/api/org/delete" class="mt-3">
            <button
                type="button"
                onClick={() => setOpen(true)}
                class="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-bold tracking-wide text-rose-300 uppercase transition-colors hover:bg-rose-500/20 hover:text-rose-200"
            >
                Delete clan
            </button>

            <ConfirmDeleteModal
                open={open}
                title="Delete clan"
                message={`Delete clan "${clanName}"? Members will keep their filters as personal. This can't be undone.`}
                confirmLabel="Delete clan"
                onCancel={() => setOpen(false)}
                onConfirm={() => {
                    setOpen(false)
                    formRef.current?.submit()
                }}
            />
        </form>
    )
}
