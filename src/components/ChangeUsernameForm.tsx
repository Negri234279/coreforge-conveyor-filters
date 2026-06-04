import { useState } from 'preact/hooks'

interface Props {
    currentUsername: string
}

const inputClass =
    'mt-1 w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 transition-all outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40'

export default function ChangeUsernameForm({ currentUsername }: Props) {
    const [value, setValue] = useState('')
    const [placeholder, setPlaceholder] = useState(currentUsername)
    const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: Event) {
        e.preventDefault()
        const username = value.trim()
        if (!username) return

        setLoading(true)
        setFeedback(null)

        try {
            const res = await fetch('/api/account/username', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
            })
            const data = await res.json()

            if (res.ok) {
                setFeedback({ ok: true, msg: 'Username updated successfully.' })
                setValue('')
                setPlaceholder(username)

                for (const id of ['header-username', 'profile-username', 'nav-username']) {
                    const el = document.getElementById(id)
                    if (el) el.textContent = username
                }
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

    return (
        <section class="rounded-lg border border-slate-800 bg-slate-900/30 p-5 transition-all hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.08)]">
            <h2 class="font-mono text-[11px] tracking-widest text-slate-400 uppercase">
                Change Username
            </h2>
            <form class="mt-3 space-y-3" onSubmit={handleSubmit} noValidate>
                <div>
                    <label class="font-mono text-[11px] tracking-widest text-slate-500 uppercase">
                        New username
                    </label>
                    <input
                        type="text"
                        required
                        minLength={3}
                        maxLength={32}
                        pattern="[A-Za-z0-9_\-]{3,32}"
                        autocomplete="username"
                        autocapitalize="off"
                        autocorrect="off"
                        spellcheck={false}
                        placeholder={placeholder}
                        value={value}
                        onInput={(e) => setValue((e.target as HTMLInputElement).value)}
                        class={inputClass}
                    />
                    <p class="mt-1 text-xs text-slate-600">3–32 chars: letters, digits, _ or -.</p>
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
                    {loading ? 'Saving…' : 'Change Username'}
                </button>
            </form>
        </section>
    )
}
