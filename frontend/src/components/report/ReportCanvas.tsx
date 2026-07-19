import React, { useLayoutEffect, useRef, useState } from 'react'
import {
    MapPin,
    Calendar,
    BarChart3,
    Users,
    BookOpen,
    Target,
    Tag,
    TrendingUp,
    Image as ImageIcon
} from 'lucide-react'
import ReportMetricCard, { REPORT_METRIC_CARD_H } from './ReportMetricCard'
import { buildTheme, hexToRgb, formatReportDate } from './reportTheme'

// Wide 16:9 frame. The FRAME is always exactly this size. Content is laid out
// naturally (no fragile height math) and uniformly scaled to fit — so text can
// never overlap; the compact layout keeps scale ≈ 1 so it fills the full width.
export const REPORT_CANVAS_W = 1280
export const REPORT_CANVAS_H = 720
export const REPORT_CANVAS_ID = 'report-canvas'

const MAX_CHART_BARS = 6
const MAX_THEME_GROUPS = 3

export interface CanvasTotal {
    kpi_id: string
    kpi_title: string
    unit_of_measurement: string
    total_value: number
    count: number
    tag_ids?: string[]
    color: string
    metricType?: string
}

export interface CanvasTag {
    id: string
    name: string
    color?: string | null
}

export interface ReportCanvasProps {
    initiativeTitle: string
    organizationName?: string | null
    brandColor?: string | null
    orgLogo?: string | null
    nexusLogo?: string | null
    storyPhoto?: string | null
    mapImage?: string | null
    overviewSummary: string
    metricsNarrative?: string | null
    beneficiaryText?: string | null
    hasBeneficiaryGroups?: boolean
    totals: CanvasTotal[]
    tags?: CanvasTag[]
    story?: {
        title: string
        description?: string
        date_represented: string
        location_name?: string
    } | null
    locations: Array<{ id: string; name: string }>
    dateStart?: string
    dateEnd?: string
    domId?: string
}

export default function ReportCanvas({
    initiativeTitle,
    organizationName,
    brandColor,
    orgLogo,
    nexusLogo,
    storyPhoto,
    mapImage,
    overviewSummary,
    metricsNarrative,
    beneficiaryText,
    hasBeneficiaryGroups = false,
    totals,
    tags = [],
    story,
    locations,
    dateStart,
    dateEnd,
    domId = REPORT_CANVAS_ID
}: ReportCanvasProps) {
    const theme = buildTheme(brandColor)
    const contentRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)

    // Uniformly scale the naturally-laid-out content to fit the locked frame.
    useLayoutEffect(() => {
        const el = contentRef.current
        if (!el) return
        const measure = () => {
            const h = el.offsetHeight
            const w = el.offsetWidth
            if (h === 0 || w === 0) return
            setScale(Math.min(1, REPORT_CANVAS_H / h, REPORT_CANVAS_W / w))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    })

    const dateRangeText = dateStart && dateEnd
        ? `${formatReportDate(dateStart)} — ${formatReportDate(dateEnd)}`
        : formatReportDate(dateStart || dateEnd) || 'All time'
    const generatedOn = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const totalClaims = totals.reduce((sum, t) => sum + (t.count || 0), 0)

    const metricCols = story ? 4 : 5
    const visibleCards = totals.slice(0, metricCols)
    const cardOverflow = totals.length - visibleCards.length

    const chartTotals = [...totals].sort((a, b) => b.total_value - a.total_value).slice(0, MAX_CHART_BARS)
    const chartMax = Math.max(...chartTotals.map(t => t.total_value), 1)

    const themeGroups = tags
        .map(tag => ({ tag, metrics: totals.filter(t => (t.tag_ids || []).includes(tag.id)) }))
        .filter(g => g.metrics.length > 0)
        .slice(0, MAX_THEME_GROUPS)

    const showChart = totals.length >= 2
    const showMap = locations.length > 0 && !!mapImage
    const showNarrative = !!metricsNarrative && totals.length > 0
    const showBeneficiary = hasBeneficiaryGroups && !!beneficiaryText
    const showThemes = themeGroups.length > 0
    const hasBottomRow = showNarrative || showBeneficiary || showThemes

    const fmt = (t: { total_value: number; metricType?: string }) =>
        t.metricType === 'percentage' ? `${Math.round(t.total_value)}%` : t.total_value.toLocaleString()

    const SectionHeader = ({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; title: string }) => (
        <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: theme.tintBg }}>
                <Icon className="w-3.5 h-3.5" style={{ color: theme.ink }} />
            </span>
            <h2 className="text-[13px] font-bold text-gray-900 tracking-tight">{title}</h2>
        </div>
    )

    const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
        <div className={`bg-white rounded-2xl border border-gray-200/70 shadow-card ${className}`}>{children}</div>
    )

    return (
        <div
            id={domId}
            className="bg-white overflow-hidden font-sans antialiased flex items-center justify-center"
            style={{ width: `${REPORT_CANVAS_W}px`, height: `${REPORT_CANVAS_H}px` }}
        >
            <div
                ref={contentRef}
                className="flex flex-col"
                style={{ width: `${REPORT_CANVAS_W}px`, transform: `scale(${scale})`, transformOrigin: 'center center' }}
            >
                {/* ---- Hero header ---- */}
                <div
                    className="flex items-center justify-between px-10 py-5"
                    style={{ background: `linear-gradient(120deg, ${theme.shade} 0%, ${theme.brand} 60%, ${theme.brand} 100%)` }}
                >
                    <div className="flex items-center gap-4 min-w-0 pr-6">
                        {orgLogo && (
                            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center flex-shrink-0 p-2">
                                <img src={orgLogo} alt="" className="w-full h-full object-contain" />
                            </div>
                        )}
                        <div className="min-w-0">
                            {organizationName && (
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/85 mb-1">{organizationName}</p>
                            )}
                            <h1 className="text-[27px] font-bold text-white leading-[1.1] tracking-tight line-clamp-2">{initiativeTitle}</h1>
                        </div>
                    </div>
                    <div className="flex items-stretch gap-3 flex-shrink-0">
                        <HeroStat value={totals.length.toLocaleString()} label="Metrics" />
                        {totalClaims > 0 && <HeroStat value={totalClaims.toLocaleString()} label="Claims" />}
                        {locations.length > 0 && <HeroStat value={locations.length.toLocaleString()} label="Locations" />}
                    </div>
                </div>

                {/* meta strip */}
                <div className="flex items-center justify-between px-10 py-2 border-b border-gray-100" style={{ background: theme.softBg }}>
                    <span className="text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.ink }}>Impact Report</span>
                    <span className="text-[12px] font-medium text-gray-600">{dateRangeText}</span>
                </div>

                {/* ---- Body ---- */}
                <div className="flex gap-5 px-10 py-5">
                    {/* Story column */}
                    {story && (
                        <div className="w-[320px] flex-shrink-0">
                            <Card className="overflow-hidden h-full flex flex-col">
                                {storyPhoto ? (
                                    <div className="w-full h-[172px] overflow-hidden flex-shrink-0">
                                        <img src={storyPhoto} alt="" className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className="w-full h-[96px] flex items-center justify-center flex-shrink-0" style={{ background: theme.tintBg }}>
                                        <ImageIcon className="w-9 h-9" style={{ color: theme.brand }} />
                                    </div>
                                )}
                                <div className="p-5 flex flex-col min-h-0">
                                    <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: theme.ink }}>
                                        <BookOpen className="w-3.5 h-3.5" />
                                        Story from the Field
                                    </div>
                                    <h3 className="text-[18px] font-bold text-gray-900 leading-snug tracking-tight line-clamp-2">{story.title}</h3>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500">
                                        <span className="inline-flex items-center gap-1">
                                            <Calendar className="w-3 h-3 text-gray-400" />
                                            {formatReportDate(story.date_represented)}
                                        </span>
                                        {story.location_name && (
                                            <span className="inline-flex items-center gap-1">
                                                <MapPin className="w-3 h-3 text-gray-400" />
                                                {story.location_name}
                                            </span>
                                        )}
                                    </div>
                                    {story.description && (
                                        <p className="text-[12.5px] text-gray-600 leading-relaxed mt-3 line-clamp-[9]">{story.description}</p>
                                    )}
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* Main column */}
                    <div className="flex-1 min-w-0 flex flex-col gap-5">
                        {/* Overview */}
                        {overviewSummary && (
                            <div>
                                <SectionHeader icon={Target} title="Overview" />
                                <p className="text-[13.5px] text-gray-700 leading-relaxed line-clamp-3">{overviewSummary}</p>
                            </div>
                        )}

                        {/* Key metrics — single row */}
                        {visibleCards.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between">
                                    <SectionHeader icon={BarChart3} title="Key Metrics" />
                                    {cardOverflow > 0 && <p className="text-[10px] text-gray-400 mb-2">+{cardOverflow} more in totals</p>}
                                </div>
                                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${metricCols}, minmax(0, 1fr))` }}>
                                    {visibleCards.map(t => (
                                        <ReportMetricCard
                                            key={t.kpi_id}
                                            title={t.kpi_title}
                                            color={t.color}
                                            total={t.total_value}
                                            unit={t.unit_of_measurement}
                                            metricType={t.metricType}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Chart + map row */}
                        {(showChart || showMap) && (
                            <div className="flex gap-5">
                                {showChart && (
                                    <div className="flex-1 min-w-0">
                                        <SectionHeader icon={TrendingUp} title="Metric Totals" />
                                        <Card className="p-4">
                                            <div className="space-y-2.5">
                                                {chartTotals.map(t => {
                                                    const pct = Math.max((t.total_value / chartMax) * 100, 2)
                                                    return (
                                                        <div key={t.kpi_id} className="flex items-center gap-3">
                                                            <p className="w-44 text-[11.5px] text-gray-600 truncate flex-shrink-0" title={t.kpi_title}>{t.kpi_title}</p>
                                                            <div className="flex-1 h-3.5 rounded-full bg-gray-100 overflow-hidden">
                                                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: t.color }} />
                                                            </div>
                                                            <p className="w-20 text-right text-[12px] font-semibold text-gray-900 tabular-nums flex-shrink-0">{fmt(t)}</p>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </Card>
                                    </div>
                                )}
                                {showMap && (
                                    <div className="w-[300px] flex-shrink-0">
                                        <SectionHeader icon={MapPin} title="Where We Worked" />
                                        <Card className="overflow-hidden">
                                            <div className="w-full h-[150px] overflow-hidden bg-gray-100">
                                                <img src={mapImage!} alt="Map of impact locations" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 p-3">
                                                {locations.slice(0, 6).map(loc => (
                                                    <span
                                                        key={loc.id}
                                                        className="text-[10.5px] font-medium text-gray-700 rounded-full px-2 py-0.5"
                                                        style={{ background: theme.softBg, border: `1px solid ${theme.border}` }}
                                                    >
                                                        {loc.name}
                                                    </span>
                                                ))}
                                                {locations.length > 6 && <span className="text-[10.5px] text-gray-400 px-1 py-0.5">+{locations.length - 6}</span>}
                                            </div>
                                        </Card>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Bottom row: narrative / beneficiary / themes */}
                        {hasBottomRow && (
                            <div className="flex gap-5">
                                {showNarrative && (
                                    <div className="flex-1 min-w-0">
                                        <SectionHeader icon={Target} title="What These Numbers Mean" />
                                        <Card className="p-4">
                                            <p className="text-[12px] text-gray-600 leading-relaxed line-clamp-4">{metricsNarrative}</p>
                                        </Card>
                                    </div>
                                )}
                                {showBeneficiary && (
                                    <div className="flex-1 min-w-0">
                                        <SectionHeader icon={Users} title="Who We Reached" />
                                        <Card className="p-4">
                                            <p className="text-[12px] text-gray-600 leading-relaxed line-clamp-4">{beneficiaryText}</p>
                                        </Card>
                                    </div>
                                )}
                                {showThemes && (
                                    <div className="flex-1 min-w-0">
                                        <SectionHeader icon={Tag} title="Impact by Theme" />
                                        <Card className="p-4 space-y-2">
                                            {themeGroups.map(({ tag, metrics }) => {
                                                const { r, g, b } = hexToRgb(tag.color || undefined)
                                                const hasColor = !!tag.color
                                                const chipInk = hasColor ? `rgb(${Math.round(r * 0.7)}, ${Math.round(g * 0.7)}, ${Math.round(b * 0.7)})` : theme.ink
                                                return (
                                                    <div key={tag.id}>
                                                        <span
                                                            className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-semibold px-2 py-0.5 mb-1"
                                                            style={{ color: chipInk, background: hasColor ? `rgba(${r}, ${g}, ${b}, 0.12)` : theme.tintBg }}
                                                        >
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: tag.color || theme.brand }} />
                                                            {tag.name}
                                                        </span>
                                                        {metrics.slice(0, 2).map(m => (
                                                            <div key={m.kpi_id} className="flex items-baseline justify-between gap-2">
                                                                <p className="text-[11.5px] text-gray-600 truncate">{m.kpi_title}</p>
                                                                <p className="text-[12px] font-semibold tabular-nums flex-shrink-0" style={{ color: m.color }}>{fmt(m)}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )
                                            })}
                                        </Card>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ---- Footer ---- */}
                <div className="flex items-center justify-between px-10 py-3 border-t border-gray-100">
                    <p className="text-[11px] text-gray-400">{organizationName ? `${organizationName}  ·  ` : ''}Generated on {generatedOn}</p>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-gray-400">Powered by</span>
                        {nexusLogo && <img src={nexusLogo} alt="" className="h-4 w-auto object-contain" />}
                        <span className="text-[12px] font-semibold text-gray-700">Nexus Impacts</span>
                        <span className="text-[11px] text-gray-400">· Know Your Mark On The World</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function HeroStat({ value, label }: { value: string; label: string }) {
    return (
        <div className="rounded-xl px-4 py-2 bg-white/15 border border-white/20 text-center min-w-[80px] flex flex-col justify-center">
            <p className="text-[22px] font-bold text-white tabular-nums leading-none">{value}</p>
            <p className="text-[10px] font-semibold text-white/80 mt-1 uppercase tracking-wide">{label}</p>
        </div>
    )
}

export { REPORT_METRIC_CARD_H }
