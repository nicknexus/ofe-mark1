import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Chapter, INK, shade } from './orgShowcase'

export type FeedItem = { key: string; at: number; title: string; body?: string; image?: string | null; href?: string; kind: string }

const QUEUE = 3
const GAP = 20
const WHEEL_LOCK_MS = 650
const RAIL_STOP = 96

const dateParts = (at: number) => {
    const date = new Date(at)
    return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        day: date.getDate(),
        year: date.getFullYear(),
    }
}

function relative(at: number) {
    const days = Math.round((at - Date.now()) / 86_400_000)
    const format = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })
    if (Math.abs(days) < 7) return format.format(days, 'day')
    if (Math.abs(days) < 60) return format.format(Math.round(days / 7), 'week')
    if (Math.abs(days) < 730) return format.format(Math.round(days / 30), 'month')
    return format.format(Math.round(days / 365), 'year')
}

function DateBadge({ at, accent, large }: { at: number; accent: string; large?: boolean }) {
    if (!at) return null
    const { month, day, year } = dateParts(at)
    return (
        <div className={`rounded-2xl bg-white/95 text-center shadow-lg ${large ? 'px-4 py-2.5 min-w-[4.5rem]' : 'px-2.5 py-1.5 min-w-[3.25rem]'}`}>
            <p className={`font-semibold uppercase tracking-[0.12em] ${large ? 'text-[12px]' : 'text-[10px]'}`} style={{ color: accent }}>{month}</p>
            <p className={`font-fraunces leading-none ${large ? 'text-4xl' : 'text-2xl'}`} style={{ color: INK }}>{day}</p>
            <p className={`text-secondary-500 ${large ? 'mt-0.5 text-[12px]' : 'text-[10px]'}`}>{year}</p>
        </div>
    )
}

export function OrgPostTimeline({ items, brandColor, accent }: { items: FeedItem[]; brandColor: string; accent: string }) {
    const reduce = useReducedMotion()
    const trackRef = useRef<HTMLDivElement>(null)
    const railRef = useRef<HTMLDivElement>(null)
    const stopRefs = useRef<(HTMLLIElement | null)[]>([])
    const wheelAt = useRef(0)
    const [width, setWidth] = useState(0)
    const [index, setIndex] = useState(0)
    const [expanded, setExpanded] = useState(false)
    const [fill, setFill] = useState(0)
    const count = items.length
    const background = shade(brandColor, 0.2)

    useEffect(() => {
        const node = trackRef.current
        if (!node) return
        const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        const rail = railRef.current
        const stop = stopRefs.current[index]
        if (!rail || !stop) return
        const center = stop.offsetLeft + stop.offsetWidth / 2
        setFill(center - RAIL_STOP / 2)
        rail.scrollTo({ left: center - rail.clientWidth / 2, behavior: reduce ? 'auto' : 'smooth' })
    }, [index, width, count, reduce])

    const jump = (next: number) => {
        setExpanded(false)
        setIndex(Math.max(0, Math.min(count - 1, next)))
    }
    const go = (step: number) => jump(index + step)

    const narrow = width < 768
    const featureW = narrow ? width : Math.round(width * 0.58)
    const featureH = narrow ? Math.min(560, Math.max(420, Math.round(width * 1.15))) : 540
    const queueSlots = narrow ? 0 : QUEUE
    const queueW = Math.max(0, (width - featureW - GAP - (QUEUE - 1) * GAP) / QUEUE)
    const queueH = Math.round(featureH * 0.7)

    /** Slot 0 is the feature, 1..n wait on the right, the one just viewed drifts off to the left. */
    const layoutFor = (slot: number) => {
        if (slot === 0) return { x: 0, y: 0, width: featureW, height: featureH, opacity: 1, zIndex: 3 }
        if (slot < 0) return { x: -featureW * 0.35, y: 0, width: featureW, height: featureH, opacity: 0, zIndex: 1 }
        if (slot <= queueSlots) {
            return { x: featureW + GAP + (slot - 1) * (queueW + GAP), y: featureH - queueH, width: queueW, height: queueH, opacity: 1, zIndex: 2 }
        }
        return { x: width + GAP, y: featureH - queueH, width: queueW || featureW, height: queueH, opacity: 0, zIndex: 0 }
    }

    const arrow = 'h-11 w-11 rounded-full border border-white/25 text-white inline-flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none'

    return (
        <section
            className="relative overflow-hidden outline-none"
            style={{ background }}
            tabIndex={-1}
            onKeyDown={event => {
                if (event.key === 'ArrowLeft') go(-1)
                if (event.key === 'ArrowRight') go(1)
            }}
        >
            <div aria-hidden className="pointer-events-none absolute -left-40 top-1/3 h-[40rem] w-[50rem] rounded-full blur-3xl opacity-30" style={{ background: `radial-gradient(ellipse, ${brandColor} 0%, transparent 65%)` }} />
            <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-10 lg:py-14">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <Chapter kicker="From the field" title="Latest posts and stories" sub="A timeline of what the team has shared, newest first." accent={accent} tone="dark" />
                    {count > 1 && (
                        <div className="flex items-center gap-3">
                            <span className="text-[13px] font-medium text-white/60 tabular-nums">{index + 1} of {count}</span>
                            <button type="button" aria-label="Newer" title="Newer" onClick={() => go(-1)} disabled={index === 0} className={arrow}>
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <button type="button" aria-label="Older" title="Older" onClick={() => go(1)} disabled={index === count - 1} className={arrow}>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                <motion.div
                    ref={trackRef}
                    className="relative mt-6 touch-pan-y"
                    style={{ height: featureH }}
                    onWheel={event => {
                        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 20) return
                        const now = Date.now()
                        if (now - wheelAt.current < WHEEL_LOCK_MS) return
                        wheelAt.current = now
                        go(event.deltaX > 0 ? 1 : -1)
                    }}
                    onPanEnd={(_, info) => {
                        if (info.offset.x < -60) go(1)
                        else if (info.offset.x > 60) go(-1)
                    }}
                >
                    {width > 0 && items.map((item, itemIndex) => {
                        const slot = itemIndex - index
                        if (slot < -1 || slot > queueSlots + 1) return null
                        const { zIndex, ...target } = layoutFor(slot)
                        const feature = slot === 0
                        const queued = slot > 0 && slot <= queueSlots
                        return (
                            <motion.article
                                key={item.key}
                                className={`absolute top-0 left-0 rounded-3xl overflow-hidden bg-[#0b1410] ${queued ? 'cursor-pointer' : ''}`}
                                style={{ zIndex, pointerEvents: feature || queued ? 'auto' : 'none', boxShadow: feature ? '0 30px 80px -24px rgba(0,0,0,0.65)' : '0 18px 40px -24px rgba(0,0,0,0.6)' }}
                                initial={slot > queueSlots ? layoutFor(queueSlots + 1) : false}
                                animate={target}
                                transition={reduce ? { duration: 0 } : { duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                                onClick={queued ? () => jump(itemIndex) : undefined}
                                aria-hidden={!feature && !queued}
                            >
                                {item.image ? (
                                    <img src={item.image} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover select-none" />
                                ) : (
                                    <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${brandColor}, ${shade(brandColor, 0.35)} 80%)` }} />
                                )}
                                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(8,14,11,0.92) 0%, rgba(8,14,11,0.55) 40%, rgba(8,14,11,0.05) 70%)' }} />
                                {!feature && <div className="absolute inset-0 bg-black/25 transition-opacity hover:opacity-0" />}

                                <div className={`absolute ${feature ? 'top-5 left-5' : 'top-3 left-3'}`}>
                                    <DateBadge at={item.at} accent={accent} large={feature} />
                                </div>

                                {feature ? (
                                    <motion.div
                                        key={`${item.key}-text`}
                                        className={`absolute inset-x-0 bottom-0 p-6 sm:p-8 ${expanded ? 'rounded-b-3xl' : ''}`}
                                        style={expanded ? { background: '#FFFFFF' } : undefined}
                                        initial={reduce ? false : { opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.45, delay: reduce ? 0 : 0.25 }}
                                    >
                                        <p className={`text-[12px] font-semibold tracking-[0.14em] uppercase ${expanded ? 'text-secondary-500' : 'text-white/70'}`}>
                                            {[item.kind, item.at ? relative(item.at) : ''].filter(Boolean).join(' · ')}
                                        </p>
                                        <h3 className={`mt-2 font-fraunces text-3xl sm:text-4xl leading-[1.1] text-balance ${expanded ? '' : 'text-white'}`} style={expanded ? { color: INK } : undefined}>{item.title}</h3>
                                        {item.body && (
                                            <p className={`mt-3 max-w-2xl text-[15px] leading-relaxed ${expanded ? 'whitespace-pre-line max-h-56 overflow-y-auto pr-2 text-secondary-700' : 'line-clamp-2 text-white/80'}`}>
                                                {item.body}
                                            </p>
                                        )}
                                        <div className="mt-4 flex flex-wrap items-center gap-3">
                                            {(item.body || '').length > 140 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setExpanded(value => !value)}
                                                    className="inline-flex items-center h-9 px-4 rounded-full text-[13px] font-semibold border"
                                                    style={expanded ? { background: INK, color: '#FFFFFF', borderColor: INK } : { background: '#FFFFFF', color: INK, borderColor: '#FFFFFF' }}
                                                >
                                                    {expanded ? 'Show less' : 'Read more'}
                                                </button>
                                            )}
                                            {item.href && (
                                                <Link
                                                    to={item.href}
                                                    className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold shadow-sm"
                                                    style={{ background: '#FFFFFF', color: accent }}
                                                >
                                                    Open story <ArrowUpRight className="w-4 h-4" />
                                                </Link>
                                            )}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <div className="absolute inset-x-0 bottom-0 p-4">
                                        {slot === 1 && <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/60">Up next</p>}
                                        <p className="mt-1 text-[15px] font-semibold leading-snug text-white line-clamp-3">{item.title}</p>
                                    </div>
                                )}
                            </motion.article>
                        )
                    })}
                </motion.div>

                {count > 1 && (
                    <div className="mt-8">
                        <div className="flex justify-between text-[11px] font-semibold tracking-[0.14em] uppercase text-white/45">
                            <span>Newest</span>
                            <span>Older</span>
                        </div>
                        <div
                            ref={railRef}
                            className="mt-2 overflow-x-auto py-3"
                            style={{ scrollbarWidth: 'none', maskImage: 'linear-gradient(to right, transparent, black 4%, black 96%, transparent)' }}
                        >
                            <div className="relative w-max min-w-full">
                                <div className="absolute top-[7px] h-px bg-white/20" style={{ left: RAIL_STOP / 2, right: RAIL_STOP / 2 }} />
                                <motion.div
                                    className="absolute top-[7px] h-px bg-white"
                                    style={{ left: RAIL_STOP / 2 }}
                                    initial={false}
                                    animate={{ width: fill }}
                                    transition={reduce ? { duration: 0 } : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                />
                                <ol className="relative flex justify-between">
                                    {items.map((item, itemIndex) => {
                                        const active = itemIndex === index
                                        const parts = item.at ? dateParts(item.at) : null
                                        const prevYear = itemIndex > 0 && items[itemIndex - 1].at ? dateParts(items[itemIndex - 1].at).year : null
                                        const newYear = !!parts && (itemIndex === 0 || parts.year !== prevYear)
                                        return (
                                            <li
                                                key={item.key}
                                                ref={node => { stopRefs.current[itemIndex] = node }}
                                                className="shrink-0 flex justify-center"
                                                style={{ width: RAIL_STOP }}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => jump(itemIndex)}
                                                    aria-label={`Show post from ${parts ? `${parts.month} ${parts.day}, ${parts.year}` : 'unknown date'}`}
                                                    aria-current={active}
                                                    className="group flex flex-col items-center"
                                                >
                                                    <span
                                                        className="h-3.5 w-3.5 rounded-full border-2 transition-all"
                                                        style={active
                                                            ? { background: '#FFFFFF', borderColor: '#FFFFFF', boxShadow: `0 0 0 4px ${brandColor}66` }
                                                            : { background, borderColor: itemIndex < index ? '#FFFFFF' : 'rgba(255,255,255,0.4)' }}
                                                    />
                                                    {parts && (
                                                        <>
                                                            <span className={`mt-2 text-[13px] font-semibold whitespace-nowrap transition-colors ${active ? 'text-white' : 'text-white/55 group-hover:text-white/80'}`}>
                                                                {parts.month} {parts.day}
                                                            </span>
                                                            <span className={`text-[11px] ${newYear ? (active ? 'text-white' : 'text-white/70 font-semibold') : 'invisible'}`}>{parts.year}</span>
                                                        </>
                                                    )}
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ol>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}

/** One featured post or story, filling whatever pane it's dropped into. Same card as the timeline, scaled down. */
export function FieldFeatureCard({ item, brandColor, accent }: { item: FeedItem; brandColor: string; accent: string }) {
    const [expanded, setExpanded] = useState(false)
    useEffect(() => { setExpanded(false) }, [item.key])
    const long = (item.body || '').length > 120

    return (
        <article className="relative h-full w-full rounded-2xl overflow-hidden bg-[#0b1410]">
            {item.image ? (
                <img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
                <div className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${brandColor}, ${shade(brandColor, 0.35)} 80%)` }} />
            )}
            {!expanded && <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(8,14,11,0.9) 0%, rgba(8,14,11,0.45) 42%, rgba(8,14,11,0.05) 68%)' }} />}
            <div className="absolute top-3 left-3">
                <DateBadge at={item.at} accent={accent} />
            </div>
            <div className={`absolute inset-x-0 bottom-0 p-4 ${expanded ? 'rounded-b-2xl max-h-[78%] flex flex-col' : ''}`} style={expanded ? { background: '#FFFFFF' } : undefined}>
                <div className={expanded ? 'overflow-y-auto min-h-0' : ''}>
                    <p className={`text-[11px] font-semibold tracking-[0.14em] uppercase ${expanded ? 'text-secondary-500' : 'text-white/70'}`}>
                        {[item.kind, item.at ? relative(item.at) : ''].filter(Boolean).join(' · ')}
                    </p>
                    <h3 className={`mt-1 font-fraunces text-xl sm:text-2xl leading-[1.15] text-balance ${expanded ? 'line-clamp-3' : 'line-clamp-2 text-white'}`} style={expanded ? { color: INK } : undefined}>{item.title}</h3>
                    {item.body && (
                        <p className={`mt-2 text-[13px] leading-relaxed ${expanded ? 'whitespace-pre-line text-secondary-700' : 'line-clamp-2 text-white/80'}`}>{item.body}</p>
                    )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 shrink-0">
                    {long && (
                        <button
                            type="button"
                            onClick={() => setExpanded(value => !value)}
                            className="inline-flex items-center h-8 px-3.5 rounded-full text-[12px] font-semibold"
                            style={expanded ? { background: INK, color: '#FFFFFF' } : { background: '#FFFFFF', color: INK }}
                        >
                            {expanded ? 'Show less' : 'Read more'}
                        </button>
                    )}
                    {item.href && (
                        <Link to={item.href} className="inline-flex items-center gap-1 h-8 px-3.5 rounded-full text-[12px] font-semibold shadow-sm" style={{ background: '#FFFFFF', color: accent }}>
                            Open story <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    )}
                </div>
            </div>
        </article>
    )
}
