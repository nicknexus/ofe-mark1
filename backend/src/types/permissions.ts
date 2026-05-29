/** Business-permission resources (PermissionService). Not tenant boundaries. */
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
    | 'team_members'
    | 'org_settings'
    | 'org_context'
    | 'branding'
    | 'billing'
    | 'subscription'
    | 'ownership'
    | 'org_delete';

export type PermissionAction =
    | 'view'
    | 'create'
    | 'edit'
    | 'delete'
    | 'manage'
    | 'upload'
    | 'export';

export interface PermissionContext {
    resourceId?: string;
    initiativeId?: string;
    locationId?: string;
}
