import { ReactNode, useState } from 'react'
import { AlertTriangle, Check, Infinity as InfinityIcon } from 'lucide-react'
import type { PlanSource } from '../../services/adminApi'

/**
 * Shared admin console primitives.
 *
 * Palette is deliberately the existing one — slate surfaces, emerald as the
 * single accent — so this reads as the same product. The rules that keep it
 * feeling built rather than decorated:
 *   - tabular-nums on every figure, so columns line up and don't jitter
 *   - state is carried by text first, colour second (never colour alone)
 *   - one accent colour; severity uses amber/red only when it means something
 */

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatBytes(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined) return '—'
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    const value = bytes / Math.pow(1024, i)
    return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

export function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "3 days ago" / "in 2 months" — for last-seen and renewal dates. */
export function formatRelative(iso: string | null | undefined): string {
    if (!iso) return 'Never'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    const diffMs = d.getTime() - Date.now()
    const abs = Math.abs(diffMs)
    const units: [number, Intl.RelativeTimeFormatUnit][] = [
        [1000 * 60 * 60 * 24 * 365, 'year'],
        [1000 * 60 * 60 * 24 * 30, 'month'],
        [1000 * 60 * 60 * 24, 'day'],
        [1000 * 60 * 60, 'hour'],
        [1000 * 60, 'minute'],
    ]
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    for (const [ms, unit] of units) {
        if (abs >= ms) return rtf.format(Math.round(diffMs / ms), unit)
    }
    return 'just now'
}

export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
    if (amount === null || amount === undefined) return '—'
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: (currency || 'usd').toUpperCase(),
        }).format(amount / 100)
    } catch {
        return `${(amount / 100).toFixed(2)} ${(currency || '').toUpperCase()}`
    }
}

// ─── Org avatar ──────────────────────────────────────────────────────────────

const AVATAR_SIZES = {
    sm: 'w-8 h-8 rounded-lg text-xs',
    md: 'w-11 h-11 rounded-xl text-base',
} as const

/**
 * Org logo, falling back to a brand-coloured initial.
 *
 * Customer logos are user-uploaded, so a URL can 404 or be replaced at any
 * time — a broken image icon in a support table is worse than no logo, so a
 * load failure quietly falls back to the initial.
 */
export function OrgAvatar({
    name,
    logoUrl,
    brandColor,
    size = 'sm',
}: {
    name: string
    logoUrl?: string | null
    brandColor?: string | null
    size?: keyof typeof AVATAR_SIZES
}) {
    const [failed, setFailed] = useState(false)
    const classes = `${AVATAR_SIZES[size]} flex-shrink-0 object-cover border border-slate-200`

    if (logoUrl && !failed) {
        return (
            <img
                src={logoUrl}
                alt=""
                loading="lazy"
                onError={() => setFailed(true)}
                className={`${classes} bg-white`}
            />
        )
    }

    return (
        <div
            aria-hidden
            className={`${AVATAR_SIZES[size]} flex-shrink-0 flex items-center justify-center font-semibold text-white border border-black/5`}
            style={{ backgroundColor: brandColor || '#475569' }}
        >
            {name.charAt(0).toUpperCase()}
        </div>
    )
}

// ─── Plan badge ──────────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, string> = {
    free: 'bg-slate-100 text-slate-700 ring-slate-200',
    growth: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    pro: 'bg-violet-50 text-violet-700 ring-violet-200',
}

const SOURCE_LABEL: Record<PlanSource, string> = {
    stripe: 'Paying',
    admin: 'Comped',
    code: 'Code',
    free: 'Free plan',
    none: 'No plan',
}

/**
 * Plan tier + how it's funded. The source matters as much as the tier during
 * support — "Pro" tells you nothing about whether money is involved.
 */
export function PlanBadge({
    tier,
    source,
    status,
    size = 'md',
}: {
    tier?: string | null
    source?: PlanSource
    status?: string | null
    size?: 'sm' | 'md'
}) {
    const normalised = (tier || 'free').toLowerCase()
    const tierStyle = TIER_STYLES[normalised] ?? 'bg-slate-100 text-slate-700 ring-slate-200'
    const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'
    const isProblem = status === 'past_due' || status === 'expired' || status === 'cancelled'

    return (
        <span className="inline-flex items-center gap-1">
            <span className={`inline-flex items-center rounded-md ring-1 ring-inset font-semibold capitalize ${tierStyle} ${pad}`}>
                {source === 'none' ? 'No plan' : normalised}
            </span>
            {source && source !== 'none' && source !== 'free' && (
                <span
                    className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                        source === 'stripe'
                            ? 'bg-sky-50 text-sky-700 ring-sky-200'
                            : 'bg-amber-50 text-amber-700 ring-amber-200'
                    }`}
                >
                    {SOURCE_LABEL[source]}
                </span>
            )}
            {isProblem && (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
                    <AlertTriangle className="w-3 h-3" />
                    {status === 'past_due' ? 'Past due' : status}
                </span>
            )}
        </span>
    )
}

// ─── Usage meter ─────────────────────────────────────────────────────────────

/**
 * Used-vs-limit with a bar. Turns amber at 80% and red at 100% so an account
 * pressed against a ceiling is visible while scanning, without reading numbers.
 */
export function UsageMeter({
    label,
    used,
    limit,
    format = (n: number) => String(n),
    compact = false,
}: {
    label?: string
    used: number
    limit: number | null | undefined
    format?: (n: number) => string
    compact?: boolean
}) {
    const unlimited = limit === null || limit === undefined
    const pct = unlimited ? 0 : Math.min(100, limit === 0 ? 100 : (used / limit) * 100)
    const over = !unlimited && used > (limit ?? 0)
    const tone = over || pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'

    return (
        <div className={compact ? '' : 'space-y-1.5'}>
            <div className="flex items-baseline justify-between gap-3">
                {label && <span className="text-xs font-medium text-slate-600">{label}</span>}
                <span className="text-xs tabular-nums text-slate-700">
                    <span className={over ? 'font-semibold text-red-600' : 'font-semibold text-slate-900'}>
                        {format(used)}
                    </span>
                    <span className="text-slate-400"> / </span>
                    {unlimited ? (
                        <InfinityIcon className="inline w-3.5 h-3.5 -mt-0.5 text-slate-400" />
                    ) : (
                        <span className="text-slate-500">{format(limit)}</span>
                    )}
                </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-[width] duration-500 ${unlimited ? 'bg-slate-200' : tone}`}
                    style={{ width: unlimited ? '100%' : `${Math.max(pct, used > 0 ? 3 : 0)}%` }}
                />
            </div>
        </div>
    )
}

// ─── Layout pieces ───────────────────────────────────────────────────────────

export function StatCard({
    label,
    value,
    hint,
    tone = 'default',
    onClick,
    active,
}: {
    label: string
    value: string | number
    hint?: string
    tone?: 'default' | 'positive' | 'warning' | 'danger'
    onClick?: () => void
    active?: boolean
}) {
    const toneClass = {
        default: 'text-slate-900',
        positive: 'text-emerald-600',
        warning: 'text-amber-600',
        danger: 'text-red-600',
    }[tone]

    const interactive = !!onClick
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!interactive}
            className={`text-left rounded-xl border bg-white px-4 py-3 transition-all ${
                active
                    ? 'border-slate-900 ring-1 ring-slate-900'
                    : 'border-slate-200'
            } ${interactive ? 'hover:border-slate-300 hover:shadow-sm cursor-pointer' : 'cursor-default'}`}
        >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
            {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
        </button>
    )
}

export function Section({
    title,
    description,
    actions,
    children,
    className = '',
}: {
    title: string
    description?: string
    actions?: ReactNode
    children: ReactNode
    className?: string
}) {
    return (
        <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
            <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
                    {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
                </div>
                {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
            </header>
            <div className="px-5 py-4">{children}</div>
        </section>
    )
}

/** Label/value row used throughout the detail page. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
            <dt className="text-xs text-slate-500 flex-shrink-0">{label}</dt>
            <dd className="text-sm text-slate-900 text-right min-w-0 truncate">{children}</dd>
        </div>
    )
}

export function EmptyState({ children }: { children: ReactNode }) {
    return <p className="py-6 text-center text-sm text-slate-400">{children}</p>
}

export function Modal({
    title,
    subtitle,
    onClose,
    children,
    footer,
    wide = false,
}: {
    title: string
    subtitle?: string
    onClose: () => void
    children: ReactNode
    footer?: ReactNode
    wide?: boolean
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
            onClick={onClose}
        >
            <div
                className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl border border-slate-200 bg-white shadow-2xl max-h-[90vh] flex flex-col`}
                onClick={e => e.stopPropagation()}
            >
                <header className="px-5 py-4 border-b border-slate-100">
                    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                    {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
                </header>
                <div className="px-5 py-4 overflow-y-auto">{children}</div>
                {footer && <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">{footer}</footer>}
            </div>
        </div>
    )
}

export function Button({
    children,
    onClick,
    variant = 'secondary',
    size = 'md',
    disabled,
    type = 'button',
    className = '',
}: {
    children: ReactNode
    onClick?: () => void
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md'
    disabled?: boolean
    type?: 'button' | 'submit'
    className?: string
}) {
    const variants = {
        primary: 'bg-slate-900 text-white hover:bg-slate-700 border-transparent',
        secondary: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200',
        ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border-transparent',
        danger: 'bg-red-600 text-white hover:bg-red-500 border-transparent',
    }
    const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3.5 py-2 text-sm' }
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
        >
            {children}
        </button>
    )
}

/** Yes/no capability marker used for plan feature lists. */
export function FeatureFlag({ enabled, label }: { enabled: boolean; label: string }) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ring-1 ring-inset ${
                enabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-50 text-slate-400 ring-slate-200'
            }`}
        >
            {enabled ? <Check className="w-3 h-3" /> : <span className="w-3 text-center">—</span>}
            {label}
        </span>
    )
}
