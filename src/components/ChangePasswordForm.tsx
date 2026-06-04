import { useState } from 'preact/hooks'

interface Props {
    hasPassword: boolean
}

const inputClass =
    'mt-1 w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition-all outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40'
const labelClass = 'font-mono text-[11px] uppercase tracking-widest text-slate-500'

export default function ChangePasswordForm({ hasPassword }: Props) {
    const [current, setCurrent] = useState('')
    const [next, setNext] = useState('')
    const [confirm, setConfirm] = useState('')
    const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: Event) {
        e.preventDefault()
        setLoading(true)
        setFeedback(null)

        try {
            const res = await fetch('/api/account/password', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: hasPassword ? current : undefined,
                    newPassword: next,
                    confirmPassword: confirm,
                }),
            })
            const data = await res.json()

            if (res.ok) {
                setFeedback({ ok: true, msg: 'Password updated successfully.' })
                setCurrent('')
                setNext('')
                setConfirm('')
            } else {
                setFeedback({
                    ok: false,
                    msg: (data as { error?: string }).error ?? 'Something went wrong.',
                })
            }
        } catch {
            setFeedback({ ok: false, msg: 'Network error. Please try again.' })
        } finally {
            setLoading(false)
        }
    }

    const label = hasPassword ? 'Change Password' : 'Set Password'

    return (
        <section class="rounded-lg border border-slate-800 bg-slate-900/30 p-5 transition-all hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]">
            <h2 class="font-mono text-[11px] tracking-widest text-slate-400 uppercase">{label}</h2>
            <form class="mt-3 space-y-3" onSubmit={handleSubmit} noValidate>
                {hasPassword && (
                    <div>
                        <label class={labelClass}>Current password</label>
                        <input
                            type="password"
                            required
                            autocomplete="current-password"
                            value={current}
                            onInput={(e) => setCurrent((e.target as HTMLInputElement).value)}
                            class={inputClass}
                        />
                    </div>
                )}
                <div>
                    <label class={labelClass}>New password</label>
                    <input
                        type="password"
                        required
                        minLength={8}
                        autocomplete="new-password"
                        value={next}
                        onInput={(e) => setNext((e.target as HTMLInputElement).value)}
                        class={inputClass}
                    />
                    <p class="mt-1 text-xs text-slate-600">Minimum 8 characters.</p>
                </div>
                <div>
                    <label class={labelClass}>Confirm new password</label>
                    <input
                        type="password"
                        required
                        autocomplete="new-password"
                        value={confirm}
                        onInput={(e) => setConfirm((e.target as HTMLInputElement).value)}
                        class={inputClass}
                    />
                </div>
                {feedback && (
                    <p class={`text-sm ${feedback.ok ? 'text-amber-400' : 'text-rose-400'}`}>
                        {feedback.msg}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={loading}
                    class="rounded-md bg-amber-500 px-4 py-2 text-sm font-bold tracking-wide text-slate-950 uppercase transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {loading ? 'Saving…' : label}
                </button>
            </form>
        </section>
    )
}
