import { supabase } from '../utils/supabase';
import { TeamService } from './teamService';
import { PlatformAdminService } from './platformAdminService';
import { logPermissionDenial, PermissionDenialEntry } from '../utils/permissionDenialLog';

export interface ResolvedOrgContext {
    organizationId: string;
    /** True when organizations.owner_id === userId. Never derived from role tables. */
    isOwner: boolean;
}

type DenyParams = Omit<PermissionDenialEntry, 'at'> & { message?: string };

/**
 * Tenant security boundaries only.
 * Do not encode business roles here — use PermissionService.
 *
 * Rules:
 * - Membership validated in this layer (not routes).
 * - X-Organization-Id is a routing hint; authority comes from DB membership.
 * - Fail closed for foreign orgs; API returns 404.
 * - Never use content created_by / user_id as authority.
 */
export class OrgAccessService {
    static accessDenied(message = 'Not found or access denied'): Error {
        const err = new Error(message);
        (err as any).status = 404;
        return err;
    }

    /** Log internally, then throw 404. */
    static deny(params: DenyParams): never {
        logPermissionDenial({
            kind: params.kind,
            userId: params.userId,
            requestedOrgId: params.requestedOrgId,
            resolvedOrgId: params.resolvedOrgId,
            organizationId: params.organizationId,
            resource: params.resource,
            resourceId: params.resourceId,
            action: params.action,
            reason: params.reason,
            detail: params.detail,
        });
        throw this.accessDenied(params.message);
    }

    /**
     * Authoritative org resolution. `requestedOrgId` is only a hint when the
     * user belongs to multiple organizations.
     */
    static async resolveOrgContext(
        userId: string,
        requestedOrgId?: string
    ): Promise<ResolvedOrgContext | null> {
        if (requestedOrgId) {
            if (await TeamService.isUserOwnerOfOrganization(userId, requestedOrgId)) {
                return { organizationId: requestedOrgId, isOwner: true };
            }

            const memberships = await TeamService.getUserTeamMemberships(userId, requestedOrgId);
            if (memberships.length > 0) {
                return { organizationId: requestedOrgId, isOwner: false };
            }

            const isAdmin = await PlatformAdminService.isAdmin(userId);
            if (isAdmin) {
                const { data: org } = await supabase
                    .from('organizations')
                    .select('id, is_demo')
                    .eq('id', requestedOrgId)
                    .maybeSingle();
                if (org?.is_demo) {
                    return { organizationId: requestedOrgId, isOwner: false };
                }
            }

            return null;
        }

        const ownedOrg = await TeamService.getUserOwnedOrganization(userId);
        if (ownedOrg?.id) {
            return { organizationId: ownedOrg.id, isOwner: true };
        }

        const memberships = await TeamService.getUserTeamMemberships(userId);
        if (memberships.length > 0) {
            return {
                organizationId: memberships[0].organization_id,
                isOwner: false,
            };
        }

        const isAdmin = await PlatformAdminService.isAdmin(userId);
        if (isAdmin) {
            const owned = await TeamService.getAllUserOwnedOrganizations(userId);
            const demo = owned.find(o => o.is_demo);
            if (demo?.id) {
                return { organizationId: demo.id, isOwner: false };
            }
        }

        return null;
    }

    static async resolveActiveOrganizationId(
        userId: string,
        requestedOrgId?: string
    ): Promise<string | null> {
        const ctx = await this.resolveOrgContext(userId, requestedOrgId);
        return ctx?.organizationId ?? null;
    }

    static async assertOrgContext(
        userId: string,
        requestedOrgId?: string
    ): Promise<ResolvedOrgContext> {
        const ctx = await this.resolveOrgContext(userId, requestedOrgId);
        if (!ctx) {
            this.deny({
                kind: 'org_access',
                userId,
                requestedOrgId,
                reason: 'no_organization_context',
            });
        }
        return ctx;
    }

    static async assertOrgAccess(userId: string, organizationId: string): Promise<void> {
        const allowed = await TeamService.hasOrgAccess(userId, organizationId);
        if (!allowed) {
            this.deny({
                kind: 'org_access',
                userId,
                organizationId,
                reason: 'foreign_organization',
            });
        }
    }

    static async isOrganizationOwner(userId: string, organizationId: string): Promise<boolean> {
        return TeamService.isUserOwnerOfOrganization(userId, organizationId);
    }

    private static async getInitiativeRow(initiativeId: string): Promise<{
        id: string;
        organization_id: string;
    } | null> {
        const { data, error } = await supabase
            .from('initiatives')
            .select('id, organization_id')
            .eq('id', initiativeId)
            .maybeSingle();
        if (error) throw new Error(`Failed to resolve initiative: ${error.message}`);
        if (!data?.organization_id) return null;
        return data as { id: string; organization_id: string };
    }

    static async assertInitiativeAccess(
        initiativeId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<{ organizationId: string; initiativeId: string }> {
        const ctx = await this.assertOrgContext(userId, requestedOrgId);
        const row = await this.getInitiativeRow(initiativeId);
        if (!row || row.organization_id !== ctx.organizationId) {
            this.deny({
                kind: 'org_access',
                userId,
                requestedOrgId,
                resolvedOrgId: ctx.organizationId,
                organizationId: row?.organization_id,
                resource: 'initiatives',
                resourceId: initiativeId,
                reason: 'initiative_not_in_active_org',
            });
        }
        return { organizationId: ctx.organizationId, initiativeId };
    }

    static async getInitiativeIdForEvidence(evidenceId: string): Promise<string | null> {
        const { data, error } = await supabase
            .from('evidence')
            .select('initiative_id')
            .eq('id', evidenceId)
            .maybeSingle();
        if (error) throw new Error(`Failed to resolve evidence: ${error.message}`);
        return data?.initiative_id ?? null;
    }

    static async assertEvidenceAccess(
        evidenceId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<{ initiativeId: string; organizationId: string }> {
        const initiativeId = await this.getInitiativeIdForEvidence(evidenceId);
        if (!initiativeId) {
            this.deny({
                kind: 'org_access',
                userId,
                requestedOrgId,
                resource: 'evidence',
                resourceId: evidenceId,
                reason: 'evidence_not_found',
            });
        }
        const { organizationId } = await this.assertInitiativeAccess(
            initiativeId,
            userId,
            requestedOrgId
        );
        return { initiativeId, organizationId };
    }

    static async assertKpiAccess(
        kpiId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<void> {
        const ctx = await this.assertOrgContext(userId, requestedOrgId);
        const { data: kpi, error } = await supabase
            .from('kpis')
            .select('id, initiative_id')
            .eq('id', kpiId)
            .maybeSingle();
        if (error) throw new Error(`Failed to resolve KPI: ${error.message}`);
        if (!kpi?.initiative_id) {
            this.deny({
                kind: 'org_access',
                userId,
                requestedOrgId,
                resolvedOrgId: ctx.organizationId,
                resource: 'metrics',
                resourceId: kpiId,
                reason: 'kpi_not_found',
            });
        }
        const initiative = await this.getInitiativeRow(kpi.initiative_id);
        if (!initiative || initiative.organization_id !== ctx.organizationId) {
            this.deny({
                kind: 'org_access',
                userId,
                requestedOrgId,
                resolvedOrgId: ctx.organizationId,
                resource: 'metrics',
                resourceId: kpiId,
                reason: 'kpi_not_in_active_org',
            });
        }
    }

    static async assertKpiUpdateAccess(
        updateId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<void> {
        const { data, error } = await supabase
            .from('kpi_updates')
            .select('kpi_id')
            .eq('id', updateId)
            .maybeSingle();
        if (error) throw new Error(`Failed to resolve KPI update: ${error.message}`);
        if (!data?.kpi_id) {
            this.deny({
                kind: 'org_access',
                userId,
                requestedOrgId,
                resource: 'impact_claims',
                resourceId: updateId,
                reason: 'kpi_update_not_found',
            });
        }
        await this.assertKpiAccess(data.kpi_id, userId, requestedOrgId);
    }

    static async assertLocationInOrg(
        locationId: string,
        organizationId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<void> {
        await this.assertOrgContext(userId, requestedOrgId);
        const { data: location, error } = await supabase
            .from('locations')
            .select('id, organization_id')
            .eq('id', locationId)
            .maybeSingle();
        if (error) throw new Error(`Failed to resolve location: ${error.message}`);
        if (!location || location.organization_id !== organizationId) {
            this.deny({
                kind: 'resource_chain',
                userId,
                requestedOrgId,
                resolvedOrgId: organizationId,
                resource: 'locations',
                resourceId: locationId,
                reason: 'location_org_mismatch',
            });
        }
    }

    static async assertBeneficiaryInInitiative(
        groupId: string,
        initiativeId: string,
        organizationId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<void> {
        await this.assertInitiativeAccess(initiativeId, userId, requestedOrgId);
        const { data: group, error } = await supabase
            .from('beneficiary_groups')
            .select('id, initiative_id')
            .eq('id', groupId)
            .maybeSingle();
        if (error) throw new Error(`Failed to resolve beneficiary group: ${error.message}`);
        if (!group || group.initiative_id !== initiativeId) {
            this.deny({
                kind: 'resource_chain',
                userId,
                requestedOrgId,
                resolvedOrgId: organizationId,
                resource: 'beneficiaries',
                resourceId: groupId,
                reason: 'beneficiary_initiative_mismatch',
            });
        }
    }

    /**
     * Validate linked resources share one org + initiative chain before writes.
     */
    static async assertEvidenceLinkageConsistency(
        initiativeId: string,
        userId: string,
        requestedOrgId: string | undefined,
        links: {
            kpi_ids?: string[];
            kpi_update_ids?: string[];
            location_ids?: string[];
            beneficiary_group_ids?: string[];
        }
    ): Promise<{ organizationId: string }> {
        const { organizationId } = await this.assertInitiativeAccess(
            initiativeId,
            userId,
            requestedOrgId
        );

        const kpiIds = links.kpi_ids ?? [];
        for (const kpiId of kpiIds) {
            const { data: kpi } = await supabase
                .from('kpis')
                .select('initiative_id')
                .eq('id', kpiId)
                .maybeSingle();
            if (!kpi || kpi.initiative_id !== initiativeId) {
                this.deny({
                    kind: 'resource_chain',
                    userId,
                    requestedOrgId,
                    resolvedOrgId: organizationId,
                    resource: 'metrics',
                    resourceId: kpiId,
                    reason: 'kpi_initiative_mismatch',
                });
            }
        }

        for (const updateId of links.kpi_update_ids ?? []) {
            const { data: update } = await supabase
                .from('kpi_updates')
                .select('kpi_id')
                .eq('id', updateId)
                .maybeSingle();
            if (!update?.kpi_id) {
                this.deny({
                    kind: 'resource_chain',
                    userId,
                    requestedOrgId,
                    resolvedOrgId: organizationId,
                    resource: 'impact_claims',
                    resourceId: updateId,
                    reason: 'kpi_update_not_found',
                });
            }
            if (!kpiIds.includes(update.kpi_id)) {
                await this.assertKpiAccess(update.kpi_id, userId, requestedOrgId);
            }
            const { data: kpi } = await supabase
                .from('kpis')
                .select('initiative_id')
                .eq('id', update.kpi_id)
                .maybeSingle();
            if (!kpi || kpi.initiative_id !== initiativeId) {
                this.deny({
                    kind: 'resource_chain',
                    userId,
                    requestedOrgId,
                    resolvedOrgId: organizationId,
                    resource: 'impact_claims',
                    resourceId: updateId,
                    reason: 'kpi_update_initiative_mismatch',
                });
            }
        }

        for (const locationId of links.location_ids ?? []) {
            await this.assertLocationInOrg(locationId, organizationId, userId, requestedOrgId);
        }

        for (const groupId of links.beneficiary_group_ids ?? []) {
            await this.assertBeneficiaryInInitiative(
                groupId,
                initiativeId,
                organizationId,
                userId,
                requestedOrgId
            );
        }

        return { organizationId };
    }

    static async getAccessibleInitiativeIds(
        userId: string,
        requestedOrgId?: string
    ): Promise<string[]> {
        const ctx = await this.resolveOrgContext(userId, requestedOrgId);
        if (!ctx) return [];

        const { data, error } = await supabase
            .from('initiatives')
            .select('id')
            .eq('organization_id', ctx.organizationId);
        if (error) throw new Error(`Failed to list initiatives: ${error.message}`);
        return (data ?? []).map((r: { id: string }) => r.id).filter(Boolean);
    }
}
