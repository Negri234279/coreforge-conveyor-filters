import { useRef, useState } from 'preact/hooks'
import ConfirmDeleteModal from './ConfirmDeleteModal'

type Props = {
    userId: string
    memberName: string
}

export default function KickMemberButton({ userId, memberName }: Props) {
    const [open, setOpen] = useState(false)
    const formRef = useRef<HTMLFormElement | null>(null)

    return (
        <form ref={formRef} method="POST" action="/api/org/members/kick" class="m-0">
            <input type="hidden" name="userId" value={userId} />
            <button
                type="button"
                onClick={() => setOpen(true)}
                class="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/20"
                aria-label={`Remove ${memberName} from the clan`}
                title={`Remove ${memberName} from the clan`}
            >
                Kick
            </button>

            <ConfirmDeleteModal
                open={open}
                title="Remove member"
                message={`Remove ${memberName} from the clan? They'll keep their filters as personal.`}
                confirmLabel="Remove"
                onCancel={() => setOpen(false)}
                onConfirm={() => {
                    setOpen(false)
                    formRef.current?.submit()
                }}
            />
        </form>
    )
}
