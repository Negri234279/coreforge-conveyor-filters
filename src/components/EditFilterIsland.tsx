import { useEffect, useState } from 'preact/hooks'
import FilterForm from './FilterForm'

export default function EditFilterIsland() {
    const [id, setId] = useState<string | null>(null)
    const [resolved, setResolved] = useState(false)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        let value = params.get('id')
        if (!value) {
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
            value = hashParams.get('id')
        }
        setId(value)
        setResolved(true)
    }, [])

    if (!resolved) return <p class="text-sm text-slate-400">Loading…</p>
    if (!id) {
        return (
            <p class="text-sm text-rose-300">
                No filter id provided.{' '}
                <a
                    href="/"
                    class="text-amber-400 underline decoration-amber-400/40 transition-colors hover:text-amber-300 hover:decoration-amber-400"
                >
                    Go home
                </a>
                .
            </p>
        )
    }

    return <FilterForm filterId={id} />
}
