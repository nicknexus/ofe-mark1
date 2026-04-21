import React, { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
    ArrowLeft, AlertTriangle, BarChart3, Lightbulb, FileText,
    Building2, Compass, ChevronRight, Workflow, ExternalLink, Target,
} from 'lucide-react'
import {
    publicApi, PublicOrganization, PublicOrganizationContext,
    PublicStatCard, PublicTheoryStage, PublicStrategy,
} from '../services/publicApi'
import PublicLoader from '../components/public/PublicLoader'
import ContextDetailModal, { formatAddedDate } from '../components/public/ContextDetailModal'

type TextSectionKey = 'problem_statement' | 'additional_info'

interface TextSection {
    key: TextSectionKey
    label: string
    icon: typeof AlertTriangle
}

const TEXT_SECTIONS: TextSection[] = [
    { key: 'problem_statement', label: 'Problem Statement', icon: AlertTriangle },
    { key: 'additional_info', label: 'More Context', icon: FileText },
]

function renderParagraphs(text: string) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    return paragraphs.map((p, idx) => (
        <p key={idx} className="text-[15px] leading-[1.75] text-gray-700 whitespace-pre-wrap">
            {p.trim()}
        </p>
    ))
}

type ActiveDetail =
    | { kind: 'stat'; card: PublicStatCard }
    | { kind: 'stage'; stage: PublicTheoryStage }
    | null

export default function PublicOrgContextPage() {
    const { slug } = useParams<{ slug: string }>()
    const [organization, setOrganization] = useState<PublicOrganization | null>(null)
    const [context, setContext] = useState<PublicOrganizationContext | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [active, setActive] = useState<ActiveDetail>(null)

    useEffect(() => {
        if (!slug) return
        let cancelled = false
        setLoading(true)
        Promise.all([
            publicApi.getOrganization(slug).catch(() => null),
            publicApi.getOrganizationContext(slug).catch(() => null),
        ])
            .then(([orgData, ctx]) => {
                if (cancelled) return
                if (!orgData) {
                    setError('Organization not found')
                    return
                }
                setOrganization(orgData.organization)
                setContext(ctx)
            })
            .catch(() => {
                if (!cancelled) setError('Failed to load context')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => { cancelled = true }
    }, [slug])

    const brandColor = organization?.brand_color || '#c0dfa1'

    const statCards = useMemo<PublicStatCard[]>(() => {
        const arr = context?.stats_and_statements
        if (!Array.isArray(arr)) return []
        return arr.filter(c => {
            if (c?.type === 'stat') return !!(c.value || '').trim()
            return !!((c?.title || '').trim() || (c?.description || '').trim())
        })
    }, [context])

    const stages = useMemo<PublicTheoryStage[]>(() => {
        const arr = context?.theory_of_change_stages
        if (!Array.isArray(arr)) return []
        return arr.filter(s => (s?.title || '').trim() || (s?.description || '').trim())
    }, [context])

    const strategies = useMemo<PublicStrategy[]>(() => {
        const arr = context?.strategies
        if (!Array.isArray(arr)) return []
        return arr.filter(s => (s?.title || '').trim() || (s?.description || '').trim())
    }, [context])

    const problemBody = (context?.problem_statement || '').trim()
    const theoryBody = (context?.theory_of_change || '').trim()
    const additionalBody = (context?.additional_info || '').trim()

    const hasAnyContent =
        !!problemBody || !!theoryBody || !!additionalBody ||
        statCards.length > 0 || stages.length > 0 || strategies.length > 0

    if (loading) return <PublicLoader message="Loading context..." />

    if (error || !organization) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
                <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-100 text-center max-w-md">
                    <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-gray-900 mb-3">Organization Not Found</h1>
                    <p className="text-gray-500 mb-8">{error}</p>
                    <Link to="/explore" className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium">
                        Browse Organizations
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50/80 font-figtree animate-fadeIn">
            <div
                className="fixed inset-0 pointer-events-none"
                style={{ background: `radial-gradient(ellipse 140% 50% at 50% -5%, ${brandColor}22, transparent 65%)` }}
            />

            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
                    <Link
                        to={`/org/${slug}`}
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm flex items-center justify-center">
                            {organization.logo_url ? (
                                <img src={organization.logo_url} alt={organization.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                                <Building2 className="w-4 h-4 text-gray-400" />
                            )}
                        </div>
                        <span className="font-semibold text-sm text-gray-900 truncate max-w-[200px]">{organization.name}</span>
                    </div>
                    <div className="ml-auto">
                        <Link to="/" className="hidden sm:flex items-center gap-2 flex-shrink-0">
                            <div className="w-6 h-6 rounded-lg overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-sm font-newsreader font-extralight text-gray-700 hidden lg:block">Nexus Impacts</span>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="relative z-10 pb-20">

                {/* Hero */}
                <section className="pt-10 md:pt-16 pb-10">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6">
                        <div className="flex items-center gap-6 md:gap-10">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-4">
                                    <div
                                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                                        style={{ backgroundColor: `${brandColor}22` }}
                                    >
                                        <Compass className="w-4 h-4" style={{ color: brandColor }} />
                                    </div>
                                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: brandColor }}>
                                        Context &amp; Challenges
                                    </span>
                                </div>
                                <h1 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight leading-[1.05]">
                                    The story behind <br className="hidden sm:block" />
                                    <span style={{ color: brandColor }}>{organization.name}</span>
                                </h1>
                                {organization.statement && (
                                    <p className="mt-5 text-lg md:text-xl text-gray-500 leading-relaxed max-w-3xl">
                                        {organization.statement}
                                    </p>
                                )}
                            </div>

                            <div className="hidden md:flex flex-shrink-0 items-center justify-center w-32 h-32 lg:w-44 lg:h-44">
                                {organization.logo_url ? (
                                    <img
                                        src={organization.logo_url}
                                        alt={organization.name}
                                        className="w-full h-full object-contain"
                                        loading="lazy"
                                    />
                                ) : (
                                    <span
                                        className="text-5xl lg:text-6xl font-bold"
                                        style={{ color: `${brandColor}99` }}
                                    >
                                        {organization.name.charAt(0)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                {/* Sections */}
                <section>
                    {(() => {
                        if (!hasAnyContent) {
                            return (
                                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
                                        <div
                                            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                                            style={{ backgroundColor: `${brandColor}22` }}
                                        >
                                            <FileText className="w-6 h-6" style={{ color: brandColor }} />
                                        </div>
                                        <h2 className="text-lg font-semibold text-gray-900 mb-2">Context coming soon</h2>
                                        <p className="text-sm text-gray-500 max-w-md mx-auto">
                                            {organization.name} hasn't shared context about their work yet.
                                            Check back soon or visit their dashboard to see the impact in numbers.
                                        </p>
                                        <Link
                                            to={`/org/${slug}`}
                                            className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:shadow-lg"
                                            style={{ backgroundColor: brandColor }}
                                        >
                                            View impact dashboard
                                        </Link>
                                    </div>
                                </div>
                            )
                        }

                        const rendered: React.ReactNode[] = []

                        if (problemBody) {
                            rendered.push(
                                <TextSectionCard
                                    key="problem"
                                    section={TEXT_SECTIONS[0]}
                                    body={problemBody}
                                    brandColor={brandColor}
                                />
                            )
                        }

                        if (statCards.length > 0) {
                            rendered.push(
                                <StatsSectionCards
                                    key="stats"
                                    cards={statCards}
                                    brandColor={brandColor}
                                    onOpen={(card) => setActive({ kind: 'stat', card })}
                                />
                            )
                        }

                        if (theoryBody || stages.length > 0) {
                            rendered.push(
                                <TheoryOfChangeSection
                                    key="theory"
                                    description={theoryBody}
                                    stages={stages}
                                    brandColor={brandColor}
                                    onOpenStage={(stage) => setActive({ kind: 'stage', stage })}
                                />
                            )
                        }

                        if (strategies.length > 0) {
                            rendered.push(
                                <StrategiesSection
                                    key="strategies"
                                    strategies={strategies}
                                    brandColor={brandColor}
                                />
                            )
                        }

                        if (additionalBody) {
                            rendered.push(
                                <TextSectionCard
                                    key="additional"
                                    section={TEXT_SECTIONS[1]}
                                    body={additionalBody}
                                    brandColor={brandColor}
                                />
                            )
                        }

                        return (
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 md:space-y-8">
                                {rendered.map((node, idx) => (
                                    <div key={idx}>{node}</div>
                                ))}
                            </div>
                        )
                    })()}

                    {/* Footer CTA */}
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-16">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">See the impact in numbers</h3>
                                <p className="text-sm text-gray-500">Metrics, stories, and evidence from the field.</p>
                            </div>
                            <Link
                                to={`/org/${slug}`}
                                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-xl transition-all hover:shadow-lg flex-shrink-0"
                                style={{ backgroundColor: brandColor }}
                            >
                                View dashboard
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* Detail modal */}
            {active?.kind === 'stat' && (
                <ContextDetailModal
                    open
                    onClose={() => setActive(null)}
                    typeBadge={active.card.type === 'stat' ? 'Stat' : 'Statement'}
                    brandColor={brandColor}
                    value={active.card.type === 'stat' ? active.card.value : undefined}
                    title={active.card.title}
                    description={active.card.description}
                    source={active.card.source}
                    sourceUrl={active.card.source_url}
                    createdAt={active.card.created_at}
                />
            )}
            {active?.kind === 'stage' && (
                <ContextDetailModal
                    open
                    onClose={() => setActive(null)}
                    typeBadge="Stage"
                    brandColor={brandColor}
                    title={active.stage.title}
                    description={active.stage.description}
                />
            )}
        </div>
    )
}

function TextSectionCard({
    section,
    body,
    brandColor,
}: {
    section: TextSection
    body: string
    brandColor: string
}) {
    const Icon = section.icon
    return (
        <article className="relative bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: brandColor }} />
            <div className="p-6 md:p-10 pl-8 md:pl-12">
                <div className="flex items-center gap-3 mb-5">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${brandColor}22` }}
                    >
                        <Icon className="w-5 h-5" style={{ color: brandColor }} />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                        {section.label}
                    </h2>
                </div>
                <div className="space-y-4">
                    {renderParagraphs(body)}
                </div>
            </div>
        </article>
    )
}

function StatsSectionCards({
    cards,
    brandColor,
    onOpen,
}: {
    cards: PublicStatCard[]
    brandColor: string
    onOpen: (card: PublicStatCard) => void
}) {
    return (
        <article className="relative bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: brandColor }} />
            <div className="p-6 md:p-10 pl-8 md:pl-12">
                <div className="flex items-center gap-3 mb-6">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${brandColor}22` }}
                    >
                        <BarChart3 className="w-5 h-5" style={{ color: brandColor }} />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                        Stats &amp; Statements
                    </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {cards.map((card) => (
                        <StatOrStatementCard
                            key={card.id}
                            card={card}
                            brandColor={brandColor}
                            onOpen={() => onOpen(card)}
                        />
                    ))}
                </div>
            </div>
        </article>
    )
}

function StatOrStatementCard({
    card,
    brandColor,
    onOpen,
}: {
    card: PublicStatCard
    brandColor: string
    onOpen: () => void
}) {
    const isStat = card.type === 'stat'
    const addedLabel = formatAddedDate(card.created_at)
    const description = (card.description || '').trim()
    const sourceTitle = (card.source || '').trim()
    const sourceUrl = (card.source_url || '').trim()
    const hasSource = !!sourceTitle || !!sourceUrl
    const sourceLabel = sourceTitle || (sourceUrl ? 'Source' : '')

    return (
        <button
            type="button"
            onClick={onOpen}
            className="group relative text-left rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/50 p-6 md:p-7 transition-all hover:shadow-md hover:border-gray-200 flex flex-col focus:outline-none focus:ring-2"
            style={{ ['--tw-ring-color' as any]: `${brandColor}55` }}
        >
            {isStat ? (
                <>
                    <div
                        className="text-5xl md:text-6xl font-bold tracking-tight leading-none mb-3"
                        style={{ color: brandColor }}
                    >
                        {card.value}
                    </div>
                    {card.title.trim() && (
                        <div className="text-base font-semibold text-gray-900 leading-snug mb-2">
                            {card.title}
                        </div>
                    )}
                </>
            ) : (
                card.title.trim() && (
                    <div className="text-xl md:text-2xl font-bold text-gray-900 leading-snug tracking-tight mb-3">
                        {card.title}
                    </div>
                )
            )}

            {description && (
                <p className="text-[14px] text-gray-600 leading-relaxed line-clamp-2 mb-3">
                    {description}
                </p>
            )}

            <span
                className="inline-flex items-center gap-1 text-xs font-semibold transition-colors mt-auto"
                style={{ color: brandColor }}
            >
                Read more
                <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>

            {(hasSource || addedLabel) && (
                <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] uppercase tracking-wider text-gray-400 font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                    {hasSource && (
                        sourceUrl ? (
                            <a
                                href={sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 hover:underline transition-colors"
                                style={{ color: brandColor }}
                                title={sourceUrl}
                            >
                                {sourceLabel}
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        ) : (
                            <span>{sourceLabel}</span>
                        )
                    )}
                    {hasSource && addedLabel && <span className="text-gray-300">·</span>}
                    {addedLabel && <span>{addedLabel}</span>}
                </div>
            )}
        </button>
    )
}

function TheoryOfChangeSection({
    description,
    stages,
    brandColor,
    onOpenStage,
}: {
    description: string
    stages: PublicTheoryStage[]
    brandColor: string
    onOpenStage: (stage: PublicTheoryStage) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const hasDescription = !!description

    return (
        <article className="relative bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: brandColor }} />
            <div className="p-6 md:p-10 pl-8 md:pl-12">
                <div className="flex items-center gap-3 mb-6">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${brandColor}22` }}
                    >
                        <Lightbulb className="w-5 h-5" style={{ color: brandColor }} />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                        Theory of Change
                    </h2>
                </div>

                {hasDescription && (
                    <div className="mb-8">
                        {expanded ? (
                            <div className="space-y-4">{renderParagraphs(description)}</div>
                        ) : (
                            <p className="text-[15px] leading-[1.75] text-gray-700 line-clamp-2 whitespace-pre-wrap">
                                {description}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() => setExpanded(v => !v)}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold transition-colors"
                            style={{ color: brandColor }}
                        >
                            {expanded ? 'Show less' : 'Read more'}
                            <ChevronRight
                                className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
                            />
                        </button>
                    </div>
                )}

                {stages.length > 0 ? (
                    <TheoryStagesGrid
                        stages={stages}
                        brandColor={brandColor}
                        onOpen={onOpenStage}
                    />
                ) : (
                    <div
                        className="border border-dashed rounded-2xl p-6 text-center text-sm text-gray-400"
                        style={{ borderColor: `${brandColor}40` }}
                    >
                        <Workflow className="w-5 h-5 mx-auto mb-2 text-gray-300" />
                        Stages haven't been added yet.
                    </div>
                )}
            </div>
        </article>
    )
}

function TheoryStagesGrid({
    stages,
    brandColor,
    onOpen,
}: {
    stages: PublicTheoryStage[]
    brandColor: string
    onOpen: (stage: PublicTheoryStage) => void
}) {
    // 4 per row on large; on smaller screens we use fewer columns, and
    // rely on the leading-arrow-on-wrap effect via index > 0 (first card has no leading arrow).
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stages.map((stage, i) => (
                <div
                    key={stage.id}
                    className="flex items-stretch gap-2 sm:gap-3"
                >
                    {i > 0 && (
                        <div
                            className="flex items-center justify-center flex-shrink-0"
                            aria-hidden
                        >
                            <ChevronRight
                                className="w-5 h-5"
                                style={{ color: brandColor }}
                            />
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => onOpen(stage)}
                        className="group relative flex-1 min-w-0 text-left rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/50 px-4 py-5 transition-all hover:shadow-md hover:border-gray-200 flex items-center gap-3 focus:outline-none focus:ring-2"
                        style={{ ['--tw-ring-color' as any]: `${brandColor}55` }}
                    >
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: `${brandColor}22`, color: brandColor }}
                        >
                            {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                                {stage.title || 'Untitled stage'}
                            </div>
                            {stage.description.trim() && (
                                <div
                                    className="text-[11px] mt-1 font-medium transition-colors"
                                    style={{ color: brandColor }}
                                >
                                    Tap for details
                                </div>
                            )}
                        </div>
                    </button>
                </div>
            ))}
        </div>
    )
}

function StrategiesSection({
    strategies,
    brandColor,
}: {
    strategies: PublicStrategy[]
    brandColor: string
}) {
    return (
        <article className="relative bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: brandColor }} />
            <div className="p-6 md:p-10 pl-8 md:pl-12">
                <div className="flex items-center gap-3 mb-6">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${brandColor}22` }}
                    >
                        <Target className="w-5 h-5" style={{ color: brandColor }} />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
                        Strategies
                    </h2>
                </div>

                <ul className="space-y-3">
                    {strategies.map((strategy, i) => (
                        <StrategyBullet
                            key={strategy.id}
                            strategy={strategy}
                            index={i}
                            brandColor={brandColor}
                        />
                    ))}
                </ul>
            </div>
        </article>
    )
}

function StrategyBullet({
    strategy,
    index,
    brandColor,
}: {
    strategy: PublicStrategy
    index: number
    brandColor: string
}) {
    const title = (strategy.title || '').trim()
    const description = (strategy.description || '').trim()
    return (
        <li
            className="group relative flex items-start gap-4 md:gap-5 rounded-2xl border border-gray-100 bg-gradient-to-r from-white to-gray-50/40 px-5 md:px-6 py-4 md:py-5 transition-all hover:shadow-md hover:border-gray-200"
        >
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{ backgroundColor: `${brandColor}22`, color: brandColor }}
            >
                {String(index + 1).padStart(2, '0')}
            </div>
            <div className="flex-1 min-w-0">
                {title && (
                    <div className="text-base md:text-lg font-semibold text-gray-900 leading-snug tracking-tight">
                        {title}
                    </div>
                )}
                {description && (
                    <p className={`text-[14px] md:text-[15px] text-gray-600 leading-relaxed ${title ? 'mt-1' : ''}`}>
                        {description}
                    </p>
                )}
            </div>
        </li>
    )
}
