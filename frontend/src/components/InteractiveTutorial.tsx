import React, { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
 X, ChevronRight, ChevronLeft, Sparkles, Target, BarChart3, TrendingUp,
 Link2, Rocket, Layers, MapPin, FileText, Image as ImageIcon,
} from 'lucide-react'
import { useTutorial } from '../context/TutorialContext'
import { EVIDENCE_TYPE_STYLE, EVIDENCE_TYPE_ORDER } from './timeline/EvidenceTypeCounts'

const BRAND = 'var(--brand-primary)'
const BRAND_DARK = 'var(--brand-primary-dark)'
const brandAlpha = (o: number) => `color-mix(in srgb, var(--brand-primary) ${o}%, transparent)`

/* ------------------------------------------------------------------ *
 * Mock UI — small, non-interactive lookalikes of the real app so the
 * tour shows the actual look instead of screenshots.
 * ------------------------------------------------------------------ */

/** Matches the dashboard's SortableInitiativeCard 1:1 (logo tile, title,
 * description, metric/location footer). `compact` drops the footer for the
 * hierarchy graphic. */
function DashboardInitiativeCard({
 title, desc, metrics, locations, active, compact,
}: {
 title: string; desc: string; metrics: number; locations: number; active?: boolean; compact?: boolean
}) {
 return (
 <div className={`bg-white rounded-2xl border shadow-card w-full ${active ? 'border-primary-300/70 ring-2 ring-primary-100' : 'border-gray-200/70'}`}>
 <div className="p-4 flex flex-col gap-2.5">
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white ring-1 ring-gray-100 overflow-hidden">
 <img src="/Nexuslogo.png" alt="" className="w-full h-full object-contain" />
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="text-sm font-semibold leading-snug text-gray-900 line-clamp-1">{title}</h3>
 <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{desc}</p>
 </div>
 </div>
 {!compact && (
 <div className="flex items-center gap-3.5 mt-auto pt-2.5 border-t border-gray-100">
 <span className="inline-flex items-center gap-1 text-xs text-gray-400"><BarChart3 className="w-3.5 h-3.5" />{metrics} metrics</span>
 <span className="inline-flex items-center gap-1 text-xs text-gray-400"><MapPin className="w-3.5 h-3.5" />{locations} locations</span>
 </div>
 )}
 </div>
 </div>
 )
}

function MetricCardMock({ title, value, unit, color }: { title: string; value: string; unit: string; color: string }) {
 return (
 <div className="bg-white rounded-2xl border border-gray-200/70 shadow-card p-3.5 flex flex-col h-[96px]">
 <div className="flex items-start gap-2">
 <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
 <p className="text-[13px] font-medium text-gray-800 leading-snug line-clamp-2">{title}</p>
 </div>
 <div className="flex items-baseline gap-1.5 mt-auto">
 <span className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</span>
 <span className="text-xs text-gray-400 truncate">{unit}</span>
 </div>
 </div>
 )
}

/* Slide 4 — impact claim (teal) linked to evidence (green), with a photo
 * placeholder and all four evidence types. */
function ClaimsEvidenceMock() {
 return (
 <div className="w-full max-w-[360px] mx-auto space-y-3">
 {/* Impact claim — teal, like the connections lane */}
 <div className="rounded-2xl border border-claim-200 bg-claim-50/70 p-4 shadow-card">
 <div className="flex items-center gap-3">
 <span className="w-10 h-10 rounded-xl bg-claim-100 flex items-center justify-center flex-shrink-0 ring-1 ring-claim-200">
 <TrendingUp className="w-5 h-5 text-claim-700" />
 </span>
 <div className="min-w-0">
 <p className="text-sm font-semibold text-gray-900"><span className="text-base mr-1">50</span>people trained</p>
 <p className="text-xs text-gray-500">Impact claim — what you did</p>
 </div>
 </div>
 </div>

 {/* Connector */}
 <div className="flex items-center justify-center gap-2 text-[11px] font-medium text-impact-600">
 <span className="h-px w-8 bg-impact-300" /><Link2 className="w-4 h-4" /> connect by date + place <span className="h-px w-8 bg-impact-300" />
 </div>

 {/* Evidence — green, with a real photo placeholder */}
 <div className="rounded-2xl border border-primary-200 bg-white p-3 shadow-card">
 <div className="flex items-center gap-3">
 <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0 ring-1 ring-gray-200/70 overflow-hidden">
 <ImageIcon className="w-6 h-6 text-gray-400" />
 </div>
 <div className="min-w-0">
 <p className="text-sm font-semibold text-gray-900">Training photos</p>
 <p className="text-xs text-primary-700 font-medium">Evidence — the proof</p>
 </div>
 </div>
 </div>

 {/* All four evidence types with their brand colours */}
 <div className="pt-1">
 <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2 text-center">Four types of evidence</p>
 <div className="grid grid-cols-2 gap-2">
 {EVIDENCE_TYPE_ORDER.map(t => {
 const s = EVIDENCE_TYPE_STYLE[t]
 const Icon = s.icon
 return (
 <div key={t} className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${s.chip}`}>
 <Icon className="w-4 h-4" /> {s.shortLabel}
 </div>
 )
 })}
 </div>
 </div>
 </div>
 )
}

/* Slide 5 — a log is a claim, evidence, or both. */
function LogsMock() {
 const rows: { title: string; sub: string; chips: ('claim' | 'evidence')[] }[] = [
 { title: 'Just a claim', sub: '50 people trained', chips: ['claim'] },
 { title: 'Just evidence', sub: 'Training photos', chips: ['evidence'] },
 { title: 'Both together', sub: 'Claim + its proof', chips: ['claim', 'evidence'] },
 ]
 return (
 <div className="w-full max-w-[360px] mx-auto space-y-2.5">
 {rows.map(r => (
 <div key={r.title} className="rounded-2xl border border-gray-200/70 bg-white p-3.5 shadow-card flex items-center gap-3">
 <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: brandAlpha(16) }}>
 <FileText className="w-4 h-4" style={{ color: BRAND_DARK }} />
 </span>
 <div className="min-w-0 flex-1">
 <p className="text-sm font-semibold text-gray-900">{r.title}</p>
 <p className="text-xs text-gray-500 truncate">{r.sub}</p>
 </div>
 <div className="flex items-center gap-1.5 flex-shrink-0">
 {r.chips.includes('claim') && (
 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-claim-300 bg-claim-50 text-claim-700 text-[11px] font-semibold">
 <TrendingUp className="w-3 h-3" /> Claim
 </span>
 )}
 {r.chips.includes('evidence') && (
 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-primary-300 bg-primary-50 text-primary-800 text-[11px] font-semibold">
 <ImageIcon className="w-3 h-3 text-primary-700" /> Evidence
 </span>
 )}
 </div>
 </div>
 ))}
 </div>
 )
}

/* ---- Hierarchy graphic building blocks ---- */

const VLine = ({ h = 20 }: { h?: number }) => <div className="w-0.5 bg-gray-200" style={{ height: h }} />
const TierLabel = ({ children }: { children: React.ReactNode }) => (
 <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{children}</p>
)

function MetricNode({ title, value, unit, color }: { title: string; value: string; unit: string; color: string }) {
 return (
 <div className="w-full max-w-[140px] bg-white rounded-xl border border-gray-200/70 shadow-card p-3">
 <div className="flex items-center gap-1.5">
 <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
 <span className="text-xs font-medium text-gray-700 truncate">{title}</span>
 </div>
 <div className="flex items-baseline gap-1 mt-1.5">
 <span className="text-lg font-semibold text-gray-900 tabular-nums">{value}</span>
 <span className="text-[10px] text-gray-400">{unit}</span>
 </div>
 </div>
 )
}

function ClaimNode() {
 return (
 <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-claim-300 bg-claim-50 text-claim-700 text-xs font-semibold shadow-sm">
 <TrendingUp className="w-4 h-4" /> Impact claim
 </span>
 )
}

function EvidenceNode() {
 return (
 <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary-300 bg-primary-50 text-primary-800 text-xs font-semibold shadow-sm">
 <ImageIcon className="w-4 h-4 text-primary-700" /> Evidence
 </span>
 )
}

/* The core graphic: initiative → 2 metrics → impact claim + evidence. */
function HierarchyMock() {
 return (
 <div className="flex flex-col items-center w-full max-w-[400px] mx-auto">
 <TierLabel>Initiative</TierLabel>
 <div className="w-56">
 <DashboardInitiativeCard compact active title="Youth Training 2025" desc="Skills program for local youth" metrics={2} locations={3} />
 </div>
 <VLine h={22} />

 {/* branch to two metrics */}
 <div className="relative flex justify-center gap-8 w-full">
 <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-gray-200" />
 <div className="flex-1 flex flex-col items-center">
 <VLine h={18} />
 <TierLabel>Metric</TierLabel>
 <MetricNode title="People trained" value="320" unit="ppl" color="#22c55e" />
 </div>
 <div className="flex-1 flex flex-col items-center">
 <VLine h={18} />
 <TierLabel>Metric</TierLabel>
 <MetricNode title="Wells built" value="18" unit="wells" color="#3b82f6" />
 </div>
 </div>

 {/* each metric is grown by a claim + its evidence */}
 <div className="flex justify-center gap-8 w-full">
 {[0, 1].map(col => (
 <div key={col} className="flex-1 flex flex-col items-center">
 <VLine h={18} />
 <div className="flex flex-col items-center gap-2">
 <ClaimNode />
 <EvidenceNode />
 </div>
 </div>
 ))}
 </div>

 <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-impact-600">
 <Link2 className="w-4 h-4" /> Claims + evidence prove each metric
 </div>
 </div>
 )
}

/* ------------------------------------------------------------------ *
 * Slides — kept deliberately short.
 * ------------------------------------------------------------------ */

type SlideLayout = 'hero' | 'two-col' | 'closing'

interface Slide {
 key: string
 layout: SlideLayout
 icon: typeof Target
 eyebrow?: string
 title: string
 body?: string
 bullets?: string[]
 art?: React.ReactNode
}

const SLIDES: Slide[] = [
 {
 key: 'welcome',
 layout: 'hero',
 icon: Sparkles,
 title: 'Nexus Impacts AI',
 body: "We've refreshed the app and added a new Logs page. Here's how it all works — in about a minute.",
 },
 {
 key: 'how',
 layout: 'two-col',
 icon: Layers,
 eyebrow: 'How it works',
 title: 'Everything connects',
 body: 'Your work fits together in a simple order. This is the whole picture:',
 bullets: [
 'Initiatives hold your metrics',
 'Metrics are the things you measure',
 'Claims + evidence prove each metric',
 ],
 art: <HierarchyMock />,
 },
 {
 key: 'initiatives',
 layout: 'two-col',
 icon: Target,
 eyebrow: 'Part 1',
 title: 'Initiatives',
 body: 'An initiative is one project or program. Everything you track lives inside it.',
 bullets: [
 'Examples: “Youth Training”, “Clean Water”',
 'Each one holds its own metrics and proof',
 'Make as many as you need',
 ],
 art: (
 <div className="space-y-3 w-full max-w-[380px] mx-auto">
 <DashboardInitiativeCard active title="Youth Training 2025" desc="Skills program for local youth across three regions." metrics={4} locations={3} />
 <DashboardInitiativeCard title="Clean Water Project" desc="Building wells and safe water access points." metrics={3} locations={5} />
 </div>
 ),
 },
 {
 key: 'metrics',
 layout: 'two-col',
 icon: BarChart3,
 eyebrow: 'Part 2',
 title: 'Metrics',
 body: 'Inside each initiative you add metrics — the things you count, like people trained or wells built.',
 bullets: [
 'Give it a name and a unit (people, hours…)',
 'Watch each metric grow over time',
 ],
 art: (
 <div className="grid grid-cols-2 gap-2.5 w-full max-w-[380px] mx-auto">
 <MetricCardMock title="People trained" value="320" unit="people" color="#22c55e" />
 <MetricCardMock title="Wells built" value="18" unit="wells" color="#3b82f6" />
 </div>
 ),
 },
 {
 key: 'claims-evidence',
 layout: 'two-col',
 icon: TrendingUp,
 eyebrow: 'Part 3',
 title: 'Impact claims & evidence',
 body: 'Metrics grow from two things. An impact claim says what you did. Evidence is the proof. Add them on the Logs page — in any order.',
 bullets: [
 'Claim first, then add evidence — or the other way',
 'Same date + place = connected on their own',
 'Green means connected and proven',
 ],
 art: <ClaimsEvidenceMock />,
 },
 {
 key: 'logs',
 layout: 'two-col',
 icon: FileText,
 eyebrow: 'Part 4',
 title: 'The Logs page',
 body: 'You add impact claims and evidence to your metrics by making a log. A log can be just a claim, just a piece of evidence, or both at once.',
 bullets: [
 'Log a claim on its own, evidence on its own, or both together',
 'The order never matters',
 'What matters is when they connect — that’s what backs up your claims',
 ],
 art: <LogsMock />,
 },
 {
 key: 'get-started',
 layout: 'closing',
 icon: Rocket,
 eyebrow: "You're ready",
 title: "Let's get started",
 },
]

const GET_STARTED_STEPS = [
 { icon: Target, title: 'Create an initiative', desc: 'Start a project to track.' },
 { icon: BarChart3, title: 'Add your metrics', desc: 'Choose what you measure.' },
 { icon: FileText, title: 'Open the Logs page', desc: 'Add claims and evidence.' },
]

/* ------------------------------------------------------------------ */

const slideVariants = {
 enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
 center: { opacity: 1, x: 0 },
 exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -48 : 48 }),
}
const EASE = [0.16, 1, 0.3, 1] as const

export default function InteractiveTutorial() {
 const { isActive, currentSlide, totalSlides, nextSlide, prevSlide, goToSlide, closeTutorial } = useTutorial()

 const lastSlide = useRef(currentSlide)
 const direction = currentSlide >= lastSlide.current ? 1 : -1
 useEffect(() => { lastSlide.current = currentSlide }, [currentSlide])

 useEffect(() => {
 if (!isActive) return
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === 'ArrowRight') nextSlide()
 else if (e.key === 'ArrowLeft') prevSlide()
 else if (e.key === 'Escape') closeTutorial()
 }
 window.addEventListener('keydown', handleKeyDown)
 return () => window.removeEventListener('keydown', handleKeyDown)
 }, [isActive, nextSlide, prevSlide, closeTutorial])

 if (!isActive) return null

 const slide = SLIDES[Math.min(currentSlide, SLIDES.length - 1)]
 const Icon = slide.icon
 const isFirst = currentSlide === 0
 const isLast = currentSlide === totalSlides - 1
 const isWelcome = slide.layout === 'hero'

 return (
 <div className="fixed inset-0 z-[100] flex flex-col h-dvh overflow-hidden">
 {/* Background — soft light with brand blur accents */}
 <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f5f6f8 42%, #eef0f3 100%)' }} />
 <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-40 blur-[120px]" style={{ backgroundColor: BRAND }} />
 <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-30 blur-[110px]" style={{ backgroundColor: BRAND }} />

 {/* Top bar — progress + skip (hidden on the welcome hero) */}
 {!isWelcome && (
 <div className="relative z-10 flex items-center justify-between px-5 py-3 flex-shrink-0 app-card-flat border-b border-gray-200/80">
 <div className="flex items-center gap-2">
 {SLIDES.map((s, i) => (
 <button
 key={s.key}
 onClick={() => goToSlide(i)}
 aria-label={`Go to step ${i + 1}`}
 className="rounded-full transition-all duration-300"
 style={{
 width: i === currentSlide ? 28 : 8,
 height: 8,
 backgroundColor: i === currentSlide ? BRAND_DARK : i < currentSlide ? brandAlpha(45) : 'rgb(209 213 219)',
 }}
 />
 ))}
 <span className="ml-3 text-xs text-gray-400 font-medium tabular-nums">{currentSlide + 1} / {totalSlides}</span>
 </div>
 <button onClick={closeTutorial} className="app-btn app-btn-ghost app-btn-sm flex items-center gap-1.5">
 Skip <X className="w-3.5 h-3.5" />
 </button>
 </div>
 )}

 {/* Content */}
 <div className="relative z-10 flex-1 min-h-0 overflow-y-auto">
 <div className="flex items-center justify-center min-h-full px-5 md:px-10 py-8">
 <AnimatePresence mode="wait" custom={direction}>
 <motion.div
 key={slide.key}
 custom={direction}
 variants={slideVariants}
 initial="enter"
 animate="center"
 exit="exit"
 transition={{ duration: 0.4, ease: EASE }}
 className="w-full max-w-5xl"
 >
 {slide.layout === 'hero' ? (
 <HeroSlide slide={slide} onStart={nextSlide} onSkip={closeTutorial} />
 ) : slide.layout === 'closing' ? (
 <ClosingSlide slide={slide} />
 ) : (
 <TwoColSlide slide={slide} Icon={Icon} />
 )}
 </motion.div>
 </AnimatePresence>
 </div>
 </div>

 {/* Bottom nav (hidden on the welcome hero, which has its own CTA) */}
 {!isWelcome && (
 <div className="relative z-10 flex items-center justify-between px-5 py-3 flex-shrink-0 app-card-flat border-t border-gray-200/80">
 <div>
 {!isFirst ? (
 <button onClick={prevSlide} className="app-btn app-btn-secondary app-btn-sm flex items-center gap-1.5">
 <ChevronLeft className="w-4 h-4" /> Back
 </button>
 ) : <div />}
 </div>
 <button
 onClick={isLast ? closeTutorial : nextSlide}
 className="flex items-center gap-1.5 px-5 py-2 text-white rounded-xl transition-all duration-200 font-semibold text-sm shadow-lg hover:opacity-90"
 style={{ backgroundColor: BRAND_DARK }}
 >
 {isLast ? 'Get started' : 'Next'}
 {isLast ? <Rocket className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
 </button>
 </div>
 )}
 </div>
 )
}

/* ---- Slide layouts ---- */

function HeroSlide({ slide, onStart, onSkip }: { slide: Slide; onStart: () => void; onSkip: () => void }) {
 return (
 <div className="flex flex-col items-center justify-center text-center">
 <motion.p
 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
 className="text-lg sm:text-xl md:text-2xl font-newsreader font-light text-foreground mb-3"
 >
 Welcome to
 </motion.p>
 <motion.h1
 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4, ease: EASE }}
 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-newsreader font-light text-foreground leading-[1.1]"
 >
 Nexus Impacts{' '}
 <span className="relative inline-block">
 <span className="relative z-10">AI</span>
 <svg className="absolute -bottom-1 md:-bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
 <path d="M2 8C50 2 150 2 198 8" stroke={BRAND} strokeWidth="4" strokeLinecap="round" />
 </svg>
 </span>
 </motion.h1>
 <motion.p
 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.7, ease: EASE }}
 className="text-sm md:text-base text-gray-500 mt-5 max-w-md"
 >
 {slide.body}
 </motion.p>
 <motion.button
 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 1, ease: EASE }}
 onClick={onStart}
 className="mt-8 flex items-center gap-1.5 px-6 py-3 text-white rounded-xl font-semibold text-sm shadow-lg hover:opacity-90 transition-opacity"
 style={{ backgroundColor: BRAND_DARK }}
 >
 Let's go <ChevronRight className="w-4 h-4" />
 </motion.button>
 <motion.button
 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1.3 }}
 onClick={onSkip}
 className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
 >
 Skip tutorial
 </motion.button>
 </div>
 )
}

function TwoColSlide({ slide, Icon }: { slide: Slide; Icon: typeof Target }) {
 return (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">
 <div className="order-2 lg:order-1">
 <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 shadow-md border border-white/60" style={{ backgroundColor: brandAlpha(22) }}>
 <Icon className="w-5 h-5" style={{ color: BRAND_DARK }} />
 </div>
 {slide.eyebrow && (
 <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: BRAND_DARK }}>{slide.eyebrow}</p>
 )}
 <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight leading-tight">{slide.title}</h2>
 {slide.body && <p className="text-sm md:text-base text-gray-500 leading-relaxed mb-5">{slide.body}</p>}
 {slide.bullets && (
 <div className="space-y-2">
 {slide.bullets.map((b, i) => (
 <motion.div
 key={i}
 initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.2 + i * 0.1, ease: EASE }}
 className="flex items-start gap-3 app-card-muted px-4 py-2.5"
 >
 <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: brandAlpha(28) }}>
 <span className="text-xs font-bold" style={{ color: BRAND_DARK }}>{i + 1}</span>
 </div>
 <p className="text-gray-600 text-sm leading-relaxed">{b}</p>
 </motion.div>
 ))}
 </div>
 )}
 </div>
 <motion.div
 initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15, ease: EASE }}
 className="order-1 lg:order-2 flex items-center justify-center"
 >
 {slide.art}
 </motion.div>
 </div>
 )
}

function ClosingSlide({ slide }: { slide: Slide }) {
 return (
 <div className="flex flex-col items-center text-center">
 <motion.div
 initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }}
 className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-md border border-white/60" style={{ backgroundColor: brandAlpha(22) }}
 >
 <Rocket className="w-7 h-7" style={{ color: BRAND_DARK }} />
 </motion.div>
 {slide.eyebrow && <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: BRAND_DARK }}>{slide.eyebrow}</p>}
 <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 tracking-tight">{slide.title}</h2>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
 {GET_STARTED_STEPS.map((step, i) => {
 const StepIcon = step.icon
 return (
 <motion.div
 key={step.title}
 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.2 + i * 0.12, ease: EASE }}
 className="app-card p-5 flex flex-col items-center text-center"
 >
 <span className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: brandAlpha(18), color: BRAND_DARK }}>
 <StepIcon className="w-5 h-5" />
 </span>
 <span className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: BRAND_DARK }}>Step {i + 1}</span>
 <p className="text-sm font-semibold text-gray-900">{step.title}</p>
 <p className="text-xs text-gray-500 mt-1">{step.desc}</p>
 </motion.div>
 )
 })}
 </div>
 </div>
 )
}
