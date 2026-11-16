import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pause, Play } from 'lucide-react'
import { backgroundEmbedUrl, getVideoThumbnailUrl, parseVideoUrl, type ParsedVideo } from '../../../utils/videoEmbed'
import { Chapter, PAPER, Reveal, imageOf, plural, rankMetrics, shade, shortDate, updateTime, type RecentResult } from './orgShowcase'
import { getMetricColor } from '../initiative/metricColors'
import { OrgProofDrawer } from './OrgProofDrawer'
import { OrgGlobeSection } from './OrgGlobeSection'
import { OrgImpactDashboard } from './OrgImpactDashboard'
import { OrgPostTimeline, type FeedItem } from './OrgPostTimeline'
import {
    publicApi,
    type PublicEvidence,
    type PublicInitiative,
    type PublicKPI,
    type PublicKPIUpdate,
    type PublicLocation,
    type PublicOrgPost,
    type PublicOrganization,
    type PublicStory,
} from '../../../services/publicApi'

/** Short names stay large beside the logo. A trailing acronym is the headline only for a long legal name. */
function orgHeadline(name: string): { title: string; legal: string | null; size: 'display' | 'comfortable' | 'legal' } {
    const acronym = name.match(/^(.*?)\s*\(([^)]{2,24})\)\s*$/)
    if (acronym && name.length > 48) {
        const legal = acronym[1].trim().replace(/,\s*$/, '')
        return { title: acronym[2].trim(), legal: legal || null, size: 'legal' }
    }
    if (name.length > 64) return { title: name, legal: null, size: 'legal' }
    if (name.length > 22) return { title: name, legal: null, size: 'comfortable' }
    return { title: name, legal: null, size: 'display' }
}

function HeroIdentity({ organization, brandColor }: { organization: PublicOrganization; brandColor: string }) {
    const headline = orgHeadline(organization.name)
    const blurb = (organization.statement || organization.description || '').trim()
    return (
        <div className="max-w-xl">
            <div
                className="h-28 w-28 sm:h-36 sm:w-36 lg:h-40 lg:w-40 rounded-3xl bg-white p-2.5 flex items-center justify-center overflow-hidden shadow-2xl"
                style={{ boxShadow: `0 24px 60px -18px rgba(0,0,0,0.55), 0 0 0 3px ${brandColor}66` }}
            >
                {organization.logo_url ? (
                    <img src={organization.logo_url} alt="" className="h-full w-full object-contain" />
                ) : (
                    <span className="font-fraunces text-6xl text-[#14352A]">{organization.name.charAt(0)}</span>
                )}
            </div>
            <p className="mt-6 text-[12px] font-semibold tracking-[0.16em] uppercase text-white/60">A Nexus Impacts partner</p>
            <h1 className={`mt-1 font-fraunces leading-[1.08] text-balance text-white ${headline.size === 'display' ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'}`}>{headline.title}</h1>
            {headline.legal && <p className="mt-1 text-[15px] text-white/70">{headline.legal}</p>}
            {blurb && <p className="mt-4 max-w-lg text-lg sm:text-xl leading-relaxed text-white/90">{blurb}</p>}
        </div>
    )
}

function MediaHero({ organization, brandColor, imageUrl, video }: { organization: PublicOrganization; brandColor: string; imageUrl?: string | null; video?: ParsedVideo | null }) {
    const posters = video
        ? video.provider === 'youtube'
            ? ['maxresdefault', 'sddefault', 'hqdefault'].map(size => `https://img.youtube.com/vi/${video.id}/${size}.jpg`)
            : [getVideoThumbnailUrl(video.embedUrl)].filter((url): url is string => !!url)
        : []
    const [posterIndex, setPosterIndex] = useState(0)
    const [playing, setPlaying] = useState(false)
    const frameRef = useRef<HTMLIFrameElement>(null)
    const poster = posters[posterIndex]
    const stepPoster = () => setPosterIndex(index => Math.min(index + 1, posters.length - 1))
    const still = playing && video ? null : (imageUrl || poster)

    useEffect(() => {
        if (!playing) return
        const unmute = () => {
            const frame = frameRef.current?.contentWindow
            if (!frame) return
            frame.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*')
            frame.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*')
            frame.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), '*')
            frame.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*')
            frame.postMessage({ method: 'setVolume', value: 1 }, '*')
            frame.postMessage({ method: 'play' }, '*')
        }
        const timers = [400, 1000, 1800].map(ms => window.setTimeout(unmute, ms))
        return () => timers.forEach(window.clearTimeout)
    }, [playing])

    return (
        <section className="relative min-h-[34rem] sm:min-h-[82vh] overflow-hidden bg-[#0b1410]">
            {playing && video ? (
                <iframe
                    ref={frameRef}
                    src={backgroundEmbedUrl(video, true)}
                    title=""
                    tabIndex={-1}
                    allow="autoplay; encrypted-media"
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-screen h-[56.25vw] min-h-full min-w-[177.78vh] border-0 pointer-events-none"
                />
            ) : still ? (
                <img
                    src={still}
                    alt=""
                    onLoad={event => { if (!imageUrl && event.currentTarget.naturalWidth < 400) stepPoster() }}
                    onError={() => { if (!imageUrl) stepPoster() }}
                    className="absolute inset-0 h-full w-full object-cover"
                />
            ) : null}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(8,14,11,0.92) 0%, rgba(8,14,11,0.78) 28%, rgba(8,14,11,0.18) 52%, rgba(8,14,11,0) 74%)' }} />
            <div className="relative max-w-7xl mx-auto px-5 sm:px-8 min-h-[34rem] sm:min-h-[82vh] grid grid-cols-1 lg:grid-cols-2 gap-10 items-center py-16 sm:py-20">
                <HeroIdentity organization={organization} brandColor={brandColor} />
                {video && !playing && (
                    <div className="flex justify-center">
                        <button
                            type="button"
                            onClick={() => setPlaying(true)}
                            aria-label="Play video"
                            className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-white text-[#0b1410] shadow-2xl inline-flex items-center justify-center hover:scale-105 transition-transform"
                        >
                            <Play className="w-8 h-8 sm:w-10 sm:h-10 ml-1" fill="currentColor" />
                        </button>
                    </div>
                )}
            </div>
            {playing && (
                <button
                    type="button"
                    onClick={() => setPlaying(false)}
                    aria-label="Pause video"
                    className="absolute bottom-5 right-5 z-20 h-11 w-11 rounded-full bg-black/55 text-white backdrop-blur inline-flex items-center justify-center hover:bg-black/70"
                >
                    <Pause className="w-5 h-5" fill="currentColor" />
                </button>
            )}
        </section>
    )
}

const EVIDENCE_TYPES: { type: PublicEvidence['type']; label: string; many?: string }[] = [
    { type: 'visual_proof', label: 'photo' },
    { type: 'documentation', label: 'document' },
    { type: 'testimony', label: 'testimony', many: 'testimonies' },
    { type: 'financials', label: 'financial record' },
]

export function PublicOrganizationScroll({
    organization,
    slug,
    orgLinkBase,
    brandColor,
    initiatives,
    metrics,
    globeLocations,
    evidence,
    locations,
    stories,
}: {
    organization: PublicOrganization
    slug: string
    orgLinkBase: string
    brandColor: string
    initiatives: PublicInitiative[]
    metrics: PublicKPI[]
    globeLocations: { lat: number; lng: number; name: string }[]
    evidence: PublicEvidence[]
    locations: PublicLocation[]
    stories: PublicStory[]
}) {
    const [posts, setPosts] = useState<PublicOrgPost[] | null>(null)
    const [proofMetric, setProofMetric] = useState<PublicKPI | null>(null)
    const [showAllEvidence, setShowAllEvidence] = useState(false)
    const closeProof = useCallback(() => setProofMetric(null), [])
    const accent = shade(brandColor, 0.45)
    const headline = orgHeadline(organization.name)

    useEffect(() => {
        let cancelled = false
        publicApi.getOrganizationPosts(slug)
            .then(rows => { if (!cancelled) setPosts(rows) })
            .catch(() => { if (!cancelled) setPosts([]) })
        return () => { cancelled = true }
    }, [slug])

    const pinned = useMemo(() => locations.filter(place => place.latitude && place.longitude), [locations])
    const placeById = useMemo(() => new Map(locations.map(place => [place.id, place])), [locations])
    const placeNames = useMemo(() => new Map(locations.map(place => [place.id, place.name])), [locations])
    const placeOf = useCallback(
        (update: PublicKPIUpdate) => update.location || (update.location_id ? placeById.get(update.location_id) : undefined),
        [placeById]
    )
    const photos = useMemo(() => evidence
        .filter(item => item.type === 'visual_proof')
        .map(item => ({ item, image: imageOf(item) }))
        .filter((row): row is { item: PublicEvidence; image: string } => !!row.image), [evidence])
    const rankedMetrics = useMemo(() => rankMetrics(metrics), [metrics])
    const claims = useMemo<RecentResult[]>(() => metrics
        .flatMap(metric => (metric.updates || []).filter(update => update.value).map(update => ({ update, metric })))
        .sort((a, b) => updateTime(b.update) - updateTime(a.update)), [metrics])
    const tickerClaims = useMemo(() => claims.slice(0, 12), [claims])
    const heroVideo = useMemo(
        () => (organization.public_hero === 'video' ? parseVideoUrl(organization.hero_video_url) : null),
        [organization.public_hero, organization.hero_video_url]
    )
    const showImage = organization.public_hero === 'image' && !!organization.hero_image_url
    const metricColors = useMemo(() => {
        const byInitiative = new Map<string, PublicKPI[]>()
        for (const metric of metrics) {
            const list = byInitiative.get(metric.initiative_id) || []
            list.push(metric)
            byInitiative.set(metric.initiative_id, list)
        }
        const colors = new Map<string, string>()
        byInitiative.forEach(list => {
            list.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
            list.forEach((metric, index) => colors.set(metric.id, getMetricColor(index)))
        })
        return colors
    }, [metrics])
    const programStats = useMemo(() => {
        const stats = new Map<string, { metrics: number; results: number }>()
        for (const metric of rankedMetrics) {
            const row = stats.get(metric.initiative_id) || { metrics: 0, results: 0 }
            row.metrics += 1
            row.results += metric.updates?.length || 0
            stats.set(metric.initiative_id, row)
        }
        return stats
    }, [rankedMetrics])
    const feed = useMemo(() => {
        const items: FeedItem[] = []
        for (const post of posts || []) {
            items.push({
                key: `post-${post.id}`,
                at: new Date(post.published_at).getTime() || 0,
                title: post.hook,
                body: post.body,
                image: post.image_url,
                kind: 'Post',
            })
        }
        for (const story of stories) {
            items.push({
                key: `story-${story.id}`,
                at: new Date(story.date_represented).getTime() || 0,
                title: story.title,
                body: story.description,
                image: story.media_type === 'photo' ? story.media_url : null,
                href: story.initiative_slug ? `${orgLinkBase}/${slug}/${story.initiative_slug}/story/${story.id}` : undefined,
                kind: 'Story',
            })
        }
        return items.sort((a, b) => b.at - a.at).slice(0, 60)
    }, [posts, stories, orgLinkBase, slug])
    const evidenceCounts = EVIDENCE_TYPES
        .map(({ type, label, many }) => ({ label, many, count: evidence.filter(item => item.type === type).length }))
        .filter(row => row.count > 0)
    const evidenceClipped = !showAllEvidence && photos.length > 8
    const shownPhotos = showAllEvidence ? photos : photos.slice(0, 12)

    const overviewSub = [
        initiatives.length ? plural(initiatives.length, 'program') : '',
        pinned.length ? plural(pinned.length, 'location') : '',
        claims.length ? `${plural(claims.length, 'result')} logged` : '',
    ].filter(Boolean).join(', ')

    return (
        <div className="relative bg-white">
            {showImage && <MediaHero organization={organization} brandColor={brandColor} imageUrl={organization.hero_image_url} />}
            {heroVideo && <MediaHero organization={organization} brandColor={brandColor} video={heroVideo} />}

            {(initiatives.length > 0 || pinned.length > 0) && (
                <OrgGlobeSection
                    organization={organization}
                    title={`What ${headline.title} does`}
                    sub={overviewSub ? `${overviewSub}.` : undefined}
                    initiatives={initiatives}
                    programStats={programStats}
                    globeLocations={globeLocations}
                    pinned={pinned}
                    claims={tickerClaims}
                    colors={metricColors}
                    placeOf={placeOf}
                    brandColor={brandColor}
                    accent={accent}
                    orgLinkBase={orgLinkBase}
                    slug={slug}
                />
            )}

            {feed.length > 0 && <OrgPostTimeline items={feed} brandColor={brandColor} accent={accent} />}

            {(rankedMetrics.length > 0 || claims.length > 0) && (
                <OrgImpactDashboard
                    metrics={rankedMetrics}
                    claims={claims}
                    evidence={evidence}
                    colors={metricColors}
                    placeOf={placeOf}
                    brandColor={brandColor}
                    accent={accent}
                    orgLinkBase={orgLinkBase}
                    slug={slug}
                    onOpenMetric={setProofMetric}
                />
            )}

            <OrgProofDrawer
                metric={proofMetric}
                evidence={evidence}
                brandColor={brandColor}
                accent={accent}
                orgLinkBase={orgLinkBase}
                slug={slug}
                onClose={closeProof}
                placeNames={placeNames}
            />

            {photos.length > 0 && (
                <section style={{ background: PAPER }}>
                    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 lg:py-14">
                        <Reveal>
                            <Chapter
                                kicker="Evidence"
                                title="See the work for yourself"
                                sub={evidenceCounts.length ? `${evidenceCounts.map(row => plural(row.count, row.label, row.many)).join(', ')} on file.` : undefined}
                                accent={accent}
                            />
                        </Reveal>
                        <div className={`mt-5 relative ${evidenceClipped ? 'max-h-[40rem] overflow-hidden' : ''}`}>
                            <div className="columns-2 md:columns-3 lg:columns-4 gap-3">
                                {shownPhotos.map(({ item, image }) => (
                                    <Link
                                        key={item.id}
                                        to={item.initiative_slug ? `${orgLinkBase}/${slug}/${item.initiative_slug}/evidence/${item.id}` : `${orgLinkBase}/${slug}`}
                                        className="group relative mb-3 block break-inside-avoid rounded-2xl overflow-hidden bg-white border border-black/5"
                                    >
                                        <img src={image} alt="" loading="lazy" className="w-full h-auto group-hover:scale-[1.03] transition-transform duration-500" />
                                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-[13px] font-medium text-white line-clamp-2">{item.title}</p>
                                            {item.date_represented && <p className="text-[11px] text-white/70">{shortDate(item.date_represented)}</p>}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                            {evidenceClipped && (
                                <div className="absolute inset-x-0 bottom-0 h-56 flex items-end justify-center pb-6" style={{ background: `linear-gradient(to bottom, transparent, ${PAPER} 75%)` }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowAllEvidence(true)}
                                        className="inline-flex items-center h-11 px-5 rounded-full text-[14px] font-semibold shadow-sm"
                                        style={{ background: accent, color: '#FFFFFF' }}
                                    >
                                        View all {photos.length} photos
                                    </button>
                                </div>
                            )}
                        </div>
                        {showAllEvidence && photos.length > 8 && (
                            <div className="mt-5 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setShowAllEvidence(false)}
                                    className="inline-flex items-center h-10 px-4 rounded-full text-[13px] font-semibold bg-white border"
                                    style={{ borderColor: `${brandColor}66`, color: accent }}
                                >
                                    Show less
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    )
}
