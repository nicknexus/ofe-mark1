import { Link } from 'react-router-dom'
import { useOrgLinkBase } from '../../../hooks/useOrgLinkBase'
import { BarChart3, ChevronRight, FileText } from 'lucide-react'
import { InitiativeDashboard } from '../../../services/publicApi'
import { formatAbbreviatedMetricTotal } from '../../../utils'
import { generateMetricSlug } from './metricColors'
import { getKPIColor } from '../../metricsDashboard/metricColorPalette'

export function MetricsTab({ dashboard, orgSlug, initiativeSlug, dateQS = '' }: {
    dashboard: InitiativeDashboard;
    orgSlug: string;
    initiativeSlug: string;
    dateQS?: string;
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

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {kpis.map((kpi, index) => {
                const color = getKPIColor(kpi.category, index)
                const metricSlug = generateMetricSlug(kpi.title)
                const isPct = kpi.metric_type === 'percentage'
                const valueLabel = kpi.total_value !== undefined
                    ? `${formatAbbreviatedMetricTotal(kpi.total_value, { isPercentage: isPct })}${isPct ? '%' : ''}`
                    : '—'
                const claims = kpi.update_count || 0
                const evidence = kpi.evidence_count || 0

                return (
                    <Link
                        key={kpi.id}
                        to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${metricSlug}${dateQS}`}
                        className="bg-white rounded-2xl border border-gray-200/70 shadow-card hover:shadow-card-hover hover:border-primary-300/70 hover:-translate-y-0.5 transition-all duration-200 p-5 cursor-pointer group relative flex flex-col h-full"
                    >
                        <ChevronRight className="absolute top-4 right-4 w-5 h-5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />

                        <div className="flex items-start gap-2.5 pr-7 mb-3">
                            <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-2"
                                style={{ backgroundColor: color }}
                            />
                            <p
                                className="text-base font-semibold text-gray-900 leading-snug line-clamp-2"
                                title={kpi.title}
                            >
                                {kpi.title}
                            </p>
                        </div>

                        <div className="flex items-baseline gap-2 mb-3">
                            <span
                                className="text-3xl font-semibold tabular-nums tracking-tight"
                                style={{ color }}
                            >
                                {valueLabel}
                            </span>
                            <span className="text-sm text-gray-400 truncate">
                                {isPct ? 'average' : kpi.unit_of_measurement}
                            </span>
                        </div>

                        <div className="flex items-center gap-4 mt-auto pt-3 border-t border-gray-100 text-sm text-gray-400">
                            <span className="inline-flex items-center gap-1.5">
                                <BarChart3 className="w-4 h-4" />
                                {claims} claim{claims === 1 ? '' : 's'}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <FileText className="w-4 h-4" />
                                {evidence} evidence
                            </span>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}
