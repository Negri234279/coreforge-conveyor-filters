import { useEffect, useState } from 'preact/hooks'
import FilterForm from './FilterForm'
import {
    createOrgFilter,
    updateOrgFilter,
    fetchOrgOpenCoreDetail,
    type OrgFilterDraft,
} from '../store/org'
import type { OrgOpenCoreDetail, FilterItem } from '../types'

interface Props {
    openCoreId: string
    categoryId?: string
    subcategoryId?: string
    filterId?: string
}

export default function OrgFilterIsland({
    openCoreId,
    categoryId,
    subcategoryId,
    filterId,
}: Props) {
    const editing = !!filterId
    const cancelHref = `/org/opencore/${openCoreId}`

    const [initialData, setInitialData] = useState<
        (OrgFilterDraft & { items: FilterItem[] }) | null
    >(null)
    const [categoryOptions, setCategoryOptions] = useState<
        { id: string; name: string; subcategories: { id: string; name: string }[] }[]
    >([])
    const [loadError, setLoadError] = useState<string | null>(null)
    const [loading, setLoading] = useState(editing)

    useEffect(() => {
        let cancelled = false
        fetchOrgOpenCoreDetail(openCoreId)
            .then((detail: OrgOpenCoreDetail) => {
                if (cancelled) return
                setCategoryOptions(
                    detail.categories.map((cat) => ({
                        id: cat.id,
                        name: cat.name,
                        subcategories: cat.subcategories.map((sub) => ({
                            id: sub.id,
                            name: sub.name,
                        })),
                    })),
                )

                if (!editing) return

                for (const cat of detail.categories) {
                    const allFilters = [
                        ...cat.filters.map((f) => ({ f, catId: cat.id })),
                        ...cat.subcategories.flatMap((sub) =>
                            sub.filters.map((f) => ({ f, catId: cat.id })),
                        ),
                    ]
                    for (const { f, catId } of allFilters) {
                        if (f.id === filterId) {
                            setInitialData({
                                categoryId: catId,
                                subcategoryId: f.subcategoryId ?? undefined,
                                name: f.name,
                                description: f.description ?? undefined,
                                coverItemShortname: f.coverItemShortname,
                                boxImagePath: f.boxImagePath ?? undefined,
                                boxCount: f.boxCount,
                                conveyorCount: f.conveyorCount,
                                storageAdaptorCount: f.storageAdaptorCount,
                                items: f.items,
                            })
                            return
                        }
                    }
                }
                setLoadError('Filter not found in this Open Core.')
            })
            .catch((e: unknown) => {
                if (cancelled) return
                setLoadError(e instanceof Error ? e.message : 'Failed to load filter')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [filterId, openCoreId, editing])

    if (loading) {
        return (
            <div class="flex min-h-[200px] items-center justify-center text-slate-400">
                Loading…
            </div>
        )
    }

    if (loadError) {
        return (
            <div class="rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                {loadError}
            </div>
        )
    }

    const onSave = async (draft: OrgFilterDraft): Promise<void> => {
        if (editing && filterId) {
            await updateOrgFilter(filterId, draft)
        } else {
            // draft.categoryId / subcategoryId already reflect the picker (seeded
            // from the category the "New filter" action was launched in).
            await createOrgFilter(draft)
        }
        window.location.href = cancelHref
    }

    const resolvedInitialData = editing
        ? (initialData ?? undefined)
        : categoryId
          ? {
                categoryId,
                subcategoryId,
                name: '',
                coverItemShortname: '',
                boxCount: 1,
                conveyorCount: 1,
                storageAdaptorCount: 1,
                items: [] as FilterItem[],
            }
          : undefined

    return (
        <FilterForm
            filterId={editing ? filterId : undefined}
            initialData={resolvedInitialData}
            onSave={onSave}
            cancelHref={cancelHref}
            categoryOptions={categoryOptions}
        />
    )
}
