import React from 'react'
import { Link } from 'react-router-dom'
import { Tag as TagIcon } from 'lucide-react'
import { MetricTag } from '../../types'
import { aggregateKpiUpdates } from '../../utils/kpiAggregation'

interface TagBreakdownStripProps {
    kpi: any
    kpiUpdates: any[]
    allTags: MetricTag[]
    /** Compact variant uses smaller paddings/text. */
    compact?: boolean
}

/**
 * Read-only breakdown of a metric by its attached tags. Shows one chip per tag
 * (even if no claims yet) plus an "Untagged" bucket if any claims aren't tagged.
 * Each chip shows the tag's aggregated total (sum for number metrics, mean for
 * percentage), respecting the same rule used by the metric total.
 */
export default function TagBreakdownStrip({ kpi, kpiUpdates, allTags, compact }: TagBreakdownStripProps) {
    const kpiTagIds: string[] = (kpi as any).tag_ids || []
    if (kpiTagIds.length === 0) return null

    const groups: Record<string, any[]> = {}
    const untagged: any[] = []
    for (const u of (kpiUpdates || [])) {
        if (u.tag_id) {
            if (!groups[u.tag_id]) groups[u.tag_id] = []
            groups[u.tag_id].push(u)
        } else {
            untagged.push(u)
        }
    }

    const unit = kpi.unit_of_measurement ? ` ${kpi.unit_of_measurement}` : ''
    const isPct = kpi.metric_type === 'percentage'
    const padX = compact ? 'px-2.5' : 'px-3'
    const padY = compact ? 'py-1' : 'py-1.5'
    const titleSize = compact ? 'text-[11px]' : 'text-xs'
    const valueSize = compact ? 'text-xs' : 'text-sm'

    return (
        <div
            className={`bg-white/80 backdrop-blur-xl border border-gray-100/60 rounded-xl ${compact ? 'px-3 py-2' : 'px-4 py-2.5'} shadow-soft-float flex items-center gap-2 overflow-x-auto`}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <TagIcon className="w-3.5 h-3.5 text-gray-400" />
                <span className={`${titleSize} font-semibold text-gray-700 uppercase tracking-wide`}>Tags</span>
            </div>
            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
                {kpiTagIds.map(tid => {
                    const t = allTags.find(t => t.id === tid)
                    const groupClaims = groups[tid] || []
                    const total = aggregateKpiUpdates(groupClaims, kpi.metric_type)
                    const name = t?.name || 'Tag'
                    return (
                        <Link
                            key={tid}
                            to={`/tags/${tid}`}
                            className={`group inline-flex items-center gap-1.5 ${padX} ${padY} rounded-full bg-primary-50/60 hover:bg-primary-100 border border-primary-100 hover:border-primary-200 transition-colors flex-shrink-0`}
                        >
                            <span className={`${titleSize} font-medium text-primary-700 truncate max-w-[140px]`}>{name}</span>
                            <span className={`${valueSize} font-bold text-primary-700`}>
                                {isPct ? `${total}%` : total.toLocaleString()}
                                {!isPct && <span className={`${titleSize} font-normal text-primary-500/70 ml-0.5`}>{unit.trim()}</span>}
                            </span>
                            <span className={`${titleSize} text-primary-500/70`}>· {groupClaims.length}</span>
                        </Link>
                    )
                })}
                {untagged.length > 0 && (
                    <span className={`inline-flex items-center gap-1.5 ${padX} ${padY} rounded-full bg-gray-50 border border-gray-200 flex-shrink-0`} title="Claims with no tag">
                        <span className={`${titleSize} font-medium text-gray-600`}>Untagged</span>
                        <span className={`${valueSize} font-bold text-gray-700`}>
                            {isPct ? `${aggregateKpiUpdates(untagged, kpi.metric_type)}%` : aggregateKpiUpdates(untagged, kpi.metric_type).toLocaleString()}
                            {!isPct && <span className={`${titleSize} font-normal text-gray-400 ml-0.5`}>{unit.trim()}</span>}
                        </span>
                        <span className={`${titleSize} text-gray-400`}>· {untagged.length}</span>
                    </span>
                )}
            </div>
        </div>
    )
}
