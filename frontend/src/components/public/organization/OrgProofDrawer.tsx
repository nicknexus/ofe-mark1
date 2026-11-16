import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Calendar, MapPin, X } from 'lucide-react'
import type { PublicEvidence, PublicKPI } from '../../../services/publicApi'
import { evidenceForMetric, formatMetric, imageOf, shortDate, updateTime } from './orgShowcase'

function metricSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
}

export function OrgProofDrawer({
    metric,
    evidence,
    brandColor,
    accent,
    orgLinkBase,
    slug,
    placeNames,
    onClose,
}: {
    metric: PublicKPI | null
    placeNames: Map<string, string>
    evidence: PublicEvidence[]
    brandColor: string
    accent: string
    orgLinkBase: string
    slug: string
    onClose: () => void
}) {
    useEffect(() => {
        if (!metric) return
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', onKey)
        return () => {
            document.body.style.overflow = previous
            window.removeEventListener('keydown', onKey)
        }
    }, [metric, onClose])

    const proof = metric ? evidenceForMetric(metric, evidence) : []
    const photos = proof.map(item => ({ item, image: imageOf(item) })).filter(row => row.image)
    const records = proof.filter(item => !imageOf(item))
    const updates = [...(metric?.updates || [])].sort((a, b) => updateTime(b) - updateTime(a))
    const placeOf = (update: (typeof updates)[number]) => update.location?.name || (update.location_id ? placeNames.get(update.location_id) : undefined)
    const places = [...new Set(updates.map(placeOf).filter((name): name is string => !!name))]
    const first = updates[updates.length - 1]
    const last = updates[0]
    const percentage = metric?.metric_type === 'percentage'
    const fullHref = metric
        ? metric.definition_slug
            ? `${orgLinkBase}/${slug}/metric/${metric.definition_slug}`
            : `${orgLinkBase}/${slug}/${metric.initiative_slug}/metric/${metricSlug(metric.title)}`
        : ''

    return createPortal(
        <AnimatePresence>
            {metric && (
                <div className="fixed inset-0 z-[150] font-figtree">
                    <motion.div
                        className="absolute inset-0 bg-[#14352A]/30"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    <motion.aside
                        role="dialog"
                        aria-modal="true"
                        aria-label={metric.title}
                        className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
                    >
                        <div className="p-6 border-b" style={{ background: `${brandColor}1A`, borderColor: `${brandColor}33` }}>
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-[12px] font-semibold tracking-[0.14em] uppercase" style={{ color: accent }}>
                                    {metric.initiative_title || 'Impact'}
                                </p>
                                <button type="button" onClick={onClose} aria-label="Close" className="h-8 w-8 -mt-1 -mr-1 rounded-full inline-flex items-center justify-center bg-white/80 hover:bg-white">
                                    <X className="w-4 h-4 text-[#1C2B24]" />
                                </button>
                            </div>
                            <p className="mt-3 font-fraunces text-6xl leading-none" style={{ color: accent }}>
                                {formatMetric(metric.total_value || 0, percentage)}
                            </p>
                            <p className="mt-2 text-lg font-semibold text-[#1C2B24] leading-snug">{metric.title}</p>
                            {metric.description && <p className="mt-2 text-[14px] text-secondary-600 leading-relaxed">{metric.description}</p>}
                            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-secondary-600">
                                {first && last && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {shortDate(first.date_represented) === shortDate(last.date_represented)
                                            ? shortDate(last.date_represented)
                                            : `${shortDate(first.date_represented)} to ${shortDate(last.date_range_end || last.date_represented)}`}
                                    </span>
                                )}
                                {places.length > 0 && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5" />
                                        {places.length === 1 ? places[0] : `${places.length} places`}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="p-6 space-y-7">
                            {photos.length > 0 && (
                                <div>
                                    <p className="text-[13px] font-semibold text-[#1C2B24]">The proof</p>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        {photos.slice(0, 6).map(({ item, image }) => (
                                            <Link
                                                key={item.id}
                                                to={item.initiative_slug ? `${orgLinkBase}/${slug}/${item.initiative_slug}/evidence/${item.id}` : fullHref}
                                                className="group rounded-xl overflow-hidden border border-black/5"
                                            >
                                                <img src={image!} alt="" className="h-28 w-full object-cover group-hover:scale-[1.03] transition-transform" />
                                                <p className="px-2.5 py-1.5 text-[12px] font-medium text-[#1C2B24] truncate">{item.title}</p>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {records.length > 0 && (
                                <div>
                                    <p className="text-[13px] font-semibold text-[#1C2B24]">Records</p>
                                    <div className="mt-2 divide-y divide-black/5">
                                        {records.slice(0, 5).map(item => (
                                            <Link
                                                key={item.id}
                                                to={item.initiative_slug ? `${orgLinkBase}/${slug}/${item.initiative_slug}/evidence/${item.id}` : fullHref}
                                                className="flex items-center justify-between gap-3 py-2.5 text-[13px] text-[#1C2B24] hover:underline"
                                            >
                                                <span className="truncate">{item.title}</span>
                                                <span className="shrink-0 text-[12px] text-secondary-500">{shortDate(item.date_represented)}</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {updates.length > 0 && (
                                <div>
                                    <p className="text-[13px] font-semibold text-[#1C2B24]">How it added up</p>
                                    <div className="mt-2 divide-y divide-black/5">
                                        {updates.slice(0, 6).map(update => (
                                            <div key={update.id} className="flex items-center justify-between gap-3 py-2.5">
                                                <div className="min-w-0">
                                                    <p className="text-[13px] text-[#1C2B24] truncate">{update.label || placeOf(update) || 'Logged result'}</p>
                                                    <p className="text-[12px] text-secondary-500">{shortDate(update.date_represented)}</p>
                                                </div>
                                                <span className="shrink-0 font-fraunces text-xl" style={{ color: accent }}>
                                                    {percentage ? formatMetric(update.value, true) : `+${formatMetric(update.value)}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!photos.length && !records.length && !updates.length && (
                                <p className="text-[14px] text-secondary-500">Details for this number are on its full page.</p>
                            )}

                            <Link
                                to={fullHref}
                                className="flex items-center justify-center gap-2 h-11 rounded-full text-sm font-semibold border"
                                style={{ borderColor: `${brandColor}66`, color: accent }}
                            >
                                Open the full metric <ArrowUpRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </motion.aside>
                </div>
            )}
        </AnimatePresence>,
        document.body
    )
}
