import React from 'react'
import { MapPin, Calendar, Users, BarChart3, FileText, Tag as TagIcon } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { InitiativeDashboard } from '../types'

interface ReportTag {
    id: string
    name: string
    color?: string | null
}

interface ReportBranding {
    name?: string
    logo_url?: string
    brand_color?: string
}

interface ReportDashboardProps {
    dashboard: InitiativeDashboard
    organization?: ReportBranding | null
    tags?: ReportTag[]
    overviewSummary: string
    totals: Array<{
        kpi_id: string
        kpi_title: string
        kpi_description?: string
        unit_of_measurement: string
        total_value: number
        count: number
        tag_ids?: string[]
    }>
    beneficiaryText: string
    hasBeneficiaryGroups?: boolean
    selectedStory?: {
        id: string
        title: string
        description?: string
        date_represented: string
        location_name?: string
        media_url?: string
        media_type?: 'photo' | 'video' | 'recording'
    } | null
    locations: Array<{
        id: string
        name: string
        description?: string
        latitude: number
        longitude: number
    }>
    dateStart?: string
    dateEnd?: string
    mapImage?: string | null
    // Edit mode props
    isEditing?: boolean
    onOverviewChange?: (text: string) => void
    onBeneficiaryTextChange?: (text: string) => void
    onStoryTitleChange?: (text: string) => void
    onStoryDescriptionChange?: (text: string) => void
}

// Default Nexus brand green — used as the fallback when a charity hasn't set
// a brand colour yet.
const DEFAULT_BRAND = '#608341'

// Parse a #RGB or #RRGGBB string into rgb components. Returns the default
// green's components for anything we can't parse so styling never breaks.
function hexToRgb(hex?: string): { r: number; g: number; b: number } {
    const fallback = { r: 96, g: 131, b: 65 }
    if (!hex) return fallback
    let h = hex.trim().replace('#', '')
    if (h.length === 3) h = h.split('').map(c => c + c).join('')
    if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return fallback
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
    }
}

export default function ReportDashboard({
    dashboard,
    organization,
    tags = [],
    overviewSummary,
    totals,
    beneficiaryText,
    hasBeneficiaryGroups = false,
    selectedStory,
    locations,
    dateStart,
    dateEnd,
    mapImage,
    isEditing = false,
    onOverviewChange,
    onBeneficiaryTextChange,
    onStoryTitleChange,
    onStoryDescriptionChange
}: ReportDashboardProps) {
    const brand = organization?.brand_color || DEFAULT_BRAND
    const { r, g, b } = hexToRgb(brand)
    // Brand-derived tints so the whole report adapts to the charity colour.
    const rgba = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`
    const softBg = rgba(0.06)
    const tintBg = rgba(0.1)
    const cardBorder = rgba(0.18)
    const pageBg = `linear-gradient(180deg, ${rgba(0.05)} 0%, #ffffff 220px)`

    const tagById = new Map(tags.map(t => [t.id, t]))

    const formatDate = (dateStr?: string): string => {
        if (!dateStr) return ''
        try {
            const date = new Date(dateStr)
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        } catch {
            return dateStr
        }
    }

    const dateRangeText = dateStart && dateEnd
        ? `${formatDate(dateStart)} - ${formatDate(dateEnd)}`
        : dateStart || dateEnd || 'Date range not specified'

    // Shared card styling for a clean, modern surface.
    const cardStyle: React.CSSProperties = {
        background: '#ffffff',
        border: `1px solid ${cardBorder}`,
        borderRadius: '16px',
        boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04), 0 8px 24px rgba(16, 24, 40, 0.06)'
    }

    // A small section heading with a brand-coloured icon.
    const SectionHeading = ({ icon: Icon, children }: { icon: any; children: React.ReactNode }) => (
        <div className="flex items-center gap-2 mb-2.5">
            <div
                className="flex items-center justify-center rounded-lg"
                style={{ width: '24px', height: '24px', background: tintBg, flexShrink: 0 }}
            >
                <Icon className="w-3.5 h-3.5" style={{ color: brand }} />
            </div>
            <h2 className="font-bold" style={{ fontSize: '13px', color: '#111827', letterSpacing: '-0.2px', margin: 0 }}>
                {children}
            </h2>
        </div>
    )

    // A colored tag pill.
    const TagChip = ({ tag, size = 'sm' }: { tag: ReportTag; size?: 'sm' | 'md' }) => {
        const c = tag.color || brand
        const { r: tr, g: tg, b: tb } = hexToRgb(c)
        return (
            <span
                className="inline-flex items-center gap-1 font-semibold rounded-full"
                style={{
                    fontSize: size === 'md' ? '10px' : '8px',
                    padding: size === 'md' ? '3px 9px' : '2px 7px',
                    color: c,
                    background: `rgba(${tr}, ${tg}, ${tb}, 0.12)`,
                    border: `1px solid rgba(${tr}, ${tg}, ${tb}, 0.25)`,
                    lineHeight: 1.2
                }}
            >
                <span
                    className="inline-block rounded-full flex-shrink-0"
                    style={{ width: size === 'md' ? '6px' : '5px', height: size === 'md' ? '6px' : '5px', background: c }}
                />
                {tag.name}
            </span>
        )
    }

    // A single metric stat card with its tag chips.
    const MetricCard = ({ total }: { total: ReportDashboardProps['totals'][0] }) => {
        const metricTags = (total.tag_ids || []).map(id => tagById.get(id)).filter(Boolean) as ReportTag[]
        return (
            <div
                style={{ ...cardStyle, padding: '12px', minHeight: '92px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
                <div
                    className="font-semibold"
                    style={{
                        fontSize: '10px',
                        color: '#6b7280',
                        lineHeight: '1.3',
                        wordBreak: 'break-word',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        minHeight: '26px'
                    }}
                    title={total.kpi_title}
                >
                    {total.kpi_title}
                </div>
                <div>
                    <div className="font-bold" style={{ fontSize: '22px', color: '#111827', lineHeight: '1.1', letterSpacing: '-0.5px' }}>
                        {total.total_value.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '9px', color: '#9ca3af', marginTop: '1px' }}>
                        {total.unit_of_measurement}
                    </div>
                </div>
                {metricTags.length > 0 && (
                    <div className="flex flex-wrap gap-1" style={{ marginTop: '8px' }}>
                        {metricTags.map(t => <TagChip key={t.id} tag={t} />)}
                    </div>
                )}
            </div>
        )
    }

    // Metric totals grouped under each theme/tag heading.
    const themeGroups = tags
        .map(tag => ({
            tag,
            metrics: totals.filter(t => (t.tag_ids || []).includes(tag.id))
        }))
        .filter(group => group.metrics.length > 0)

    const ThemeBreakdown = () => {
        if (themeGroups.length === 0) return null
        return (
            <div style={{ ...cardStyle, padding: '14px' }}>
                <SectionHeading icon={TagIcon}>Impact by Theme</SectionHeading>
                <div className="grid grid-cols-2 gap-2.5">
                    {themeGroups.map(({ tag, metrics }) => {
                        const c = tag.color || brand
                        return (
                            <div
                                key={tag.id}
                                className="rounded-xl"
                                style={{ background: softBg, border: `1px solid ${cardBorder}`, padding: '10px 12px' }}
                            >
                                <div className="mb-2">
                                    <TagChip tag={tag} size="md" />
                                </div>
                                <div className="space-y-1">
                                    {metrics.map(m => (
                                        <div key={m.kpi_id} className="flex items-baseline justify-between gap-2">
                                            <span style={{ fontSize: '10px', color: '#4b5563', lineHeight: '1.3' }} title={m.kpi_title}>
                                                {m.kpi_title}
                                            </span>
                                            <span className="font-bold whitespace-nowrap" style={{ fontSize: '11px', color: c }}>
                                                {m.total_value.toLocaleString()} <span style={{ fontSize: '8px', color: '#9ca3af', fontWeight: 400 }}>{m.unit_of_measurement}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    const KeyMetrics = () => {
        if (totals.length === 0) return null
        return (
            <div>
                <SectionHeading icon={BarChart3}>Key Metrics</SectionHeading>
                <div className="grid grid-cols-4 gap-2.5">
                    {totals.map(total => <MetricCard key={total.kpi_id} total={total} />)}
                </div>
            </div>
        )
    }

    const OverviewSection = () => (
        <div style={{ ...cardStyle, padding: '14px' }}>
            <SectionHeading icon={FileText}>Overview Summary</SectionHeading>
            {isEditing ? (
                <textarea
                    value={overviewSummary}
                    onChange={(e) => onOverviewChange?.(e.target.value)}
                    className="w-full leading-relaxed resize-none border border-primary-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ fontSize: '12px', color: '#1f2937', lineHeight: '1.5', minHeight: '60px' }}
                />
            ) : (
                <p className="leading-relaxed" style={{ fontSize: '12px', color: '#374151', lineHeight: '1.55' }}>
                    {overviewSummary}
                </p>
            )}
        </div>
    )

    const BeneficiarySection = () => {
        if (!hasBeneficiaryGroups || !beneficiaryText) return null
        return (
            <div style={{ ...cardStyle, padding: '14px' }}>
                <SectionHeading icon={Users}>Beneficiary Breakdown</SectionHeading>
                {isEditing ? (
                    <textarea
                        value={beneficiaryText}
                        onChange={(e) => onBeneficiaryTextChange?.(e.target.value)}
                        className="w-full leading-relaxed resize-none border border-primary-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        style={{ fontSize: '12px', color: '#1f2937', lineHeight: '1.5', minHeight: '60px' }}
                    />
                ) : (
                    <p className="leading-relaxed" style={{ fontSize: '12px', color: '#374151', lineHeight: '1.55' }}>
                        {beneficiaryText}
                    </p>
                )}
            </div>
        )
    }

    const ChartAndMap = ({ mapWidth }: { mapWidth: number }) => {
        if (totals.length === 0) return null
        return (
            <div className="flex gap-3 items-stretch">
                {/* Bar chart */}
                <div className="flex-1 overflow-hidden" style={{ ...cardStyle, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '12px 14px 4px 14px' }}>
                        <SectionHeading icon={BarChart3}>Metric Totals</SectionHeading>
                    </div>
                    <div style={{ padding: '0 10px 10px 10px', flex: 1, minHeight: '180px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={totals.map(total => ({
                                    name: total.kpi_title.length > 15 ? total.kpi_title.substring(0, 15) + '...' : total.kpi_title,
                                    value: total.total_value,
                                    fullName: total.kpi_title
                                }))}
                                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                            >
                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10, fill: '#9ca3af' }} interval={0} />
                                <YAxis
                                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                                    tickFormatter={(value) => {
                                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                                        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                                        return value.toString()
                                    }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'white', border: `1px solid ${cardBorder}`, borderRadius: '8px', fontSize: '12px', padding: '6px 8px' }}
                                    formatter={(value: number) => [value.toLocaleString(), 'Total']}
                                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                                />
                                <Bar dataKey="value" fill={brand} radius={[5, 5, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Map */}
                {mapImage && locations.length > 0 && (
                    <div className="overflow-hidden" style={{ ...cardStyle, display: 'flex', flexDirection: 'column', width: `${mapWidth}px`, flexShrink: 0 }}>
                        <div style={{ padding: '12px 14px 4px 14px' }}>
                            <SectionHeading icon={MapPin}>Locations</SectionHeading>
                        </div>
                        <div className="w-full relative" style={{ height: `${Math.round(mapWidth * 0.8)}px`, overflow: 'hidden' }}>
                            <img src={mapImage} alt="Impact locations map" className="w-full h-full object-cover" />
                        </div>
                        <div style={{ padding: '10px' }}>
                            <div className="grid grid-cols-2 gap-1.5">
                                {locations.map(location => (
                                    <div key={location.id} className="rounded-lg" style={{ background: softBg, border: `1px solid ${cardBorder}`, padding: '5px 8px' }}>
                                        <div className="font-semibold" style={{ fontSize: '9px', color: '#374151', marginBottom: '1px' }}>{location.name}</div>
                                        <div style={{ fontSize: '7px', color: '#9ca3af' }}>{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    const StoryCard = () => {
        if (!selectedStory) return null
        return (
            <div className="overflow-hidden" style={{ ...cardStyle, display: 'flex', flexDirection: 'column', height: '100%', minHeight: '600px' }}>
                {selectedStory.media_url && selectedStory.media_type === 'photo' && (
                    <div className="w-full relative" style={{ height: '280px', overflow: 'hidden', flexShrink: 0 }}>
                        <img src={selectedStory.media_url} alt={selectedStory.title} className="w-full h-full object-cover" />
                    </div>
                )}
                <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2" style={{ fontSize: '11px', color: '#9ca3af' }}>
                        {selectedStory.location_name && (
                            <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {selectedStory.location_name}
                            </span>
                        )}
                        <span>{selectedStory.date_represented}</span>
                    </div>
                    {isEditing ? (
                        <input
                            type="text"
                            value={selectedStory.title}
                            onChange={(e) => onStoryTitleChange?.(e.target.value)}
                            className="font-bold mb-2 w-full border border-primary-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            style={{ fontSize: '17px', color: '#111827' }}
                        />
                    ) : (
                        <h3 className="font-bold mb-2" style={{ fontSize: '17px', color: '#111827', letterSpacing: '-0.3px' }}>{selectedStory.title}</h3>
                    )}
                    {isEditing ? (
                        <textarea
                            value={selectedStory.description || ''}
                            onChange={(e) => onStoryDescriptionChange?.(e.target.value)}
                            className="w-full leading-relaxed resize-none border border-primary-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary-500 flex-1"
                            style={{ fontSize: '12px', color: '#1f2937', lineHeight: '1.5', minHeight: '100px' }}
                            placeholder="Story description..."
                        />
                    ) : selectedStory.description ? (
                        <p className="leading-relaxed" style={{ fontSize: '12px', color: '#374151', lineHeight: '1.55', marginBottom: 'auto' }}>
                            {selectedStory.description}
                        </p>
                    ) : null}
                </div>
            </div>
        )
    }

    return (
        <div style={{ position: 'relative', width: '1123px', margin: '0 auto' }}>
            <div
                id="report-dashboard"
                className="landscape-dashboard"
                style={{
                    width: '1123px',
                    margin: '0 auto',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    background: pageBg,
                    backgroundColor: '#ffffff',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Brand accent bar */}
                <div style={{ height: '6px', background: brand }} />

                {/* Header */}
                <div style={{ padding: '22px 30px 18px 30px', borderBottom: `1px solid ${cardBorder}` }}>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            {organization?.logo_url && (
                                <div
                                    className="flex items-center justify-center rounded-xl overflow-hidden flex-shrink-0"
                                    style={{ width: '56px', height: '56px', background: '#ffffff', border: `1px solid ${cardBorder}` }}
                                >
                                    <img src={organization.logo_url} alt={organization?.name || 'Logo'} className="w-full h-full object-contain" style={{ padding: '4px' }} />
                                </div>
                            )}
                            <div>
                                {organization?.name && (
                                    <div className="font-semibold mb-0.5" style={{ fontSize: '11px', color: brand, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                                        {organization.name}
                                    </div>
                                )}
                                <h1 className="font-bold" style={{ fontSize: '26px', color: '#111827', letterSpacing: '-0.6px', lineHeight: '1.15' }}>
                                    {dashboard.initiative.title}
                                </h1>
                                <div className="flex items-center gap-1.5 mt-1" style={{ fontSize: '12px', color: '#6b7280' }}>
                                    <Calendar className="w-3.5 h-3.5" style={{ color: brand }} />
                                    <span>{dateRangeText}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0" style={{ paddingTop: '2px' }}>
                            <div className="font-bold" style={{ fontSize: '13px', color: '#111827' }}>Impact Report</div>
                            <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                                {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main content */}
                <div style={{ padding: '20px 30px 8px 30px', position: 'relative' }}>
                    {selectedStory ? (
                        <div className="grid grid-cols-3 gap-4 mb-4" style={{ alignItems: 'stretch' }}>
                            <div className="col-span-1">
                                <StoryCard />
                            </div>
                            <div className="col-span-2 space-y-4">
                                <KeyMetrics />
                                <OverviewSection />
                                <ThemeBreakdown />
                                <BeneficiarySection />
                                <ChartAndMap mapWidth={200} />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col mb-4" style={{ minHeight: '600px', width: '100%' }}>
                            <div className="w-full space-y-4">
                                <KeyMetrics />
                                <OverviewSection />
                                <ThemeBreakdown />
                                <BeneficiarySection />
                                <ChartAndMap mapWidth={300} />
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div
                        className="flex items-center justify-between"
                        style={{ marginTop: '8px', paddingTop: '14px', paddingBottom: '8px', borderTop: `1px solid ${cardBorder}` }}
                    >
                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                            Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span style={{ fontSize: '10px', color: '#9ca3af' }}>Powered by</span>
                            <img src="/Nexuslogo.png" alt="Nexus Impacts" style={{ height: '16px', width: 'auto', objectFit: 'contain' }} />
                            <span className="font-semibold" style={{ fontSize: '10px', color: '#6b7280' }}>Nexus Impacts</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
