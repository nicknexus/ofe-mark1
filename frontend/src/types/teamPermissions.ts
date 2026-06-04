/** Mirrors backend PermissionResource / PermissionAction for invites. */
export type MemberType = 'admin' | 'team_member'

export type PermissionResource =
 | 'initiatives'
 | 'locations'
 | 'metrics'
 | 'impact_claims'
 | 'evidence'
 | 'stories'
 | 'beneficiaries'
 | 'tags'
 | 'reports'
 | 'analytics'

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'upload' | 'export'

export interface PermissionGrant {
 resource: PermissionResource
 action: PermissionAction
 allowed: boolean
}

/**
 * Initiative/location scope for a team_member (mirrors backend TeamMemberScope).
 * Fail-closed: empty allow-list === access to nothing.
 * - allInitiatives → every initiative in the org.
 * - else initiativeIds → explicit allow-list.
 * - locationIds → OPTIONAL narrowing within scoped initiatives ([] = all).
 */
export interface TeamMemberScope {
 allInitiatives: boolean
 initiativeIds: string[]
 locationIds: string[]
}

export const fullScope: TeamMemberScope = {
 allInitiatives: true,
 initiativeIds: [],
 locationIds: [],
}

export const emptyScope: TeamMemberScope = {
 allInitiatives: false,
 initiativeIds: [],
 locationIds: [],
}

/** UI toggles when inviting a team_member (not admin). */
export interface TeamMemberPermissionToggles {
 viewData: boolean
 addImpactClaims: boolean
 addEditEvidence: boolean
 editInitiatives: boolean
 editMetrics: boolean
 editLocations: boolean
 editBeneficiaries: boolean
 editStories: boolean
 deleteContent: boolean
 exportReports: boolean
}

export const defaultTeamMemberToggles: TeamMemberPermissionToggles = {
 viewData: true,
 addImpactClaims: false,
 addEditEvidence: false,
 editInitiatives: false,
 editMetrics: false,
 editLocations: false,
 editBeneficiaries: false,
 editStories: false,
 deleteContent: false,
 exportReports: false,
}

export function togglesToGrants(toggles: TeamMemberPermissionToggles): PermissionGrant[] {
 const grants: PermissionGrant[] = []

 const viewResources: PermissionResource[] = [
 'initiatives',
 'locations',
 'metrics',
 'evidence',
 'stories',
 'beneficiaries',
 'tags',
 'reports',
 'analytics',
 ]

 if (toggles.viewData) {
 for (const resource of viewResources) {
 grants.push({ resource, action: 'view', allowed: true })
 }
 }

 if (toggles.addImpactClaims) {
 grants.push({ resource: 'impact_claims', action: 'create', allowed: true })
 }

 if (toggles.addEditEvidence) {
 grants.push({ resource: 'evidence', action: 'view', allowed: true })
 grants.push({ resource: 'evidence', action: 'create', allowed: true })
 grants.push({ resource: 'evidence', action: 'edit', allowed: true })
 grants.push({ resource: 'evidence', action: 'upload', allowed: true })
 }

 if (toggles.editInitiatives) {
 grants.push({ resource: 'initiatives', action: 'edit', allowed: true })
 }
 if (toggles.editMetrics) {
 grants.push({ resource: 'metrics', action: 'edit', allowed: true })
 }
 if (toggles.editLocations) {
 grants.push({ resource: 'locations', action: 'edit', allowed: true })
 }
 if (toggles.editBeneficiaries) {
 grants.push({ resource: 'beneficiaries', action: 'edit', allowed: true })
 }
 if (toggles.editStories) {
 grants.push({ resource: 'stories', action: 'edit', allowed: true })
 }

 if (toggles.deleteContent) {
 grants.push({ resource: 'evidence', action: 'delete', allowed: true })
 grants.push({ resource: 'initiatives', action: 'delete', allowed: true })
 grants.push({ resource: 'metrics', action: 'delete', allowed: true })
 }

 if (toggles.exportReports) {
 grants.push({ resource: 'reports', action: 'export', allowed: true })
 }

 const byKey = new Map<string, PermissionGrant>()
 for (const g of grants) {
 byKey.set(`${g.resource}:${g.action}`, g)
 }
 return Array.from(byKey.values())
}

export function grantsToToggles(grants: PermissionGrant[]): TeamMemberPermissionToggles {
 const has = (resource: PermissionResource, action: PermissionAction) =>
 grants.some((g) => g.resource === resource && g.action === action && g.allowed)

 const viewData =
 has('initiatives', 'view') ||
 has('evidence', 'view') ||
 has('metrics', 'view')

 return {
 viewData,
 addImpactClaims: has('impact_claims', 'create'),
 addEditEvidence: has('evidence', 'edit') || has('evidence', 'create'),
 editInitiatives: has('initiatives', 'edit'),
 editMetrics: has('metrics', 'edit'),
 editLocations: has('locations', 'edit'),
 editBeneficiaries: has('beneficiaries', 'edit'),
 editStories: has('stories', 'edit'),
 deleteContent:
 has('evidence', 'delete') ||
 has('initiatives', 'delete') ||
 has('metrics', 'delete'),
 exportReports: has('reports', 'export'),
 }
}

export function validateTeamMemberInvite(
 memberType: MemberType,
 toggles: TeamMemberPermissionToggles,
 scope?: TeamMemberScope
): string | null {
 if (memberType === 'admin') return null
 const grants = togglesToGrants(toggles)
 if (grants.filter((g) => g.allowed).length === 0) {
 return 'Select at least one permission for a team member'
 }
 if (!toggles.viewData) {
 return 'View access is required for team members'
 }
 // Fail-closed scope: must grant access to at least one initiative.
 if (scope && !scope.allInitiatives && scope.initiativeIds.length === 0) {
 return 'Select at least one initiative the member can access'
 }
 return null
}
