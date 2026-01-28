import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { TeamService, UserPermissions, AccessibleOrganization } from '../services/team'

interface TeamContextType {
    permissions: UserPermissions | null
    loading: boolean
    error: string | null
    isOwner: boolean
    isSharedMember: boolean
    canAddImpactClaims: boolean
    canDelete: boolean
    organizationId?: string
    organizationName?: string
    // Organization switching
    accessibleOrganizations: AccessibleOrganization[]
    activeOrganization: AccessibleOrganization | null
    switchOrganization: (orgId: string) => void
    hasMultipleOrgs: boolean
    refreshPermissions: () => Promise<void>
    // Does user own ANY organization (regardless of which one is active)
    hasOwnOrganization: boolean
    ownedOrganization: AccessibleOrganization | null
}

const defaultPermissions: UserPermissions = {
    isOwner: false,
    isSharedMember: false,
    canAddImpactClaims: false,
    canDelete: false
}

const TeamContext = createContext<TeamContextType>({
    permissions: null,
    loading: true,
    error: null,
    isOwner: false,
    isSharedMember: false,
    canAddImpactClaims: false,
    canDelete: false,
    accessibleOrganizations: [],
    activeOrganization: null,
    switchOrganization: () => {},
    hasMultipleOrgs: false,
    refreshPermissions: async () => {},
    hasOwnOrganization: false,
    ownedOrganization: null
})

const ACTIVE_ORG_STORAGE_KEY = 'nexus-active-org-id'

export function TeamProvider({ children }: { children: React.ReactNode }) {
    const [permissions, setPermissions] = useState<UserPermissions | null>(null)
    const [accessibleOrganizations, setAccessibleOrganizations] = useState<AccessibleOrganization[]>([])
    const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
        // Restore from localStorage on mount
        return localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            
            // Fetch accessible orgs - this gives us everything we need
            // Permissions can be derived from the active organization's role
            const orgs = await TeamService.getAccessibleOrganizations()
            
            setAccessibleOrganizations(orgs)
            
            // Derive permissions from orgs instead of separate call
            const hasOwnedOrg = orgs.some(o => o.role === 'owner')
            const derivedPerms: UserPermissions = {
                isOwner: hasOwnedOrg,
                isSharedMember: orgs.some(o => o.role === 'member'),
                canAddImpactClaims: true, // Will be overridden based on active org
                canDelete: hasOwnedOrg,
                organizationId: orgs[0]?.id,
                organizationName: orgs[0]?.name
            }
            setPermissions(derivedPerms)
            
            // Set active org if not already set or if current one is invalid
            if (orgs.length > 0) {
                const savedOrgId = localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)
                const savedOrgValid = savedOrgId && orgs.some(o => o.id === savedOrgId)
                
                if (!savedOrgValid) {
                    // Default to team membership org if available, otherwise own org
                    const teamOrg = orgs.find(o => o.role === 'member')
                    const defaultOrg = teamOrg || orgs[0]
                    setActiveOrgId(defaultOrg.id)
                    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, defaultOrg.id)
                }
            }
        } catch (err) {
            console.error('Error fetching team data:', err)
            setError((err as Error).message)
            setPermissions(defaultPermissions)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const switchOrganization = useCallback((orgId: string) => {
        const org = accessibleOrganizations.find(o => o.id === orgId)
        if (org) {
            setActiveOrgId(orgId)
            localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId)
            // Reload the page to refresh all data for new org context
            window.location.reload()
        }
    }, [accessibleOrganizations])

    const activeOrganization = accessibleOrganizations.find(o => o.id === activeOrgId) || null
    const ownedOrganization = accessibleOrganizations.find(o => o.role === 'owner') || null
    
    // Determine if viewing as shared member based on active org
    const isViewingAsSharedMember = activeOrganization?.role === 'member'

    const value: TeamContextType = {
        permissions,
        loading,
        error,
        isOwner: !isViewingAsSharedMember,
        isSharedMember: isViewingAsSharedMember,
        canAddImpactClaims: isViewingAsSharedMember ? (activeOrganization?.canAddImpactClaims ?? false) : true,
        canDelete: !isViewingAsSharedMember,
        organizationId: activeOrganization?.id || permissions?.organizationId,
        organizationName: activeOrganization?.name || permissions?.organizationName,
        accessibleOrganizations,
        activeOrganization,
        switchOrganization,
        hasMultipleOrgs: accessibleOrganizations.length > 1,
        refreshPermissions: fetchData,
        hasOwnOrganization: ownedOrganization !== null,
        ownedOrganization
    }

    return (
        <TeamContext.Provider value={value}>
            {children}
        </TeamContext.Provider>
    )
}

export function useTeam() {
    const context = useContext(TeamContext)
    if (!context) {
        throw new Error('useTeam must be used within a TeamProvider')
    }
    return context
}

// Hook to check if current user can perform an action
export function useCanDelete() {
    const { canDelete } = useTeam()
    return canDelete
}

export function useCanAddImpactClaims() {
    const { canAddImpactClaims } = useTeam()
    return canAddImpactClaims
}

export function useIsOwner() {
    const { isOwner } = useTeam()
    return isOwner
}

export function useIsSharedMember() {
    const { isSharedMember } = useTeam()
    return isSharedMember
}
