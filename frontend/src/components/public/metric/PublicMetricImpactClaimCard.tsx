import { Link } from 'react-router-dom'
import { Calendar, CheckCircle2, MapPin } from 'lucide-react'
import { useOrgLinkBase } from '../../../hooks/useOrgLinkBase'
import { formatDate } from '../../../utils'
import { PublicMetricTag } from '../../../services/publicApi'
import PublicTagChip from '../PublicTagChip'
import type { MetricCategoryVisual } from './metricCategoryConfig'

export function PublicMetricImpactClaimCard({ update, unit, isPercentage, config, orgSlug, initiativeSlug, tag, selectedTagIds, onToggleTag }: {
    update: any
    unit: string
    isPercentage?: boolean
    config: MetricCategoryVisual
    orgSlug: string
    initiativeSlug: string
    tag?: PublicMetricTag
    selectedTagIds?: string[]
    onToggleTag?: (id: string) => void
}) {
    const orgLinkBase = useOrgLinkBase()
    const hasDateRange = update.date_range_start && update.date_range_end
    const displayDate = hasDateRange
        ? `${formatDate(update.date_range_start, { month: 'short', day: 'numeric' })} - ${formatDate(update.date_range_end)}`
        : formatDate(update.date_represented)

    return (
        <Link
            to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/claim/${update.id}`}
            className="block p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white border border-gray-200/80 shadow-public hover:shadow-public-hover hover:border-gray-300 transition-all group active:scale-[0.98]"
        >
            <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                        <span className={`text-lg sm:text-xl font-bold ${config.text}`}>
                            {isPercentage ? '' : '+'}{parseFloat(update.value).toLocaleString()}{isPercentage ? '%' : ''}
                        </span>
                        {!isPercentage && <span className="text-xs text-gray-500">{unit}</span>}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 text-xs text-gray-500">
                        <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span>{displayDate}</span>
                    </div>
                </div>
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-accent/50 group-hover:text-accent transition-colors flex-shrink-0" />
            </div>
            {update.location && (
                <div className="mt-1.5 sm:mt-2 flex items-center gap-1 text-xs text-gray-500">
                    <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span>{update.location.name}</span>
                </div>
            )}
            {tag && (
                <div className="mt-1.5 sm:mt-2 flex">
                    <PublicTagChip
                        name={tag.name}
                        size="xs"
                        selected={selectedTagIds?.includes(tag.id)}
                        onClick={onToggleTag ? () => onToggleTag(tag.id) : undefined}
                    />
                </div>
            )}
            {update.note && (
                <p className="mt-1.5 sm:mt-2 text-xs text-gray-500 line-clamp-2 italic">{`"${update.note}"`}</p>
            )}
        </Link>
    )
}
