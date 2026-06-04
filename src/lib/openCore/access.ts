export function canViewLayout(args: {
    layoutUserId: string
    layoutSharedWithOrg: boolean
    ownerOrgId: string | null
    user: { id: string; orgId: string | null }
}): boolean {
    const { layoutUserId, layoutSharedWithOrg, ownerOrgId, user } = args
    if (user.id === layoutUserId) return true
    return (
        layoutSharedWithOrg &&
        user.orgId !== null &&
        ownerOrgId !== null &&
        ownerOrgId === user.orgId
    )
}

export function canEditLayout(args: {
    layoutUserId: string
    layoutSharedWithOrg: boolean
    ownerOrgId: string | null
    user: { id: string; orgId: string | null; orgRole: string | null }
}): boolean {
    const { layoutUserId, layoutSharedWithOrg, ownerOrgId, user } = args
    if (user.id === layoutUserId) return true
    return (
        layoutSharedWithOrg &&
        user.orgId !== null &&
        ownerOrgId !== null &&
        ownerOrgId === user.orgId &&
        (user.orgRole === 'owner' || user.orgRole === 'admin')
    )
}
