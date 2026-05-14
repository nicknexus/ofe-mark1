import React, { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrgLinkBase } from '../../../hooks/useOrgLinkBase'
import { ArrowLeft, BarChart3, BookOpen, ChevronRight, FileText, Loader2, MapPin } from 'lucide-react'
import { MapContainer } from 'react-leaflet'
import { publicApi, LocationDetail, PublicLocation } from '../../../services/publicApi'
import { formatAbbreviatedMetricTotal, formatDate } from '../../../utils'
import { ClickableLocationMarker, MapResizeHandler, TileLayerWithFallback } from './PublicInitiativeMap'
import { EmptyState, LoadingState } from './PublicInitiativeTabStates'

export function LocationsTab({ locations, orgSlug, initiativeSlug, dateQS = '' }: { locations: PublicLocation[] | null; orgSlug: string; initiativeSlug: string; dateQS?: string }) {
    const orgLinkBase = useOrgLinkBase()
    const [selectedLocation, setSelectedLocation] = useState<PublicLocation | null>(null)
    const [locationDetail, setLocationDetail] = useState<LocationDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    const openLocationDetail = useCallback(async (loc: PublicLocation) => {
        setSelectedLocation(loc)
        setDetailLoading(true)
        try {
            const detail = await publicApi.getLocationDetail(orgSlug, initiativeSlug, loc.id)
            setLocationDetail(detail)
        } catch (err) {
            console.error('Error loading location detail:', err)
        } finally {
            setDetailLoading(false)
        }
    }, [orgSlug, initiativeSlug])

    const closeDetail = useCallback(() => {
        setSelectedLocation(null)
        setLocationDetail(null)
    }, [])

    if (!locations) return <LoadingState />
    if (locations.length === 0) return <EmptyState icon={MapPin} message="No locations available yet." />

    const categoryConfig: Record<string, { bg: string; text: string }> = {
        impact: { bg: 'bg-purple-100', text: 'text-purple-700' },
        output: { bg: 'bg-green-100', text: 'text-green-700' },
        input: { bg: 'bg-evidence-100', text: 'text-evidence-700' }
    }

    // If a location is selected, show the detail view instead of the map entirely
    if (selectedLocation) {
        const evType: Record<string, string> = { visual_proof: 'Visual Proof', documentation: 'Documentation', testimony: 'Testimonies', financials: 'Financials' }
        const isImage = (url: string) => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(url.split('.').pop()?.toLowerCase() || '')
        const isYTUrl = (url: string) => url ? /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(url) : false
        const getYTId = (url: string): string | null => { const m = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/); return m ? m[1] : null }

        return (
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={closeDetail} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-sm font-medium">Back to Locations</span>
                        </button>
                        <div className="h-5 w-px bg-gray-200" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-accent" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-foreground text-sm sm:text-base">{selectedLocation.name}</h2>
                                {selectedLocation.description && <p className="text-xs text-muted-foreground">{selectedLocation.description}</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {detailLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    </div>
                ) : locationDetail ? (
                    locationDetail.metrics.length === 0 && locationDetail.evidence.length === 0 && locationDetail.stories.length === 0 ? (
                        <div className="text-center py-20">
                            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-sm text-muted-foreground">No activity recorded at this location yet</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Stories */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-accent" />
                                        <h3 className="font-semibold text-gray-800 text-sm">Stories</h3>
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">{locationDetail.stories.length}</span>
                                </div>
                                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                    {locationDetail.stories.length === 0 ? (
                                        <div className="text-center py-10">
                                            <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-xs text-muted-foreground">No stories here yet</p>
                                        </div>
                                    ) : locationDetail.stories.map((story) => (
                                        <Link key={story.id} to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/story/${story.id}${dateQS}`}
                                            className="block rounded-xl border border-gray-100 hover:border-accent/30 p-3 transition-colors">
                                            {story.media_url && story.media_type === 'photo' && (
                                                <img src={story.media_url} alt={story.title} loading="lazy" className="w-full h-32 object-cover rounded-lg mb-2" />
                                            )}
                                            <h4 className="text-sm font-medium text-foreground">{story.title}</h4>
                                            {story.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{story.description}</p>}
                                            <p className="text-xs text-muted-foreground mt-1">{formatDate(story.date_represented)}</p>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-accent" />
                                        <h3 className="font-semibold text-gray-800 text-sm">Metrics</h3>
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">{locationDetail.metrics.length}</span>
                                </div>
                                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                    {locationDetail.metrics.length === 0 ? (
                                        <div className="text-center py-10">
                                            <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-xs text-muted-foreground">No metrics here yet</p>
                                        </div>
                                    ) : locationDetail.metrics.map((m) => {
                                        const cat = categoryConfig[m.category] || categoryConfig.output
                                        return (
                                            <Link key={m.id} to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${m.slug}${dateQS}`}
                                                className="block p-3 rounded-xl border border-gray-100 hover:border-accent/30 transition-colors">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-foreground">{m.title}</p>
                                                        <p className="text-lg font-bold text-foreground mt-0.5">{formatAbbreviatedMetricTotal(m.total_value, { isPercentage: m.metric_type === 'percentage' })}{m.metric_type === 'percentage' ? '%' : ''} <span className="text-xs font-normal text-muted-foreground">{m.metric_type === 'percentage' ? 'avg' : m.unit_of_measurement}</span></p>
                                                        <p className="text-xs text-muted-foreground">{m.claim_count} claim{m.claim_count !== 1 ? 's' : ''} at this location</p>
                                                    </div>
                                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${cat.bg} ${cat.text} capitalize`}>{m.category}</span>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Evidence */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-accent" />
                                        <h3 className="font-semibold text-gray-800 text-sm">Evidence</h3>
                                    </div>
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">{locationDetail.evidence.length}</span>
                                </div>
                                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                    {locationDetail.evidence.length === 0 ? (
                                        <div className="text-center py-10">
                                            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-xs text-muted-foreground">No evidence here yet</p>
                                        </div>
                                    ) : locationDetail.evidence.map((ev) => {
                                        const imgPreview = ev.files?.find(f => isImage(f.file_url))?.file_url || (ev.file_url && isImage(ev.file_url) ? ev.file_url : null)
                                        const ytUrl = !imgPreview ? (ev.files?.find(f => isYTUrl(f.file_url))?.file_url || (ev.file_url && isYTUrl(ev.file_url) ? ev.file_url : null)) : null
                                        const ytId = ytUrl ? getYTId(ytUrl) : null
                                        const preview = imgPreview || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null)
                                        return (
                                            <Link key={ev.id} to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/evidence/${ev.id}${dateQS}`}
                                                className="block rounded-xl border border-gray-100 hover:border-accent/30 p-3 transition-colors">
                                                {preview && (
                                                    <div className="relative">
                                                        <img src={preview} alt={ev.title} loading="lazy" className="w-full h-32 object-cover rounded-lg mb-2" />
                                                        {ytId && (
                                                            <div className="absolute inset-0 flex items-center justify-center mb-2">
                                                                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                                                                    <svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <span className="text-xs text-muted-foreground">{evType[ev.type] || ev.type}</span>
                                                <h4 className="text-sm font-medium text-foreground mt-0.5">{ev.title}</h4>
                                                {ev.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ev.description}</p>}
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="text-center py-20">
                        <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">Failed to load location details</p>
                    </div>
                )}
            </div>
        )
    }

    const mapCenter = [
        locations.reduce((sum, l) => sum + l.latitude, 0) / locations.length,
        locations.reduce((sum, l) => sum + l.longitude, 0) / locations.length
    ] as [number, number]

    return (
        <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 h-[450px] rounded-xl overflow-hidden border border-gray-200">
                    <MapContainer center={mapCenter} zoom={locations.length === 1 ? 8 : 3} className="w-full h-full" zoomControl={true} scrollWheelZoom={true}>
                        <MapResizeHandler />
                        <TileLayerWithFallback />
                        {locations.map((location) => (
                            <ClickableLocationMarker key={location.id} location={location} onClick={openLocationDetail} />
                        ))}
                    </MapContainer>
                </div>
                <div className="space-y-2 max-h-[450px] overflow-y-auto">
                    {locations.map((location) => (
                        <button
                            key={location.id}
                            onClick={() => openLocationDetail(location)}
                            className="w-full text-left bg-gradient-to-r from-accent/5 to-transparent rounded-xl p-3 border border-transparent hover:border-accent hover:shadow-md transition-all group"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-accent/30 transition-colors">
                                    <MapPin className="w-4 h-4 text-accent" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-medium text-foreground text-sm group-hover:text-accent transition-colors">{location.name}</h4>
                                    {location.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{location.description}</p>}
                                    <p className="text-xs text-muted-foreground mt-1">{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent flex-shrink-0 mt-2 transition-colors" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
