import { useEffect, useRef, useState } from 'preact/hooks'
import type { Category } from '../types'
import {
    addSubcategory,
    categories,
    deleteCategory,
    removeSubcategory,
    renameSubcategory,
    updateCategory,
} from '../store/filters'
import FilterCard from './FilterCard'
import CategoryFormModal from './CategoryFormModal'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import SubcategoryFormModal from './SubcategoryFormModal'

interface Props {
    category: Category
}

function HeaderMenu({
    items,
}: {
    items: { label: string; tone?: 'danger'; onClick: () => void }[]
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        function onDoc(e: MouseEvent) {
            if (!ref.current) return
            if (!ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', onDoc)
        return () => document.removeEventListener('mousedown', onDoc)
    }, [])

    return (
        <div class="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                class="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                aria-label="Section actions"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    class="h-5 w-5"
                >
                    <circle cx="5" cy="12" r="1.7" />
                    <circle cx="12" cy="12" r="1.7" />
                    <circle cx="19" cy="12" r="1.7" />
                </svg>
            </button>
            {open ? (
                <div
                    role="menu"
                    class="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl"
                >
                    {items.map((it) => (
                        <button
                            key={it.label}
                            type="button"
                            onClick={() => {
                                setOpen(false)
                                it.onClick()
                            }}
                            class={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-800 ${
                                it.tone === 'danger'
                                    ? 'text-rose-300 hover:bg-rose-500/10'
                                    : 'text-slate-200'
                            }`}
                        >
                            {it.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    )
}

export default function CategorySection({ category }: Props) {
    const totalFilters =
        category.filters.length +
        category.subcategories.reduce((acc, s) => acc + s.filters.length, 0)

    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [subDeleteId, setSubDeleteId] = useState<string | null>(null)
    const [subRenameId, setSubRenameId] = useState<string | null>(null)
    const [subCreateOpen, setSubCreateOpen] = useState(false)

    function onAddSubcategory() {
        setSubCreateOpen(true)
    }

    function handleCreateSubcategorySubmit(values: { name: string }) {
        addSubcategory(category.id, values.name)
        setSubCreateOpen(false)
    }

    function validateCreateSubcategoryName(name: string): string | null {
        const dup = category.subcategories.find(
            (s) => s.name.trim().toLowerCase() === name.toLowerCase(),
        )
        return dup ? `A subcategory named "${name}" already exists.` : null
    }

    function onEditCategory() {
        setEditOpen(true)
    }

    function handleEditSubmit(values: { name: string; isOpenCoreFilter: boolean }) {
        updateCategory(category.id, values)
        setEditOpen(false)
    }

    function validateEditName(name: string): string | null {
        if (name.toLowerCase() === category.name.trim().toLowerCase()) return null
        const dup = categories.value.find(
            (c) => c.id !== category.id && c.name.trim().toLowerCase() === name.toLowerCase(),
        )
        return dup ? `A category named "${name}" already exists.` : null
    }

    function onDeleteCategory() {
        setDeleteOpen(true)
    }

    function confirmDeleteCategory() {
        deleteCategory(category.id)
        setDeleteOpen(false)
    }

    const subToDelete =
        subDeleteId != null ? category.subcategories.find((s) => s.id === subDeleteId) : undefined

    function confirmDeleteSubcategory() {
        if (!subDeleteId) return
        removeSubcategory(category.id, subDeleteId)
        setSubDeleteId(null)
    }

    const subToRename =
        subRenameId != null ? category.subcategories.find((s) => s.id === subRenameId) : undefined

    function handleRenameSubcategorySubmit(values: { name: string }) {
        if (!subRenameId) return
        renameSubcategory(category.id, subRenameId, values.name)
        setSubRenameId(null)
    }

    function validateRenameSubcategoryName(name: string): string | null {
        if (!subToRename) return null
        if (name.toLowerCase() === subToRename.name.trim().toLowerCase()) {
            return null
        }
        const dup = category.subcategories.find(
            (s) => s.id !== subRenameId && s.name.trim().toLowerCase() === name.toLowerCase(),
        )
        return dup ? `A subcategory named "${name}" already exists.` : null
    }

    return (
        <section class="mb-12">
            <header class="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 class="text-sm font-bold tracking-[0.18em] text-slate-100 uppercase">
                    {category.name}
                </h2>
                <div class="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={onAddSubcategory}
                        class="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                    >
                        <span aria-hidden="true">+</span> Add Subcategory
                    </button>
                    <HeaderMenu
                        items={[
                            {
                                label: 'New filter',
                                onClick: () => {
                                    window.location.href = `/filters/new?categoryId=${encodeURIComponent(
                                        category.id,
                                    )}`
                                },
                            },
                            { label: 'Edit', onClick: onEditCategory },
                            { label: 'Delete', tone: 'danger', onClick: onDeleteCategory },
                        ]}
                    />
                </div>
            </header>

            <CategoryFormModal
                open={editOpen}
                mode="edit"
                initialName={category.name}
                initialIsOpenCoreFilter={!!category.isOpenCoreFilter}
                onCancel={() => setEditOpen(false)}
                onSubmit={handleEditSubmit}
                validateName={validateEditName}
            />

            <ConfirmDeleteModal
                open={deleteOpen}
                title="Delete category"
                message={`Delete category "${category.name}" and all ${totalFilters} filters? This cannot be undone.`}
                confirmLabel="Delete category"
                onCancel={() => setDeleteOpen(false)}
                onConfirm={confirmDeleteCategory}
            />

            <ConfirmDeleteModal
                open={!!subToDelete}
                title="Delete subcategory"
                message={
                    subToDelete
                        ? `Delete subcategory "${subToDelete.name}"? Its filters will move into the parent category.`
                        : ''
                }
                confirmLabel="Delete subcategory"
                onCancel={() => setSubDeleteId(null)}
                onConfirm={confirmDeleteSubcategory}
            />

            <SubcategoryFormModal
                open={!!subToRename}
                mode="edit"
                initialName={subToRename?.name ?? ''}
                onCancel={() => setSubRenameId(null)}
                onSubmit={handleRenameSubcategorySubmit}
                validateName={validateRenameSubcategoryName}
            />

            <SubcategoryFormModal
                open={subCreateOpen}
                mode="create"
                onCancel={() => setSubCreateOpen(false)}
                onSubmit={handleCreateSubcategorySubmit}
                validateName={validateCreateSubcategoryName}
            />

            <div class="mt-4 space-y-8">
                {/* Filters directly in category */}
                {category.filters.length === 0 && category.subcategories.length === 0 ? (
                    <p class="text-xs text-slate-500">No filters in this category.</p>
                ) : null}

                {category.filters.length > 0 ? (
                    <div>
                        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {category.filters.map((f) => (
                                <FilterCard key={f.id} filter={f} />
                            ))}
                        </div>
                    </div>
                ) : category.subcategories.length > 0 ? (
                    <p class="text-xs text-slate-500">No filters in this category.</p>
                ) : null}

                {/* Subcategories */}
                {category.subcategories.map((sub) => (
                    <div key={sub.id}>
                        <header class="flex items-center justify-between border-b border-slate-800/70 pb-2">
                            <h3 class="text-xs font-bold tracking-[0.18em] text-slate-200 uppercase">
                                {sub.name}
                            </h3>
                            <HeaderMenu
                                items={[
                                    {
                                        label: 'New filter',
                                        onClick: () => {
                                            window.location.href = `/filters/new?categoryId=${encodeURIComponent(
                                                category.id,
                                            )}&subcategoryId=${encodeURIComponent(sub.id)}`
                                        },
                                    },
                                    {
                                        label: 'Rename',
                                        onClick: () => setSubRenameId(sub.id),
                                    },
                                    {
                                        label: 'Delete',
                                        tone: 'danger',
                                        onClick: () => setSubDeleteId(sub.id),
                                    },
                                ]}
                            />
                        </header>
                        <div class="mt-4">
                            {sub.filters.length === 0 ? (
                                <p class="text-xs text-slate-500">No filters yet.</p>
                            ) : (
                                <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {sub.filters.map((f) => (
                                        <FilterCard key={f.id} filter={f} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}
