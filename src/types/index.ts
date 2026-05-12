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
    TargetCategory: null
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

export interface Filter {
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

export interface OrgFilterView {
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

export interface OrgSummary {
    id: string
    name: string
    inviteCode: string | null // null for non-owners
    role: 'owner' | 'member'
    members: { id: string; username: string; role: 'owner' | 'member' }[]
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
}

/** Full read-only contents of a clan member's shared Open Core. */
export interface OrgOpenCoreDetail {
    id: string
    name: string
    owner: { id: string; username: string }
    categories: Category[]
}
