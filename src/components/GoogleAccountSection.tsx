import { useState } from 'preact/hooks'
import ConfirmDeleteModal from './ConfirmDeleteModal'

interface Props {
    isLinked: boolean
}

const GoogleLogo = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        class="h-5 w-5 shrink-0"
        aria-hidden="true"
    >
        <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
        />
        <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
        />
        <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            fill="#FBBC05"
        />
        <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
        />
    </svg>
)

export default function GoogleAccountSection({ isLinked: initialLinked }: Props) {
    const [isLinked, setIsLinked] = useState(initialLinked)
    const [modalOpen, setModalOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleUnlink() {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/account/unlink-google', { method: 'POST' })
            const data = await res.json()
            if (res.ok) {
                setIsLinked(false)
                setModalOpen(false)
            } else {
                setError((data as { error?: string }).error ?? 'Something went wrong.')
                setModalOpen(false)
            }
        } catch {
            setError('Network error. Please try again.')
            setModalOpen(false)
        } finally {
            setLoading(false)
        }
    }

    return (
        <section class="rounded-lg border border-slate-800 bg-slate-900/30 p-5 transition-all hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]">
            <h2 class="font-mono text-[11px] tracking-widest text-slate-400 uppercase">
                Linked Accounts
            </h2>
            <div class="mt-3 flex items-center justify-between gap-4">
                <div class="flex items-center gap-2.5">
                    <GoogleLogo />
                    <div>
                        <p class="text-sm text-slate-200">Google</p>
                        {isLinked ? (
                            <p class="text-xs text-amber-400">Connected</p>
                        ) : (
                            <p class="text-xs text-slate-500">Not connected</p>
                        )}
                    </div>
                </div>

                {isLinked ? (
                    <div class="flex flex-col items-end gap-1">
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => setModalOpen(true)}
                            class="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-400 transition-all hover:border-rose-500/40 hover:bg-slate-800 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? 'Unlinking…' : 'Unlink'}
                        </button>
                        {error && <span class="text-xs text-rose-400">{error}</span>}
                    </div>
                ) : (
                    <a
                        href="/api/auth/google?mode=link"
                        class="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400"
                    >
                        Link Google
                    </a>
                )}
            </div>

            <ConfirmDeleteModal
                open={modalOpen}
                title="Unlink Google Account"
                message="Your Google account will be disconnected. You will only be able to sign in with your password."
                confirmLabel="Unlink"
                confirmTone="danger"
                onCancel={() => setModalOpen(false)}
                onConfirm={handleUnlink}
            />
        </section>
    )
}
