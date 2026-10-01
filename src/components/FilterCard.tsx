import { useState } from 'preact/hooks'
import type { Filter } from '../types'
import { deleteFilter } from '../store/filters'
import { copyFilter } from '../store/filterClipboard'
import FilterCardBase, { type FilterCardAction } from './FilterCardBase'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import { showToast } from './CopyToast'

interface Props {
    filter: Filter
}

export default function FilterCard({ filter }: Props) {
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

    function onEdit() {
        window.location.href = `/filters/edit?id=${encodeURIComponent(filter.id)}`
    }

    function onCopyFilter() {
        copyFilter(filter)
        showToast(`Copied "${filter.name}" · paste into a category`)
    }

    function confirmDelete() {
        setConfirmDeleteOpen(false)
        deleteFilter(filter.id)
    }

    const actions: FilterCardAction[] = [
        { label: 'Edit', onClick: onEdit },
        { label: 'Copy filter', onClick: onCopyFilter },
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
