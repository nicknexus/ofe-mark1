import React from 'react'
import { MapPin, Calendar, Users, BarChart3, FileText } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { InitiativeDashboard } from '../types'

interface ReportDashboardProps {
    dashboard: InitiativeDashboard
    overviewSummary: string
    totals: Array<{
        kpi_id: string
        kpi_title: string
        kpi_description?: string
        unit_of_measurement: string
        total_value: number
        count: number
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
}

export default function ReportDashboard({
    dashboard,
    overviewSummary,
    totals,
    beneficiaryText,
    hasBeneficiaryGroups = false,
    selectedStory,
    locations,
    dateStart,
    dateEnd,
    mapImage
}: ReportDashboardProps) {
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

    return (
        <div style={{ position: 'relative', width: '1123px', margin: '0 auto' }}>
            {/* Blur background layers - rendered BEHIND dashboard to prevent grey boxes */}
            <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ zIndex: 0 }}
            >
                {/* Static blurry green background effects */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: `
                            radial-gradient(ellipse 900px 700px at 20% 30%, rgba(151, 181, 153, 0.55) 0%, transparent 55%),
                            radial-gradient(ellipse 700px 900px at 80% 70%, rgba(151, 181, 153, 0.5) 0%, transparent 55%),
                            radial-gradient(ellipse 800px 600px at 50% 20%, rgba(151, 181, 153, 0.45) 0%, transparent 50%),
                            radial-gradient(ellipse 600px 800px at 10% 80%, rgba(151, 181, 153, 0.5) 0%, transparent 50%),
                            radial-gradient(ellipse 700px 700px at 90% 30%, rgba(151, 181, 153, 0.4) 0%, transparent 45%),
                            radial-gradient(ellipse 650px 550px at 30% 60%, rgba(151, 181, 153, 0.45) 0%, transparent 48%)
                        `,
                        filter: 'blur(50px)',
                        WebkitFilter: 'blur(50px)'
                    }}
                />

                {/* Additional static green blur effects */}
                <div
                    style={{
                        position: 'absolute',
                        top: '-15%',
                        right: '-8%',
                        width: '700px',
                        height: '700px',
                        background: 'radial-gradient(circle, rgba(151, 181, 153, 0.45) 0%, transparent 65%)',
                        borderRadius: '50%',
                        filter: 'blur(70px)',
                        WebkitFilter: 'blur(70px)'
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: '-12%',
                        left: '-4%',
                        width: '600px',
                        height: '600px',
                        background: 'radial-gradient(circle, rgba(151, 181, 153, 0.5) 0%, transparent 65%)',
                        borderRadius: '50%',
                        filter: 'blur(65px)',
                        WebkitFilter: 'blur(65px)'
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '800px',
                        height: '800px',
                        background: 'radial-gradient(circle, rgba(151, 181, 153, 0.3) 0%, transparent 60%)',
                        borderRadius: '50%',
                        filter: 'blur(90px)',
                        WebkitFilter: 'blur(90px)'
                    }}
                />
            </div>

            {/* Dashboard content - clean layer, no grey boxes */}
            <div
                id="report-dashboard"
                className="landscape-dashboard"
                style={{
                    width: '1123px', // Exact PDF width at 96 DPI (297mm landscape A4)
                    margin: '0 auto',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 50%, #ecfdf5 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                    transform: 'scale(1)',
                    transformOrigin: 'top left',
                    willChange: 'transform',
                    backgroundColor: '#ffffff',
                    zIndex: 1
                }}
            >

                {/* Header */}
                <div
                    className="relative overflow-hidden"
                    style={{
                        background: '#97b599',
                        padding: '20px 30px',
                        color: 'white',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                        zIndex: 1
                    }}
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <h1
                                className="font-bold mb-1"
                                style={{ fontSize: '28px', letterSpacing: '-0.5px', lineHeight: '1.2' }}
                            >
                                {dashboard.initiative.title}
                            </h1>
                            <div className="flex items-center gap-2 text-white/90" style={{ fontSize: '12px' }}>
                                <Calendar className="w-3 h-3" />
                                <span>{dateRangeText}</span>
                            </div>
                        </div>
                        <div
                            className="text-right"
                            style={{ fontSize: '10px' }}
                        >
                            <div className="font-semibold mb-0.5">Nexus Impacts</div>
                            <div style={{ fontSize: '9px' }}>Know Your Mark On The World</div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div style={{ padding: '20px 30px 10px 30px', position: 'relative', zIndex: 1, background: 'transparent' }}>
                    {/* Main Grid Layout */}
                    {selectedStory ? (
                        <div className="grid grid-cols-3 gap-4 mb-5" style={{ alignItems: 'stretch' }}>
                            {/* Left Column: Story */}
                            <div className="col-span-1">
                                {/* Story Section - Top Left */}
                                <div
                                    className="rounded-xl overflow-hidden"
                                    style={{
                                        background: '#ffffff',
                                        border: '1px solid rgba(6, 78, 59, 0.2)',
                                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        height: '100%',
                                        minHeight: '600px' // Match approximate height of right column content
                                    }}
                                >
                                    {selectedStory.media_url && selectedStory.media_type === 'photo' && (
                                        <div
                                            className="w-full relative"
                                            style={{
                                                height: '280px',
                                                overflow: 'hidden',
                                                flexShrink: 0
                                            }}
                                        >
                                            <img
                                                src={selectedStory.media_url}
                                                alt={selectedStory.title}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <div className="p-4 flex-1 flex flex-col">
                                        <div className="flex items-center gap-2 mb-2" style={{ fontSize: '10px', color: '#6b7280' }}>
                                            {selectedStory.location_name && (
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" />
                                                    <span>{selectedStory.location_name}</span>
                                                </div>
                                            )}
                                            <span>{selectedStory.date_represented}</span>
                                        </div>
                                        <h3
                                            className="font-bold mb-2"
                                            style={{ fontSize: '16px', color: '#065f46' }}
                                        >
                                            {selectedStory.title}
                                        </h3>
                                        {selectedStory.description && (
                                            <p
                                                className="leading-relaxed"
                                                style={{ fontSize: '11px', color: '#1f2937', lineHeight: '1.4', marginBottom: 'auto' }}
                                            >
                                                {selectedStory.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Totals, Overview, and Map */}
                            <div className="col-span-2 space-y-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <BarChart3 className="w-4 h-4" style={{ color: '#065f46' }} />
                                        <h2
                                            className="font-bold"
                                            style={{ fontSize: '14px', color: '#065f46' }}
                                        >
                                            Key Metrics
                                        </h2>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {totals.map((total) => (
                                            <div
                                                key={total.kpi_id}
                                                className="rounded-xl p-2.5"
                                                style={{
                                                    background: '#ffffff',
                                                    border: '1px solid rgba(6, 78, 59, 0.2)',
                                                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                                                    transition: 'all 0.3s ease',
                                                    minHeight: '80px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between'
                                                }}
                                            >
                                                <div
                                                    className="font-semibold mb-1"
                                                    style={{
                                                        fontSize: '9px',
                                                        color: '#065f46',
                                                        lineHeight: '1.3',
                                                        wordBreak: 'break-word',
                                                        overflow: 'hidden',
                                                        height: '23px', // Fixed height for 2 lines (9px * 1.3 * 2)
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical',
                                                        paddingBottom: '2px'
                                                    }}
                                                    title={total.kpi_title}
                                                >
                                                    {total.kpi_title}
                                                </div>
                                                <div>
                                                    <div
                                                        className="font-bold"
                                                        style={{ fontSize: '16px', color: '#047857', lineHeight: '1.2' }}
                                                    >
                                                        {total.total_value.toLocaleString()}
                                                    </div>
                                                    <div
                                                        className="mt-0.5"
                                                        style={{ fontSize: '9px', color: '#6b7280' }}
                                                    >
                                                        {total.unit_of_measurement}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Overview Section - Always at top right */}
                                <div
                                    className="rounded-xl p-3"
                                    style={{
                                        background: '#ffffff',
                                        border: '1px solid rgba(6, 78, 59, 0.2)',
                                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
                                    }}
                                >
                                    <div className="flex items-center gap-2 mb-2" style={{ alignItems: 'center' }}>
                                        <FileText className="w-3 h-3" style={{ color: '#065f46', flexShrink: 0, verticalAlign: 'middle' }} />
                                        <h2
                                            className="font-bold"
                                            style={{ fontSize: '12px', color: '#065f46', lineHeight: '1.2', margin: 0 }}
                                        >
                                            Overview Summary
                                        </h2>
                                    </div>
                                    <p
                                        className="leading-relaxed"
                                        style={{ fontSize: '11px', color: '#1f2937', lineHeight: '1.4' }}
                                    >
                                        {overviewSummary}
                                    </p>
                                </div>

                                {/* Beneficiaries Section - Full width, same as overview summary */}
                                {hasBeneficiaryGroups && beneficiaryText && (
                                    <div
                                        className="rounded-xl p-3"
                                        style={{
                                            background: '#ffffff',
                                            border: '1px solid rgba(6, 78, 59, 0.2)',
                                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
                                        }}
                                    >
                                        <div className="flex items-center gap-2 mb-2" style={{ alignItems: 'center' }}>
                                            <Users className="w-3 h-3" style={{ color: '#065f46', flexShrink: 0, verticalAlign: 'middle' }} />
                                            <h2
                                                className="font-bold"
                                                style={{ fontSize: '12px', color: '#065f46', lineHeight: '1.2', margin: 0 }}
                                            >
                                                Beneficiary Breakdown
                                            </h2>
                                        </div>
                                        <p
                                            className="leading-relaxed"
                                            style={{ fontSize: '11px', color: '#1f2937', lineHeight: '1.4' }}
                                        >
                                            {beneficiaryText}
                                        </p>
                                    </div>
                                )}

                                {/* Bar Chart and Map Section Container */}
                                {totals.length > 0 && (
                                    <div className="space-y-4">

                                        {/* Bar Chart and Map Section */}
                                        <div className="flex gap-4 items-stretch">
                                            {/* Bar Chart Section */}
                                            <div
                                                className="rounded-xl overflow-hidden flex-1"
                                                style={{
                                                    background: '#ffffff',
                                                    border: '1px solid rgba(6, 78, 59, 0.2)',
                                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                                                    display: 'flex',
                                                    flexDirection: 'column'
                                                }}
                                            >
                                                <div className="p-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(6, 78, 59, 0.2)' }}>
                                                    <div className="flex items-center gap-2">
                                                        <BarChart3 className="w-3 h-3" style={{ color: '#065f46' }} />
                                                        <h3
                                                            className="font-bold"
                                                            style={{ fontSize: '11px', color: '#065f46' }}
                                                        >
                                                            Metric Totals
                                                        </h3>
                                                    </div>
                                                </div>
                                                <div style={{ padding: '10px', flex: 1, minHeight: 0 }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            data={totals.map(total => ({
                                                                name: total.kpi_title.length > 15
                                                                    ? total.kpi_title.substring(0, 15) + '...'
                                                                    : total.kpi_title,
                                                                value: total.total_value,
                                                                fullName: total.kpi_title
                                                            }))}
                                                            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                                                        >
                                                            <XAxis
                                                                dataKey="name"
                                                                angle={-45}
                                                                textAnchor="end"
                                                                height={60}
                                                                tick={{ fontSize: 9, fill: '#6b7280' }}
                                                                interval={0}
                                                            />
                                                            <YAxis
                                                                tick={{ fontSize: 9, fill: '#6b7280' }}
                                                                tickFormatter={(value) => {
                                                                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                                                                    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                                                                    return value.toString()
                                                                }}
                                                            />
                                                            <Tooltip
                                                                contentStyle={{
                                                                    backgroundColor: 'white',
                                                                    border: '1px solid rgba(6, 78, 59, 0.2)',
                                                                    borderRadius: '6px',
                                                                    fontSize: '11px',
                                                                    padding: '6px 8px'
                                                                }}
                                                                formatter={(value: number) => [value.toLocaleString(), 'Total']}
                                                                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                                                            />
                                                            <Bar
                                                                dataKey="value"
                                                                fill="#97b599"
                                                                radius={[4, 4, 0, 0]}
                                                            />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>

                                            {/* Map Section - Small Square */}
                                            {mapImage && locations.length > 0 && (
                                                <div
                                                    className="rounded-xl overflow-hidden"
                                                    style={{
                                                        background: '#ffffff',
                                                        border: '1px solid rgba(6, 78, 59, 0.2)',
                                                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        width: '200px',
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    <div className="p-2 border-b" style={{ borderColor: 'rgba(6, 78, 59, 0.2)' }}>
                                                        <div className="flex items-center gap-2">
                                                            <MapPin className="w-3 h-3" style={{ color: '#065f46' }} />
                                                            <h3
                                                                className="font-bold"
                                                                style={{ fontSize: '11px', color: '#065f46' }}
                                                            >
                                                                Locations
                                                            </h3>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="w-full relative"
                                                        style={{ height: '160px', width: '200px', overflow: 'hidden' }}
                                                    >
                                                        <img
                                                            src={mapImage}
                                                            alt="Impact locations map"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="p-2">
                                                        <div className="grid grid-cols-2 gap-1.5">
                                                            {locations.map((location) => (
                                                                <div
                                                                    key={location.id}
                                                                    className="px-2 py-1 rounded-lg"
                                                                    style={{
                                                                        background: '#f0fdf4',
                                                                        border: '1px solid rgba(6, 78, 59, 0.2)',
                                                                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                                                                    }}
                                                                >
                                                                    <div
                                                                        className="font-semibold"
                                                                        style={{ fontSize: '9px', color: '#065f46', marginBottom: '1px' }}
                                                                    >
                                                                        {location.name}
                                                                    </div>
                                                                    <div
                                                                        style={{ fontSize: '7px', color: '#6b7280' }}
                                                                    >
                                                                        {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* No Story - Left-aligned and Full Width Layout */
                        <div className="flex flex-col mb-5" style={{ minHeight: '600px', width: '100%' }}>
                            <div className="w-full space-y-4">
                                {/* Totals Grid */}
                                {totals.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-2 mb-3" style={{ alignItems: 'center' }}>
                                            <BarChart3 className="w-4 h-4" style={{ color: '#065f46', flexShrink: 0, verticalAlign: 'middle' }} />
                                            <h2
                                                className="font-bold"
                                                style={{ fontSize: '14px', color: '#065f46', lineHeight: '1.2', margin: 0 }}
                                            >
                                                Key Metrics
                                            </h2>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {totals.map((total) => (
                                                <div
                                                    key={total.kpi_id}
                                                    className="rounded-xl p-2.5"
                                                    style={{
                                                        background: '#ffffff',
                                                        border: '1px solid rgba(6, 78, 59, 0.2)',
                                                        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                                                        transition: 'all 0.3s ease',
                                                        minHeight: '80px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'space-between'
                                                    }}
                                                >
                                                    <div
                                                        className="font-semibold mb-1"
                                                        style={{
                                                            fontSize: '9px',
                                                            color: '#065f46',
                                                            lineHeight: '1.3',
                                                            wordBreak: 'break-word',
                                                            overflow: 'hidden',
                                                            height: '23px', // Fixed height for 2 lines (9px * 1.3 * 2)
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: 'vertical',
                                                            paddingBottom: '2px'
                                                        }}
                                                        title={total.kpi_title}
                                                    >
                                                        {total.kpi_title}
                                                    </div>
                                                    <div>
                                                        <div
                                                            className="font-bold"
                                                            style={{ fontSize: '16px', color: '#047857', lineHeight: '1.2' }}
                                                        >
                                                            {total.total_value.toLocaleString()}
                                                        </div>
                                                        <div
                                                            className="mt-0.5"
                                                            style={{ fontSize: '9px', color: '#6b7280' }}
                                                        >
                                                            {total.unit_of_measurement}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Overview Section */}
                                <div
                                    className="rounded-xl p-3"
                                    style={{
                                        background: '#ffffff',
                                        border: '1px solid rgba(6, 78, 59, 0.2)',
                                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
                                    }}
                                >
                                    <div className="flex items-center gap-2 mb-2" style={{ alignItems: 'center' }}>
                                        <FileText className="w-3 h-3" style={{ color: '#065f46', flexShrink: 0, verticalAlign: 'middle' }} />
                                        <h2
                                            className="font-bold"
                                            style={{ fontSize: '12px', color: '#065f46', lineHeight: '1.2', margin: 0 }}
                                        >
                                            Overview Summary
                                        </h2>
                                    </div>
                                    <p
                                        className="leading-relaxed"
                                        style={{ fontSize: '11px', color: '#1f2937', lineHeight: '1.4' }}
                                    >
                                        {overviewSummary}
                                    </p>
                                </div>

                                {/* Beneficiaries Section */}
                                {hasBeneficiaryGroups && beneficiaryText && (
                                    <div
                                        className="rounded-xl p-3"
                                        style={{
                                            background: '#ffffff',
                                            border: '1px solid rgba(6, 78, 59, 0.2)',
                                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)'
                                        }}
                                    >
                                        <div className="flex items-center gap-2 mb-2" style={{ alignItems: 'center' }}>
                                            <Users className="w-3 h-3" style={{ color: '#065f46', flexShrink: 0, verticalAlign: 'middle' }} />
                                            <h2
                                                className="font-bold"
                                                style={{ fontSize: '12px', color: '#065f46', lineHeight: '1.2', margin: 0 }}
                                            >
                                                Beneficiary Breakdown
                                            </h2>
                                        </div>
                                        <p
                                            className="leading-relaxed"
                                            style={{ fontSize: '11px', color: '#1f2937', lineHeight: '1.4' }}
                                        >
                                            {beneficiaryText}
                                        </p>
                                    </div>
                                )}

                                {/* Bar Chart and Map Section */}
                                {totals.length > 0 && (
                                    <div className="flex gap-4 items-stretch">
                                        {/* Bar Chart Section */}
                                        <div
                                            className="rounded-xl overflow-hidden flex-1"
                                            style={{
                                                background: '#ffffff',
                                                border: '1px solid rgba(6, 78, 59, 0.2)',
                                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                                                display: 'flex',
                                                flexDirection: 'column'
                                            }}
                                        >
                                            <div className="p-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(6, 78, 59, 0.2)' }}>
                                                <div className="flex items-center gap-2">
                                                    <BarChart3 className="w-3 h-3" style={{ color: '#065f46' }} />
                                                    <h3
                                                        className="font-bold"
                                                        style={{ fontSize: '11px', color: '#065f46' }}
                                                    >
                                                        Metric Totals
                                                    </h3>
                                                </div>
                                            </div>
                                            <div style={{ padding: '10px', flex: 1, minHeight: 0 }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart
                                                        data={totals.map(total => ({
                                                            name: total.kpi_title.length > 15
                                                                ? total.kpi_title.substring(0, 15) + '...'
                                                                : total.kpi_title,
                                                            value: total.total_value,
                                                            fullName: total.kpi_title
                                                        }))}
                                                        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                                                    >
                                                        <XAxis
                                                            dataKey="name"
                                                            angle={-45}
                                                            textAnchor="end"
                                                            height={60}
                                                            tick={{ fontSize: 9, fill: '#6b7280' }}
                                                            interval={0}
                                                        />
                                                        <YAxis
                                                            tick={{ fontSize: 9, fill: '#6b7280' }}
                                                            tickFormatter={(value) => {
                                                                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                                                                if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                                                                return value.toString()
                                                            }}
                                                        />
                                                        <Tooltip
                                                            contentStyle={{
                                                                backgroundColor: 'white',
                                                                border: '1px solid rgba(6, 78, 59, 0.2)',
                                                                borderRadius: '6px',
                                                                fontSize: '11px',
                                                                padding: '6px 8px'
                                                            }}
                                                            formatter={(value: number) => [value.toLocaleString(), 'Total']}
                                                            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                                                        />
                                                        <Bar
                                                            dataKey="value"
                                                            fill="#97b599"
                                                            radius={[4, 4, 0, 0]}
                                                        />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        {/* Map Section - Bigger */}
                                        {mapImage && locations.length > 0 && (
                                            <div
                                                className="rounded-xl overflow-hidden"
                                                style={{
                                                    background: '#ffffff',
                                                    border: '1px solid rgba(6, 78, 59, 0.2)',
                                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    width: '300px',
                                                    flexShrink: 0
                                                }}
                                            >
                                                <div className="p-2 border-b" style={{ borderColor: 'rgba(6, 78, 59, 0.2)' }}>
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="w-3 h-3" style={{ color: '#065f46' }} />
                                                        <h3
                                                            className="font-bold"
                                                            style={{ fontSize: '11px', color: '#065f46' }}
                                                        >
                                                            Locations
                                                        </h3>
                                                    </div>
                                                </div>
                                                <div
                                                    className="w-full relative"
                                                    style={{ height: '240px', width: '300px', overflow: 'hidden' }}
                                                >
                                                    <img
                                                        src={mapImage}
                                                        alt="Impact locations map"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="p-2">
                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {locations.map((location) => (
                                                            <div
                                                                key={location.id}
                                                                className="px-2 py-1 rounded-lg"
                                                                style={{
                                                                    background: '#f0fdf4',
                                                                    border: '1px solid rgba(6, 78, 59, 0.2)',
                                                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                                                                }}
                                                            >
                                                                <div
                                                                    className="font-semibold"
                                                                    style={{ fontSize: '9px', color: '#065f46', marginBottom: '1px' }}
                                                                >
                                                                    {location.name}
                                                                </div>
                                                                <div
                                                                    style={{ fontSize: '7px', color: '#6b7280' }}
                                                                >
                                                                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div
                        className="text-center pt-4 pb-2 border-t"
                        style={{
                            borderColor: 'rgba(6, 78, 59, 0.2)',
                            color: '#6b7280',
                            fontSize: '10px'
                        }}
                    >
                        <div className="font-semibold mb-0.5" style={{ color: '#065f46' }}>
                            Nexus Impacts | Know Your Mark On The World
                        </div>
                        <div>
                            Generated on {new Date().toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

