/**
 * Internal audit log for tenant/permission denials.
 * API responses stay generic (404); details live here for ops/debugging.
 */
export interface PermissionDenialEntry {
    kind: 'org_access' | 'resource_chain' | 'permission';
    userId: string;
    requestedOrgId?: string;
    resolvedOrgId?: string;
    organizationId?: string;
    resource?: string;
    resourceId?: string;
    action?: string;
    reason: string;
    detail?: Record<string, unknown>;
}

export function logPermissionDenial(entry: PermissionDenialEntry): void {
    console.warn('[permission_denied]', JSON.stringify({
        ...entry,
        at: new Date().toISOString(),
    }));
}
