import { supabase } from '../utils/supabase'
import { OrgAccessService } from './orgAccessService'
import { BeneficiaryService } from './beneficiaryService'
import { MetricTagService } from './metricTagService'

/**
 * Single source of truth for "does this evidence support this claim".
 *
 * The auto-link, reconcile and backfill paths in EvidenceService all apply
 * the same five gates (metric, location, date overlap, tag, beneficiary
 * groups). This module exposes those gates as one pure function plus two
 * read-only entry points on top of it:
 *
 *  - previewMatches: given a scope the user is about to save, which existing
 *    claims / evidence would connect. Replaces the client-side mirrors that
 *    used to live in the frontend and drift out of sync.
 *  - diagnoseEvidence / diagnoseClaim: for an existing row, every candidate
 *    on the other side with the exact gate(s) that failed. Turns "0
 *    connections" into something a user can fix.
 */

export type MatchReason = 'metric' | 'location' | 'date' | 'tag' | 'groups'

export interface ClaimScope {
    kpiId: string
    locationId: string | null
    dateStart: string
    dateEnd: string | null
    tagId: string | null
    beneficiaryGroupIds: string[]
}

export interface EvidenceScope {
    kpiIds: string[]
    locationIds: string[]
    dateStart: string
    dateEnd: string | null
    tagIds: string[]
    beneficiaryGroupIds: string[]
}

export interface PreviewScope {
    kpiIds: string[]
    locationIds: string[]
    tagIds: string[]
    beneficiaryGroupIds: string[]
    dateStart: string
    dateEnd?: string | null
}

export interface MatchVerdict {
    ok: boolean
    reasons: MatchReason[]
}

export interface ClaimCandidate {
    id: string
    kpi_id: string
    kpi_title: string
    value: number | null
    title: string | null
    location_id: string | null
    location_name: string | null
    date_represented: string | null
    date_range_start: string | null
    date_range_end: string | null
    tag_id: string | null
    beneficiary_group_ids: string[]
    linked: boolean
    verdict: MatchVerdict
}

export interface EvidenceCandidate {
    id: string
    title: string | null
    type: string | null
    kpi_ids: string[]
    location_ids: string[]
    date_represented: string | null
    date_range_start: string | null
    date_range_end: string | null
    tag_ids: string[]
    beneficiary_group_ids: string[]
    approval_status: string | null
    linked: boolean
    verdict: MatchVerdict
}

export class MatchService {
    static datesOverlap(start1: string, end1: string | null, start2: string, end2: string | null): boolean {
        const e1 = end1 || start1
        const e2 = end2 || start2
        return start1 <= e2 && start2 <= e1
    }

    /**
     * Pure gate check. Every reason that fails is reported (not just the
     * first) so a diagnostic view can list them all.
     */
    static explain(claim: ClaimScope, evidence: EvidenceScope): MatchVerdict {
        const reasons: MatchReason[] = []
        if (!evidence.kpiIds.includes(claim.kpiId)) reasons.push('metric')
        if (!claim.locationId || !evidence.locationIds.includes(claim.locationId)) reasons.push('location')
        if (!claim.dateStart || !evidence.dateStart || !this.datesOverlap(evidence.dateStart, evidence.dateEnd, claim.dateStart, claim.dateEnd)) {
            reasons.push('date')
        }
        if (!MetricTagService.evidenceMatchesClaimTag(claim.tagId, evidence.tagIds)) reasons.push('tag')
        if (!BeneficiaryService.beneficiaryGroupsMatch(claim.beneficiaryGroupIds, evidence.beneficiaryGroupIds)) reasons.push('groups')
        return { ok: reasons.length === 0, reasons }
    }

    // ------------------------------------------------------------------
    // Loaders
    // ------------------------------------------------------------------

    private static async loadClaims(kpiIds: string[]): Promise<Omit<ClaimCandidate, 'linked' | 'verdict'>[]> {
        if (kpiIds.length === 0) return []
        const { data: rows } = await supabase
            .from('kpi_updates')
            .select('id, kpi_id, value, title, location_id, date_represented, date_range_start, date_range_end, kpis(title), locations(name)')
            .in('kpi_id', kpiIds)
        const claims = (rows || []) as any[]
        const ids = claims.map(c => c.id)
        const [bgMap, tagMap] = ids.length > 0
            ? await Promise.all([
                BeneficiaryService.getBenGroupsForUpdates(ids),
                MetricTagService.getTagIdsForUpdates(ids),
            ])
            : [{} as Record<string, string[]>, {} as Record<string, string | null>]
        return claims.map(c => ({
            id: c.id,
            kpi_id: c.kpi_id,
            kpi_title: c.kpis?.title || 'Unknown metric',
            value: c.value ?? null,
            title: c.title ?? null,
            location_id: c.location_id ?? null,
            location_name: c.locations?.name ?? null,
            date_represented: c.date_represented ?? null,
            date_range_start: c.date_range_start ?? null,
            date_range_end: c.date_range_end ?? null,
            tag_id: tagMap[c.id] ?? null,
            beneficiary_group_ids: bgMap[c.id] || [],
        }))
    }

    private static async loadEvidence(kpiIds: string[]): Promise<Omit<EvidenceCandidate, 'linked' | 'verdict'>[]> {
        if (kpiIds.length === 0) return []
        const { data: kpiLinks } = await supabase
            .from('evidence_kpis')
            .select('evidence_id, kpi_id')
            .in('kpi_id', kpiIds)
        const evidenceIds = [...new Set((kpiLinks || []).map((l: any) => l.evidence_id as string))]
        if (evidenceIds.length === 0) return []

        const [{ data: rows }, { data: allKpiLinks }, { data: locLinks }, tagMap, bgMap] = await Promise.all([
            supabase
                .from('evidence')
                .select('id, title, type, date_represented, date_range_start, date_range_end, approval_status')
                .in('id', evidenceIds),
            supabase.from('evidence_kpis').select('evidence_id, kpi_id').in('evidence_id', evidenceIds),
            supabase.from('evidence_locations').select('evidence_id, location_id').in('evidence_id', evidenceIds),
            MetricTagService.getTagIdsForEvidences(evidenceIds),
            BeneficiaryService.getBenGroupsForEvidence(evidenceIds),
        ])

        const kpiIdsByEv: Record<string, string[]> = {}
        for (const l of (allKpiLinks || []) as any[]) (kpiIdsByEv[l.evidence_id] ||= []).push(l.kpi_id)
        const locIdsByEv: Record<string, string[]> = {}
        for (const l of (locLinks || []) as any[]) (locIdsByEv[l.evidence_id] ||= []).push(l.location_id)

        return ((rows || []) as any[]).map(e => ({
            id: e.id,
            title: e.title ?? null,
            type: e.type ?? null,
            kpi_ids: kpiIdsByEv[e.id] || [],
            location_ids: locIdsByEv[e.id] || [],
            date_represented: e.date_represented ?? null,
            date_range_start: e.date_range_start ?? null,
            date_range_end: e.date_range_end ?? null,
            tag_ids: tagMap[e.id] || [],
            beneficiary_group_ids: bgMap[e.id] || [],
            approval_status: e.approval_status ?? null,
        }))
    }

    private static claimScopeOf(c: Omit<ClaimCandidate, 'linked' | 'verdict'>): ClaimScope {
        return {
            kpiId: c.kpi_id,
            locationId: c.location_id,
            dateStart: c.date_range_start || c.date_represented || '',
            dateEnd: c.date_range_end || null,
            tagId: c.tag_id,
            beneficiaryGroupIds: c.beneficiary_group_ids,
        }
    }

    private static evidenceScopeOf(e: Omit<EvidenceCandidate, 'linked' | 'verdict'>): EvidenceScope {
        return {
            kpiIds: e.kpi_ids,
            locationIds: e.location_ids,
            dateStart: e.date_range_start || e.date_represented || '',
            dateEnd: e.date_range_end || null,
            tagIds: e.tag_ids,
            beneficiaryGroupIds: e.beneficiary_group_ids,
        }
    }

    // ------------------------------------------------------------------
    // Preview: what would a not-yet-saved scope connect to?
    // ------------------------------------------------------------------

    /**
     * Treats `scope` as evidence and returns the claims it would link to, and
     * treats `scope` as a claim (per metric x location, single tag) and
     * returns the evidence it would link to. The wizard shows whichever side
     * is relevant for the kind being created.
     */
    static async previewMatches(
        initiativeId: string,
        scope: PreviewScope,
        userId: string,
        requestedOrgId?: string
    ): Promise<{ claims: ClaimCandidate[]; evidence: EvidenceCandidate[] }> {
        await OrgAccessService.assertInitiativeAccess(initiativeId, userId, requestedOrgId)

        // Restrict to metrics in this program so a stray kpi id can't leak
        // another program's rows.
        const { data: kpiRows } = await supabase
            .from('kpis')
            .select('id')
            .eq('initiative_id', initiativeId)
            .in('id', scope.kpiIds.length > 0 ? scope.kpiIds : ['00000000-0000-0000-0000-000000000000'])
        const kpiIds = (kpiRows || []).map((k: any) => k.id as string)
        if (kpiIds.length === 0 || !scope.dateStart) return { claims: [], evidence: [] }

        const asEvidence: EvidenceScope = {
            kpiIds,
            locationIds: scope.locationIds,
            dateStart: scope.dateStart,
            dateEnd: scope.dateEnd || null,
            tagIds: scope.tagIds,
            beneficiaryGroupIds: scope.beneficiaryGroupIds,
        }

        const [claims, evidence] = await Promise.all([this.loadClaims(kpiIds), this.loadEvidence(kpiIds)])

        const matchedClaims: ClaimCandidate[] = claims
            .map(c => ({ ...c, linked: false, verdict: this.explain(this.claimScopeOf(c), asEvidence) }))
            .filter(c => c.verdict.ok)

        // A claim has one location and at most one tag. Evaluate the scope as
        // every (kpi x location) claim it could become; evidence matching any
        // of them is reported.
        const claimTag = scope.tagIds[0] ?? null
        const matchedEvidence: EvidenceCandidate[] = evidence
            .filter(e => e.approval_status !== 'pending')
            .map(e => {
                const evScope = this.evidenceScopeOf(e)
                let best: MatchVerdict = { ok: false, reasons: ['metric'] }
                for (const kpiId of kpiIds) {
                    for (const locationId of scope.locationIds) {
                        const v = this.explain({
                            kpiId,
                            locationId,
                            dateStart: scope.dateStart,
                            dateEnd: scope.dateEnd || null,
                            tagId: claimTag,
                            beneficiaryGroupIds: scope.beneficiaryGroupIds,
                        }, evScope)
                        if (v.ok) { best = v; break }
                        if (v.reasons.length < best.reasons.length) best = v
                    }
                    if (best.ok) break
                }
                return { ...e, linked: false, verdict: best }
            })
            .filter(e => e.verdict.ok)

        return { claims: matchedClaims, evidence: matchedEvidence }
    }

    // ------------------------------------------------------------------
    // Diagnostics: why is / isn't this row connected?
    // ------------------------------------------------------------------

    static async diagnoseEvidence(
        evidenceId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<{ evidence: EvidenceScope & { approval_status: string | null }; candidates: ClaimCandidate[] }> {
        await OrgAccessService.assertEvidenceAccess(evidenceId, userId, requestedOrgId)

        const [{ data: ev }, { data: kpiLinks }, { data: locLinks }, { data: existingLinks }, evTagIds, evBgMap] = await Promise.all([
            supabase.from('evidence').select('id, date_represented, date_range_start, date_range_end, approval_status').eq('id', evidenceId).maybeSingle(),
            supabase.from('evidence_kpis').select('kpi_id').eq('evidence_id', evidenceId),
            supabase.from('evidence_locations').select('location_id').eq('evidence_id', evidenceId),
            supabase.from('evidence_kpi_updates').select('kpi_update_id').eq('evidence_id', evidenceId),
            MetricTagService.getTagIdsForEvidence(evidenceId),
            BeneficiaryService.getBenGroupsForEvidence([evidenceId]),
        ])
        if (!ev) throw new Error('Evidence not found')

        const evScope: EvidenceScope = {
            kpiIds: (kpiLinks || []).map((l: any) => l.kpi_id),
            locationIds: (locLinks || []).map((l: any) => l.location_id),
            dateStart: ((ev as any).date_range_start || (ev as any).date_represented || '') as string,
            dateEnd: ((ev as any).date_range_end || null) as string | null,
            tagIds: evTagIds,
            beneficiaryGroupIds: evBgMap[evidenceId] || [],
        }
        const linked = new Set((existingLinks || []).map((l: any) => l.kpi_update_id as string))

        const claims = await this.loadClaims(evScope.kpiIds)
        const candidates: ClaimCandidate[] = claims.map(c => ({
            ...c,
            linked: linked.has(c.id),
            verdict: this.explain(this.claimScopeOf(c), evScope),
        }))
        candidates.sort((a, b) => Number(b.linked) - Number(a.linked) || a.verdict.reasons.length - b.verdict.reasons.length)

        return { evidence: { ...evScope, approval_status: (ev as any).approval_status ?? null }, candidates }
    }

    static async diagnoseClaim(
        updateId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<{ claim: ClaimScope; candidates: EvidenceCandidate[] }> {
        await OrgAccessService.assertKpiUpdateAccess(updateId, userId, requestedOrgId)

        const [{ data: row }, { data: existingLinks }, tagMap, bgMap] = await Promise.all([
            supabase.from('kpi_updates').select('id, kpi_id, location_id, date_represented, date_range_start, date_range_end').eq('id', updateId).maybeSingle(),
            supabase.from('evidence_kpi_updates').select('evidence_id').eq('kpi_update_id', updateId),
            MetricTagService.getTagIdsForUpdates([updateId]),
            BeneficiaryService.getBenGroupsForUpdates([updateId]),
        ])
        if (!row) throw new Error('Impact claim not found')

        const claim: ClaimScope = {
            kpiId: (row as any).kpi_id,
            locationId: (row as any).location_id ?? null,
            dateStart: ((row as any).date_range_start || (row as any).date_represented || '') as string,
            dateEnd: ((row as any).date_range_end || null) as string | null,
            tagId: tagMap[updateId] ?? null,
            beneficiaryGroupIds: bgMap[updateId] || [],
        }
        const linked = new Set((existingLinks || []).map((l: any) => l.evidence_id as string))

        const evidence = await this.loadEvidence([claim.kpiId])
        const candidates: EvidenceCandidate[] = evidence.map(e => ({
            ...e,
            linked: linked.has(e.id),
            verdict: this.explain(claim, this.evidenceScopeOf(e)),
        }))
        candidates.sort((a, b) => Number(b.linked) - Number(a.linked) || a.verdict.reasons.length - b.verdict.reasons.length)

        return { claim, candidates }
    }
}
