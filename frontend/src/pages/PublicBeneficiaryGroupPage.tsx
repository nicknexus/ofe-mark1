import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useOrgLinkBase } from '../hooks/useOrgLinkBase'
import {
    ArrowLeft, Users, BarChart3, FileText, MapPin, Calendar,
    BookOpen, Camera, MessageSquare, DollarSign, Info
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { publicApi, PublicBeneficiaryGroupDetail, PublicMetricTag } from '../services/publicApi'
import PublicBreadcrumb from '../components/public/PublicBreadcrumb'
import PublicLoader from '../components/public/PublicLoader'
import PublicTagFilter from '../components/public/PublicTagFilter'
import PublicTagChip from '../components/public/PublicTagChip'
import { formatDate } from '../utils'

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

function FitBoundsToLocations({ locations }: { locations: { latitude: number; longitude: number }[] }) {
    const map = useMap()
    useEffect(() => {
        if (locations.length === 0) return
        if (locations.length === 1) {
            map.setView([locations[0].latitude, locations[0].longitude], 12)
            return
        }
        const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude]))
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }, [map, locations])
    return null
}

function createLocationIcon() {
    const size = 32
    const color = '#c0dfa1'
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
            <div style="width:20px;height:20px;border-radius:50%;background:${color};border:3px solid white;position:relative;z-index:10;">
                <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background:white;"></div>
            </div>
        </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    })
}

const locationMarkerIcon = createLocationIcon()

const categoryConfig: Record<string, { bg: string; text: string }> = {
    impact: { bg: 'bg-purple-100', text: 'text-purple-700' },
    output: { bg: 'bg-green-100', text: 'text-green-700' },
    input: { bg: 'bg-blue-100', text: 'text-blue-700' }
}

const evidenceTypeColors: Record<string, { headerBg: string; headerIcon: string; cardBg: string; cardBorder: string; itemBorder: string; dotColor: string }> = {
    visual_proof: { headerBg: 'bg-gradient-to-r from-pink-100/80 to-rose-100/60', headerIcon: 'text-pink-700', cardBg: 'bg-gradient-to-br from-pink-50/50 to-rose-50/30', cardBorder: 'border-pink-100/60', itemBorder: 'border-pink-100/40', dotColor: 'bg-pink-400' },
    documentation: { headerBg: 'bg-gradient-to-r from-blue-100/80 to-indigo-100/60', headerIcon: 'text-blue-700', cardBg: 'bg-gradient-to-br from-blue-50/50 to-indigo-50/30', cardBorder: 'border-blue-100/60', itemBorder: 'border-blue-100/40', dotColor: 'bg-blue-400' },
    testimony: { headerBg: 'bg-gradient-to-r from-orange-100/80 to-amber-100/60', headerIcon: 'text-orange-700', cardBg: 'bg-gradient-to-br from-orange-50/50 to-amber-50/30', cardBorder: 'border-orange-100/60', itemBorder: 'border-orange-100/40', dotColor: 'bg-orange-400' },
    financials: { headerBg: 'bg-gradient-to-r from-emerald-100/80 to-teal-100/60', headerIcon: 'text-emerald-700', cardBg: 'bg-gradient-to-br from-emerald-50/50 to-teal-50/30', cardBorder: 'border-emerald-100/60', itemBorder: 'border-emerald-100/40', dotColor: 'bg-emerald-400' },
}

const defaultColors = { headerBg: 'bg-gradient-to-r from-gray-100/80 to-slate-100/60', headerIcon: 'text-gray-700', cardBg: 'bg-gradient-to-br from-gray-50/50 to-slate-50/30', cardBorder: 'border-gray-100/60', itemBorder: 'border-gray-100/40', dotColor: 'bg-gray-400' }

const evidenceTypeLabels: Record<string, string> = {
    visual_proof: 'Visual Proof',
    documentation: 'Documentation',
    testimony: 'Testimony',
    financials: 'Financial Records',
}

function getEvidenceIcon(type: string) {
    switch (type) {
        case 'visual_proof': return Camera
        case 'testimony': return MessageSquare
        case 'financials': return DollarSign
        default: return FileText
    }
}

function generateMetricSlug(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

export default function PublicBeneficiaryGroupPage() {
    const { orgSlug, initiativeSlug, groupId } = useParams<{
        orgSlug: string
        initiativeSlug: string
        groupId: string
    }>()
    const orgLinkBase = useOrgLinkBase()

    const [data, setData] = useState<PublicBeneficiaryGroupDetail | null>(null)
    const [tags, setTags] = useState<PublicMetricTag[]>([])
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!orgSlug || !initiativeSlug || !groupId) return
        setLoading(true)
        setError(null)
        publicApi.getBeneficiaryGroupDetail(orgSlug, initiativeSlug, groupId)
            .then(setData)
            .catch(() => setError('Failed to load beneficiary group'))
            .finally(() => setLoading(false))
    }, [orgSlug, initiativeSlug, groupId])

    useEffect(() => {
        if (orgSlug) {
            publicApi.getOrganizationTags(orgSlug).then(setTags).catch(() => setTags([]))
        }
    }, [orgSlug])

    const tagsById = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags])

    // Tags actually used on this page's content — drives the dropdown.
    const groupTagIds = useMemo(() => {
        if (!data) return new Set<string>()
        const set = new Set<string>()
        data.claims.forEach(c => { if (c.tag_id) set.add(c.tag_id) })
        data.evidence.forEach(e => (e.tag_ids || []).forEach(id => set.add(id)))
        data.stories.forEach(s => (s.tag_ids || []).forEach(id => set.add(id)))
        return set
    }, [data])

    const groupTags = useMemo(() => tags.filter(t => groupTagIds.has(t.id)), [tags, groupTagIds])

    const tagMatchSingle = (id?: string | null) => {
        if (selectedTagIds.length === 0) return true
        if (!id) return false
        return selectedTagIds.includes(id)
    }
    const tagMatchAny = (ids?: string[] | null) => {
        if (selectedTagIds.length === 0) return true
        if (!ids || ids.length === 0) return false
        return ids.some(i => selectedTagIds.includes(i))
    }

    const filteredStories = useMemo(
        () => data ? data.stories.filter(s => tagMatchAny(s.tag_ids)) : [],
        [data, selectedTagIds]
    )
    const filteredClaims = useMemo(
        () => data ? data.claims.filter(c => tagMatchSingle(c.tag_id)) : [],
        [data, selectedTagIds]
    )
    const filteredEvidence = useMemo(
        () => data ? data.evidence.filter(e => tagMatchAny(e.tag_ids)) : [],
        [data, selectedTagIds]
    )

    const metricsByKPI = useMemo(() => {
        if (!data) return {}
        const map: Record<string, { kpi: any; claims: any[]; total: number }> = {}
        filteredClaims.forEach(c => {
            const kpiId = c.kpi?.id || 'unknown'
            if (!map[kpiId]) map[kpiId] = { kpi: c.kpi, claims: [], total: 0 }
            map[kpiId].claims.push(c)
            map[kpiId].total += (c.value || 0)
        })
        return map
    }, [data, filteredClaims])

    const evidenceByType = useMemo(() => {
        if (!data) return {}
        const map: Record<string, typeof data.evidence> = {}
        filteredEvidence.forEach(e => {
            const type = e.type || 'other'
            if (!map[type]) map[type] = []
            map[type].push(e)
        })
        return map
    }, [data, filteredEvidence])

    const mapLocations = useMemo(() => {
        if (!data) return []
        return data.locations.filter(l => l.latitude && l.longitude)
    }, [data])

    if (loading) return <PublicLoader message="Loading beneficiary group..." />

    if (error || !data) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="bg-white/50 backdrop-blur-2xl border border-white/60 shadow-xl p-12 rounded-3xl text-center max-w-md">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-gray-800 mb-3">Beneficiary Group Not Found</h1>
                    <p className="text-gray-500 mb-8">{error || 'This beneficiary group does not exist.'}</p>
                    <Link to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}?tab=beneficiaries`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4" /> Back to Beneficiaries
                    </Link>
                </div>
            </div>
        )
    }

    const brandColor = data.initiative.brand_color || '#c0dfa1'
    const ageRange = data.age_range_start && data.age_range_end
        ? `${data.age_range_start}-${data.age_range_end}`
        : data.age_range_start ? `${data.age_range_start}+` : null

    return (
        <div className="min-h-screen md:h-screen font-figtree relative animate-fadeIn flex flex-col overflow-hidden">
            {/* Gradient background */}
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

            {/* Header */}
            <div className="sticky top-0 z-50 bg-white/60 backdrop-blur-2xl border-b border-white/40 flex-shrink-0">
                <div className="max-w-full mx-auto px-4 sm:px-6 py-2 sm:py-3">
                    <div className="flex items-center justify-between">
                        <Link to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}?tab=beneficiaries`} className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-gray-800 transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-xs sm:text-sm font-medium">Back</span>
                        </Link>
                        <PublicTagFilter
                            tags={groupTags}
                            selectedTagIds={selectedTagIds}
                            onChange={setSelectedTagIds}
                        />
                        <Link to="/" className="flex items-center gap-2">
                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-sm sm:text-base font-newsreader font-extralight text-gray-800 hidden sm:block">Nexus Impacts</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="relative z-10 flex-1 flex flex-col overflow-hidden px-4 sm:px-6 py-4 sm:py-5">
                {/* Breadcrumb */}
                <div className="hidden sm:block flex-shrink-0">
                    <PublicBreadcrumb
                        orgSlug={orgSlug!}
                        orgName={data.initiative.org_name || ''}
                        items={[
                            { label: data.initiative.title, href: `${orgLinkBase}/${orgSlug}/${initiativeSlug}?tab=beneficiaries` },
                            { label: data.name }
                        ]}
                    />
                </div>

                {/* Group header */}
                <div className="flex-shrink-0 mb-4 sm:mb-5">
                    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 p-4 sm:p-5">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${brandColor}33` }}>
                                <Users className="w-6 h-6" style={{ color: brandColor }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{data.name}</h1>
                                {data.description && <p className="text-sm text-gray-600 mb-2">{data.description}</p>}
                                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                    {data.total_number != null && (
                                        <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />{data.total_number.toLocaleString()} beneficiaries</span>
                                    )}
                                    {ageRange && (
                                        <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />Ages: {ageRange}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4-column grid */}
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 min-h-0 overflow-auto lg:overflow-hidden">
                    {/* Column 1 - Stories */}
                    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 flex flex-col min-h-[300px] lg:min-h-0 lg:h-full overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/40 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-gray-600" />
                                <h3 className="text-sm font-semibold text-gray-900">Stories</h3>
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{filteredStories.length}</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3">
                            {filteredStories.length === 0 ? (
                                <div className="text-center py-8">
                                    <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-xs text-gray-500">No stories for this group</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredStories.map(story => (
                                        <Link
                                            key={story.id}
                                            to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/story/${story.id}`}
                                            className="block bg-white/60 rounded-xl border border-white/50 overflow-hidden hover:bg-white/80 hover:shadow-md transition-all group"
                                        >
                                            {story.media_url && story.media_type === 'photo' && (
                                                <div className="w-full h-32 bg-gray-100 overflow-hidden">
                                                    <img src={story.media_url} alt={story.title} className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                            <div className="p-3">
                                                <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-gray-700">{story.title}</h4>
                                                {story.description && <p className="text-xs text-gray-600 line-clamp-2 mt-1">{story.description}</p>}
                                                {story.tag_ids && story.tag_ids.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-2" onClick={(e) => e.preventDefault()}>
                                                        {story.tag_ids.slice(0, 3).map(id => {
                                                            const t = tagsById.get(id)
                                                            if (!t) return null
                                                            return (
                                                                <PublicTagChip
                                                                    key={id}
                                                                    name={t.name}
                                                                    size="xs"
                                                                    selected={selectedTagIds.includes(id)}
                                                                    onClick={() => setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                                                                />
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-2">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>{formatDate(story.date_represented)}</span>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 2 - Metrics (impact claims grouped by KPI) */}
                    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 flex flex-col min-h-[300px] lg:min-h-0 lg:h-full overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/40 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-gray-600" />
                                <h3 className="text-sm font-semibold text-gray-900">Metrics</h3>
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{Object.keys(metricsByKPI).length}</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3">
                            {Object.keys(metricsByKPI).length === 0 ? (
                                <div className="text-center py-8">
                                    <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-xs text-gray-500">No metrics for this group</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {Object.values(metricsByKPI).map((group, idx) => {
                                        const cat = group.kpi?.category || 'output'
                                        const colors = categoryConfig[cat] || categoryConfig.output
                                        const slug = group.kpi?.title ? generateMetricSlug(group.kpi.title) : ''
                                        return (
                                            <Link
                                                key={group.kpi?.id || idx}
                                                to={slug ? `${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${slug}` : '#'}
                                                className="block p-3 bg-white/60 rounded-xl border border-white/50 hover:bg-white/80 hover:shadow-md transition-all group"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-lg flex-shrink-0 ${colors.bg}`}>
                                                        <BarChart3 className={`w-4 h-4 ${colors.text}`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-gray-900 truncate">{group.kpi?.title || 'Unknown Metric'}</p>
                                                        <div className="flex items-baseline gap-1.5 mt-0.5">
                                                            <span className="text-lg font-bold text-gray-800">{group.total.toLocaleString()}</span>
                                                            <span className="text-xs text-gray-500">{group.kpi?.unit_of_measurement || ''}</span>
                                                        </div>
                                                        <p className="text-xs text-gray-400 mt-1">{group.claims.length} {group.claims.length === 1 ? 'impact claim' : 'impact claims'}</p>
                                                        {(() => {
                                                            const ids = Array.from(new Set(group.claims.map((c: any) => c.tag_id).filter(Boolean))) as string[]
                                                            if (ids.length === 0) return null
                                                            return (
                                                                <div className="flex flex-wrap gap-1 mt-1.5" onClick={(e) => e.preventDefault()}>
                                                                    {ids.slice(0, 3).map(id => {
                                                                        const t = tagsById.get(id)
                                                                        if (!t) return null
                                                                        return (
                                                                            <PublicTagChip
                                                                                key={id}
                                                                                name={t.name}
                                                                                size="xs"
                                                                                selected={selectedTagIds.includes(id)}
                                                                                onClick={() => setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                                                                            />
                                                                        )
                                                                    })}
                                                                </div>
                                                            )
                                                        })()}
                                                    </div>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 3 - Evidence grouped by type */}
                    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 flex flex-col min-h-[300px] lg:min-h-0 lg:h-full overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/40 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-600" />
                                <h3 className="text-sm font-semibold text-gray-900">Evidence</h3>
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{filteredEvidence.length}</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3">
                            {Object.keys(evidenceByType).length === 0 ? (
                                <div className="text-center py-8">
                                    <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-xs text-gray-500">No evidence for this group</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {Object.entries(evidenceByType).map(([type, evidenceList]) => {
                                        const colors = evidenceTypeColors[type] || defaultColors
                                        const IconComp = getEvidenceIcon(type)
                                        const label = evidenceTypeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ')
                                        return (
                                            <div key={type} className={`rounded-lg border ${colors.cardBorder} overflow-hidden ${colors.cardBg}`}>
                                                <div className={`px-3 py-2 border-b ${colors.cardBorder} ${colors.headerBg}`}>
                                                    <div className="flex items-center gap-2">
                                                        <IconComp className={`w-4 h-4 ${colors.headerIcon} flex-shrink-0`} />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-bold text-gray-900 truncate">{label}</p>
                                                            <p className="text-xs text-gray-600">{evidenceList.length} {evidenceList.length === 1 ? 'item' : 'items'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={`px-3 py-1.5 space-y-1 ${evidenceList.length > 4 ? 'max-h-[180px] overflow-y-auto' : ''}`}>
                                                    {evidenceList.map((ev, idx) => (
                                                        <Link
                                                            key={ev.id}
                                                            to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/evidence/${ev.id}`}
                                                            className={`flex items-center py-1.5 px-2 rounded-md transition-all hover:bg-white/80 hover:shadow-sm ${idx < evidenceList.length - 1 ? `border-b ${colors.itemBorder}` : ''
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <div className={`w-1.5 h-1.5 rounded-full ${colors.dotColor} flex-shrink-0`} />
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-xs font-medium text-gray-900 truncate">{ev.title}</p>
                                                                    {ev.description && <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{ev.description}</p>}
                                                                    {ev.tag_ids && ev.tag_ids.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mt-1" onClick={(e) => e.preventDefault()}>
                                                                            {ev.tag_ids.slice(0, 2).map(id => {
                                                                                const t = tagsById.get(id)
                                                                                if (!t) return null
                                                                                return (
                                                                                    <PublicTagChip
                                                                                        key={id}
                                                                                        name={t.name}
                                                                                        size="xs"
                                                                                        selected={selectedTagIds.includes(id)}
                                                                                        onClick={() => setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                                                                                    />
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 4 - Location map */}
                    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 flex flex-col min-h-[300px] lg:min-h-0 lg:h-full overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/40 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-600" />
                                <h3 className="text-sm font-semibold text-gray-900">Locations</h3>
                                {mapLocations.length > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">{mapLocations.length}</span>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 relative overflow-hidden">
                            {mapLocations.length === 0 ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center py-8">
                                        <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                        <p className="text-xs text-gray-500">No location linked</p>
                                    </div>
                                </div>
                            ) : (
                                <MapContainer
                                    center={[
                                        mapLocations.reduce((s, l) => s + l.latitude, 0) / mapLocations.length,
                                        mapLocations.reduce((s, l) => s + l.longitude, 0) / mapLocations.length
                                    ]}
                                    zoom={2}
                                    style={{ width: '100%', height: '100%' }}
                                    zoomControl={false}
                                    scrollWheelZoom={true}
                                >
                                    <TileLayerWithFallback />
                                    <MapResizeHandler />
                                    <FitBoundsToLocations locations={mapLocations} />
                                    {mapLocations.map(loc => (
                                        <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={locationMarkerIcon}>
                                            <Tooltip direction="top" offset={[0, -16]} permanent={mapLocations.length <= 3}>
                                                <span className="text-xs font-medium">{loc.name}</span>
                                            </Tooltip>
                                        </Marker>
                                    ))}
                                </MapContainer>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
