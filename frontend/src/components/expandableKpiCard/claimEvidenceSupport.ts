import { parseLocalDate, getLocalDateString } from '../../utils'

export function beneficiaryGroupsMatch(claimGroupIds: string[], evidenceGroupIds: string[]): boolean {
    const claimScoped = claimGroupIds.length > 0
    const evidenceScoped = evidenceGroupIds.length > 0
    if (!claimScoped && !evidenceScoped) return true
    if (claimScoped !== evidenceScoped) return false
    return claimGroupIds.some(id => evidenceGroupIds.includes(id))
}

export function evidenceMatchesClaimTag(claimTagId: string | null | undefined, evTagIds: string[]): boolean {
    if (!claimTagId) return true
    if (!evTagIds || evTagIds.length === 0) return false
    return evTagIds.includes(claimTagId)
}

export function getClaimSupportPercentage(claim: any, evidence: any[]): number {
    if (!claim || !claim.id || !evidence || evidence.length === 0) return 0

    const claimGroupIds: string[] = claim.beneficiary_group_ids || []
    const claimTagId: string | null = claim.tag_id || null

    const linkedEvidence = evidence.filter((ev: any) => {
        const evGroupIds: string[] = ev.beneficiary_group_ids || []
        if (!beneficiaryGroupsMatch(claimGroupIds, evGroupIds)) return false
        const evTagIds: string[] = ev.tag_ids || []
        if (!evidenceMatchesClaimTag(claimTagId, evTagIds)) return false

        if (ev.kpi_update_ids && Array.isArray(ev.kpi_update_ids)) {
            return ev.kpi_update_ids.includes(claim.id)
        }
        if (ev.evidence_kpi_updates && Array.isArray(ev.evidence_kpi_updates)) {
            return ev.evidence_kpi_updates.some((link: any) => link.kpi_update_id === claim.id)
        }
        return false
    })

    if (linkedEvidence.length === 0) return 0

    const claimStart = claim.date_range_start
        ? parseLocalDate(claim.date_range_start)
        : parseLocalDate(claim.date_represented)
    const claimEnd = claim.date_range_end
        ? parseLocalDate(claim.date_range_end)
        : parseLocalDate(claim.date_represented)

    const startUTC = Date.UTC(claimStart.getFullYear(), claimStart.getMonth(), claimStart.getDate(), 12, 0, 0)
    const endUTC = Date.UTC(claimEnd.getFullYear(), claimEnd.getMonth(), claimEnd.getDate(), 12, 0, 0)
    const claimDays = Math.round((endUTC - startUTC) / (1000 * 60 * 60 * 24)) + 1

    const coveredDays = new Set<string>()

    linkedEvidence.forEach((ev: any) => {
        if (ev.date_range_start && ev.date_range_end) {
            const evidenceStart = parseLocalDate(ev.date_range_start)
            const evidenceEnd = parseLocalDate(ev.date_range_end)

            const overlapStart = new Date(Math.max(claimStart.getTime(), evidenceStart.getTime()))
            const overlapEnd = new Date(Math.min(claimEnd.getTime(), evidenceEnd.getTime()))

            if (overlapEnd >= overlapStart) {
                for (let d = new Date(overlapStart); d <= overlapEnd; d.setDate(d.getDate() + 1)) {
                    if (d >= claimStart && d <= claimEnd) {
                        coveredDays.add(getLocalDateString(d))
                    }
                }
            }
        } else if (ev.date_represented) {
            const evidenceDate = parseLocalDate(ev.date_represented)
            if (evidenceDate >= claimStart && evidenceDate <= claimEnd) {
                coveredDays.add(ev.date_represented.split('T')[0])
            }
        }
    })

    const percentage = Math.round((coveredDays.size / claimDays) * 100)
    return Math.min(percentage, 100)
}

export function getClaimEvidenceCount(claim: any, evidence: any[]): number {
    if (!claim || !claim.id || !evidence || evidence.length === 0) return 0

    const claimGroupIds: string[] = claim.beneficiary_group_ids || []
    const claimTagId: string | null = claim.tag_id || null

    const linkedEvidence = evidence.filter((ev: any) => {
        const evGroupIds: string[] = ev.beneficiary_group_ids || []
        if (!beneficiaryGroupsMatch(claimGroupIds, evGroupIds)) return false
        const evTagIds: string[] = ev.tag_ids || []
        if (!evidenceMatchesClaimTag(claimTagId, evTagIds)) return false

        if (ev.kpi_update_ids && Array.isArray(ev.kpi_update_ids)) {
            return ev.kpi_update_ids.includes(claim.id)
        }
        if (ev.evidence_kpi_updates && Array.isArray(ev.evidence_kpi_updates)) {
            return ev.evidence_kpi_updates.some((link: any) => link.kpi_update_id === claim.id)
        }
        return false
    })

    return linkedEvidence.length
}
