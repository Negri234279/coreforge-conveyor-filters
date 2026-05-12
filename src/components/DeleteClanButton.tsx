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
                class="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20"
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
