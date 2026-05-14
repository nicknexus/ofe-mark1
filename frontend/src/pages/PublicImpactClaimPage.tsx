import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useOrgLinkBase } from '../hooks/useOrgLinkBase'
import { ArrowLeft, Target, Calendar, MapPin, BarChart3 } from 'lucide-react'
import { MapContainer, Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { TileLayerWithFallback, MapResizeHandler } from '../components/public/initiative/PublicInitiativeMap'
import { publicApi, PublicImpactClaimDetail, PublicMetricTag } from '../services/publicApi'
import PublicBreadcrumb from '../components/public/PublicBreadcrumb'
import PublicLoader from '../components/public/PublicLoader'
import PublicTagChip from '../components/public/PublicTagChip'
import PublicDonateButton from '../components/public/PublicDonateButton'
import DateRangePicker from '../components/DateRangePicker'
import {
    PublicPageBackground,
} from '../components/public/publicStyles'
import { getLocalDateString, formatDate } from '../utils'
import { impactClaimCategoryConfig } from '../components/public/impactClaim/impactClaimCategoryConfig'
import { PublicImpactClaimEvidenceGallerySection } from '../components/public/impactClaim/PublicImpactClaimEvidenceGallerySection'

export default function PublicImpactClaimPage() {
    const { orgSlug, initiativeSlug, claimId } = useParams<{
        orgSlug: string
        initiativeSlug: string
        claimId: string
    }>()
    const orgLinkBase = useOrgLinkBase()
    const [searchParams] = useSearchParams()
    const from = searchParams.get('from')

    const [dateFilter, setDateFilter] = useState<{ singleDate?: string; startDate?: string; endDate?: string }>(() => {
        const s = searchParams.get('startDate')
        const e = searchParams.get('endDate')
        if (s && e) return { startDate: s, endDate: e }
        if (s) return { singleDate: s }
        return {}
    })

    const [claim, setClaim] = useState<PublicImpactClaimDetail | null>(null)
    const [tags, setTags] = useState<PublicMetricTag[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
    const [currentFileIndex, setCurrentFileIndex] = useState(0)

    useEffect(() => {
        const loadClaim = async () => {
            if (!orgSlug || !initiativeSlug || !claimId) return

            try {
                setLoading(true)
                setError(null)
                const [data, orgTags] = await Promise.all([
                    publicApi.getImpactClaimDetail(orgSlug, initiativeSlug, claimId),
                    publicApi.getOrganizationTags(orgSlug).catch(() => []),
                ])
                setClaim(data)
                setTags(orgTags)
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
                <div className="rounded-3xl bg-white border border-gray-200/80 shadow-public p-12 text-center max-w-md">
                    <Target className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-gray-800 mb-3">Impact Claim Not Found</h1>
                    <p className="text-gray-500 mb-8">{error || 'This impact claim does not exist.'}</p>
                    <Link to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}?tab=metrics`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4" /> Back to Metrics
                    </Link>
                </div>
            </div>
        )
    }

    const config = impactClaimCategoryConfig[claim.metric.category] || impactClaimCategoryConfig.output
    const tagsById = new Map<string, PublicMetricTag>(tags.map(t => [t.id, t]))
    const brandColor = claim.initiative.brand_color || '#c0dfa1'

    const hasDateRange = claim.date_range_start && claim.date_range_end
    const displayDate = hasDateRange
        ? `${formatDate(claim.date_range_start!, { month: 'short', day: 'numeric' })} - ${formatDate(claim.date_range_end!)}`
        : formatDate(claim.date_represented, { month: 'long', day: 'numeric', year: 'numeric' })

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
            <PublicPageBackground brandColor={brandColor} />

            <div className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <Link
                                to={from === 'org' ? `${orgLinkBase}/${orgSlug}` : `${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${claim.metric.slug}`}
                                className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-gray-800 transition-colors min-w-0"
                            >
                                <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                                <span className="text-xs sm:text-sm font-medium truncate">
                                    {from === 'org' ? `Back to ${claim.initiative.org_name || 'Organization'}` : `Back to ${claim.metric.title}`}
                                </span>
                            </Link>
                            <PublicDonateButton orgSlug={orgSlug} />
                        </div>
                        <DateRangePicker
                            value={dateFilter}
                            onChange={setDateFilter}
                            maxDate={getLocalDateString(new Date())}
                            placeholder="Date"
                            activeColor={brandColor}
                            className="w-auto"
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

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
                <div className="hidden sm:block">
                    <PublicBreadcrumb
                        orgSlug={orgSlug!}
                        orgName={claim.initiative.org_name || ''}
                        items={from === 'org' ? [
                            { label: claim.metric.metric_type === 'percentage' ? `${parseFloat(String(claim.value)).toLocaleString()}%` : `+${parseFloat(String(claim.value)).toLocaleString()} ${claim.metric.unit_of_measurement}` }
                        ] : [
                            { label: claim.initiative.title, href: `${orgLinkBase}/${orgSlug}/${initiativeSlug}?tab=metrics` },
                            { label: claim.metric.title, href: `${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${claim.metric.slug}` },
                            { label: claim.metric.metric_type === 'percentage' ? `${parseFloat(String(claim.value)).toLocaleString()}%` : `+${parseFloat(String(claim.value)).toLocaleString()} ${claim.metric.unit_of_measurement}` }
                        ]}
                    />
                </div>

                <div className="mb-5 sm:mb-8">
                    <div className="flex flex-col gap-4 sm:gap-6">
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                                <span className="text-lg sm:text-xl font-bold text-gray-800">
                                    Impact Claim
                                </span>
                                <span className={`px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-semibold rounded-full uppercase tracking-wide border ${claim.metric.category === 'impact' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' :
                                        claim.metric.category === 'input' ? 'bg-evidence-500/10 text-evidence-700 border-evidence-500/20' :
                                            'bg-accent/15 text-accent-foreground border-accent/25'
                                    }`}>
                                    {claim.metric.category}
                                </span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">
                                {claim.metric.title}
                            </h1>
                            {claim.metric.description && (
                                <p className="text-sm sm:text-lg text-gray-600 max-w-2xl line-clamp-2 sm:line-clamp-none">{claim.metric.description}</p>
                            )}
                            {claim.tag_id && tagsById.get(claim.tag_id) && (
                                <div className="mt-2">
                                    <PublicTagChip name={tagsById.get(claim.tag_id)!.name} size="sm" />
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl sm:rounded-3xl bg-white border border-gray-200/80 shadow-public p-4 sm:p-6 lg:min-w-[200px] lg:max-w-[240px]">
                            <p className="text-gray-500 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">{claim.metric.metric_type === 'percentage' ? 'Claimed Percentage' : 'Claimed Impact'}</p>
                            <p className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight ${config.text}`}>
                                {claim.metric.metric_type === 'percentage' ? '' : '+'}{parseFloat(String(claim.value)).toLocaleString()}{claim.metric.metric_type === 'percentage' ? '%' : ''}
                            </p>
                            {claim.metric.metric_type !== 'percentage' && <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">{claim.metric.unit_of_measurement}</p>}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-5 sm:mb-8">
                    <div className="rounded-2xl sm:rounded-3xl bg-white border border-gray-200/80 shadow-public overflow-hidden">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40">
                            <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                                Claim Details
                            </h2>
                        </div>
                        <div className="p-4 sm:p-6 space-y-4">
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Date</p>
                                <div className="flex items-center gap-2 text-sm text-gray-800">
                                    <Calendar className="w-4 h-4 text-gray-400" />
                                    {displayDate}
                                </div>
                            </div>

                            {claim.location && (
                                <div>
                                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Location</p>
                                    <div className="flex items-center gap-2 text-sm text-gray-800">
                                        <MapPin className="w-4 h-4 text-gray-400" />
                                        {claim.location.name}
                                    </div>
                                    {claim.location.description && (
                                        <p className="text-xs text-gray-500 mt-0.5 ml-6">{claim.location.description}</p>
                                    )}
                                </div>
                            )}

                            {claim.note && (
                                <div>
                                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Note</p>
                                    <p className="text-sm text-gray-700 italic">{`"${claim.note}"`}</p>
                                </div>
                            )}

                            {claim.label && (
                                <div>
                                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Label</p>
                                    <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 font-medium shadow-sm">{claim.label}</span>
                                </div>
                            )}

                            <div className="pt-3 border-t border-gray-100">
                                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Part of Metric</p>
                                <Link
                                    to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${claim.metric.slug}`}
                                    className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-200/80 shadow-public hover:shadow-public-hover hover:border-gray-300 transition-all group"
                                >
                                    <BarChart3 className={`w-5 h-5 ${config.text} flex-shrink-0`} />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-800 group-hover:text-accent transition-colors truncate">{claim.metric.title}</p>
                                        <p className="text-xs text-gray-500">{claim.metric.unit_of_measurement} • {claim.metric.category}</p>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-2 rounded-2xl sm:rounded-3xl bg-white border border-gray-200/80 shadow-public overflow-hidden flex flex-col">
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

                <PublicImpactClaimEvidenceGallerySection
                    evidence={claim.evidence}
                    evidenceCount={claim.evidence_count}
                    config={config}
                    galleryIndex={galleryIndex}
                    setGalleryIndex={setGalleryIndex}
                    currentFileIndex={currentFileIndex}
                    setCurrentFileIndex={setCurrentFileIndex}
                    orgSlug={orgSlug!}
                    initiativeSlug={initiativeSlug!}
                    tagsById={tagsById}
                />
            </div>

            <div className="relative z-10 border-t border-gray-100 bg-white mt-8 sm:mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                        <p className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                            Part of <Link to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${claim.metric.slug}`} className="text-accent hover:underline font-medium">{claim.metric.title}</Link>
                            {' '}in <Link to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}`} className="text-accent hover:underline font-medium">{claim.initiative.title}</Link>
                        </p>
                        <Link to={`${orgLinkBase}/${orgSlug}`} className="text-xs sm:text-sm text-accent hover:text-accent/80 font-medium flex items-center gap-1">
                            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Back to Organization
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
