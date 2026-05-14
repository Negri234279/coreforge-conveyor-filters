export interface Item {
    id: number
    itemId: number
    shortname: string
    name: string
    category: string
    imagePath: string
}

export interface Box {
    id: number
    name: string
    imagePath: string
}

export interface CategorySeed {
    id: number
    name: string
}

export interface ConveyorItem {
    /** null for item slots; the ItemCategory id for category slots. */
    TargetCategory: number | null
    MaxAmountInOutput: number
    BufferAmount: number
    MinAmountInInput: number
    IsBlueprint: boolean
    BufferTransferRemaining: number
    TargetItemName: string
}

export interface FilterItem {
    shortname: string
    max: number
    buffer: number
    min: number
}

/** Deployment counts for a filter. How many boxes it feeds, how many conveyors
 *  run it, and how many storage adaptors are wired up. Default 1 each. */
export interface FilterCounts {
    boxCount: number
    conveyorCount: number
    storageAdaptorCount: number
}

export const DEFAULT_FILTER_COUNTS: FilterCounts = {
    boxCount: 1,
    conveyorCount: 1,
    storageAdaptorCount: 1,
}

export interface Filter extends FilterCounts {
    id: string
    name: string
    description?: string
    coverItemShortname: string
    boxImagePath?: string
    categoryId: string
    subcategoryId?: string
    items: FilterItem[]
    sharedWithOrg?: boolean
    createdAt: string
}

export interface OrgFilterView extends FilterCounts {
    id: string
    name: string
    description?: string
    coverItemShortname: string
    boxImagePath?: string
    items: FilterItem[]
    owner: { id: string; username: string }
    categoryName: string
    subcategoryName?: string
    createdAt: string
}

export type OrgRole = 'owner' | 'admin' | 'member'

export interface OrgSummary {
    id: string
    name: string
    inviteCode: string | null // null for non-owners
    role: OrgRole
    members: { id: string; username: string; role: OrgRole }[]
}

export interface Subcategory {
    id: string
    name: string
    filters: Filter[]
}

export interface Category {
    id: string
    name: string
    /** When set, this category belongs to that Open Core; otherwise it's a "loose" category. */
    openCoreId?: string | null
    /** @deprecated Replaced by the Open Core entity. Kept for backward-compat; unused. */
    isOpenCoreFilter?: boolean
    sharedWithOrg?: boolean
    subcategories: Subcategory[]
    filters: Filter[]
}

/** An Open Core: a named grouping of categories (a base's industrial setup). */
export interface OpenCore {
    id: string
    name: string
    sharedWithOrg?: boolean
}

export interface MeState {
    openCores: OpenCore[]
    categories: Category[]
    source?: string
}

/** A clan member's shared Open Core, as listed on the Clan page. */
export interface OrgOpenCoreView {
    id: string
    name: string
    owner: { id: string; username: string }
    categoryCount: number
    filterCount: number
    /** Sums of the per-filter deployment counts across the whole Open Core. */
    boxTotal: number
    boxLargeTotal: number
    boxSmallTotal: number
    boxLockerTotal: number
    boxFridgeTotal: number
    conveyorTotal: number
    storageAdaptorTotal: number
}

/** Full read-only contents of a clan member's shared Open Core. */
export interface OrgOpenCoreDetail {
    id: string
    name: string
    owner: { id: string; username: string }
    categories: Category[]
}

/** A clan member's shared standalone category, as listed on the Clan page. */
export interface OrgCategoryView {
    id: string
    name: string
    owner: { id: string; username: string }
    /** Name of the Open Core the category belongs to, if any. Purely informative. */
    openCoreName?: string
    subcategoryCount: number
    filterCount: number
    boxTotal: number
    boxLargeTotal: number
    boxSmallTotal: number
    boxLockerTotal: number
    boxFridgeTotal: number
    conveyorTotal: number
    storageAdaptorTotal: number
}

/** Full read-only contents of a clan member's shared category. */
export interface OrgCategoryDetail {
    id: string
    name: string
    owner: { id: string; username: string }
    openCoreName?: string
    subcategories: Subcategory[]
    filters: Filter[]
}
