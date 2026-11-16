import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Camera, Check, Heart, MapPin, Quote, Share2 } from 'lucide-react'
import type {
    PublicEvidence,
    PublicInitiative,
    PublicKPI,
    PublicLocation,
    PublicOrgPost,
    PublicOrganization,
    PublicStatCard,
    PublicStory,
} from '../../../services/publicApi'
import { CountUp, Reveal, formatMetric, imageOf, rankMetrics, recentResults, shortDate } from './orgShowcase'

export type OrgTheme = { brandColor: string; accent: string; ink: string }

const INK = '#1C2B24'

function SectionTitle({ eyebrow, title, sub, accent, action }: { eyebrow: string; title: string; sub?: string; accent: string; action?: ReactNode }) {
    return (
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
                <p className="text-[12px] font-semibold tracking-[0.16em] uppercase" style={{ color: accent }}>{eyebrow}</p>
                <h2 className="mt-1 font-fraunces text-4xl text-[#1C2B24]">{title}</h2>
                {sub && <p className="mt-2 text-[15px] text-secondary-500 max-w-xl">{sub}</p>}
            </div>
            {action}
        </Reveal>
    )
}

function linkedTo(place: PublicLocation, programId: string) {
    return place.initiative_ids?.length ? place.initiative_ids.includes(programId) : place.initiative_id === programId
}

export function ProgramExplorer({
    programs,
    metrics,
    evidence,
    locations,
    stories,
    theme,
    orgLinkBase,
    slug,
    onOpenMetric,
}: {
    programs: PublicInitiative[]
    metrics: PublicKPI[]
    evidence: PublicEvidence[]
    locations: PublicLocation[]
    stories: PublicStory[]
    theme: OrgTheme
    orgLinkBase: string
    slug: string
    onOpenMetric: (metric: PublicKPI) => void
}) {
    const [activeId, setActiveId] = useState(programs[0]?.id)
    const program = programs.find(item => item.id === activeId) || programs[0]

    const detail = useMemo(() => {
        if (!program) return null
        const programMetrics = rankMetrics(metrics.filter(metric => metric.initiative_id === program.id))
        const photo = evidence
            .filter(item => item.initiative_id === program.id && item.type === 'visual_proof')
            .map(item => ({ item, image: imageOf(item) }))
            .find(row => row.image)
        const latest = recentResults(programMetrics, 1)[0]
        const latestId = latest?.update.location_id
        return {
            metrics: programMetrics.slice(0, 2),
            latest,
            latestPlace: latest?.update.location?.name || (latestId ? locations.find(place => place.id === latestId)?.name : undefined),
            photo,
            places: locations.filter(place => linkedTo(place, program.id)),
            stories: stories.filter(story => story.initiative_id === program.id).length,
            proof: evidence.filter(item => item.initiative_id === program.id).length,
        }
    }, [program, metrics, evidence, locations, stories])

    if (!program || !detail) return null
    const { brandColor, accent } = theme
    const href = `${orgLinkBase}/${slug}/${program.slug}`

    return (
        <section id="programs" className="scroll-mt-16 border-y border-black/5" style={{ background: `${brandColor}0D` }}>
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
                <SectionTitle eyebrow="Programs" title="Explore what they run" sub="Pick a program to see its numbers, places, and the latest result." accent={accent} />
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-[17rem_1fr] gap-4">
                    <div className="flex lg:flex-col gap-2 overflow-x-auto [scrollbar-width:none] -mx-5 px-5 lg:mx-0 lg:px-0">
                        {programs.map(item => {
                            const active = item.id === program.id
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setActiveId(item.id)}
                                    className="shrink-0 lg:shrink text-left rounded-2xl px-4 py-3 border transition-all max-w-[16rem] lg:max-w-none"
                                    style={active
                                        ? { background: '#fff', borderColor: brandColor, boxShadow: `0 6px 20px -10px ${brandColor}` }
                                        : { background: 'rgba(255,255,255,0.55)', borderColor: `${brandColor}33` }}
                                >
                                    <span className="block text-[14px] font-semibold text-[#1C2B24] leading-snug line-clamp-2">{item.title}</span>
                                    {item.region && <span className="block mt-0.5 text-[12px] text-secondary-500 truncate">{item.region}</span>}
                                </button>
                            )
                        })}
                    </div>

                    <div key={program.id} className="rounded-3xl bg-white border shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_1.1fr] animate-fadeIn" style={{ borderColor: `${brandColor}40` }}>
                        <div className="relative min-h-[220px] md:min-h-full">
                            {detail.photo ? (
                                <img src={detail.photo.image!} alt="" className="absolute inset-0 h-full w-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 p-6 flex items-end" style={{ background: `linear-gradient(150deg, ${brandColor}40, ${brandColor}10)` }}>
                                    <p className="font-fraunces text-3xl leading-tight text-[#1C2B24]">{program.title}</p>
                                </div>
                            )}
                            {detail.photo && (
                                <span className="absolute left-3 bottom-3 max-w-[85%] inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[12px] font-medium text-[#1C2B24]">
                                    <Camera className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
                                    <span className="truncate">{detail.photo.item.title}</span>
                                </span>
                            )}
                        </div>
                        <div className="p-6 flex flex-col">
                            <h3 className="font-fraunces text-2xl text-[#1C2B24] leading-snug">{program.title}</h3>
                            {program.description && <p className="mt-2 text-[14px] text-secondary-600 leading-relaxed line-clamp-4">{program.description}</p>}

                            {detail.metrics.length > 0 && (
                                <div className="mt-5 grid grid-cols-2 gap-2">
                                    {detail.metrics.map(metric => (
                                        <button
                                            key={metric.id}
                                            type="button"
                                            onClick={() => onOpenMetric(metric)}
                                            className="text-left rounded-2xl px-4 py-3 border hover:bg-white transition-colors"
                                            style={{ background: `${brandColor}12`, borderColor: `${brandColor}33` }}
                                        >
                                            <span className="block font-fraunces text-3xl leading-none" style={{ color: accent }}>
                                                <CountUp value={metric.total_value || 0} percentage={metric.metric_type === 'percentage'} />
                                            </span>
                                            <span className="block mt-1.5 text-[12px] text-[#1C2B24] leading-snug line-clamp-2">{metric.title}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {detail.latest && (
                                <p className="mt-4 text-[13px] text-secondary-600">
                                    <span className="font-semibold text-[#1C2B24]">Latest: </span>
                                    {detail.latest.metric.metric_type === 'percentage'
                                        ? formatMetric(detail.latest.update.value, true)
                                        : `+${formatMetric(detail.latest.update.value)}`}{' '}
                                    {detail.latest.metric.title.toLowerCase()}
                                    {detail.latestPlace ? ` in ${detail.latestPlace}` : ''}
                                    {shortDate(detail.latest.update.date_represented) ? `, ${shortDate(detail.latest.update.date_represented)}` : ''}
                                </p>
                            )}

                            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-secondary-500">
                                {detail.places.length > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5" />
                                        {detail.places.length === 1 ? detail.places[0].name : `${detail.places.length} places`}
                                    </span>
                                )}
                                {detail.proof > 0 && <span>{detail.proof} pieces of evidence</span>}
                                {detail.stories > 0 && <span>{detail.stories} {detail.stories === 1 ? 'story' : 'stories'}</span>}
                            </div>

                            <Link
                                to={href}
                                className="mt-6 md:mt-auto md:pt-6 self-start inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-semibold border"
                                style={{ borderColor: `${brandColor}66`, color: accent }}
                            >
                                Explore this program <ArrowUpRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

export function WhyBand({ problemStatement, cards, theme }: { problemStatement: string; cards: PublicStatCard[]; theme: OrgTheme }) {
    if (!problemStatement && !cards.length) return null
    const { brandColor, accent } = theme
    return (
        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
            <div className="rounded-[2rem] border p-7 sm:p-10" style={{ background: `linear-gradient(135deg, ${brandColor}1F, #ffffff 70%)`, borderColor: `${brandColor}40` }}>
                <Reveal>
                    <p className="text-[12px] font-semibold tracking-[0.16em] uppercase" style={{ color: accent }}>Why this work</p>
                    {problemStatement && (
                        <p className="mt-3 font-fraunces text-2xl sm:text-3xl leading-snug text-[#1C2B24] max-w-3xl line-clamp-6">{problemStatement}</p>
                    )}
                </Reveal>
                {cards.length > 0 && (
                    <div className={`mt-8 grid grid-cols-1 sm:grid-cols-2 ${cards.length >= 4 ? 'lg:grid-cols-4' : cards.length === 3 ? 'lg:grid-cols-3' : ''} gap-3`}>
                        {cards.map((card, index) => (
                            <Reveal key={card.id} delay={index * 0.06}>
                                <div className="h-full rounded-2xl bg-white/90 border p-5" style={{ borderColor: `${brandColor}33` }}>
                                    {card.type === 'stat' && card.value ? (
                                        <p className="font-fraunces text-4xl leading-none" style={{ color: accent }}>{card.value}</p>
                                    ) : (
                                        <Quote className="w-5 h-5" style={{ color: accent }} />
                                    )}
                                    {card.title && <p className="mt-3 text-[14px] font-semibold text-[#1C2B24] leading-snug">{card.title}</p>}
                                    {card.description && <p className="mt-1 text-[13px] text-secondary-500 leading-relaxed line-clamp-4">{card.description}</p>}
                                    {card.source && (
                                        card.source_url
                                            ? <a href={card.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] text-secondary-400 hover:underline">{card.source}</a>
                                            : <p className="mt-2 text-[11px] text-secondary-400">{card.source}</p>
                                    )}
                                </div>
                            </Reveal>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}

function postDate(value: string) {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function PostsShowcase({ posts, theme }: { posts: PublicOrgPost[]; theme: OrgTheme }) {
    const [featuredId, setFeaturedId] = useState(posts[0]?.id)
    if (!posts.length) return null
    const { brandColor, accent } = theme
    const featured = posts.find(post => post.id === featuredId) || posts[0]
    const rail = posts.filter(post => post.id !== featured.id).slice(0, 4)

    return (
        <section id="posts" className="scroll-mt-16 max-w-6xl mx-auto px-5 sm:px-8 py-16">
            <SectionTitle eyebrow="From the field" title="Latest updates" sub="Posts this organization chose to share." accent={accent} />
            <div className={`mt-8 grid grid-cols-1 gap-4 ${rail.length ? 'lg:grid-cols-[1.7fr_1fr]' : ''}`}>
                <article key={featured.id} className="rounded-3xl bg-white border shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-2 animate-fadeIn" style={{ borderColor: `${brandColor}40` }}>
                    {featured.image_url ? (
                        <img src={featured.image_url} alt="" className="h-64 md:h-full w-full object-cover" />
                    ) : (
                        <div className="min-h-[16rem] p-7 flex items-end" style={{ background: `linear-gradient(150deg, ${brandColor}38, ${brandColor}0D)` }}>
                            <p className="font-fraunces text-3xl leading-tight text-[#1C2B24]">{featured.hook}</p>
                        </div>
                    )}
                    <div className="p-6 flex flex-col">
                        <p className="text-[12px] font-medium" style={{ color: accent }}>{postDate(featured.published_at)}</p>
                        {featured.image_url && <h3 className="mt-2 font-fraunces text-2xl leading-snug text-[#1C2B24]">{featured.hook}</h3>}
                        {featured.body && <p className="mt-3 text-[14px] leading-relaxed text-secondary-600 whitespace-pre-line line-clamp-[10]">{featured.body}</p>}
                        {featured.cta && <p className="mt-4 text-[14px] font-semibold text-[#1C2B24]">{featured.cta}</p>}
                    </div>
                </article>
                {rail.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 content-start">
                        {rail.map(post => (
                            <button
                                key={post.id}
                                type="button"
                                onClick={() => setFeaturedId(post.id)}
                                className="flex items-center gap-3 text-left rounded-2xl bg-white border p-2.5 hover:-translate-y-0.5 hover:shadow-sm transition-all"
                                style={{ borderColor: `${brandColor}33` }}
                            >
                                {post.image_url ? (
                                    <img src={post.image_url} alt="" className="h-16 w-16 rounded-xl object-cover shrink-0" />
                                ) : (
                                    <span className="h-16 w-16 rounded-xl shrink-0" style={{ background: `${brandColor}26` }} />
                                )}
                                <span className="min-w-0">
                                    <span className="block text-[13px] font-semibold text-[#1C2B24] leading-snug line-clamp-2">{post.hook}</span>
                                    <span className="block mt-0.5 text-[12px] text-secondary-500">{postDate(post.published_at)}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}

export function StoriesSection({ stories, theme, orgLinkBase, slug }: { stories: PublicStory[]; theme: OrgTheme; orgLinkBase: string; slug: string }) {
    if (!stories.length) return null
    const { brandColor, accent } = theme
    const picks = [...stories]
        .sort((a, b) => Number(!!b.description) - Number(!!a.description) || new Date(b.date_represented).getTime() - new Date(a.date_represented).getTime())
        .slice(0, 3)

    return (
        <section id="stories" className="scroll-mt-16 border-y border-black/5 bg-[#F7F8F4]">
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
                <SectionTitle eyebrow="Stories" title="In their own words" accent={accent} />
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {picks.map((story, index) => {
                        const place = story.location?.name || story.locations?.[0]?.name || story.location_name
                        const photo = story.media_type === 'photo' ? story.media_url : undefined
                        const inner = (
                            <>
                                {photo && <img src={photo} alt="" className="h-40 w-full object-cover" />}
                                <div className="p-6 flex flex-col flex-1">
                                    <Quote className="w-6 h-6" style={{ color: brandColor }} />
                                    <p className="mt-3 font-fraunces text-[19px] leading-snug text-[#1C2B24] line-clamp-6">
                                        {story.description || story.title}
                                    </p>
                                    <p className="mt-auto pt-5 text-[13px] font-semibold text-[#1C2B24]">{story.title}</p>
                                    <p className="text-[12px] text-secondary-500">
                                        {[place, story.initiative_title].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                            </>
                        )
                        const className = 'h-full rounded-3xl bg-white border shadow-sm overflow-hidden flex flex-col'
                        return (
                            <Reveal key={story.id} delay={index * 0.06}>
                                {story.initiative_slug ? (
                                    <Link to={`${orgLinkBase}/${slug}/${story.initiative_slug}/story/${story.id}`} className={`${className} hover:-translate-y-0.5 transition-transform`} style={{ borderColor: `${brandColor}33` }}>
                                        {inner}
                                    </Link>
                                ) : (
                                    <div className={className} style={{ borderColor: `${brandColor}33` }}>{inner}</div>
                                )}
                            </Reveal>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}

export function EvidenceWall({ evidence, theme, orgLinkBase, slug }: { evidence: PublicEvidence[]; theme: OrgTheme; orgLinkBase: string; slug: string }) {
    const [program, setProgram] = useState('all')
    const photos = useMemo(() => evidence
        .filter(item => item.type === 'visual_proof')
        .map(item => ({ item, image: imageOf(item) }))
        .filter((row): row is { item: PublicEvidence; image: string } => !!row.image), [evidence])
    const programs = useMemo(() => {
        const seen = new Map<string, string>()
        photos.forEach(({ item }) => { if (item.initiative_id && item.initiative_title) seen.set(item.initiative_id, item.initiative_title) })
        return [...seen.entries()]
    }, [photos])
    if (!photos.length) return null
    const { brandColor, accent, ink } = theme
    const shown = photos.filter(({ item }) => program === 'all' || item.initiative_id === program).slice(0, 12)

    return (
        <section id="evidence" className="scroll-mt-16 max-w-6xl mx-auto px-5 sm:px-8 py-16">
            <SectionTitle eyebrow="Evidence" title="See the work" sub={`${photos.length} photos from the field, not stock.`} accent={accent} />
            {programs.length > 1 && (
                <div className="mt-6 flex flex-wrap gap-2">
                    {[['all', 'All'] as [string, string], ...programs].map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setProgram(id)}
                            className="h-9 px-4 rounded-full text-[13px] font-semibold border transition-colors"
                            style={program === id
                                ? { background: brandColor, color: ink, borderColor: brandColor }
                                : { background: '#fff', color: INK, borderColor: `${brandColor}44` }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
            <div className="mt-6 columns-2 md:columns-3 lg:columns-4 gap-3">
                {shown.map(({ item, image }) => (
                    <Link
                        key={item.id}
                        to={item.initiative_slug ? `${orgLinkBase}/${slug}/${item.initiative_slug}/evidence/${item.id}` : `${orgLinkBase}/${slug}`}
                        className="group relative mb-3 block break-inside-avoid rounded-2xl overflow-hidden bg-white border border-black/5"
                    >
                        <img src={image} alt="" loading="lazy" className="w-full h-auto group-hover:scale-[1.03] transition-transform duration-500" />
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[13px] font-semibold text-white leading-snug line-clamp-2">{item.title}</p>
                            <p className="text-[11px] text-white/80">{[item.initiative_title, shortDate(item.date_represented)].filter(Boolean).join(' · ')}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    )
}

export function PlacesSection({ places, theme, onFocus }: { places: PublicLocation[]; theme: OrgTheme; onFocus?: (place: PublicLocation) => void }) {
    if (!places.length) return null
    const { brandColor, accent } = theme
    return (
        <section id="places" className="scroll-mt-16 border-t border-black/5 bg-[#F7F8F4]">
            <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
                <SectionTitle eyebrow="Places" title="Where they work" sub={onFocus ? 'Tap a place to find it on the globe.' : undefined} accent={accent} />
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {places.slice(0, 12).map(place => (
                        <button
                            key={place.id}
                            type="button"
                            onClick={onFocus ? () => onFocus(place) : undefined}
                            className={`flex items-start gap-3 text-left rounded-2xl bg-white border p-4 ${onFocus ? 'hover:-translate-y-0.5 transition-transform' : 'cursor-default'}`}
                            style={{ borderColor: `${brandColor}33` }}
                        >
                            <span className="h-9 w-9 rounded-xl inline-flex items-center justify-center shrink-0" style={{ background: `${brandColor}22`, color: accent }}>
                                <MapPin className="w-4 h-4" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-[14px] font-semibold text-[#1C2B24] truncate">{place.name}</span>
                                <span className="block text-[12px] text-secondary-500 truncate">
                                    {[place.country, place.initiative_title].filter(Boolean).join(' · ') || 'Program site'}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </section>
    )
}

export function ClosingAsk({ organization, theme, orgLinkBase, slug }: { organization: PublicOrganization; theme: OrgTheme; orgLinkBase: string; slug: string }) {
    const [copied, setCopied] = useState(false)
    const { brandColor, accent, ink } = theme

    const share = async () => {
        const url = window.location.href
        if (navigator.share) {
            try { await navigator.share({ title: organization.name, url }) } catch { /* dismissed */ }
            return
        }
        await navigator.clipboard?.writeText(url)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
    }

    return (
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-20 pt-4">
            <Reveal>
                <div className="relative overflow-hidden rounded-[2rem] border p-8 sm:p-12 text-center" style={{ background: `radial-gradient(circle at 50% 0%, ${brandColor}40, #ffffff 70%)`, borderColor: `${brandColor}55` }}>
                    <Heart className="mx-auto w-7 h-7" style={{ color: accent }} />
                    <h2 className="mt-4 font-fraunces text-3xl sm:text-4xl text-[#1C2B24] text-balance">Help {organization.name} keep going</h2>
                    <p className="mt-3 text-[15px] text-secondary-600 max-w-lg mx-auto">Every number on this page is logged and backed by the work itself. Your support adds the next one.</p>
                    <div className="mt-7 flex flex-wrap justify-center gap-3">
                        {organization.donation_url && (
                            <a href={organization.donation_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-sm font-semibold" style={{ background: brandColor, color: ink }}>
                                Support this work <ArrowUpRight className="w-4 h-4" />
                            </a>
                        )}
                        <button type="button" onClick={share} className="inline-flex items-center gap-2 h-11 px-5 rounded-full text-sm font-semibold bg-white border" style={{ borderColor: `${brandColor}66`, color: accent }}>
                            {copied ? <><Check className="w-4 h-4" /> Link copied</> : <><Share2 className="w-4 h-4" /> Share</>}
                        </button>
                        <Link to={`${orgLinkBase}/${slug}/context`} className="inline-flex items-center h-11 px-5 rounded-full text-sm font-semibold bg-white border" style={{ borderColor: `${brandColor}66`, color: accent }}>
                            Our story
                        </Link>
                    </div>
                </div>
            </Reveal>
        </section>
    )
}
