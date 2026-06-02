import { supabase } from '../utils/supabase';
import {
    grantsAllow,
    dedupeGrants,
    legacyBooleansToGrants,
    MemberType,
    PermissionGrant,
    ADMIN_ALLOWED,
    ADMIN_ALLOWED_KEYS,
    OWNER_ONLY_RESOURCES,
    TeamMemberScope,
    TeamPermissionsBlob,
    FULL_SCOPE,
    EMPTY_SCOPE,
    normalizePermissionsBlob,
    normalizeScope,
} from '../constants/teamPermissionMatrix';
import { PermissionAction, PermissionResource } from '../types/permissions';

/** Granular capability flags consumed by the frontend to gate UI. */
export interface MemberCapabilities {
    canAddImpactClaims: boolean;
    canEditEvidence: boolean;
    canEditMetrics: boolean;
    canEditInitiatives: boolean;
    canCreateInitiatives: boolean;
    canEditLocations: boolean;
    canEditBeneficiaries: boolean;
    canEditStories: boolean;
    canEditTags: boolean;
    canExportReports: boolean;
    canEditOrgContext: boolean;
    canDelete: boolean;
}

/** Owner/admin: unrestricted operational access. */
export function fullCapabilities(): MemberCapabilities {
    return {
        canAddImpactClaims: true,
        canEditEvidence: true,
        canEditMetrics: true,
        canEditInitiatives: true,
        canCreateInitiatives: true,
        canEditLocations: true,
        canEditBeneficiaries: true,
        canEditStories: true,
        canEditTags: true,
        canExportReports: true,
        canEditOrgContext: true,
        canDelete: true,
    };
}

export function noCapabilities(): MemberCapabilities {
    return {
        canAddImpactClaims: false,
        canEditEvidence: false,
        canEditMetrics: false,
        canEditInitiatives: false,
        canCreateInitiatives: false,
        canEditLocations: false,
        canEditBeneficiaries: false,
        canEditStories: false,
        canEditTags: false,
        canExportReports: false,
        canEditOrgContext: false,
        canDelete: false,
    };
}

/**
 * Effective member_type for a team_members row.
 * NULL → admin (existing rows pre-migration + post backfill safety).
 */
export function resolveMemberType(raw: string | null | undefined): MemberType {
    if (raw === 'team_member') return 'team_member';
    return 'admin';
}

/** Invitation: NULL → team_member (legacy invites). */
export function resolveInvitationMemberType(raw: string | null | undefined): MemberType {
    if (raw === 'admin') return 'admin';
    return 'team_member';
}

/**
 * Permissions now live in a single JSONB column per row:
 *   team_members.permissions / team_invitations.permissions
 *     = { grants: PermissionGrant[], scope: TeamMemberScope }
 * Admin rows ignore the blob (capabilities fixed in ADMIN_ALLOWED).
 */
export class TeamMemberPermissionsService {
    static isEnforcementEnabled(): boolean {
        return process.env.ENFORCE_TEAM_MEMBER_PERMISSIONS === 'true';
    }

    // ---------------------------------------------------------------- reads
    static async getMemberBlob(teamMemberId: string): Promise<TeamPermissionsBlob> {
        const { data, error } = await supabase
            .from('team_members')
            .select('permissions')
            .eq('id', teamMemberId)
            .maybeSingle();
        if (error) {
            console.warn('[team_members.permissions] read failed:', error.message);
            return { grants: [], scope: { ...EMPTY_SCOPE } };
        }
        return normalizePermissionsBlob(data?.permissions);
    }

    static async getInvitationBlob(invitationId: string): Promise<TeamPermissionsBlob> {
        const { data, error } = await supabase
            .from('team_invitations')
            .select('permissions')
            .eq('id', invitationId)
            .maybeSingle();
        if (error) {
            console.warn('[team_invitations.permissions] read failed:', error.message);
            return { grants: [], scope: { ...EMPTY_SCOPE } };
        }
        return normalizePermissionsBlob(data?.permissions);
    }

    static async getMemberGrants(teamMemberId: string): Promise<PermissionGrant[]> {
        return (await this.getMemberBlob(teamMemberId)).grants;
    }

    static async getInvitationGrants(invitationId: string): Promise<PermissionGrant[]> {
        return (await this.getInvitationBlob(invitationId)).grants;
    }

    static async getMemberScope(teamMemberId: string): Promise<TeamMemberScope> {
        return (await this.getMemberBlob(teamMemberId)).scope;
    }

    // --------------------------------------------------------------- writes
    static async writeMemberPermissions(
        teamMemberId: string,
        grants: PermissionGrant[],
        scope: TeamMemberScope
    ): Promise<void> {
        const blob: TeamPermissionsBlob = {
            grants: dedupeGrants(grants),
            scope: normalizeScope(scope),
        };
        const { error } = await supabase
            .from('team_members')
            .update({ permissions: blob })
            .eq('id', teamMemberId);
        if (error) throw new Error(`Failed to save member permissions: ${error.message}`);
    }

    static async writeInvitationPermissions(
        invitationId: string,
        grants: PermissionGrant[],
        scope: TeamMemberScope
    ): Promise<void> {
        const blob: TeamPermissionsBlob = {
            grants: dedupeGrants(grants),
            scope: normalizeScope(scope),
        };
        const { error } = await supabase
            .from('team_invitations')
            .update({ permissions: blob })
            .eq('id', invitationId);
        if (error) throw new Error(`Failed to save invitation permissions: ${error.message}`);
    }

    /** Copy the invitation's permissions blob onto the new member row. */
    static async copyInvitationToMember(invitationId: string, teamMemberId: string): Promise<void> {
        const blob = await this.getInvitationBlob(invitationId);
        await this.writeMemberPermissions(teamMemberId, blob.grants, blob.scope);
    }

    // ----------------------------------------------------------- evaluation
    static resolveGrantsForMemberBlob(
        memberType: MemberType,
        blob: TeamPermissionsBlob,
        legacyBooleans?: { canAddImpactClaims: boolean; canEditEvidence: boolean }
    ): PermissionGrant[] {
        if (memberType === 'admin') {
            return ADMIN_ALLOWED.filter((g) => g.allowed);
        }
        if (blob.grants.length > 0) return blob.grants;
        if (legacyBooleans) {
            return legacyBooleansToGrants(
                legacyBooleans.canAddImpactClaims,
                legacyBooleans.canEditEvidence
            );
        }
        return [];
    }

    static memberCanFromBlob(
        memberType: MemberType,
        blob: TeamPermissionsBlob,
        resource: PermissionResource,
        action: PermissionAction,
        legacyBooleans?: { canAddImpactClaims: boolean; canEditEvidence: boolean }
    ): boolean {
        if (OWNER_ONLY_RESOURCES.includes(resource)) return false;
        if (memberType === 'admin') {
            return ADMIN_ALLOWED_KEYS.has(`${resource}:${action}`);
        }
        const grants = this.resolveGrantsForMemberBlob(memberType, blob, legacyBooleans);
        return grantsAllow(grants, resource, action);
    }

    static uiFlagsFromBlob(
        memberType: MemberType,
        blob: TeamPermissionsBlob,
        legacyBooleans?: { canAddImpactClaims: boolean; canEditEvidence: boolean }
    ): { canAddImpactClaims: boolean; canEditEvidence: boolean; canDelete: boolean } {
        const caps = this.capabilitiesFromBlob(memberType, blob, legacyBooleans);
        return {
            canAddImpactClaims: caps.canAddImpactClaims,
            canEditEvidence: caps.canEditEvidence,
            canDelete: caps.canDelete,
        };
    }

    /** Full granular capability set the frontend needs to gate every action. */
    static capabilitiesFromBlob(
        memberType: MemberType,
        blob: TeamPermissionsBlob,
        legacyBooleans?: { canAddImpactClaims: boolean; canEditEvidence: boolean }
    ): MemberCapabilities {
        if (memberType === 'admin') return fullCapabilities();
        const grants = this.resolveGrantsForMemberBlob(memberType, blob, legacyBooleans);
        return {
            canAddImpactClaims: grantsAllow(grants, 'impact_claims', 'create'),
            canEditEvidence:
                grantsAllow(grants, 'evidence', 'edit') || grantsAllow(grants, 'evidence', 'create'),
            canEditMetrics: grantsAllow(grants, 'metrics', 'edit'),
            canEditInitiatives: grantsAllow(grants, 'initiatives', 'edit'),
            canCreateInitiatives: grantsAllow(grants, 'initiatives', 'create'),
            canEditLocations: grantsAllow(grants, 'locations', 'edit'),
            canEditBeneficiaries: grantsAllow(grants, 'beneficiaries', 'edit'),
            canEditStories: grantsAllow(grants, 'stories', 'edit'),
            canEditTags: grantsAllow(grants, 'tags', 'edit'),
            canExportReports: grantsAllow(grants, 'reports', 'export'),
            canEditOrgContext: false, // owner/admin only
            canDelete:
                grantsAllow(grants, 'evidence', 'delete') ||
                grantsAllow(grants, 'initiatives', 'delete') ||
                grantsAllow(grants, 'metrics', 'delete'),
        };
    }

    // --------------------------------------------------- DB-reading wrappers
    static async memberCan(
        memberType: MemberType,
        teamMemberId: string,
        resource: PermissionResource,
        action: PermissionAction,
        legacyBooleans?: { canAddImpactClaims: boolean; canEditEvidence: boolean }
    ): Promise<boolean> {
        if (OWNER_ONLY_RESOURCES.includes(resource)) return false;
        if (memberType === 'admin') {
            return ADMIN_ALLOWED_KEYS.has(`${resource}:${action}`);
        }
        const blob = await this.getMemberBlob(teamMemberId);
        return this.memberCanFromBlob(memberType, blob, resource, action, legacyBooleans);
    }
}
