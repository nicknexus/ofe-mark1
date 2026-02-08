import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
    ArrowLeft, Target, Calendar, MapPin, FileText, ExternalLink, CheckCircle2, BarChart3,
    ChevronLeft, ChevronRight, X
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { publicApi, PublicImpactClaimDetail, PublicEvidence } from '../services/publicApi'
import PublicBreadcrumb from '../components/public/PublicBreadcrumb'
import PublicLoader from '../components/public/PublicLoader'

// Category colors - matching PublicMetricPage
const categoryConfig: Record<string, { bg: string; text: string; accent: string }> = {
    impact: { bg: 'bg-purple-500', text: 'text-purple-600', accent: '#8b5cf6' },
    output: { bg: 'bg-accent', text: 'text-accent', accent: '#c0dfa1' },
    input: { bg: 'bg-blue-500', text: 'text-blue-600', accent: '#3b82f6' }
}

// Map tile
const CARTO_VOYAGER_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

function TileLayerWithFallback() {
    const [useFallback, setUseFallback] = useState(false)
    const map = useMap()

    useEffect(() => {
        if (useFallback) return
        const testImg = new Image()
        testImg.onerror = () => setUseFallback(true)
        testImg.src = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/0/0/0.png'
        return () => { testImg.onerror = null }
    }, [useFallback])

    return (
        <TileLayer
            attribution={useFallback ? '&copy; OpenStreetMap contributors' : CARTO_ATTRIBUTION}
            url={useFallback ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' : CARTO_VOYAGER_URL}
            subdomains={['a', 'b', 'c', 'd']}
            maxZoom={20}
        />
    )
}

function MapResizeHandler() {
    const map = useMap()
    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => map.invalidateSize())
        resizeObserver.observe(map.getContainer())
        map.invalidateSize()
        return () => resizeObserver.disconnect()
    }, [map])
    return null
}

export default function PublicImpactClaimPage() {
    const { orgSlug, initiativeSlug, claimId } = useParams<{
        orgSlug: string
        initiativeSlug: string
        claimId: string
    }>()
    const [searchParams] = useSearchParams()
    const from = searchParams.get('from')

    const [claim, setClaim] = useState<PublicImpactClaimDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Evidence gallery state
    const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
    const [currentFileIndex, setCurrentFileIndex] = useState(0)

    useEffect(() => {
        const loadClaim = async () => {
            if (!orgSlug || !initiativeSlug || !claimId) return

            try {
                setLoading(true)
                setError(null)
                const data = await publicApi.getImpactClaimDetail(orgSlug, initiativeSlug, claimId)
                setClaim(data)
            } catch (err) {
                console.error('Error loading impact claim:', err)
                setError('Failed to load impact claim')
            } finally {
                setLoading(false)
            }
        }

        loadClaim()
    }, [orgSlug, initiativeSlug, claimId])

    if (loading) {
        return <PublicLoader message="Loading impact claim..." />
    }

    if (error || !claim) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="bg-white/50 backdrop-blur-2xl border border-white/60 shadow-xl p-12 rounded-3xl text-center max-w-md">
                    <Target className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-gray-800 mb-3">Impact Claim Not Found</h1>
                    <p className="text-gray-500 mb-8">{error || 'This impact claim does not exist.'}</p>
                    <Link to={`/org/${orgSlug}/${initiativeSlug}?tab=metrics`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4" /> Back to Metrics
                    </Link>
                </div>
            </div>
        )
    }

    const config = categoryConfig[claim.metric.category] || categoryConfig.output
    const brandColor = claim.initiative.brand_color || '#c0dfa1'

    const hasDateRange = claim.date_range_start && claim.date_range_end
    const displayDate = hasDateRange
        ? `${new Date(claim.date_range_start!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(claim.date_range_end!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : new Date(claim.date_represented).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    // Custom marker for map
    const locationIcon = L.divIcon({
        className: 'custom-marker',
        html: `
            <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background-color: ${config.accent}; opacity: 0.3;"></div>
                <div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${config.accent}; border: 3px solid white; position: relative; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                    <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; border-radius: 50%; background-color: white;"></div>
                </div>
            </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    })

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
                        <Link
                            to={from === 'org' ? `/org/${orgSlug}` : `/org/${orgSlug}/${initiativeSlug}/metric/${claim.metric.slug}`}
                            className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-xs sm:text-sm font-medium">
                                {from === 'org' ? `Back to ${claim.initiative.org_name || 'Organization'}` : `Back to ${claim.metric.title}`}
                            </span>
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
                {/* Breadcrumb */}
                <div className="hidden sm:block">
                    <PublicBreadcrumb
                        orgSlug={orgSlug!}
                        orgName={claim.initiative.org_name || ''}
                        items={from === 'org' ? [
                            { label: `+${parseFloat(String(claim.value)).toLocaleString()} ${claim.metric.unit_of_measurement}` }
                        ] : [
                            { label: claim.initiative.title, href: `/org/${orgSlug}/${initiativeSlug}?tab=metrics` },
                            { label: claim.metric.title, href: `/org/${orgSlug}/${initiativeSlug}/metric/${claim.metric.slug}` },
                            { label: `+${parseFloat(String(claim.value)).toLocaleString()} ${claim.metric.unit_of_measurement}` }
                        ]}
                    />
                </div>

                {/* Hero Section */}
                <div className="mb-5 sm:mb-8">
                    <div className="flex flex-col gap-4 sm:gap-6">
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                <span className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-full text-white ${config.bg} uppercase tracking-wide`}>
                                    {claim.metric.category}
                                </span>
                                <span className="text-xs sm:text-sm text-gray-500 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                    Verified Impact Claim
                                </span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">
                                {claim.metric.title}
                            </h1>
                            {claim.metric.description && (
                                <p className="text-sm sm:text-lg text-gray-600 max-w-2xl line-clamp-2 sm:line-clamp-none">{claim.metric.description}</p>
                            )}
                        </div>

                        {/* Value Card */}
                        <div className="bg-white/70 backdrop-blur-2xl p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl shadow-black/10 border border-white/60 lg:min-w-[200px] lg:max-w-[240px]">
                            <p className="text-gray-500 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">Claimed Impact</p>
                            <p className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight ${config.text}`}>
                                +{parseFloat(String(claim.value)).toLocaleString()}
                            </p>
                            <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">{claim.metric.unit_of_measurement}</p>
                        </div>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-5 sm:mb-8">
                    {/* Claim Details */}
                    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-xl shadow-black/5 overflow-hidden">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40">
                            <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                                Claim Details
                            </h2>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4">
                            {/* Date */}
                            <div>
                                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide mb-1">Date</p>
                                <div className="flex items-center gap-2 text-sm text-gray-800">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    {displayDate}
                                </div>
                            </div>

                            {/* Location */}
                            {claim.location && (
                                <div>
                                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide mb-1">Location</p>
                                    <div className="flex items-center gap-2 text-sm text-gray-800">
                                        <MapPin className="w-4 h-4 text-gray-400" />
                                        {claim.location.name}
                                    </div>
                                    {claim.location.description && (
                                        <p className="text-xs text-gray-500 mt-0.5 ml-6">{claim.location.description}</p>
                                    )}
                                </div>
                            )}

                            {/* Note */}
                            {claim.note && (
                                <div>
                                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide mb-1">Note</p>
                                    <p className="text-sm text-gray-700 italic">"{claim.note}"</p>
                                </div>
                            )}

                            {/* Label */}
                            {claim.label && (
                                <div>
                                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide mb-1">Label</p>
                                    <span className="px-2.5 py-1 bg-white/60 border border-white/80 rounded-lg text-sm text-gray-700 font-medium">{claim.label}</span>
                                </div>
                            )}

                            {/* Metric Link */}
                            <div className="pt-3 border-t border-gray-100">
                                <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide mb-1.5">Part of Metric</p>
                                <Link
                                    to={`/org/${orgSlug}/${initiativeSlug}/metric/${claim.metric.slug}`}
                                    className="flex items-center gap-2 p-3 bg-white/60 border border-white/80 rounded-xl hover:bg-white/80 hover:shadow-md transition-all group"
                                >
                                    <BarChart3 className={`w-5 h-5 ${config.text} flex-shrink-0`} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-800 group-hover:text-accent transition-colors truncate">{claim.metric.title}</p>
                                        <p className="text-[10px] text-gray-500">{claim.metric.unit_of_measurement} • {claim.metric.category}</p>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Location Map */}
                    <div className="lg:col-span-2 bg-white/50 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-xl shadow-black/5 overflow-hidden flex flex-col">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40">
                            <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                                Location
                            </h2>
                        </div>

                        {claim.location ? (
                            <div className="flex-1 min-h-[250px] sm:min-h-[300px]">
                                <MapContainer
                                    center={[claim.location.latitude, claim.location.longitude]}
                                    zoom={10}
                                    className="w-full h-full"
                                    zoomControl={true}
                                    scrollWheelZoom={true}
                                >
                                    <MapResizeHandler />
                                    <TileLayerWithFallback />
                                    <Marker position={[claim.location.latitude, claim.location.longitude]} icon={locationIcon}>
                                        <Tooltip direction="top" offset={[0, -15]}>
                                            <div className="font-sans">
                                                <p className="font-semibold text-sm">{claim.location.name}</p>
                                                {claim.location.description && <p className="text-xs text-gray-500">{claim.location.description}</p>}
                                            </div>
                                        </Tooltip>
                                    </Marker>
                                </MapContainer>
                            </div>
                        ) : (
                            <div className="flex-1 min-h-[250px] flex items-center justify-center text-gray-500">
                                <div className="text-center">
                                    <MapPin className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">No location data for this claim</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Evidence Section */}
                <EvidenceGallerySection
                    evidence={claim.evidence}
                    evidenceCount={claim.evidence_count}
                    config={config}
                    galleryIndex={galleryIndex}
                    setGalleryIndex={setGalleryIndex}
                    currentFileIndex={currentFileIndex}
                    setCurrentFileIndex={setCurrentFileIndex}
                    orgSlug={orgSlug!}
                    initiativeSlug={initiativeSlug!}
                />
            </div>

            {/* Footer */}
            <div className="relative z-10 border-t border-white/40 bg-white/40 backdrop-blur-xl mt-8 sm:mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                        <p className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                            Part of <Link to={`/org/${orgSlug}/${initiativeSlug}/metric/${claim.metric.slug}`} className="text-accent hover:underline font-medium">{claim.metric.title}</Link>
                            {' '}in <Link to={`/org/${orgSlug}/${initiativeSlug}`} className="text-accent hover:underline font-medium">{claim.initiative.title}</Link>
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

// Generate slug from metric title
function generateMetricSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
}

// ===== Evidence Gallery Section =====
function EvidenceGallerySection({ evidence, evidenceCount, config, galleryIndex, setGalleryIndex, currentFileIndex, setCurrentFileIndex, orgSlug, initiativeSlug }: {
    evidence: PublicEvidence[]
    evidenceCount: number
    config: { bg: string; text: string; accent: string }
    galleryIndex: number | null
    setGalleryIndex: (i: number | null) => void
    orgSlug: string
    initiativeSlug: string
    currentFileIndex: number
    setCurrentFileIndex: (i: number | ((prev: number) => number)) => void
}) {
    const typeConfig: Record<string, { bg: string; label: string }> = {
        visual_proof: { bg: 'bg-pink-100 text-pink-800', label: 'Visual Proof' },
        documentation: { bg: 'bg-blue-100 text-blue-700', label: 'Documentation' },
        testimony: { bg: 'bg-orange-100 text-orange-800', label: 'Testimonies' },
        financials: { bg: 'bg-primary-100 text-primary-800', label: 'Financials' }
    }

    const isImageFile = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || ''
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
    }

    const isPdfFile = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || ''
        return ext === 'pdf'
    }

    const getPreviewUrl = (item: PublicEvidence) => {
        if (item.files && item.files.length > 0) {
            const imageFile = item.files.find(f => isImageFile(f.file_url))
            if (imageFile) return imageFile.file_url
        }
        if (item.file_url && isImageFile(item.file_url)) return item.file_url
        return null
    }

    const getAllFiles = (item: PublicEvidence) => {
        if (item.files && item.files.length > 0) return item.files
        if (item.file_url) return [{ id: '0', file_url: item.file_url, file_name: item.title, file_type: item.type, display_order: 0 }]
        return []
    }

    // Gallery helpers
    const galleryItem = galleryIndex !== null ? evidence[galleryIndex] : null
    const galleryFiles = galleryItem ? getAllFiles(galleryItem) : []
    const galleryFile = galleryFiles[currentFileIndex] || null

    const openGallery = (index: number) => { setGalleryIndex(index); setCurrentFileIndex(0) }
    const closeGallery = useCallback(() => { setGalleryIndex(null); setCurrentFileIndex(0) }, [setGalleryIndex, setCurrentFileIndex])

    const goToPrev = useCallback(() => {
        if (galleryIndex === null) return
        setGalleryIndex(galleryIndex === 0 ? evidence.length - 1 : galleryIndex - 1)
        setCurrentFileIndex(0)
    }, [galleryIndex, evidence.length, setGalleryIndex, setCurrentFileIndex])

    const goToNext = useCallback(() => {
        if (galleryIndex === null) return
        setGalleryIndex((galleryIndex + 1) % evidence.length)
        setCurrentFileIndex(0)
    }, [galleryIndex, evidence.length, setGalleryIndex, setCurrentFileIndex])

    // Keyboard nav
    useEffect(() => {
        if (galleryIndex === null) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeGallery()
            else if (e.key === 'ArrowLeft') {
                if (galleryFiles.length > 1 && !e.shiftKey) setCurrentFileIndex(i => i === 0 ? galleryFiles.length - 1 : i - 1)
                else goToPrev()
            } else if (e.key === 'ArrowRight') {
                if (galleryFiles.length > 1 && !e.shiftKey) {
                    setCurrentFileIndex(i => {
                        if (i + 1 >= galleryFiles.length) { goToNext(); return 0 }
                        return i + 1
                    })
                } else goToNext()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [galleryIndex, galleryFiles.length, closeGallery, goToPrev, goToNext, setCurrentFileIndex])

    // Lock scroll
    useEffect(() => {
        if (galleryIndex !== null) {
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = '' }
        }
    }, [galleryIndex])

    return (
        <>
            <div className="bg-white/50 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-xl shadow-black/5 overflow-hidden">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                        Supporting Evidence
                    </h2>
                    <span className={`text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1 rounded-full ${config.bg} text-white`}>
                        {evidenceCount} item{evidenceCount !== 1 ? 's' : ''}
                    </span>
                </div>

                {evidence.length === 0 ? (
                    <div className="py-10 sm:py-16 text-center text-gray-500 px-4">
                        <FileText className="w-10 h-10 sm:w-14 sm:h-14 mx-auto mb-3 sm:mb-4 opacity-20" />
                        <p className="text-sm sm:text-lg font-medium mb-1">No evidence linked yet</p>
                        <p className="text-xs sm:text-sm">Evidence will appear here when linked to this claim</p>
                    </div>
                ) : (
                    <div className="p-3 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                        {evidence.map((ev, idx) => {
                            const previewUrl = getPreviewUrl(ev)
                            const fileCount = ev.files?.length || (ev.file_url ? 1 : 0)
                            const evTypeConfig = typeConfig[ev.type] || { bg: 'bg-gray-100 text-gray-600', label: ev.type }

                            return (
                                <button
                                    key={ev.id}
                                    onClick={() => openGallery(idx)}
                                    className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50 hover:bg-white/80 hover:shadow-lg hover:border-accent transition-all overflow-hidden group text-left"
                                >
                                    {previewUrl ? (
                                        <div className="relative aspect-video bg-gray-100 overflow-hidden">
                                            <img src={previewUrl} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            {fileCount > 1 && (
                                                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">{fileCount} files</div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="aspect-video bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center">
                                            <div className="text-center">
                                                <FileText className="w-10 h-10 text-accent/50 mx-auto mb-2" />
                                                <span className="text-sm text-gray-500">{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${evTypeConfig.bg}`}>{evTypeConfig.label}</span>
                                            <span className="text-xs text-gray-500">{new Date(ev.date_represented).toLocaleDateString()}</span>
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-sm mb-1 group-hover:text-accent transition-colors">{ev.title}</h3>
                                        {ev.description && <p className="text-xs text-gray-500 line-clamp-2">{ev.description}</p>}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Evidence Gallery Modal — portaled to body to escape z-10 stacking context */}
            {galleryIndex !== null && galleryItem && createPortal(
                <div className="fixed inset-0 z-[100]">
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-2xl" onClick={closeGallery} />

                    <div className="relative z-10 w-full h-full max-w-6xl mx-auto flex flex-col p-3 sm:p-6">
                        {/* Top bar */}
                        <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <button onClick={closeGallery} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-sm font-medium">Back to Evidence</span>
                                </button>
                                <div className="h-5 w-px bg-gray-200" />
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${typeConfig[galleryItem.type]?.bg || 'bg-gray-100 text-gray-600'}`}>
                                    {typeConfig[galleryItem.type]?.label || galleryItem.type}
                                </span>
                                <span className="text-muted-foreground text-sm">{galleryIndex + 1} of {evidence.length}</span>
                            </div>
                            <button onClick={closeGallery} className="w-9 h-9 rounded-full bg-white/60 hover:bg-white/80 border border-gray-200/50 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Main area */}
                        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
                            {/* File preview */}
                            <div className="lg:col-span-2 flex flex-col">
                                <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 overflow-hidden flex-1 flex flex-col">
                                    <div className="relative bg-gray-900 flex-1 min-h-[250px] sm:min-h-[400px] flex items-center justify-center">
                                        {galleryFile ? (
                                            isImageFile(galleryFile.file_url) ? (
                                                <img src={galleryFile.file_url} alt={galleryFile.file_name || galleryItem.title} className="max-w-full max-h-full object-contain" />
                                            ) : isPdfFile(galleryFile.file_url) ? (
                                                <iframe src={galleryFile.file_url} className="w-full h-full" title={galleryFile.file_name || galleryItem.title} />
                                            ) : (
                                                <div className="text-center text-white">
                                                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                                    <p className="text-sm opacity-70 mb-4">{galleryFile.file_name}</p>
                                                    <a href={galleryFile.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm">
                                                        <ExternalLink className="w-4 h-4" /> Open File
                                                    </a>
                                                </div>
                                            )
                                        ) : (
                                            <div className="text-center text-white/50">
                                                <FileText className="w-16 h-16 mx-auto mb-4" />
                                                <p>No preview available</p>
                                            </div>
                                        )}

                                        {galleryFiles.length > 1 && (
                                            <>
                                                <button onClick={() => setCurrentFileIndex(i => i === 0 ? galleryFiles.length - 1 : i - 1)} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors">
                                                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                                <button onClick={() => setCurrentFileIndex(i => (i + 1) % galleryFiles.length)} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors">
                                                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                                                    {galleryFiles.map((_, i) => (
                                                        <button key={i} onClick={() => setCurrentFileIndex(i)} className={`h-1.5 rounded-full transition-all ${i === currentFileIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'}`} />
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="px-3 sm:px-4 py-2 sm:py-3 bg-white/30 border-t border-white/30 flex items-center justify-between gap-2">
                                        <span className="text-xs sm:text-sm text-gray-600 truncate flex-1">
                                            {galleryFile?.file_name}
                                            {galleryFiles.length > 1 && <span className="text-[10px] sm:text-xs text-gray-400 ml-2">({currentFileIndex + 1}/{galleryFiles.length})</span>}
                                        </span>
                                        {galleryFile?.file_url && (
                                            <a href={galleryFile.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-xs font-medium flex-shrink-0">
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Open in New Tab</span>
                                                <span className="sm:hidden">Open</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar */}
                            <div className="lg:col-span-1 flex flex-col gap-3 sm:gap-4 min-h-0 overflow-y-auto">
                                <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 p-4 sm:p-5 flex-shrink-0">
                                    <h2 className="font-semibold text-foreground text-base sm:text-lg mb-1">{galleryItem.title}</h2>
                                    {galleryItem.description && <p className="text-muted-foreground text-xs sm:text-sm mb-3 line-clamp-4">{galleryItem.description}</p>}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {new Date(galleryItem.date_represented).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </div>
                                    {galleryItem.locations && galleryItem.locations.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1">
                                            {galleryItem.locations.map((loc) => (
                                                <span key={loc.id} className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded font-medium">{loc.name}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Linked Metrics */}
                                {galleryItem.kpis && galleryItem.kpis.length > 0 && (
                                    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 p-4 sm:p-5 flex-shrink-0">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Linked Metrics</h3>
                                        <div className="space-y-2">
                                            {galleryItem.kpis.map((kpi) => {
                                                const badgeColor = kpi.category === 'impact'
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : kpi.category === 'output'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                return (
                                                    <Link key={kpi.id} to={`/org/${orgSlug}/${initiativeSlug}/metric/${generateMetricSlug(kpi.title)}`} className="block p-3 rounded-xl bg-white/60 border border-white/80 hover:bg-white/80 hover:border-accent/30 hover:shadow-md transition-all group">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">{kpi.title}</p>
                                                            {kpi.category && (
                                                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${badgeColor} capitalize flex-shrink-0`}>
                                                                    {kpi.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {kpi.unit_of_measurement && (
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.unit_of_measurement}</p>
                                                        )}
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom nav */}
                        <div className="flex items-center justify-between mt-3 sm:mt-4 flex-shrink-0">
                            <button onClick={goToPrev} className="flex items-center gap-2 px-4 py-2.5 bg-white/60 hover:bg-white/80 border border-gray-200/50 text-foreground rounded-xl transition-colors text-sm font-medium shadow-sm">
                                <ChevronLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Previous</span>
                            </button>

                            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[50vw] scrollbar-hide px-2">
                                {evidence.map((item, i) => {
                                    const thumb = getPreviewUrl(item)
                                    return (
                                        <button key={item.id} onClick={() => { setGalleryIndex(i); setCurrentFileIndex(0) }}
                                            className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shadow-sm ${i === galleryIndex ? 'border-gray-800 scale-110 shadow-md' : 'border-white/60 opacity-60 hover:opacity-90 hover:border-gray-300'}`}>
                                            {thumb ? (
                                                <img src={thumb} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 flex items-center justify-center"><FileText className="w-4 h-4 text-gray-400" /></div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>

                            <button onClick={goToNext} className="flex items-center gap-2 px-4 py-2.5 bg-white/60 hover:bg-white/80 border border-gray-200/50 text-foreground rounded-xl transition-colors text-sm font-medium shadow-sm">
                                <span className="hidden sm:inline">Next</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
