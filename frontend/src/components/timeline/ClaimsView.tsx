import React, { useMemo } from 'react'
import { TrendingUp, BarChart3, Paperclip, Link2 } from 'lucide-react'
import { EmptyState } from '../ui'
import { KPI, Location, TimelineClaim, TimelineContributor, TimelineEvidence } from '../../types'
import { formatDate } from '../../utils'
import {
 TimelineFilters,
 deriveClaimStatus,
 filterClaims,
 groupPackages,
 groupPositionFor,
 hasActiveFilters,
 sortByUploadDate,
} from '../../utils/timeline'
import TimelineRow, { TimelineRowHeader, TimelinePackageHeader } from './TimelineRow'
import EvidenceTypeCounts, { EvidenceTypeCountMap, countEvidenceTypes } from './EvidenceTypeCounts'

interface ClaimsViewProps {
 claims: TimelineClaim[]
 kpis: KPI[]
 locations: Location[]
 /** Full evidence list, used to break each claim's support down by type. */
 evidence: TimelineEvidence[]
 contributors: Record<string, TimelineContributor>
 filters: TimelineFilters
 onOpenClaim: (claim: TimelineClaim, kpi: KPI | undefined) => void
 /** Quick-upload new evidence scoped to this claim. */
 onAddEvidenceToClaim?: (claim: TimelineClaim, kpi: KPI | undefined) => void
 /** Attach an existing unconnected evidence record to this claim. */
 onConnectExistingToClaim?: (claim: TimelineClaim) => void
}

/** All impact claims in the initiative, newest upload first. */
export default function ClaimsView({ claims, kpis, locations, evidence, contributors, filters, onOpenClaim, onAddEvidenceToClaim, onConnectExistingToClaim }: ClaimsViewProps) {
 const kpiById = useMemo(() => new Map(kpis.map(k => [k.id, k])), [kpis])
 const locationById = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations])

 // Per-claim evidence-type breakdown for the glanceable icon strip.
 const typeCountsByClaim = useMemo(() => {
 const evidenceByClaim = new Map<string, TimelineEvidence[]>()
 for (const ev of evidence) {
 for (const claimId of ev.kpi_update_ids || []) {
 const list = evidenceByClaim.get(claimId) || []
 list.push(ev)
 evidenceByClaim.set(claimId, list)
 }
 }
 const map = new Map<string, EvidenceTypeCountMap>()
 for (const [claimId, list] of evidenceByClaim) {
 map.set(claimId, countEvidenceTypes(list))
 }
 return map
 }, [evidence])

 const groups = useMemo(
 () => groupPackages(sortByUploadDate(filterClaims(claims, filters))),
 [claims, filters]
 )

 if (groups.length === 0) {
 return (
 <div className="app-card md:p-8">
 <EmptyState
 icon={TrendingUp}
 title="No impact claims found"
 description={
 hasActiveFilters(filters)
 ? 'Try adjusting your filters or search query'
 : 'Add your first impact claim to start tracking progress'
 }
 />
 </div>
 )
 }

  let flatIndex = 0

  return (
    <div className="app-card overflow-hidden">
      <TimelineRowHeader kindLabel="Claim" />
      <div className="divide-y divide-gray-100">
        {groups.map((group, groupIndex) => (
          <React.Fragment key={group.items[0].id || groupIndex}>
            {group.isPackage && <TimelinePackageHeader count={group.items.length} />}
            {group.items.map((claim, index) => {
              const rowIndex = flatIndex++
 const kpi = kpiById.get(claim.kpi_id)
 const locationName = claim.location_id
 ? locationById.get(claim.location_id) || '—'
 : '—'
 const contributor = claim.user_id ? contributors[claim.user_id] : undefined
 const activityDate = claim.date_range_start && claim.date_range_end
 ? `${formatDate(claim.date_range_start)} – ${formatDate(claim.date_range_end)}`
 : formatDate(claim.date_represented)
 const metricTitle = kpi?.title || 'Unknown metric'
 const typeCounts = typeCountsByClaim.get(claim.id!) || countEvidenceTypes([])

 return (
 <TimelineRow
 key={claim.id}
 leading={
 <div className="p-2 rounded-xl bg-primary-100">
 <BarChart3 className="w-4 h-4 text-primary-800" />
 </div>
 }
 title={
 <>
 <span className="text-base font-semibold text-gray-900 mr-1.5">{claim.value}</span>
 <span>{claim.label || metricTitle}</span>
 </>
 }
 subtitle={claim.label ? (
 // The metric stays visible even when the claim has its own label.
 <span className="inline-flex items-center gap-1">
 <BarChart3 className="w-3 h-3 text-primary-800 flex-shrink-0" />
 {metricTitle}
 </span>
 ) : (claim.note || undefined)}
 whereWhen={{ location: locationName, date: activityDate }}
 uploadedBy={contributor?.name || contributor?.email || '—'}
 connectionSummary={<EvidenceTypeCounts counts={typeCounts} />}
                  status={deriveClaimStatus(claim)}
                  groupPosition={group.isPackage ? groupPositionFor(index, group.items.length) : 'single'}
                  index={rowIndex}
                  onClick={() => onOpenClaim(claim, kpi)}
                  actions={(onAddEvidenceToClaim || onConnectExistingToClaim) ? (
                    <>
                      {onAddEvidenceToClaim && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onAddEvidenceToClaim(claim, kpi)
                          }}
                          className="p-1.5 text-gray-400 hover:text-primary-700 rounded-lg hover:bg-primary-50 transition-all duration-200"
                          title="Add evidence to this claim"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                      )}
                      {onConnectExistingToClaim && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onConnectExistingToClaim(claim)
                          }}
                          className="p-1.5 text-gray-400 hover:text-primary-700 rounded-lg hover:bg-primary-50 transition-all duration-200"
                          title="Connect existing evidence"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  ) : undefined}
                />
 )
 })}
 </React.Fragment>
 ))}
 </div>
 </div>
 )
}
