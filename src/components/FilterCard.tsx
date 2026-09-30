import { useState } from 'preact/hooks'
import type { Filter } from '../types'
import { deleteFilter } from '../store/filters'
import FilterCardBase, { type FilterCardAction } from './FilterCardBase'
import ConfirmDeleteModal from './ConfirmDeleteModal'

interface Props {
    filter: Filter
}

export default function FilterCard({ filter }: Props) {
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

    function onEdit() {
        window.location.href = `/filters/edit?id=${encodeURIComponent(filter.id)}`
    }

    function confirmDelete() {
        setConfirmDeleteOpen(false)
        deleteFilter(filter.id)
    }

    const actions: FilterCardAction[] = [
        { label: 'Edit', onClick: onEdit },
        { label: 'Delete', tone: 'danger', onClick: () => setConfirmDeleteOpen(true) },
    ]

    return (
        <>
            <FilterCardBase filter={filter} actions={actions} showSharedBadge />
            <ConfirmDeleteModal
                open={confirmDeleteOpen}
                title="Delete filter"
                message={`Delete filter "${filter.name}"? This can't be undone.`}
                onCancel={() => setConfirmDeleteOpen(false)}
                onConfirm={confirmDelete}
            />
        </>
    )
}
