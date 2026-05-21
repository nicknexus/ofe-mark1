import { Link } from 'react-router-dom'
import { useOrgLinkBase } from '../../../hooks/useOrgLinkBase'
import { BarChart3, ChevronRight } from 'lucide-react'
import { InitiativeDashboard, PublicMetricTag } from '../../../services/publicApi'
import PublicTagChip from '../PublicTagChip'
import { formatAbbreviatedMetricTotal } from '../../../utils'
import { generateMetricSlug } from './metricColors'

export function MetricsTab({ dashboard, orgSlug, initiativeSlug, dateQS = '', tagsById, onTagClick, selectedTagIds }: {
    dashboard: InitiativeDashboard;
    orgSlug: string;
    initiativeSlug: string;
    dateQS?: string;
    tagsById?: Map<string, PublicMetricTag>;
    onTagClick?: (id: string) => void;
    selectedTagIds?: string[];
}) {
    const orgLinkBase = useOrgLinkBase()
    const { kpis } = dashboard

    if (kpis.length === 0) {
        return (
            <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-12 text-center">
                <BarChart3 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No metrics available yet.</p>
            </div>
        )
    }

    const getCategoryConfig = (category: string) => {
        switch (category) {
            case 'impact': return { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', accent: 'text-purple-600' }
            case 'output': return { bg: 'bg-accent/20', text: 'text-accent', border: 'border-accent/30', accent: 'text-accent' }
            case 'input': return { bg: 'bg-evidence-50', text: 'text-evidence-700', border: 'border-evidence-200', accent: 'text-evidence-700' }
            default: return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', accent: 'text-gray-600' }
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {kpis.map((kpi) => {
                const config = getCategoryConfig(kpi.category)
                const metricSlug = generateMetricSlug(kpi.title)

                return (
                    <Link
                        key={kpi.id}
                        to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${metricSlug}${dateQS}`}
                        className="rounded-2xl bg-white border border-gray-200/80 shadow-public hover:shadow-public-hover hover:border-gray-300 transition-all overflow-hidden group cursor-pointer"
                    >
                        {/* Header */}
                        <div className={`px-5 py-3 ${config.bg} border-b ${config.border}`}>
                            <div className="flex items-center justify-between">
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full bg-white border border-gray-200 ${config.text} capitalize`}>
                                    {kpi.category}
                                </span>
                                {kpi.update_count !== undefined && kpi.update_count > 0 && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <BarChart3 className="w-3 h-3" />
                                        {kpi.update_count} data point{kpi.update_count !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-5">
                            <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="font-semibold text-foreground text-lg group-hover:text-accent transition-colors">{kpi.title}</h4>
                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0 mt-1" />
                            </div>
                            {kpi.description && (
                                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{kpi.description}</p>
                            )}

                            {tagsById && kpi.tag_ids && kpi.tag_ids.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3" onClick={(e) => e.preventDefault()}>
                                    {kpi.tag_ids.slice(0, 5).map(id => {
                                        const t = tagsById.get(id)
                                        if (!t) return null
                                        return (
                                            <PublicTagChip
                                                key={id}
                                                name={t.name}
                                                size="sm"
                                                selected={selectedTagIds?.includes(id)}
                                                onClick={onTagClick ? () => onTagClick(id) : undefined}
                                            />
                                        )
                                    })}
                                    {kpi.tag_ids.length > 5 && (
                                        <span className="text-xs text-muted-foreground px-1">+{kpi.tag_ids.length - 5}</span>
                                    )}
                                </div>
                            )}

                            {/* Main Value */}
                            <div className="mb-4">
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-3xl font-bold ${config.accent}`}>
                                        {kpi.total_value !== undefined
                                            ? `${formatAbbreviatedMetricTotal(kpi.total_value, { isPercentage: kpi.metric_type === 'percentage' })}${kpi.metric_type === 'percentage' ? '%' : ''}`
                                            : '—'}
                                    </span>
                                    <span className="text-sm text-muted-foreground">{kpi.metric_type === 'percentage' ? 'average' : kpi.unit_of_measurement}</span>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                                <div className="text-center p-2 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-muted-foreground mb-0.5">Evidence</p>
                                    <p className="text-sm font-semibold text-foreground">{kpi.evidence_count || 0} items</p>
                                </div>
                                <div className="text-center p-2 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-muted-foreground mb-0.5">Coverage</p>
                                    <p className={`text-sm font-semibold ${(kpi.evidence_percentage || 0) >= 50 ? 'text-accent' : 'text-orange-500'}`}>
                                        {kpi.evidence_percentage || 0}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}
