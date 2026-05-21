import React, { useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
    ArrowLeft,
    Calendar,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    FileText,
    X,
} from 'lucide-react'
import { useOrgLinkBase } from '../../../hooks/useOrgLinkBase'
import { PublicEvidence, PublicMetricTag } from '../../../services/publicApi'
import PublicTagChip from '../PublicTagChip'
import { formatDate } from '../../../utils'
import { generateMetricSlug } from '../initiative/metricColors'
import type { MetricCategoryVisual } from './metricCategoryConfig'

export function PublicMetricEvidenceGallerySection({ evidence, evidenceCount, config, galleryIndex, setGalleryIndex, currentFileIndex, setCurrentFileIndex, orgSlug, initiativeSlug, tagsById, selectedTagIds, onToggleTag }: {
    evidence: PublicEvidence[]
    evidenceCount: number
    config: MetricCategoryVisual
    galleryIndex: number | null
    setGalleryIndex: (i: number | null) => void
    orgSlug: string
    initiativeSlug: string
    currentFileIndex: number
    setCurrentFileIndex: (i: number | ((prev: number) => number)) => void
    tagsById?: Map<string, PublicMetricTag>
    selectedTagIds?: string[]
    onToggleTag?: (id: string) => void
}) {
    const orgLinkBase = useOrgLinkBase()
    const typeConfig: Record<string, { bg: string; label: string }> = {
        visual_proof: { bg: 'bg-pink-100 text-pink-800', label: 'Visual Proof' },
        documentation: { bg: 'bg-evidence-100 text-evidence-700', label: 'Documentation' },
        testimony: { bg: 'bg-orange-100 text-orange-800', label: 'Testimonies' },
        financials: { bg: 'bg-primary-100 text-primary-800', label: 'Financials' }
    }

    const isImageFile = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || ''
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
    }

    const isPdfFile = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || ''
        return ext === 'pdf'
    }

    const isVideoFile = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || ''
        return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)
    }

    const isYouTubeUrl = (url: string) => {
        if (!url) return false
        return /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(url)
    }

    const getYouTubeVideoId = (url: string): string | null => {
        if (!url) return null
        const match = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
        return match ? match[1] : null
    }

    const getPreviewUrl = (item: PublicEvidence) => {
        if (item.files && item.files.length > 0) {
            const imageFile = item.files.find(f => isImageFile(f.file_url))
            if (imageFile) return imageFile.file_url
            const ytFile = item.files.find(f => isYouTubeUrl(f.file_url))
            if (ytFile) {
                const vid = getYouTubeVideoId(ytFile.file_url)
                if (vid) return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`
            }
        }
        if (item.file_url && isImageFile(item.file_url)) return item.file_url
        if (item.file_url && isYouTubeUrl(item.file_url)) {
            const vid = getYouTubeVideoId(item.file_url)
            if (vid) return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`
        }
        return null
    }

    const getVideoPreviewUrl = (item: PublicEvidence): string | null => {
        if (item.files && item.files.length > 0) {
            const videoFile = item.files.find(f => isVideoFile(f.file_url))
            if (videoFile) return videoFile.file_url
        }
        if (item.file_url && isVideoFile(item.file_url)) return item.file_url
        return null
    }

    const getAllFiles = (item: PublicEvidence) => {
        if (item.files && item.files.length > 0) return item.files
        if (item.file_url) return [{ id: '0', file_url: item.file_url, file_name: item.title, file_type: item.type, display_order: 0 }]
        return []
    }

    const galleryItem = galleryIndex !== null ? evidence[galleryIndex] : null
    const galleryFiles = galleryItem ? getAllFiles(galleryItem) : []
    const galleryFile = galleryFiles[currentFileIndex] || null

    const openGallery = (index: number) => { setGalleryIndex(index); setCurrentFileIndex(0) }
    const closeGallery = useCallback(() => { setGalleryIndex(null); setCurrentFileIndex(0) }, [setGalleryIndex, setCurrentFileIndex])

    const goToPrev = useCallback(() => {
        if (galleryIndex === null) return
        setGalleryIndex(galleryIndex === 0 ? evidence.length - 1 : galleryIndex - 1)
        setCurrentFileIndex(0)
    }, [galleryIndex, evidence.length, setGalleryIndex, setCurrentFileIndex])

    const goToNext = useCallback(() => {
        if (galleryIndex === null) return
        setGalleryIndex((galleryIndex + 1) % evidence.length)
        setCurrentFileIndex(0)
    }, [galleryIndex, evidence.length, setGalleryIndex, setCurrentFileIndex])

    // Keyboard nav
    useEffect(() => {
        if (galleryIndex === null) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeGallery()
            else if (e.key === 'ArrowLeft') {
                if (galleryFiles.length > 1 && !e.shiftKey) setCurrentFileIndex(i => i === 0 ? galleryFiles.length - 1 : i - 1)
                else goToPrev()
            } else if (e.key === 'ArrowRight') {
                if (galleryFiles.length > 1 && !e.shiftKey) {
                    setCurrentFileIndex(i => {
                        if (i + 1 >= galleryFiles.length) { goToNext(); return 0 }
                        return i + 1
                    })
                } else goToNext()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [galleryIndex, galleryFiles.length, closeGallery, goToPrev, goToNext, setCurrentFileIndex])

    // Lock scroll
    useEffect(() => {
        if (galleryIndex !== null) {
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = '' }
        }
    }, [galleryIndex])

    return (
        <>
            <div className="rounded-2xl sm:rounded-3xl bg-white border border-gray-200/80 shadow-public overflow-hidden">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                        Supporting Evidence
                    </h2>
                    <span className={`text-xs font-semibold px-2 sm:px-3 py-1 rounded-full ${config.bg} text-white`}>
                        {evidenceCount} item{evidenceCount !== 1 ? 's' : ''}
                    </span>
                </div>

                {evidence.length === 0 ? (
                    <div className="py-10 sm:py-16 text-center text-gray-500 px-4">
                        <FileText className="w-10 h-10 sm:w-14 sm:h-14 mx-auto mb-3 sm:mb-4 opacity-20" />
                        <p className="text-sm sm:text-lg font-medium mb-1">No evidence linked yet</p>
                        <p className="text-xs sm:text-sm">Evidence will appear here when linked to this metric</p>
                    </div>
                ) : (
                    <div className="p-3 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                        {evidence.map((ev, idx) => {
                            const previewUrl = getPreviewUrl(ev)
                            const videoUrl = !previewUrl ? getVideoPreviewUrl(ev) : null
                            const fileCount = ev.files?.length || (ev.file_url ? 1 : 0)
                            const evTypeConfig = typeConfig[ev.type] || { bg: 'bg-gray-100 text-gray-600', label: ev.type }

                            return (
                                <button
                                    key={ev.id}
                                    onClick={() => openGallery(idx)}
                                    className="rounded-2xl overflow-hidden group text-left bg-white border border-gray-200/80 shadow-public hover:shadow-public-hover hover:border-gray-300 transition-all"
                                >
                                    {previewUrl ? (
                                        <div className="relative aspect-video bg-gray-100 overflow-hidden">
                                            <img src={previewUrl} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            {fileCount > 1 && (
                                                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">{fileCount} files</div>
                                            )}
                                        </div>
                                    ) : videoUrl ? (
                                        <div className="relative aspect-video bg-gray-900 overflow-hidden">
                                            <video src={videoUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center shadow-lg">
                                                    <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                                </div>
                                            </div>
                                            {fileCount > 1 && (
                                                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">{fileCount} files</div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="aspect-video bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center">
                                            <div className="text-center">
                                                <FileText className="w-10 h-10 text-accent/50 mx-auto mb-2" />
                                                <span className="text-sm text-gray-500">{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${evTypeConfig.bg}`}>{evTypeConfig.label}</span>
                                            <span className="text-xs text-gray-500">{formatDate(ev.date_represented)}</span>
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-sm mb-1 group-hover:text-accent transition-colors">{ev.title}</h3>
                                        {ev.description && <p className="text-xs text-gray-500 line-clamp-2">{ev.description}</p>}
                                        {tagsById && ev.tag_ids && ev.tag_ids.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                                                {ev.tag_ids.slice(0, 3).map(id => {
                                                    const t = tagsById.get(id)
                                                    if (!t) return null
                                                    return (
                                                        <PublicTagChip
                                                            key={id}
                                                            name={t.name}
                                                            size="sm"
                                                            selected={selectedTagIds?.includes(id)}
                                                            onClick={onToggleTag ? () => onToggleTag(id) : undefined}
                                                        />
                                                    )
                                                })}
                                                {ev.tag_ids.length > 3 && (
                                                    <span className="text-xs text-gray-500 px-1">+{ev.tag_ids.length - 3}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Evidence Gallery Modal — portaled to body to escape z-10 stacking context */}
            {galleryIndex !== null && galleryItem && createPortal(
                <div className="fixed inset-0 z-[100]">
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-2xl" onClick={closeGallery} />

                    <div className="relative z-10 w-full h-full max-w-6xl mx-auto flex flex-col p-3 sm:p-6">
                        {/* Top bar */}
                        <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <button onClick={closeGallery} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-sm font-medium">Back to Metric</span>
                                </button>
                                <div className="h-5 w-px bg-gray-200" />
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${typeConfig[galleryItem.type]?.bg || 'bg-gray-100 text-gray-600'}`}>
                                    {typeConfig[galleryItem.type]?.label || galleryItem.type}
                                </span>
                                <span className="text-muted-foreground text-sm">{galleryIndex + 1} of {evidence.length}</span>
                            </div>
                            <button onClick={closeGallery} className="w-9 h-9 rounded-full bg-white hover:bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Main area */}
                        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
                            {/* File preview */}
                            <div className="lg:col-span-2 flex flex-col">
                                <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public overflow-hidden flex-1 flex flex-col">
                                    <div className="relative bg-gray-900 flex-1 min-h-[250px] sm:min-h-[400px] max-h-[50vh] sm:max-h-[60vh] flex items-center justify-center">
                                        {galleryFile ? (
                                            isImageFile(galleryFile.file_url) ? (
                                                <img src={galleryFile.file_url} alt={galleryFile.file_name || galleryItem.title} className="max-w-full max-h-full object-contain" />
                                            ) : isVideoFile(galleryFile.file_url) ? (
                                                <video src={galleryFile.file_url} controls className="max-w-full max-h-full rounded-xl" preload="metadata" />
                                            ) : isPdfFile(galleryFile.file_url) ? (
                                                <iframe src={galleryFile.file_url} className="w-full h-full" title={galleryFile.file_name || galleryItem.title} />
                                            ) : isYouTubeUrl(galleryFile.file_url) ? (
                                                <div className="w-full h-full flex items-center justify-center p-4">
                                                    <div className="relative w-full max-w-2xl" style={{ paddingBottom: '56.25%' }}>
                                                        <iframe
                                                            src={`https://www.youtube.com/embed/${getYouTubeVideoId(galleryFile.file_url)}`}
                                                            title="YouTube video"
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                            allowFullScreen
                                                            className="absolute inset-0 w-full h-full rounded-lg"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center text-white">
                                                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                                    <p className="text-sm opacity-70 mb-4">{galleryFile.file_name}</p>
                                                    <a href={galleryFile.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm">
                                                        <ExternalLink className="w-4 h-4" /> Open File
                                                    </a>
                                                </div>
                                            )
                                        ) : (
                                            <div className="text-center text-white/50">
                                                <FileText className="w-16 h-16 mx-auto mb-4" />
                                                <p>No preview available</p>
                                            </div>
                                        )}

                                        {galleryFiles.length > 1 && (
                                            <>
                                                <button onClick={() => setCurrentFileIndex(i => i === 0 ? galleryFiles.length - 1 : i - 1)} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors">
                                                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                                <button onClick={() => setCurrentFileIndex(i => (i + 1) % galleryFiles.length)} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors">
                                                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                                                    {galleryFiles.map((_, i) => (
                                                        <button key={i} onClick={() => setCurrentFileIndex(i)} className={`h-1.5 rounded-full transition-all ${i === currentFileIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'}`} />
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="px-3 sm:px-4 py-2 sm:py-3 bg-white/30 border-t border-white/30 flex items-center justify-between gap-2">
                                        <span className="text-xs sm:text-sm text-gray-600 truncate flex-1">
                                            {galleryFile?.file_name}
                                            {galleryFiles.length > 1 && <span className="text-xs text-gray-400 ml-2">({currentFileIndex + 1}/{galleryFiles.length})</span>}
                                        </span>
                                        {galleryFile?.file_url && (
                                            <a href={galleryFile.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-xs font-medium flex-shrink-0">
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Open in New Tab</span>
                                                <span className="sm:hidden">Open</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar */}
                            <div className="lg:col-span-1 flex flex-col gap-3 sm:gap-4 min-h-0 overflow-y-auto">
                                <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-4 sm:p-5 flex-shrink-0">
                                    <h2 className="font-semibold text-foreground text-base sm:text-lg mb-1">{galleryItem.title}</h2>
                                    {galleryItem.description && <p className="text-muted-foreground text-xs sm:text-sm mb-3 line-clamp-4">{galleryItem.description}</p>}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {formatDate(galleryItem.date_represented)}
                                    </div>
                                    {galleryItem.locations && galleryItem.locations.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1">
                                            {galleryItem.locations.map((loc) => (
                                                <span key={loc.id} className="text-xs bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded font-medium">{loc.name}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Impact Claims */}
                                {galleryItem.impact_claims && galleryItem.impact_claims.length > 0 ? (
                                    <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-4 sm:p-5 flex-shrink-0">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Supporting Impact Claims</h3>
                                        <div className="space-y-2">
                                            {galleryItem.impact_claims.map((claim: any) => {
                                                const metricTitle = claim.kpis?.title || 'Unknown Metric'
                                                const metricSlug = claim.kpis?.title ? generateMetricSlug(claim.kpis.title) : ''
                                                const dateLabel = claim.date_range_start && claim.date_range_end
                                                    ? `${formatDate(claim.date_range_start, { month: 'short', day: 'numeric' })} – ${formatDate(claim.date_range_end)}`
                                                    : claim.date_represented
                                                        ? formatDate(claim.date_represented)
                                                        : ''
                                                return (
                                                    <Link key={claim.id} to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${metricSlug}`} className="block p-3 rounded-xl bg-white border border-gray-200/80 shadow-public hover:shadow-public-hover hover:border-gray-300 transition-all group">
                                                        <p className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                                                            {claim.value}{claim.kpis?.metric_type === 'percentage' ? '%' : ` ${claim.kpis?.unit_of_measurement || ''}`}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-0.5">{metricTitle}</p>
                                                        {dateLabel && <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>}
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ) : galleryItem.kpis && galleryItem.kpis.length > 0 ? (
                                    <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-4 sm:p-5 flex-shrink-0">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Linked Metrics</h3>
                                        <div className="space-y-2">
                                            {galleryItem.kpis.map((kpi) => (
                                                <Link key={kpi.id} to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${generateMetricSlug(kpi.title)}`} className="block p-3 rounded-xl bg-white border border-gray-200/80 shadow-public hover:shadow-public-hover hover:border-gray-300 transition-all group">
                                                    <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">{kpi.title}</p>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Bottom nav */}
                        <div className="flex items-center justify-between mt-3 sm:mt-4 flex-shrink-0">
                            <button onClick={goToPrev} className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-foreground rounded-xl transition-colors text-sm font-medium shadow-sm">
                                <ChevronLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Previous</span>
                            </button>

                            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[50vw] scrollbar-hide px-2">
                                {evidence.map((item, i) => {
                                    const thumb = getPreviewUrl(item)
                                    const vidThumb = !thumb ? getVideoPreviewUrl(item) : null
                                    return (
                                        <button key={item.id} onClick={() => { setGalleryIndex(i); setCurrentFileIndex(0) }}
                                            className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shadow-sm ${i === galleryIndex ? 'border-gray-800 scale-110 shadow-md' : 'border-white/60 opacity-60 hover:opacity-90 hover:border-gray-300'}`}>
                                            {thumb ? (
                                                <img src={thumb} alt="" className="w-full h-full object-cover" />
                                            ) : vidThumb ? (
                                                <video src={vidThumb} className="w-full h-full object-cover" muted preload="metadata" />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 flex items-center justify-center"><FileText className="w-4 h-4 text-gray-400" /></div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>

                            <button onClick={goToNext} className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-foreground rounded-xl transition-colors text-sm font-medium shadow-sm">
                                <span className="hidden sm:inline">Next</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
