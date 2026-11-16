import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, useInView, useReducedMotion } from 'framer-motion'
import type { PublicEvidence, PublicKPI, PublicKPIUpdate } from '../../../services/publicApi'

const CATEGORY_RANK: Record<string, number> = { impact: 0, output: 1, input: 2 }

export function imageOf(evidence: PublicEvidence) {
    const urls = [evidence.file_url, ...(evidence.files || []).map(file => file.file_url)].filter((url): url is string => !!url)
    return urls.find(url => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)) || null
}

export function formatMetric(value: number, percentage?: boolean) {
    if (percentage) return `${Math.round(value)}%`
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    return Math.round(value).toLocaleString('en-US')
}

/** Only metrics with a logged value. Evidence-backed first, then impact over output over input, then size. */
export function rankMetrics(metrics: PublicKPI[]) {
    return metrics.filter(metric => (metric.total_value || 0) > 0).sort((a, b) => {
        const proof = Number((b.evidence_count || 0) > 0) - Number((a.evidence_count || 0) > 0)
        if (proof) return proof
        const category = (CATEGORY_RANK[a.category] ?? 3) - (CATEGORY_RANK[b.category] ?? 3)
        if (category) return category
        return (b.total_value || 0) - (a.total_value || 0)
    })
}

export function evidenceForMetric(metric: PublicKPI, evidence: PublicEvidence[]) {
    const updateIds = new Set((metric.updates || []).map(update => update.id))
    return evidence.filter(item =>
        item.kpis?.some(kpi => kpi.id === metric.id) ||
        item.impact_claims?.some(claim => claim.kpi_id === metric.id || updateIds.has(claim.id))
    )
}

export type RecentResult = { update: PublicKPIUpdate; metric: PublicKPI }

/** Newest results, one per metric first so a single busy metric can't fill the feed. */
export function recentResults(metrics: PublicKPI[], limit: number): RecentResult[] {
    const rows = metrics
        .flatMap(metric => (metric.updates || []).map(update => ({ update, metric })))
        .filter(row => row.update.value)
        .sort((a, b) => updateTime(b.update) - updateTime(a.update))
    const seen = new Set<string>()
    const firsts = rows.filter(row => !seen.has(row.metric.id) && !!seen.add(row.metric.id))
    const rest = rows.filter(row => !firsts.includes(row))
    return [...firsts, ...rest].slice(0, limit)
}

export const claimValue = ({ update, metric }: RecentResult) =>
    metric.metric_type === 'percentage' ? formatMetric(update.value, true) : `+${formatMetric(update.value)}`

export const INK = '#1C2B24'
export const PAPER = '#F7F8F4'

function parseHex(hex: string) {
    const raw = hex.replace('#', '')
    const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw
    const n = parseInt(full, 16)
    return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : null
}

function toHex(rgb: number[]) {
    return `#${rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
}

/** Darkens toward black; amount 1 is unchanged. */
export function shade(hex: string, amount: number) {
    const rgb = parseHex(hex)
    return rgb ? toHex(rgb.map(channel => channel * amount)) : '#14352A'
}

/** Solid brand wash over white; amount 0 is white. */
export function tint(hex: string, amount: number) {
    const rgb = parseHex(hex)
    return rgb ? toHex(rgb.map(channel => 255 + (channel - 255) * amount)) : PAPER
}

export const plural = (count: number, word: string, many = `${word}s`) => `${count.toLocaleString('en-US')} ${count === 1 ? word : many}`

export function Chapter({ kicker, title, sub, accent, tone = 'light' }: { kicker: string; title: string; sub?: string; accent: string; tone?: 'light' | 'dark' }) {
    const dark = tone === 'dark'
    return (
        <div className="max-w-2xl">
            <p className="text-[12px] font-semibold tracking-[0.16em] uppercase" style={{ color: dark ? 'rgba(255,255,255,0.65)' : accent }}>{kicker}</p>
            <h2 className="mt-2 font-fraunces text-4xl sm:text-5xl leading-[1.05] text-balance" style={{ color: dark ? '#FFFFFF' : INK }}>{title}</h2>
            {sub && <p className={`mt-2 text-lg leading-relaxed ${dark ? 'text-white/70' : 'text-secondary-600'}`}>{sub}</p>}
        </div>
    )
}

export function compactNumber(value: number) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function updateTime(update: PublicKPIUpdate) {
    return new Date(update.date_range_end || update.date_represented).getTime() || 0
}

export function shortDate(value?: string) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function CountUp({ value, percentage }: { value: number; percentage?: boolean }) {
    const ref = useRef<HTMLSpanElement>(null)
    const inView = useInView(ref, { once: true, margin: '-40px' })
    const reduce = useReducedMotion()
    const [shown, setShown] = useState(reduce ? value : 0)

    useEffect(() => {
        if (!inView) return
        if (reduce) {
            setShown(value)
            return
        }
        const controls = animate(0, value, { duration: 1.4, ease: [0.16, 1, 0.3, 1], onUpdate: setShown })
        return () => controls.stop()
    }, [inView, value, reduce])

    return <span ref={ref}>{formatMetric(shown, percentage)}</span>
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
    const reduce = useReducedMotion()
    if (reduce) return <div className={className}>{children}</div>
    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
        >
            {children}
        </motion.div>
    )
}

/** Highlights the section nav pill for whichever section is in view. */
export function useActiveSection(ids: string[]) {
    const [active, setActive] = useState(ids[0] || '')
    const key = ids.join('|')

    useEffect(() => {
        const nodes = ids.map(id => document.getElementById(id)).filter((node): node is HTMLElement => !!node)
        if (!nodes.length) return
        const observer = new IntersectionObserver(
            entries => {
                const visible = entries.filter(entry => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
                if (visible) setActive(visible.target.id)
            },
            { rootMargin: '-80px 0px -55% 0px' }
        )
        nodes.forEach(node => observer.observe(node))
        return () => observer.disconnect()
    }, [key])

    return active
}
