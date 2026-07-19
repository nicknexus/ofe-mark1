import { supabase } from '../utils/supabase';
import {
    TimelineClaim,
    TimelineConnection,
    TimelineContributor,
    TimelineEvidence,
    TimelineResponse,
} from '../types';
import { KPIService } from './kpiService';
import { EvidenceService } from './evidenceService';
import { MetricTagService } from './metricTagService';
import { OrgAccessService } from './orgAccessService';

export class TimelineService {
    /**
     * Unified initiative activity payload: every impact claim, every evidence
     * record, and the stored claim↔evidence connections, in one round trip.
     * Read path — org access only, matching EvidenceService.getAll /
     * KPIService.getUpdatesForInitiative. Ordering is upload date
     * (created_at DESC); filtering happens client-side like the existing tabs.
     */
    static async getForInitiative(
        initiativeId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<TimelineResponse> {
        await OrgAccessService.assertInitiativeAccess(initiativeId, userId, requestedOrgId);

        // KPIService.getAll / EvidenceService.getAll re-assert access; acceptable
        // duplication to reuse their embeds and scoping behavior verbatim.
        const [kpis, evidenceRaw] = await Promise.all([
            KPIService.getAll(userId, initiativeId, requestedOrgId),
            EvidenceService.getAll(userId, requestedOrgId, initiativeId),
        ]);

        const kpiIds = kpis.map(k => k.id!).filter(Boolean) as string[];

        // Flat claim list across all the initiative's metrics (same query shape
        // as KPIService.getUpdatesForInitiative, without the per-KPI grouping).
        let claimsRaw: any[] = [];
        if (kpiIds.length > 0) {
            const { data, error } = await supabase
                .from('kpi_updates')
                .select('*, kpi_update_beneficiary_groups(beneficiary_group_id)')
                .in('kpi_id', kpiIds)
                .order('created_at', { ascending: false });
            if (error) throw new Error(`Failed to fetch timeline claims: ${error.message}`);
            claimsRaw = data || [];
        }

        const updateIds = claimsRaw.map(u => u.id).filter(Boolean);
        const tagMap = await MetricTagService.getTagIdsForUpdates(updateIds);
        const claimIdSet = new Set(updateIds);

        // Connections derived from the evidence rows' stored junction links,
        // restricted to claims in this initiative.
        const connections: TimelineConnection[] = [];
        const evidenceCountByClaim: Record<string, number> = {};
        for (const item of evidenceRaw as any[]) {
            for (const kpiUpdateId of item.kpi_update_ids || []) {
                if (!claimIdSet.has(kpiUpdateId)) continue;
                connections.push({ evidence_id: item.id, kpi_update_id: kpiUpdateId });
                evidenceCountByClaim[kpiUpdateId] = (evidenceCountByClaim[kpiUpdateId] || 0) + 1;
            }
        }

        const claims: TimelineClaim[] = claimsRaw.map((u: any) => ({
            ...u,
            beneficiary_group_ids: (u.kpi_update_beneficiary_groups || []).map((l: any) => l.beneficiary_group_id),
            tag_id: tagMap[u.id] ?? null,
            kpi_update_beneficiary_groups: undefined,
            evidence_count: evidenceCountByClaim[u.id] || 0,
        }));

        const evidence: TimelineEvidence[] = (evidenceRaw as any[]).map(item => ({
            ...item,
            kpi_ids: (item.evidence_kpis || []).map((l: any) => l.kpi_id).filter(Boolean),
            evidence_kpis: undefined,
            evidence_kpi_updates: undefined,
            evidence_locations: undefined,
            evidence_beneficiary_groups: undefined,
            evidence_files: undefined,
            claim_count: (item.kpi_update_ids || []).filter((id: string) => claimIdSet.has(id)).length,
        }));

        const contributors = await this.resolveContributors([
            ...claims.map(c => c.user_id),
            ...evidence.map(e => e.user_id),
        ]);

        // Pending evidence rides along in the payload (the Logs render it as
        // the approval queue) but is excluded from every stat except its own.
        const approvedEvidence = evidence.filter(e => (e as any).approval_status !== 'pending');
        const pendingTotal = evidence.length - approvedEvidence.length;

        const connectedClaims = claims.filter(c => c.evidence_count > 0).length;
        const connectedEvidence = approvedEvidence.filter(e => e.claim_count > 0).length;
        const total = claims.length + approvedEvidence.length;
        const connected = connectedClaims + connectedEvidence;

        return {
            kpis,
            claims,
            evidence,
            connections,
            contributors,
            stats: {
                total,
                connected,
                not_connected: total - connected,
                claims_total: claims.length,
                evidence_total: approvedEvidence.length,
                pending_total: pendingTotal,
            },
        };
    }

    /**
     * Resolve display names for the distinct contributor ids. Same
     * auth-admin lookup TeamService uses for member lists; failures fall
     * back to null so a broken lookup never breaks the timeline.
     */
    private static async resolveContributors(
        userIds: Array<string | undefined>
    ): Promise<Record<string, TimelineContributor>> {
        const distinct = [...new Set(userIds.filter(Boolean) as string[])];
        const entries = await Promise.allSettled(
            distinct.map(async id => {
                const { data } = await supabase.auth.admin.getUserById(id);
                return [id, {
                    name: data?.user?.user_metadata?.name ?? null,
                    email: data?.user?.email ?? null,
                }] as const;
            })
        );

        const contributors: Record<string, TimelineContributor> = {};
        entries.forEach((result, i) => {
            contributors[distinct[i]] = result.status === 'fulfilled'
                ? result.value[1]
                : { name: null, email: null };
        });
        return contributors;
    }
}
