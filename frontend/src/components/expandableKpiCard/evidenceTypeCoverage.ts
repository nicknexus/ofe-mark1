import { beneficiaryGroupsMatch, evidenceMatchesClaimTag } from './claimEvidenceSupport'

export type EvidenceTypeCoverageKey = 'visual_proof' | 'documentation' | 'testimony' | 'financials'

export type EvidenceTypePercentages = Record<
    EvidenceTypeCoverageKey,
    { count: number; percentage: number }
>

const EMPTY: EvidenceTypePercentages = {
    visual_proof: { count: 0, percentage: 0 },
    documentation: { count: 0, percentage: 0 },
    testimony: { count: 0, percentage: 0 },
    financials: { count: 0, percentage: 0 },
}

export function calculateEvidenceTypePercentages(params: {
    kpiId: string
    kpiUpdates: any[]
    evidence: any[]
}): EvidenceTypePercentages {
    const { kpiId, kpiUpdates, evidence } = params
    const totalDataPoints = kpiUpdates?.length || 0

    if (!evidence || evidence.length === 0 || totalDataPoints === 0) {
        return EMPTY
    }

    const dataPointsCoveredByType: Record<string, Set<string>> = {
        visual_proof: new Set(),
        documentation: new Set(),
        testimony: new Set(),
        financials: new Set(),
    }

    const validUpdateIds = new Set(kpiUpdates.map((update: any) => update.id).filter(Boolean))

    const updateById = new Map<string, any>()
    kpiUpdates.forEach((u: any) => {
        if (u.id) updateById.set(u.id, u)
    })

    const tryCover = (ev: any, updateId: string) => {
        if (!validUpdateIds.has(updateId)) return
        const claim = updateById.get(updateId)
        if (!claim) return
        const claimGroupIds: string[] = claim.beneficiary_group_ids || []
        const evGroupIds: string[] = ev.beneficiary_group_ids || []
        if (!beneficiaryGroupsMatch(claimGroupIds, evGroupIds)) return
        const claimTagId: string | null = claim.tag_id || null
        const evTagIds: string[] = ev.tag_ids || []
        if (!evidenceMatchesClaimTag(claimTagId, evTagIds)) return
        dataPointsCoveredByType[ev.type as keyof typeof dataPointsCoveredByType].add(updateId)
    }

    evidence.forEach((ev: any) => {
        if (!ev.type || !Object.prototype.hasOwnProperty.call(dataPointsCoveredByType, ev.type)) return

        if (ev.kpi_update_ids && Array.isArray(ev.kpi_update_ids)) {
            ev.kpi_update_ids.forEach((updateId: string) => tryCover(ev, updateId))
        } else if (ev.evidence_kpi_updates && Array.isArray(ev.evidence_kpi_updates)) {
            ev.evidence_kpi_updates.forEach((link: any) => {
                if (link.kpi_update_id) tryCover(ev, link.kpi_update_id)
            })
        } else if (kpiId && ev.kpi_ids?.includes(kpiId)) {
            kpiUpdates.forEach((update: any) => {
                if (update.id) tryCover(ev, update.id)
            })
        }
    })

    return {
        visual_proof: {
            count: dataPointsCoveredByType.visual_proof.size,
            percentage:
                totalDataPoints > 0
                    ? Math.round((dataPointsCoveredByType.visual_proof.size / totalDataPoints) * 100)
                    : 0,
        },
        documentation: {
            count: dataPointsCoveredByType.documentation.size,
            percentage:
                totalDataPoints > 0
                    ? Math.round((dataPointsCoveredByType.documentation.size / totalDataPoints) * 100)
                    : 0,
        },
        testimony: {
            count: dataPointsCoveredByType.testimony.size,
            percentage:
                totalDataPoints > 0
                    ? Math.round((dataPointsCoveredByType.testimony.size / totalDataPoints) * 100)
                    : 0,
        },
        financials: {
            count: dataPointsCoveredByType.financials.size,
            percentage:
                totalDataPoints > 0
                    ? Math.round((dataPointsCoveredByType.financials.size / totalDataPoints) * 100)
                    : 0,
        },
    }
}
