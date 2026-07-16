import React, { useMemo } from 'react'
import { FileText, Camera, MessageSquare, DollarSign } from 'lucide-react'
import { EmptyState } from '../ui'
import { getStatusStyle } from './statusStyles'
import { KPI, Location, TimelineContributor, TimelineEvidence } from '../../types'
import { formatDate, getEvidenceTypeInfo } from '../../utils'
import {
  TimelineFilters,
  deriveEvidenceStatus,
  filterEvidence,
  getEvidenceImageUrl,
  hasActiveFilters,
  sortByMode,
} from '../../utils/timeline'
import TimelineRow, { TimelineRowHeader } from './TimelineRow'
import MetricChip from './MetricChip'
import type { EvidenceViewMode } from './EvidenceViewModeToggle'

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
  mode: EvidenceViewMode
  onOpenEvidence: (evidence: TimelineEvidence) => void
}

/** All evidence in the initiative, newest upload first. */
export default function EvidenceView({ evidence, kpis, locations, contributors, filters, mode, onOpenEvidence }: EvidenceViewProps) {
  const locationById = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations])
  const kpiById = useMemo(() => new Map(kpis.map(k => [k.id, k])), [kpis])

  const rows = useMemo(
    () => sortByMode(filterEvidence(evidence, filters), filters.orderMode),
    [evidence, filters]
  )

  if (rows.length === 0) {
    return (
      <div className="app-card overflow-hidden">
        <TimelineRowHeader kindLabel="Evidence" />
        <div className="md:p-8">
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
      </div>
    )
  }

  if (mode === 'gallery') {
    return (
      <div className="app-card overflow-hidden">
        <TimelineRowHeader kindLabel="Evidence" />
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {rows.map(ev => {
            const typeInfo = getEvidenceTypeInfo(ev.type)
            const bgColor = typeInfo.color.split(' ')[0]
            const Icon = TYPE_ICONS[ev.type] || FileText
            const thumbnailUrl = getEvidenceImageUrl(ev)
            const style = getStatusStyle(deriveEvidenceStatus(ev))
            const StatusIcon = style.icon
            return (
              <button
                key={ev.id}
                onClick={() => onOpenEvidence(ev)}
                className={`app-card-interactive overflow-hidden text-left flex flex-col border ${style.card}`}
              >
                <div className="relative aspect-[4/3] bg-gray-100 flex items-center justify-center">
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className={`p-4 rounded-2xl ${bgColor}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  )}
                  <span
                    className={`absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      style.badge ?? `bg-white/90 ${style.accent}`
                    }`}
                  >
                    <StatusIcon className={`w-3 h-3 ${style.badge ? style.accent : ''}`} />
                    {style.label}
                  </span>
                </div>
                <div className="p-2.5 min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">{ev.title || 'Untitled Evidence'}</p>
                  <p className="text-[11px] text-gray-500 truncate">{typeInfo.label}</p>
                </div>
              </button>
            )
          })}
        </div>
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
