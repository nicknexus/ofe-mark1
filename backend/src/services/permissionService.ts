import { PermissionAction, PermissionContext, PermissionResource } from '../types/permissions';
import { OrgAccessService } from './orgAccessService';
import { TeamService } from './teamService';
import { resolveMemberType, TeamMemberPermissionsService } from './teamMemberPermissionsService';
import { OWNER_ONLY_RESOURCES, normalizePermissionsBlob } from '../constants/teamPermissionMatrix';

/**
 * Business permissions for an organization tenant.
 * Tenant boundaries are enforced by OrgAccessService first.
 *
 * ENFORCE_TEAM_MEMBER_PERMISSIONS=false (default): members keep Phase 1 full ops access.
 * Set to true after migration + verification to apply admin / team_member matrix.
 */
export class PermissionService {
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
            // In-org capability denial → friendly 403 (resource exists, member lacks grant).
            OrgAccessService.denyCapability({
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

    static async canForOrganization(
        userId: string,
        organizationId: string,
        isOwner: boolean,
        resource: PermissionResource,
        action: PermissionAction,
        _context?: PermissionContext
    ): Promise<boolean> {
        if (isOwner) {
            return true;
        }

        const membership = await TeamService.getUserTeamMembership(userId, organizationId);
        if (!membership) {
            return false;
        }

        const memberType = resolveMemberType(membership.member_type);
        const blob = normalizePermissionsBlob((membership as any).permissions);

        return TeamMemberPermissionsService.memberCanFromBlob(
            memberType,
            blob,
            resource,
            action,
            {
                canAddImpactClaims: membership.can_add_impact_claims,
                canEditEvidence: membership.can_edit_evidence,
            }
        );
    }

    /** Whether a member may manage team (invite/remove) — admin only when enforced. */
    static async canManageTeam(
        userId: string,
        organizationId: string,
        isOwner: boolean
    ): Promise<boolean> {
        if (isOwner) return true;
        const membership = await TeamService.getUserTeamMembership(userId, organizationId);
        if (!membership) return false;
        const memberType = resolveMemberType(membership.member_type);
        if (!TeamMemberPermissionsService.isEnforcementEnabled()) {
            return false;
        }
        return memberType === 'admin';
    }
}

export { OWNER_ONLY_RESOURCES };
