import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
    ArrowLeft, BarChart3, TrendingUp, FileText, Calendar, 
    ExternalLink, MapPin, Target, Sparkles, CheckCircle2
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { publicApi, PublicMetricDetail, PublicEvidence } from '../services/publicApi'
import PublicBreadcrumb from '../components/public/PublicBreadcrumb'
import PublicLoader from '../components/public/PublicLoader'

// Category colors
const categoryConfig: Record<string, { bg: string; text: string; gradient: string; accent: string }> = {
    impact: { bg: 'bg-purple-500', text: 'text-purple-600', gradient: 'from-purple-500 to-purple-600', accent: '#8b5cf6' },
    output: { bg: 'bg-accent', text: 'text-accent', gradient: 'from-accent to-primary-600', accent: '#c0dfa1' },
    input: { bg: 'bg-blue-500', text: 'text-blue-600', gradient: 'from-blue-500 to-blue-600', accent: '#3b82f6' }
}

export default function PublicMetricPage() {
    const { orgSlug, initiativeSlug, metricSlug } = useParams<{ 
        orgSlug: string; 
        initiativeSlug: string; 
        metricSlug: string 
    }>()
    
    const [metric, setMetric] = useState<PublicMetricDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const loadMetric = async () => {
            if (!orgSlug || !initiativeSlug || !metricSlug) return
            
            try {
                setLoading(true)
                setError(null)
                const data = await publicApi.getMetricDetail(orgSlug, initiativeSlug, metricSlug)
                setMetric(data)
            } catch (err) {
                console.error('Error loading metric:', err)
                setError('Failed to load metric')
            } finally {
                setLoading(false)
            }
        }
        
        loadMetric()
    }, [orgSlug, initiativeSlug, metricSlug])

    if (loading) {
        return <PublicLoader message="Loading metric..." />
    }

    if (error || !metric) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="bg-white/50 backdrop-blur-2xl border border-white/60 shadow-xl p-12 rounded-3xl text-center max-w-md">
                    <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-gray-800 mb-3">Metric Not Found</h1>
                    <p className="text-gray-500 mb-8">{error || 'This metric does not exist.'}</p>
                    <Link to={`/org/${orgSlug}/${initiativeSlug}?tab=metrics`} 
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4" /> Back to Metrics
                    </Link>
                </div>
            </div>
        )
    }

    const config = categoryConfig[metric.category] || categoryConfig.output

    // Prepare chart data (sorted by date)
    const chartData = [...(metric.updates || [])]
        .sort((a, b) => new Date(a.date_represented).getTime() - new Date(b.date_represented).getTime())
        .map(update => ({
            date: new Date(update.date_represented).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            fullDate: update.date_represented,
            value: parseFloat(String(update.value)) || 0,
            note: update.note,
            location: update.location?.name
        }))

    // Calculate cumulative values
    let cumulative = 0
    const cumulativeData = chartData.map(d => {
        cumulative += d.value
        return { ...d, cumulative }
    })

    // Brand color from initiative/organization data
    const brandColor = metric.initiative.brand_color || '#c0dfa1'

    return (
        <div className="min-h-screen font-figtree relative animate-fadeIn">
            {/* Flowing gradient background */}
            <div 
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(ellipse 80% 50% at 20% 40%, ${brandColor}90, transparent 60%),
                        radial-gradient(ellipse 60% 80% at 80% 20%, ${brandColor}70, transparent 55%),
                        radial-gradient(ellipse 50% 60% at 60% 80%, ${brandColor}60, transparent 55%),
                        radial-gradient(ellipse 70% 40% at 10% 90%, ${brandColor}50, transparent 50%),
                        linear-gradient(180deg, white 0%, #fafafa 100%)
                    `
                }}
            />

            {/* Navigation Header */}
            <div className="sticky top-0 z-50 bg-white/60 backdrop-blur-2xl border-b border-white/40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3">
                    <div className="flex items-center justify-between">
                        <Link to={`/org/${orgSlug}/${initiativeSlug}?tab=metrics`} className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-gray-800 transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-xs sm:text-sm font-medium">Back</span>
                        </Link>
                        <Link to="/" className="flex items-center gap-2">
                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-sm sm:text-base font-newsreader font-extralight text-gray-800 hidden sm:block">Nexus Impacts</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
                {/* Breadcrumb - Hidden on mobile */}
                <div className="hidden sm:block">
                    <PublicBreadcrumb 
                        orgSlug={orgSlug!}
                        orgName={metric.initiative.org_name || ''}
                        items={[
                            { label: metric.initiative.title, href: `/org/${orgSlug}/${initiativeSlug}?tab=metrics` },
                            { label: metric.title }
                        ]}
                    />
                </div>

                {/* Hero Section */}
                <div className="mb-5 sm:mb-8">
                    <div className="flex flex-col gap-4 sm:gap-6">
                        {/* Metric Info */}
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                <span className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-full text-white ${config.bg} uppercase tracking-wide`}>
                                    {metric.category}
                                </span>
                                <span className="text-xs sm:text-sm text-gray-500 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                    {metric.update_count} claim{metric.update_count !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">{metric.title}</h1>
                            {metric.description && (
                                <p className="text-sm sm:text-lg text-gray-600 max-w-2xl line-clamp-2 sm:line-clamp-none">{metric.description}</p>
                            )}
                        </div>
                        
                        {/* Big Total Card - Full width on mobile */}
                        <div className="bg-white/70 backdrop-blur-2xl p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl shadow-black/10 border border-white/60 lg:min-w-[200px] lg:max-w-[240px]">
                            <p className="text-gray-500 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">Total Impact</p>
                            <p className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight ${config.text}`}>
                                {metric.total_value.toLocaleString()}
                            </p>
                            <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">{metric.unit_of_measurement}</p>
                        </div>
                    </div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-5 sm:mb-8">
                    {/* Chart - Takes 2 columns */}
                    <div className="lg:col-span-2 bg-white/50 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-xl shadow-black/5 overflow-hidden">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                                Cumulative Progress
                            </h2>
                            <span className="text-[10px] sm:text-xs text-gray-500 bg-white/60 px-2 sm:px-3 py-1 rounded-full">
                                All time
                            </span>
                        </div>
                        
                        {chartData.length === 0 ? (
                            <div className="h-48 sm:h-72 flex items-center justify-center text-gray-500">
                                <div className="text-center">
                                    <BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">No impact claims recorded yet</p>
                                </div>
                            </div>
                        ) : (
                            <div className="h-48 sm:h-72 p-2 sm:p-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={cumulativeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={config.accent} stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor={config.accent} stopOpacity={0.02}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis 
                                            dataKey="date" 
                                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                                            axisLine={{ stroke: '#e2e8f0' }}
                                            tickLine={false}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value.toString()}
                                            width={35}
                                        />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'white', 
                                                border: 'none',
                                                borderRadius: '12px',
                                                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                                                padding: '8px 12px',
                                                fontSize: '12px'
                                            }}
                                            formatter={(value: number) => [
                                                `${value.toLocaleString()} ${metric.unit_of_measurement}`,
                                                'Total'
                                            ]}
                                            labelFormatter={(label) => label}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="cumulative" 
                                            stroke={config.accent}
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorCumulative)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Impact Claims - Right side scrollable */}
                    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-xl shadow-black/5 overflow-hidden flex flex-col max-h-[300px] sm:max-h-[400px]">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40 flex-shrink-0">
                            <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                                Impact Claims
                            </h2>
                        </div>
                        
                        {metric.updates.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-gray-500 p-4 sm:p-6">
                                <div className="text-center">
                                    <Target className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-xs sm:text-sm">No claims yet</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3">
                                {[...metric.updates]
                                    .sort((a, b) => new Date(b.date_represented).getTime() - new Date(a.date_represented).getTime())
                                    .map((update, idx) => (
                                    <ImpactClaimCard key={update.id || idx} update={update} unit={metric.unit_of_measurement} config={config} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Evidence Section */}
                <div className="bg-white/50 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-xl shadow-black/5 overflow-hidden">
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                            Supporting Evidence
                        </h2>
                        <span className={`text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1 rounded-full ${config.bg} text-white`}>
                            {metric.evidence_count} item{metric.evidence_count !== 1 ? 's' : ''}
                        </span>
                    </div>
                    
                    {metric.evidence.length === 0 ? (
                        <div className="py-10 sm:py-16 text-center text-gray-500 px-4">
                            <FileText className="w-10 h-10 sm:w-14 sm:h-14 mx-auto mb-3 sm:mb-4 opacity-20" />
                            <p className="text-sm sm:text-lg font-medium mb-1">No evidence linked yet</p>
                            <p className="text-xs sm:text-sm">Evidence will appear here when linked to this metric</p>
                        </div>
                    ) : (
                        <div className="p-3 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                            {metric.evidence.map((ev) => (
                                <EvidenceCard key={ev.id} evidence={ev} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 border-t border-white/40 bg-white/40 backdrop-blur-xl mt-8 sm:mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                        <p className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                            Part of <Link to={`/org/${orgSlug}/${initiativeSlug}?tab=metrics`} className="text-accent hover:underline font-medium">{metric.initiative.title}</Link>
                        </p>
                        <Link to={`/org/${orgSlug}`} className="text-xs sm:text-sm text-accent hover:text-accent/80 font-medium flex items-center gap-1">
                            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Back to Organization
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Impact Claim Card Component
function ImpactClaimCard({ update, unit, config }: { 
    update: any; 
    unit: string; 
    config: { bg: string; text: string; gradient: string; accent: string } 
}) {
    const hasDateRange = update.date_range_start && update.date_range_end
    const displayDate = hasDateRange
        ? `${new Date(update.date_range_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(update.date_range_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : new Date(update.date_represented).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    return (
        <div className="p-3 sm:p-4 bg-white/60 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/50 hover:bg-white/80 hover:shadow-md transition-all group active:scale-[0.98]">
            <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                        <span className={`text-lg sm:text-xl font-bold ${config.text}`}>
                            +{parseFloat(update.value).toLocaleString()}
                        </span>
                        <span className="text-[10px] sm:text-xs text-gray-500">{unit}</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-gray-500">
                        <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span>{displayDate}</span>
                    </div>
                </div>
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-accent/50 group-hover:text-accent transition-colors flex-shrink-0" />
            </div>
            {update.location && (
                <div className="mt-1.5 sm:mt-2 flex items-center gap-1 text-[10px] sm:text-xs text-gray-500">
                    <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span>{update.location.name}</span>
                </div>
            )}
            {update.note && (
                <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-500 line-clamp-2 italic">"{update.note}"</p>
            )}
        </div>
    )
}

// Evidence Card Component - matching PublicInitiativePage EvidenceTab style
function EvidenceCard({ evidence }: { evidence: PublicEvidence }) {
    // Colors matching the signed-in app
    const typeConfig: Record<string, { bg: string; label: string }> = {
        visual_proof: { bg: 'bg-pink-100 text-pink-800', label: 'Visual Proof' },
        documentation: { bg: 'bg-blue-100 text-blue-700', label: 'Documentation' },
        testimony: { bg: 'bg-orange-100 text-orange-800', label: 'Testimonies' },
        financials: { bg: 'bg-primary-100 text-primary-800', label: 'Financials' }
    }
    
    const config = typeConfig[evidence.type] || { bg: 'bg-gray-100 text-gray-600', label: evidence.type }
    
    const isImageFile = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || ''
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
    }

    const getPreviewUrl = () => {
        if (evidence.files && evidence.files.length > 0) {
            const imageFile = evidence.files.find(f => isImageFile(f.file_url))
            if (imageFile) return imageFile.file_url
        }
        if (evidence.file_url && isImageFile(evidence.file_url)) {
            return evidence.file_url
        }
        return null
    }

    const previewUrl = getPreviewUrl()
    const fileUrl = evidence.files?.[0]?.file_url || evidence.file_url
    const fileCount = evidence.files?.length || (evidence.file_url ? 1 : 0)

    return (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50 hover:bg-white/80 hover:shadow-lg transition-all overflow-hidden">
            {/* Image Preview */}
            {previewUrl ? (
                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <div className="relative aspect-video bg-gray-100 overflow-hidden">
                        <img 
                            src={previewUrl} 
                            alt={evidence.title}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                        {fileCount > 1 && (
                            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                                +{fileCount - 1} more
                            </div>
                        )}
                    </div>
                </a>
            ) : fileUrl ? (
                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                    <div className="aspect-video bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center">
                        <div className="text-center">
                            <FileText className="w-10 h-10 text-accent/50 mx-auto mb-2" />
                            <span className="text-sm text-gray-500">
                                {fileCount} file{fileCount > 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                </a>
            ) : null}

            {/* Content */}
            <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.bg}`}>
                        {config.label}
                    </span>
                    <span className="text-xs text-gray-500">{new Date(evidence.date_represented).toLocaleDateString()}</span>
                </div>
                <h3 className="font-semibold text-gray-800 text-sm mb-1">{evidence.title}</h3>
                {evidence.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{evidence.description}</p>}
                
                {/* File link (if no preview shown) */}
                {!previewUrl && fileUrl && (
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 font-medium">
                        <ExternalLink className="w-3.5 h-3.5" />View file{fileCount > 1 ? `s (${fileCount})` : ''}
                    </a>
                )}
            </div>
        </div>
    )
}
