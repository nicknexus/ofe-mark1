import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { TeamService, UserPermissions, AccessibleOrganization } from '../services/team'
import type { TeamMemberScope } from '../types/teamPermissions'
import { apiService } from '../services/api'
import PendingInviteModal from '../components/PendingInviteModal'

interface TeamContextType {
 permissions: UserPermissions | null
 loading: boolean
 error: string | null
 isOwner: boolean
 isSharedMember: boolean
 isAdmin: boolean
 memberType?: 'admin' | 'team_member'
 canManageTeam: boolean
 canAddImpactClaims: boolean
 canEditEvidence: boolean
 canDelete: boolean
 canEditMetrics: boolean
 canEditInitiatives: boolean
 canCreateInitiatives: boolean
 canEditLocations: boolean
 canEditBeneficiaries: boolean
 canEditStories: boolean
 canEditTags: boolean
 canExportReports: boolean
 canEditOrgContext: boolean
 /** team_member initiative/location scope; owners/admins are unrestricted. */
 scope?: TeamMemberScope
 /** True when the caller may access the given initiative under their scope. */
 canAccessInitiative: (initiativeId: string) => boolean
 /** True when the caller may use/see the given location under their scope. */
 canAccessLocation: (locationId: string) => boolean
 organizationId?: string
 organizationName?: string
 accessibleOrganizations: AccessibleOrganization[]
 switcherOrganizations: AccessibleOrganization[]
 activeOrganization: AccessibleOrganization | null
 switchOrganization: (orgId: string) => void
 hasMultipleOrgs: boolean
 refreshPermissions: () => Promise<void>
 hasOwnOrganization: boolean
 ownedOrganization: AccessibleOrganization | null
 editableOrganization: AccessibleOrganization | null
}

const defaultPermissions: UserPermissions = {
 isOwner: false,
 isSharedMember: false,
 canAddImpactClaims: false,
 canDelete: false,
}

const TeamContext = createContext<TeamContextType>({
 permissions: null,
 loading: true,
 error: null,
 isOwner: false,
 isSharedMember: false,
 isAdmin: false,
 canManageTeam: false,
 canAddImpactClaims: false,
 canEditEvidence: false,
 canDelete: false,
 canEditMetrics: false,
 canEditInitiatives: false,
 canCreateInitiatives: false,
 canEditLocations: false,
 canEditBeneficiaries: false,
 canEditStories: false,
 canEditTags: false,
 canExportReports: false,
 canEditOrgContext: false,
 canAccessInitiative: () => true,
 canAccessLocation: () => true,
 accessibleOrganizations: [],
 switcherOrganizations: [],
 activeOrganization: null,
 switchOrganization: () => { },
 hasMultipleOrgs: false,
 refreshPermissions: async () => { },
 hasOwnOrganization: false,
 ownedOrganization: null,
 editableOrganization: null,
})

const ACTIVE_ORG_STORAGE_KEY = 'nexus-active-org-id'

export function TeamProvider({ children }: { children: React.ReactNode }) {
 const navigate = useNavigate()
 const [permissions, setPermissions] = useState<UserPermissions | null>(null)
 const [accessibleOrganizations, setAccessibleOrganizations] = useState<AccessibleOrganization[]>([])
 const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
 return localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)
 })
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState<string | null>(null)

 const loadPermissionsForActiveOrg = useCallback(async () => {
 try {
 const perms = await TeamService.getPermissions()
 setPermissions(perms)
 } catch (err) {
 console.error('Error fetching permissions:', err)
 setPermissions(defaultPermissions)
 }
 }, [])

 const fetchData = useCallback(async () => {
 try {
 setLoading(true)
 setError(null)

 const orgs = await TeamService.getAccessibleOrganizations()
 setAccessibleOrganizations(orgs)

 if (orgs.length > 0) {
 const savedOrgId = localStorage.getItem(ACTIVE_ORG_STORAGE_KEY)
 const savedOrgValid = savedOrgId && orgs.some(o => o.id === savedOrgId)

 if (!savedOrgValid) {
 const teamOrg = orgs.find(o => o.role === 'member' && !o.is_demo)
 const realOwnedOrg = orgs.find(o => o.role === 'owner' && !o.is_demo)
 const defaultOrg = teamOrg || realOwnedOrg || orgs[0]
 setActiveOrgId(defaultOrg.id)
 localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, defaultOrg.id)
 }
 }

 await loadPermissionsForActiveOrg()
 } catch (err) {
 console.error('Error fetching team data:', err)
 setError((err as Error).message)
 setPermissions(defaultPermissions)
 } finally {
 setLoading(false)
 }
 }, [loadPermissionsForActiveOrg])

 useEffect(() => {
 fetchData()
 }, [fetchData])

 useEffect(() => {
 if (!activeOrgId || loading) return
 loadPermissionsForActiveOrg()
 }, [activeOrgId, loading, loadPermissionsForActiveOrg])

 // Onboarding writes org fields (logo, brand color, website/donation URLs)
 // straight to the DB. The accessible-orgs list is cached, so refresh it when
 // onboarding signals a change — otherwise Account settings reads a stale
 // snapshot and the new values appear missing.
 useEffect(() => {
 const onOnboardingUpdated = () => {
 apiService.clearCache('/team/organizations')
 apiService.clearCache('/organizations')
 fetchData()
 }
 window.addEventListener('onboarding-updated', onOnboardingUpdated)
 return () => window.removeEventListener('onboarding-updated', onOnboardingUpdated)
 }, [fetchData])

 const switchOrganization = useCallback((orgId: string) => {
 const org = accessibleOrganizations.find(o => o.id === orgId)
 if (!org) return
 if (orgId === activeOrgId) return

 apiService.clearCache()
 localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId)
 setActiveOrgId(orgId)
 if (typeof window !== 'undefined' && window.location.pathname !== '/') {
 navigate('/', { replace: true })
 }
 }, [accessibleOrganizations, activeOrgId, navigate])

 const activeOrganization = accessibleOrganizations.find(o => o.id === activeOrgId) || null
 const ownedOrganization = accessibleOrganizations.find(o => o.role === 'owner' && !o.is_demo) || null
 const editableOrganization = activeOrganization?.role === 'owner'
 ? activeOrganization
 : ownedOrganization
 const switcherOrganizations = accessibleOrganizations.filter(o => !o.is_demo)

 const isOwner = permissions?.isOwner ?? false
 const isSharedMember = permissions?.isSharedMember ?? (activeOrganization?.role === 'member')
 const isAdmin = permissions?.isAdmin ?? permissions?.memberType === 'admin'
 const canManageTeam = isOwner || isAdmin

 const scope = permissions?.scope
 const unrestricted = isOwner || isAdmin
 const caps = permissions?.capabilities
 // unrestricted (owner/admin) → all true; else read granular caps from API.
 const cap = (key: keyof NonNullable<UserPermissions['capabilities']>) =>
 unrestricted ? true : caps?.[key] ?? false
 const canAccessInitiative = useCallback(
 (initiativeId: string) => {
 if (unrestricted || !scope) return true
 if (scope.allInitiatives) return true
 return scope.initiativeIds.includes(initiativeId)
 },
 [unrestricted, scope]
 )
 const canAccessLocation = useCallback(
 (locationId: string) => {
 if (unrestricted || !scope) return true
 // Empty locationIds = no location narrowing (all locations in scope).
 if (scope.locationIds.length === 0) return true
 return scope.locationIds.includes(locationId)
 },
 [unrestricted, scope]
 )

 const value: TeamContextType = {
 permissions,
 loading,
 error,
 isOwner,
 isSharedMember,
 isAdmin,
 memberType: permissions?.memberType,
 canManageTeam,
 canAddImpactClaims: cap('canAddImpactClaims'),
 canEditEvidence: cap('canEditEvidence'),
 canDelete: cap('canDelete'),
 canEditMetrics: cap('canEditMetrics'),
 canEditInitiatives: cap('canEditInitiatives'),
 canCreateInitiatives: cap('canCreateInitiatives'),
 canEditLocations: cap('canEditLocations'),
 canEditBeneficiaries: cap('canEditBeneficiaries'),
 canEditStories: cap('canEditStories'),
 canEditTags: cap('canEditTags'),
 canExportReports: cap('canExportReports'),
 canEditOrgContext: cap('canEditOrgContext'),
 scope,
 canAccessInitiative,
 canAccessLocation,
 organizationId: activeOrganization?.id || permissions?.organizationId,
 organizationName: activeOrganization?.name || permissions?.organizationName,
 accessibleOrganizations,
 switcherOrganizations,
 activeOrganization,
 switchOrganization,
 hasMultipleOrgs: switcherOrganizations.length > 1,
 refreshPermissions: fetchData,
 hasOwnOrganization: ownedOrganization !== null,
 ownedOrganization,
 editableOrganization,
 }

 return (
 <TeamContext.Provider value={value}>
 {children}
 <PendingInviteModal />
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

export function useCanDelete() {
 const { canDelete } = useTeam()
 return canDelete
}

export function useCanAddImpactClaims() {
 const { canAddImpactClaims } = useTeam()
 return canAddImpactClaims
}

export function useCanEditEvidence() {
 const { canEditEvidence } = useTeam()
 return canEditEvidence
}

export function useIsOwner() {
 const { isOwner } = useTeam()
 return isOwner
}

export function useIsSharedMember() {
 const { isSharedMember } = useTeam()
 return isSharedMember
}
