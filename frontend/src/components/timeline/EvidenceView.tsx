import React, { useMemo } from 'react'
import { FileText, Camera, MessageSquare, DollarSign } from 'lucide-react'
import { EmptyState } from '../ui'
import { KPI, Location, TimelineContributor, TimelineEvidence } from '../../types'
import { formatDate, getEvidenceTypeInfo } from '../../utils'
import {
  TimelineFilters,
  deriveEvidenceStatus,
  filterEvidence,
  getEvidenceImageUrl,
  hasActiveFilters,
  sortByUploadDate,
} from '../../utils/timeline'
import TimelineRow, { TimelineRowHeader } from './TimelineRow'
import MetricChip from './MetricChip'

const TYPE_ICONS = {
  visual_proof: Camera,
  documentation: FileText,
  testimony: MessageSquare,
  financials: DollarSign,
} as const

interface EvidenceViewProps {
  evidence: TimelineEvidence[]
  kpis: KPI[]
  locations: Location[]
  contributors: Record<string, TimelineContributor>
  filters: TimelineFilters
  onOpenEvidence: (evidence: TimelineEvidence) => void
}

/** All evidence in the initiative, newest upload first. */
export default function EvidenceView({ evidence, kpis, locations, contributors, filters, onOpenEvidence }: EvidenceViewProps) {
  const locationById = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations])
  const kpiById = useMemo(() => new Map(kpis.map(k => [k.id, k])), [kpis])

  const rows = useMemo(
    () => sortByUploadDate(filterEvidence(evidence, filters)),
    [evidence, filters]
  )

  if (rows.length === 0) {
    return (
      <div className="app-card md:p-8">
        <EmptyState
          icon={FileText}
          title="No evidence found"
          description={
            hasActiveFilters(filters)
              ? 'Try adjusting your filters or search query'
              : 'Upload your first evidence to support your impact claims'
          }
        />
      </div>
    )
  }

  return (
    <div className="app-card overflow-hidden">
      <TimelineRowHeader kindLabel="Evidence" />
      <div className="divide-y divide-gray-100">
        {rows.map((ev, index) => {
          const typeInfo = getEvidenceTypeInfo(ev.type)
          const bgColor = typeInfo.color.split(' ')[0]
          const Icon = TYPE_ICONS[ev.type] || FileText
          const thumbnailUrl = getEvidenceImageUrl(ev)

          const locationIds = ev.location_ids || (ev.location_id ? [ev.location_id] : [])
          const locationNames = locationIds
            .map(id => locationById.get(id))
            .filter(Boolean)
          const locationLabel = locationNames.length === 0
            ? '—'
            : locationNames.length === 1
              ? locationNames[0]!
              : `${locationNames.length} locations`

          const metricKpis = (ev.kpi_ids || [])
            .map(id => kpiById.get(id))
            .filter(Boolean) as KPI[]

          const contributor = ev.user_id ? contributors[ev.user_id] : undefined
          const activityDate = ev.date_range_start && ev.date_range_end
            ? `${formatDate(ev.date_range_start)} – ${formatDate(ev.date_range_end)}`
            : formatDate(ev.date_represented)
          const count = ev.claim_count

          return (
            <TimelineRow
              key={ev.id}
              leading={
                thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt=""
                    className="w-10 h-10 rounded-xl object-cover bg-gray-100"
                    loading="lazy"
                  />
                ) : (
                  <div className={`p-2 rounded-xl ${bgColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                )
              }
              title={ev.title || 'Untitled Evidence'}
              subtitle={typeInfo.label}
              metric={metricKpis.length === 0 ? (
                <span className="text-sm text-gray-400">—</span>
              ) : (
                <span className="inline-flex items-center gap-1 min-w-0">
                  <MetricChip kpi={metricKpis[0]} kpis={kpis} />
                  {metricKpis.length > 1 && (
                    <span className="text-[11px] text-gray-400 flex-shrink-0">+{metricKpis.length - 1}</span>
                  )}
                </span>
              )}
              whereWhen={{ location: locationLabel, date: activityDate }}
              uploadedBy={contributor?.name || contributor?.email || '—'}
              connectionSummary={`${count} ${count === 1 ? 'claim' : 'claims'}`}
              status={deriveEvidenceStatus(ev)}
              index={index}
              onClick={() => onOpenEvidence(ev)}
            />
          )
        })}
      </div>
    </div>
  )
}
