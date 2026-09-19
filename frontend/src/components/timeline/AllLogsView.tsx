import React, { useMemo } from 'react'
import { FileText, TrendingUp, ChevronRight, Clock } from 'lucide-react'
import { KPI, Location, TimelineClaim, TimelineEvidence } from '../../types'
import { formatDate } from '../../utils'
import { filterClaims, filterEvidence, getEvidenceImageUrl, hasActiveFilters, sortByMode, TimelineFilters } from '../../utils/timeline'
import { EmptyState } from '../ui'

interface AllLogsViewProps {
 claims: TimelineClaim[]
 evidence: TimelineEvidence[]
 kpis: KPI[]
 locations: Location[]
 filters: TimelineFilters
 onOpenClaim: (claim: TimelineClaim, kpi: KPI | undefined) => void
 onOpenEvidence: (evidence: TimelineEvidence) => void
}

/** Saved records stay visible whether or not they have a support relationship. */
export default function AllLogsView({ claims, evidence, kpis, locations, filters, onOpenClaim, onOpenEvidence }: AllLogsViewProps) {
 const rows = useMemo(() => sortByMode([
  ...(filters.evidenceTypes.length ? [] : filterClaims(claims, filters)).map(record => ({ ...record, kind: 'claim' as const, record })),
  ...filterEvidence(evidence, filters).map(record => ({ ...record, kind: 'evidence' as const, record })),
 ], filters.orderMode), [claims, evidence, filters])
 const kpiById = useMemo(() => new Map(kpis.map(k => [k.id, k])), [kpis])
 const locationById = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations])

 if (rows.length === 0) return (
  <div className="app-card p-6">
   <EmptyState icon={FileText} title="No logs yet" description={hasActiveFilters(filters) ? 'Try adjusting your filters.' : 'Add photos, documents or results. You can fill in more details later.'} />
  </div>
 )

 return (
  <div className="app-card overflow-hidden divide-y divide-gray-100">
   {rows.map(row => {
    const claim = row.kind === 'claim' ? row.record : null
    const ev = row.kind === 'evidence' ? row.record : null
    const metric = claim ? kpiById.get(claim.kpi_id) : undefined
    const image = ev ? getEvidenceImageUrl(ev) : null
    const locationIds = ev ? ev.location_ids || (ev.location_id ? [ev.location_id] : []) : claim?.location_id ? [claim.location_id] : []
    const locationLabel = locationIds.map(id => locationById.get(id)).filter(Boolean).join(', ')
    const dateLabel = row.date_range_start && row.date_range_end
     ? `${formatDate(row.date_range_start)} to ${formatDate(row.date_range_end)}` : formatDate(row.date_represented)
    const pending = ev?.approval_status === 'pending'
    const status = pending ? 'Needs approval'
     : ev && !ev.kpi_ids?.length ? 'Assign a metric'
     : ev && !locationIds.length ? 'Add a location'
     : claim && claim.evidence_count === 0 ? 'Evidence can be added later' : 'Saved'
    return (
     <button key={`${row.kind}-${row.id}`} type="button" onClick={() => ev ? onOpenEvidence(ev) : claim && onOpenClaim(claim, metric)} className="w-full text-left p-4 sm:px-5 flex items-center gap-3 hover:bg-gray-50 transition-colors">
      {image ? <img src={image} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" /> : <span className="app-icon-tile shrink-0">{claim ? <TrendingUp className="w-5 h-5" /> : <FileText className="w-5 h-5" />}</span>}
      <span className="min-w-0 flex-1">
       <span className="block text-xs text-secondary-500 mb-0.5">{claim ? 'Result' : 'Evidence'}</span>
       <span className="block text-sm font-semibold text-secondary-900 break-words">{ev ? ev.title || 'Untitled evidence' : `${claim?.value}${metric?.metric_type === 'percentage' ? '%' : ''} ${metric?.title || 'Result'}`}</span>
       <span className="block text-xs text-secondary-500 mt-1">{[locationLabel, dateLabel].filter(Boolean).join(' · ')}</span>
       <span className={`inline-flex items-center gap-1 text-xs mt-2 ${pending ? 'text-amber-700' : 'text-secondary-500'}`}>{pending && <Clock className="w-3 h-3" />}{status}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-secondary-400 shrink-0" />
     </button>
    )
   })}
  </div>
 )
}
