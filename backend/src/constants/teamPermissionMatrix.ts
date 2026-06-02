import { PermissionAction, PermissionResource } from '../types/permissions';

export type MemberType = 'admin' | 'team_member';

export interface PermissionGrant {
    resource: PermissionResource;
    action: PermissionAction;
    allowed: boolean;
}

/** Owner-only — never grant via admin or team_member. */
export const OWNER_ONLY_RESOURCES: PermissionResource[] = [
    'billing',
    'subscription',
    'ownership',
    'org_delete',
];

/** Admin: full operational + team + org context/branding; no billing/ownership/delete org. */
export const ADMIN_ALLOWED: PermissionGrant[] = [
    { resource: 'initiatives', action: 'view', allowed: true },
    { resource: 'initiatives', action: 'create', allowed: true },
    { resource: 'initiatives', action: 'edit', allowed: true },
    { resource: 'initiatives', action: 'delete', allowed: true },
    { resource: 'locations', action: 'view', allowed: true },
    { resource: 'locations', action: 'edit', allowed: true },
    { resource: 'metrics', action: 'view', allowed: true },
    { resource: 'metrics', action: 'edit', allowed: true },
    { resource: 'metrics', action: 'delete', allowed: true },
    { resource: 'impact_claims', action: 'create', allowed: true },
    { resource: 'evidence', action: 'view', allowed: true },
    { resource: 'evidence', action: 'create', allowed: true },
    { resource: 'evidence', action: 'edit', allowed: true },
    { resource: 'evidence', action: 'delete', allowed: true },
    { resource: 'evidence', action: 'upload', allowed: true },
    { resource: 'stories', action: 'view', allowed: true },
    { resource: 'stories', action: 'edit', allowed: true },
    { resource: 'beneficiaries', action: 'view', allowed: true },
    { resource: 'beneficiaries', action: 'edit', allowed: true },
    { resource: 'tags', action: 'view', allowed: true },
    { resource: 'tags', action: 'edit', allowed: true },
    { resource: 'reports', action: 'view', allowed: true },
    { resource: 'reports', action: 'export', allowed: true },
    { resource: 'analytics', action: 'view', allowed: true },
    { resource: 'team_members', action: 'view', allowed: true },
    { resource: 'team_members', action: 'manage', allowed: true },
    { resource: 'org_settings', action: 'view', allowed: true },
    { resource: 'org_settings', action: 'edit', allowed: true },
    { resource: 'org_context', action: 'view', allowed: true },
    { resource: 'org_context', action: 'edit', allowed: true },
    { resource: 'branding', action: 'view', allowed: true },
    { resource: 'branding', action: 'edit', allowed: true },
];

const adminKey = (resource: PermissionResource, action: PermissionAction) =>
    `${resource}:${action}`;

export const ADMIN_ALLOWED_KEYS = new Set(
    ADMIN_ALLOWED.filter((g) => g.allowed).map((g) => adminKey(g.resource, g.action))
);

/** Legacy invite booleans → minimal team_member grants (pre–permission UI). */
export function legacyBooleansToGrants(
    canAddImpactClaims: boolean,
    canEditEvidence: boolean
): PermissionGrant[] {
    const grants: PermissionGrant[] = [
        { resource: 'initiatives', action: 'view', allowed: true },
        { resource: 'locations', action: 'view', allowed: true },
        { resource: 'metrics', action: 'view', allowed: true },
        { resource: 'evidence', action: 'view', allowed: true },
        { resource: 'stories', action: 'view', allowed: true },
        { resource: 'beneficiaries', action: 'view', allowed: true },
        { resource: 'reports', action: 'view', allowed: true },
        { resource: 'analytics', action: 'view', allowed: true },
        { resource: 'tags', action: 'view', allowed: true },
        { resource: 'impact_claims', action: 'create', allowed: canAddImpactClaims },
        { resource: 'evidence', action: 'edit', allowed: canEditEvidence },
        { resource: 'evidence', action: 'create', allowed: canEditEvidence },
        { resource: 'evidence', action: 'upload', allowed: canEditEvidence },
    ];
    return grants;
}

export function grantsAllow(
    grants: PermissionGrant[],
    resource: PermissionResource,
    action: PermissionAction
): boolean {
    const row = grants.find((g) => g.resource === resource && g.action === action);
    return row?.allowed === true;
}

/** Collapse duplicate resource+action pairs (keep only allowed=true rows). */
export function dedupeGrants(grants: PermissionGrant[]): PermissionGrant[] {
    const byKey = new Map<string, PermissionGrant>();
    for (const g of grants) {
        if (!g?.allowed) continue;
        byKey.set(`${g.resource}:${g.action}`, { ...g, allowed: true });
    }
    return Array.from(byKey.values());
}

// ---------------------------------------------------------------------------
// Scope (team_member only): initiative-primary, fail-closed.
//  - allInitiatives === true  → access to every initiative in the org.
//  - else initiativeIds       → explicit allow-list ([] === access to nothing).
//  - locationIds              → OPTIONAL further restriction within scoped
//                               initiatives. [] === all locations of those
//                               initiatives are allowed.
// Owners and admins ignore scope entirely (unrestricted).
// ---------------------------------------------------------------------------
export interface TeamMemberScope {
    allInitiatives: boolean;
    initiativeIds: string[];
    locationIds: string[];
}

export const FULL_SCOPE: TeamMemberScope = {
    allInitiatives: true,
    initiativeIds: [],
    locationIds: [],
};

export const EMPTY_SCOPE: TeamMemberScope = {
    allInitiatives: false,
    initiativeIds: [],
    locationIds: [],
};

/** Normalize arbitrary JSON into a safe TeamMemberScope. */
export function normalizeScope(raw: any): TeamMemberScope {
    if (!raw || typeof raw !== 'object') return { ...FULL_SCOPE };
    const initiativeIds = Array.isArray(raw.initiativeIds)
        ? raw.initiativeIds.filter((x: unknown) => typeof x === 'string')
        : [];
    const locationIds = Array.isArray(raw.locationIds)
        ? raw.locationIds.filter((x: unknown) => typeof x === 'string')
        : [];
    return {
        allInitiatives: raw.allInitiatives === true,
        initiativeIds,
        locationIds,
    };
}

/** Stored JSONB blob shape on team_members / team_invitations. */
export interface TeamPermissionsBlob {
    grants: PermissionGrant[];
    scope: TeamMemberScope;
}

export function normalizePermissionsBlob(raw: any): TeamPermissionsBlob {
    const grants = Array.isArray(raw?.grants)
        ? dedupeGrants(
              raw.grants
                  .filter((g: any) => g && typeof g.resource === 'string' && typeof g.action === 'string')
                  .map((g: any) => ({
                      resource: g.resource as PermissionResource,
                      action: g.action as PermissionAction,
                      allowed: g.allowed === true,
                  }))
          )
        : [];
    return { grants, scope: normalizeScope(raw?.scope) };
}

/** True when the member may touch the given initiative under their scope. */
export function scopeAllowsInitiative(scope: TeamMemberScope, initiativeId: string): boolean {
    if (scope.allInitiatives) return true;
    return scope.initiativeIds.includes(initiativeId);
}

/** True when the member may touch the given location (within already-scoped initiatives). */
export function scopeAllowsLocation(scope: TeamMemberScope, locationId: string): boolean {
    if (scope.locationIds.length === 0) return true; // no location narrowing
    return scope.locationIds.includes(locationId);
}
