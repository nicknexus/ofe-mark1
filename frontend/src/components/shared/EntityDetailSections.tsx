import React from 'react'
import { BarChart3, Calendar, Camera, DollarSign, FileText, MessageSquare, type LucideIcon } from 'lucide-react'
import { Evidence, KPIUpdate, Story } from '../../types'
import { formatDate, getEvidenceTypeInfo } from '../../utils'
import { getEvidenceImageUrl } from '../../utils/timeline'

const TYPE_ICONS: Record<string, LucideIcon> = {
  visual_proof: Camera,
  documentation: FileText,
  testimony: MessageSquare,
  financials: DollarSign,
}

interface DetailColumnProps {
  icon: LucideIcon
  title: string
  count: number
  children: React.ReactNode
  /** Drop body padding so content (e.g. a map) can bleed to the column edges. */
  flush?: boolean
}

export function DetailColumn({ icon: Icon, title, count, children, flush }: DetailColumnProps) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white shadow-card overflow-hidden flex flex-col min-h-0 h-full">
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</h3>
          <span className="app-chip text-[11px] px-1.5 py-0">{count}</span>
        </div>
      </div>
      <div className={`flex-1 overflow-y-auto min-h-0 ${flush ? '' : 'p-4'}`}>
        {children}
      </div>
    </div>
  )
}

export function DetailEmpty({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="text-center py-8">
      <Icon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-xs text-gray-500">{message}</p>
    </div>
  )
}

interface StoriesListProps {
  stories: Story[]
  onStoryClick?: (storyId: string) => void
  onClose?: () => void
}

export function StoriesList({ stories, onStoryClick, onClose }: StoriesListProps) {
  if (stories.length === 0) {
    return <DetailEmpty icon={MessageSquare} message="No stories" />
  }

  return (
    <div className="space-y-2.5">
      {stories.map(story => (
        <div
          key={story.id}
          onClick={() => {
            if (story.id && onStoryClick) {
              onClose?.()
              onStoryClick(story.id)
            }
          }}
          className={`rounded-2xl border border-gray-200/70 bg-white shadow-card overflow-hidden transition-all ${onStoryClick && story.id
            ? 'hover:shadow-card-hover hover:border-primary-200 cursor-pointer'
            : ''
            }`}
        >
          {story.media_url && story.media_type === 'photo' && (
            <div className="w-full h-36 bg-gray-100 overflow-hidden">
              <img src={story.media_url} alt={story.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-3">
            <h4 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">{story.title}</h4>
            {story.description && (
              <p className="text-xs text-gray-600 line-clamp-2 mb-2 leading-relaxed">{story.description}</p>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-2 border-t border-gray-100">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(story.date_represented)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

interface MetricGroup {
  kpi: { id?: string; title?: string; unit_of_measurement?: string }
  updates: KPIUpdate[]
  total: number
}

interface MetricsListProps {
  metricsByKPI: Record<string, MetricGroup>
  onMetricClick?: (kpiId: string) => void
  onClose?: () => void
}

export function MetricsList({ metricsByKPI, onMetricClick, onClose }: MetricsListProps) {
  const groups = Object.values(metricsByKPI)
  if (groups.length === 0) {
    return <DetailEmpty icon={BarChart3} message="No metrics" />
  }

  return (
    <div className="space-y-2.5">
      {groups.map((group, idx) => (
        <div
          key={group.kpi?.id || idx}
          onClick={(e) => {
            e.stopPropagation()
            if (group.kpi?.id && onMetricClick) {
              onClose?.()
              onMetricClick(group.kpi.id)
            }
          }}
          className={`rounded-2xl border border-gray-200/70 bg-white shadow-card p-4 transition-all ${onMetricClick && group.kpi?.id
            ? 'hover:shadow-card-hover hover:border-primary-200 cursor-pointer'
            : ''
            }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{group.kpi?.title || 'Unknown Metric'}</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-semibold text-gray-900 tabular-nums">{group.total.toLocaleString()}</span>
                {group.kpi?.unit_of_measurement && (
                  <span className="text-xs text-gray-400">{group.kpi.unit_of_measurement}</span>
                )}
              </div>
            </div>
            <BarChart3 className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </div>
          <p className="text-xs text-gray-500 pt-2 border-t border-gray-100">
            {group.updates.length} {group.updates.length === 1 ? 'impact claim' : 'impact claims'}
          </p>
        </div>
      ))}
    </div>
  )
}

/** Single evidence row — same chrome as Connections view on the Logs tab. */
function EvidenceRowButton({ ev, onClick }: { ev: Evidence; onClick: () => void }) {
  const typeInfo = getEvidenceTypeInfo(ev.type)
  const Icon = TYPE_ICONS[ev.type] || FileText
  const bgColor = typeInfo.color.split(' ')[0]
  const thumbnailUrl = getEvidenceImageUrl({ ...ev, claim_count: 0 })

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 transition-colors text-left"
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0"
          loading="lazy"
        />
      ) : (
        <div className={`p-2 rounded-lg flex-shrink-0 ${bgColor}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      )}
      <p className="text-xs font-medium text-gray-800 truncate flex-1 min-w-0">
        {ev.title || 'Untitled Evidence'}
      </p>
    </button>
  )
}

interface EvidenceListProps {
  evidence: Evidence[]
  onEvidenceClick: (evidence: Evidence) => void
}

/** Evidence grouped by type, with thumbnail + title rows matching Logs → Connections. */
export function EvidenceList({ evidence, onEvidenceClick }: EvidenceListProps) {
  const evidenceByType: Record<string, Evidence[]> = {}
  evidence.forEach(ev => {
    const type = ev.type || 'other'
    if (!evidenceByType[type]) evidenceByType[type] = []
    evidenceByType[type].push(ev)
  })

  if (Object.keys(evidenceByType).length === 0) {
    return <DetailEmpty icon={FileText} message="No evidence" />
  }

  return (
    <div className="space-y-3">
      {Object.entries(evidenceByType).map(([type, items]) => {
        const typeInfo = getEvidenceTypeInfo(type as Evidence['type'])
        const Icon = TYPE_ICONS[type] || FileText
        const bgColor = typeInfo.color.split(' ')[0]

        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-1.5 px-0.5">
              <div className={`p-1.5 rounded-lg ${bgColor}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-gray-600">{typeInfo.label}</span>
              <span className="text-[11px] text-gray-400">({items.length})</span>
            </div>
            <div className="space-y-1.5">
              {items.map(ev => (
                <EvidenceRowButton key={ev.id} ev={ev} onClick={() => onEvidenceClick(ev)} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
