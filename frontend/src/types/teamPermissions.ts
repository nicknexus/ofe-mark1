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

/** UI toggles when inviting a team_member (not admin). Add and edit are
 *  separate columns per resource: add* gates create flows, edit* gates
 *  changing existing records. */
export interface TeamMemberPermissionToggles {
 viewData: boolean
 addMetrics: boolean
 editMetrics: boolean
 addClaims: boolean
 editClaims: boolean
 addEvidence: boolean
 editEvidence: boolean
 addStories: boolean
 editStories: boolean
 addBeneficiaries: boolean
 editBeneficiaries: boolean
 addTags: boolean
 editTags: boolean
 editInitiatives: boolean
 editLocations: boolean
 deleteContent: boolean
 exportReports: boolean
}

export const defaultTeamMemberToggles: TeamMemberPermissionToggles = {
 viewData: true,
 addMetrics: false,
 editMetrics: false,
 addClaims: false,
 editClaims: false,
 addEvidence: false,
 editEvidence: false,
 addStories: false,
 editStories: false,
 addBeneficiaries: false,
 editBeneficiaries: false,
 addTags: false,
 editTags: false,
 editInitiatives: false,
 editLocations: false,
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

 // Add/edit matrix — one grant per checked cell.
 if (toggles.addMetrics) grants.push({ resource: 'metrics', action: 'create', allowed: true })
 if (toggles.editMetrics) grants.push({ resource: 'metrics', action: 'edit', allowed: true })
 if (toggles.addClaims) grants.push({ resource: 'impact_claims', action: 'create', allowed: true })
 if (toggles.editClaims) grants.push({ resource: 'impact_claims', action: 'edit', allowed: true })
 if (toggles.addEvidence) {
 grants.push({ resource: 'evidence', action: 'create', allowed: true })
 grants.push({ resource: 'evidence', action: 'upload', allowed: true })
 }
 if (toggles.editEvidence) grants.push({ resource: 'evidence', action: 'edit', allowed: true })
 if (toggles.addStories) grants.push({ resource: 'stories', action: 'create', allowed: true })
 if (toggles.editStories) grants.push({ resource: 'stories', action: 'edit', allowed: true })
 if (toggles.addBeneficiaries) grants.push({ resource: 'beneficiaries', action: 'create', allowed: true })
 if (toggles.editBeneficiaries) grants.push({ resource: 'beneficiaries', action: 'edit', allowed: true })
 if (toggles.addTags) grants.push({ resource: 'tags', action: 'create', allowed: true })
 if (toggles.editTags) grants.push({ resource: 'tags', action: 'edit', allowed: true })

 if (toggles.editInitiatives) {
 grants.push({ resource: 'initiatives', action: 'edit', allowed: true })
 }
 if (toggles.editLocations) {
 grants.push({ resource: 'locations', action: 'edit', allowed: true })
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

 // Legacy blobs are expanded server-side (edit implied add pre-split), so a
 // straight per-cell read is correct for both old and new members.
 return {
 viewData,
 addMetrics: has('metrics', 'create'),
 editMetrics: has('metrics', 'edit'),
 addClaims: has('impact_claims', 'create'),
 editClaims: has('impact_claims', 'edit'),
 addEvidence: has('evidence', 'create'),
 editEvidence: has('evidence', 'edit'),
 addStories: has('stories', 'create'),
 editStories: has('stories', 'edit'),
 addBeneficiaries: has('beneficiaries', 'create'),
 editBeneficiaries: has('beneficiaries', 'edit'),
 addTags: has('tags', 'create'),
 editTags: has('tags', 'edit'),
 editInitiatives: has('initiatives', 'edit'),
 editLocations: has('locations', 'edit'),
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
