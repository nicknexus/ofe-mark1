import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
    Loader2, ArrowLeft, BarChart3, TrendingUp, FileText, Calendar, 
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
                <div className="glass-card p-12 rounded-3xl text-center max-w-md">
                    <BarChart3 className="w-16 h-16 text-muted-foreground/50 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-foreground mb-3">Metric Not Found</h1>
                    <p className="text-muted-foreground mb-8">{error || 'This metric does not exist.'}</p>
                    <Link to={`/org/${orgSlug}/${initiativeSlug}`} 
                        className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4" /> Back to Initiative
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

    // Brand color from initiative data or fallback
    const brandColor = '#c0dfa1' // Could be passed from initiative if available

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
                <div className="max-w-7xl mx-auto px-6 py-3">
                    <div className="flex items-center justify-between">
                        <Link to={`/org/${orgSlug}/${initiativeSlug}`} className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-sm font-medium">Back to Initiative</span>
                        </Link>
                        <Link to="/" className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-base font-newsreader font-extralight text-foreground hidden sm:block">Nexus Impacts</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 max-w-7xl mx-auto px-6 py-6">
                {/* Breadcrumb */}
                <PublicBreadcrumb 
                    orgSlug={orgSlug!}
                    orgName={metric.initiative.org_name || ''}
                    items={[
                        { label: metric.initiative.title, href: `/org/${orgSlug}/${initiativeSlug}` },
                        { label: metric.title }
                    ]}
                />

                {/* Hero Section */}
                <div className="mb-8">
                    <div className="flex flex-col lg:flex-row gap-6 items-start">
                        {/* Metric Info */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                                <span className={`px-3 py-1.5 text-xs font-bold rounded-full text-white ${config.bg} uppercase tracking-wide`}>
                                    {metric.category}
                                </span>
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    {metric.update_count} impact claim{metric.update_count !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">{metric.title}</h1>
                            {metric.description && (
                                <p className="text-lg text-muted-foreground max-w-2xl">{metric.description}</p>
                            )}
                        </div>
                        
                        {/* Big Total Card */}
                        <div className={`bg-gradient-to-br ${config.gradient} p-6 rounded-3xl text-white shadow-xl shadow-accent/10 min-w-[200px]`}>
                            <p className="text-white/80 text-sm font-medium mb-1">Total Impact</p>
                            <p className="text-4xl sm:text-5xl font-bold tracking-tight">
                                {metric.total_value.toLocaleString()}
                            </p>
                            <p className="text-white/80 text-sm mt-1">{metric.unit_of_measurement}</p>
                        </div>
                    </div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Chart - Takes 2 columns */}
                    <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-semibold text-foreground flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-accent" />
                                Cumulative Progress
                            </h2>
                            <span className="text-xs text-muted-foreground bg-gray-100 px-3 py-1 rounded-full">
                                All time
                            </span>
                        </div>
                        
                        {chartData.length === 0 ? (
                            <div className="h-72 flex items-center justify-center text-muted-foreground">
                                <div className="text-center">
                                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p>No impact claims recorded yet</p>
                                </div>
                            </div>
                        ) : (
                            <div className="h-72 p-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={cumulativeData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={config.accent} stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor={config.accent} stopOpacity={0.02}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis 
                                            dataKey="date" 
                                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                                            axisLine={{ stroke: '#e2e8f0' }}
                                            tickLine={false}
                                        />
                                        <YAxis 
                                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(value) => value.toLocaleString()}
                                        />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'white', 
                                                border: 'none',
                                                borderRadius: '16px',
                                                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                                                padding: '12px 16px'
                                            }}
                                            formatter={(value: number) => [
                                                `${value.toLocaleString()} ${metric.unit_of_measurement}`,
                                                'Cumulative Total'
                                            ]}
                                            labelFormatter={(label) => label}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="cumulative" 
                                            stroke={config.accent}
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#colorCumulative)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Impact Claims - Right side scrollable */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col max-h-[400px]">
                        <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
                            <h2 className="font-semibold text-foreground flex items-center gap-2">
                                <Target className="w-5 h-5 text-accent" />
                                Impact Claims
                            </h2>
                        </div>
                        
                        {metric.updates.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-muted-foreground p-6">
                                <div className="text-center">
                                    <Target className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No claims yet</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h2 className="font-semibold text-foreground flex items-center gap-2">
                            <FileText className="w-5 h-5 text-accent" />
                            Supporting Evidence
                        </h2>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${config.bg} text-white`}>
                            {metric.evidence_count} item{metric.evidence_count !== 1 ? 's' : ''}
                        </span>
                    </div>
                    
                    {metric.evidence.length === 0 ? (
                        <div className="py-16 text-center text-muted-foreground">
                            <FileText className="w-14 h-14 mx-auto mb-4 opacity-20" />
                            <p className="text-lg font-medium mb-1">No evidence linked yet</p>
                            <p className="text-sm">Evidence will appear here when linked to this metric</p>
                        </div>
                    ) : (
                        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {metric.evidence.map((ev) => (
                                <EvidenceCard key={ev.id} evidence={ev} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 border-t border-gray-100 bg-white/50 backdrop-blur-sm mt-12">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-muted-foreground">
                            Part of <Link to={`/org/${orgSlug}/${initiativeSlug}`} className="text-accent hover:underline font-medium">{metric.initiative.title}</Link>
                        </p>
                        <Link to={`/org/${orgSlug}`} className="text-sm text-accent hover:text-accent/80 font-medium flex items-center gap-1">
                            <ArrowLeft className="w-4 h-4" /> Back to Organization
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
        <div className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 hover:border-accent/30 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xl font-bold ${config.text}`}>
                            +{parseFloat(update.value).toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">{unit}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{displayDate}</span>
                    </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-accent/50 group-hover:text-accent transition-colors flex-shrink-0" />
            </div>
            {update.location && (
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span>{update.location.name}</span>
                </div>
            )}
            {update.note && (
                <p className="mt-2 text-xs text-muted-foreground line-clamp-2 italic">"{update.note}"</p>
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
        <div className="glass-card rounded-2xl border border-transparent hover:border-accent hover:shadow-[0_0_20px_rgba(192,223,161,0.3)] transition-all overflow-hidden">
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
                            <span className="text-sm text-muted-foreground">
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
                    <span className="text-xs text-muted-foreground">{new Date(evidence.date_represented).toLocaleDateString()}</span>
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1">{evidence.title}</h3>
                {evidence.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{evidence.description}</p>}
                
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
