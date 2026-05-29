import { PermissionAction, PermissionContext, PermissionResource } from '../types/permissions';
import { OrgAccessService } from './orgAccessService';
import { TeamService } from './teamService';

/** Account-level resources: owners only (via organizations.owner_id, never role tables). */
const OWNER_ONLY_RESOURCES: PermissionResource[] = [
    'billing',
    'subscription',
    'org_settings',
    'branding',
    'ownership',
    'org_delete',
    'team_members',
];

/**
 * Business permissions for an organization tenant.
 * Tenant boundaries are enforced by OrgAccessService first.
 *
 * Phase 1: team members retain full operational access (same as today).
 * owners.owner_id always wins; never read role_id for owners.
 */
export class PermissionService {
    /**
     * Resolve organization from membership, then evaluate business permission.
     * @param requestedOrgId Routing hint only (e.g. X-Organization-Id) — not authoritative alone.
     */
    static async can(
        userId: string,
        requestedOrgId: string | undefined,
        resource: PermissionResource,
        action: PermissionAction,
        context?: PermissionContext
    ): Promise<boolean> {
        const orgContext = await OrgAccessService.resolveOrgContext(userId, requestedOrgId);
        if (!orgContext) {
            return false;
        }

        return this.canForOrganization(
            userId,
            orgContext.organizationId,
            orgContext.isOwner,
            resource,
            action,
            context
        );
    }

    static async assert(
        userId: string,
        requestedOrgId: string | undefined,
        resource: PermissionResource,
        action: PermissionAction,
        context?: PermissionContext
    ): Promise<void> {
        const orgContext = await OrgAccessService.resolveOrgContext(userId, requestedOrgId);
        if (!orgContext) {
            OrgAccessService.deny({
                kind: 'permission',
                userId,
                requestedOrgId,
                resource,
                resourceId: context?.resourceId,
                action,
                reason: 'no_organization_context',
            });
        }

        const allowed = await this.canForOrganization(
            userId,
            orgContext.organizationId,
            orgContext.isOwner,
            resource,
            action,
            context
        );
        if (!allowed) {
            OrgAccessService.deny({
                kind: 'permission',
                userId,
                requestedOrgId,
                resolvedOrgId: orgContext.organizationId,
                organizationId: orgContext.organizationId,
                resource,
                resourceId: context?.resourceId,
                action,
                reason: 'permission_denied',
            });
        }
    }

    /**
     * Evaluate permission when org membership is already established.
     */
    static async canForOrganization(
        userId: string,
        organizationId: string,
        isOwner: boolean,
        resource: PermissionResource,
        _action: PermissionAction,
        _context?: PermissionContext
    ): Promise<boolean> {
        // Rule 3: owner bypass — organizations.owner_id only, not role tables.
        if (isOwner) {
            return true;
        }

        if (OWNER_ONLY_RESOURCES.includes(resource)) {
            return false;
        }

        // Phase 5+: read role_permissions for custom roles.
        // Phase 1 baseline: all team members keep full operational access.
        const membership = await TeamService.getUserTeamMembership(userId, organizationId);
        return !!membership;
    }
}
