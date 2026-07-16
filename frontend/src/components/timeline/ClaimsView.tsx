import React, { useMemo } from 'react'
import { TrendingUp, Paperclip, Link2 } from 'lucide-react'
import { EmptyState } from '../ui'
import { KPI, Location, TimelineClaim, TimelineContributor, TimelineEvidence } from '../../types'
import { formatDate } from '../../utils'
import {
  TimelineFilters,
  deriveClaimStatus,
  filterClaims,
  hasActiveFilters,
  sortByMode,
} from '../../utils/timeline'
import TimelineRow, { TimelineRowHeader } from './TimelineRow'
import EvidenceTypeCounts, { EvidenceTypeCountMap, countEvidenceTypes } from './EvidenceTypeCounts'
import MetricChip from './MetricChip'

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

  const rows = useMemo(
    () => sortByMode(filterClaims(claims, filters), filters.orderMode),
    [claims, filters]
  )

  if (rows.length === 0) {
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

  return (
    <div className="app-card overflow-hidden">
      <TimelineRowHeader kindLabel="Claim" layout="claim" />
      <div className="divide-y divide-gray-100">
        {rows.map((claim, index) => {
          const kpi = kpiById.get(claim.kpi_id)
          const locationName = claim.location_id
            ? locationById.get(claim.location_id) || '—'
            : '—'
          const contributor = claim.user_id ? contributors[claim.user_id] : undefined
          const activityDate = claim.date_range_start && claim.date_range_end
            ? `${formatDate(claim.date_range_start)} – ${formatDate(claim.date_range_end)}`
            : formatDate(claim.date_represented)
          const typeCounts = typeCountsByClaim.get(claim.id!) || countEvidenceTypes([])
          const isPct = kpi?.metric_type === 'percentage'
          const unit = isPct ? '' : (kpi?.unit_of_measurement || '')
          const connected = deriveClaimStatus(claim) === 'connected'

          return (
            <TimelineRow
              key={claim.id}
              layout="claim"
              title={
                <span className="inline-flex items-baseline gap-1">
                  <span className="text-lg font-bold text-gray-900 tabular-nums">
                    {claim.value}{isPct ? '%' : ''}
                  </span>
                  {unit && <span className="text-sm text-gray-500">{unit}</span>}
                </span>
              }
              metric={<MetricChip kpi={kpi} kpis={kpis} />}
              whereWhen={{ location: locationName, date: activityDate }}
              uploadedBy={contributor?.name || contributor?.email || '—'}
              connectionSummary={connected || !onAddEvidenceToClaim ? (
                <EvidenceTypeCounts counts={typeCounts} />
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddEvidenceToClaim(claim, kpi)
                  }}
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium bg-primary-50 text-primary-800 border border-primary-200 hover:bg-primary-100 transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5 flex-shrink-0" />
                  Add evidence
                </button>
              )}
              status={deriveClaimStatus(claim)}
              index={index}
              onClick={() => onOpenClaim(claim, kpi)}
              actions={(onAddEvidenceToClaim || onConnectExistingToClaim) ? (
                <>
                  {onAddEvidenceToClaim && connected && (
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
      </div>
    </div>
  )
}
