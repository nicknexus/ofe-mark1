import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrgLinkBase } from '../../../hooks/useOrgLinkBase'
import {
    ArrowLeft,
    Calendar,
    Camera,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    DollarSign,
    ExternalLink,
    FileText,
    MessageSquare,
    X,
} from 'lucide-react'
import { PublicEvidence, PublicMetricTag } from '../../../services/publicApi'
import PublicTagChip from '../PublicTagChip'
import { formatDate } from '../../../utils'
import { generateMetricSlug } from './metricColors'
import { EmptyState, LoadingState } from './PublicInitiativeTabStates'

export function EvidenceTab({ evidence, orgSlug, initiativeSlug, dateQS = '', tagsById, onTagClick, selectedTagIds }: {
    evidence: PublicEvidence[] | null
    orgSlug: string
    initiativeSlug: string
    dateQS?: string
    tagsById?: Map<string, PublicMetricTag>
    onTagClick?: (id: string) => void
    selectedTagIds?: string[]
}) {
    const orgLinkBase = useOrgLinkBase()
    const [displayCount, setDisplayCount] = useState(8)
    const [selectedTypes, setSelectedTypes] = useState<string[]>([])
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

    // Gallery state
    const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
    const [currentFileIndex, setCurrentFileIndex] = useState(0)

    // Evidence types with icons matching the signed-in app
    const evidenceTypes = [
        { value: 'visual_proof', label: 'Visual Support', icon: Camera },
        { value: 'documentation', label: 'Documentation', icon: FileText },
        { value: 'testimony', label: 'Testimonies', icon: MessageSquare },
        { value: 'financials', label: 'Financials', icon: DollarSign }
    ] as const

    // Colors matching the signed-in app
    const typeConfig: Record<string, { bg: string; label: string; color: string }> = {
        visual_proof: {
            bg: 'bg-pink-100 text-pink-800',
            label: 'Visual Support',
            color: 'text-pink-500'
        },
        documentation: {
            bg: 'bg-evidence-100 text-evidence-700',
            label: 'Documentation',
            color: 'text-evidence-500'
        },
        testimony: {
            bg: 'bg-orange-100 text-orange-800',
            label: 'Testimonies',
            color: 'text-orange-500'
        },
        financials: {
            bg: 'bg-primary-100 text-primary-800',
            label: 'Financials',
            color: 'text-primary-500'
        }
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
        if (item.file_url && isImageFile(item.file_url)) {
            return item.file_url
        }
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

    // Get all files for an evidence item
    const getAllFiles = (item: PublicEvidence) => {
        if (item.files && item.files.length > 0) return item.files
        if (item.file_url) return [{ id: '0', file_url: item.file_url, file_name: item.title, file_type: item.type, display_order: 0 }]
        return []
    }

    // Filter evidence
    const filteredEvidence = useMemo(() =>
        selectedTypes.length > 0
            ? (evidence || []).filter(e => selectedTypes.includes(e.type))
            : (evidence || []),
        [evidence, selectedTypes]
    )

    // Count by type
    const typeCounts = useMemo(() =>
        (evidence || []).reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1
            return acc
        }, {} as Record<string, number>),
        [evidence]
    )

    const displayedEvidence = filteredEvidence.slice(0, displayCount)
    const hasMore = displayCount < filteredEvidence.length

    const toggleType = (type: string) => {
        if (selectedTypes.includes(type)) {
            setSelectedTypes(selectedTypes.filter(t => t !== type))
        } else {
            setSelectedTypes([...selectedTypes, type])
        }
        setDisplayCount(8)
    }

    // Gallery navigation
    const galleryItem = galleryIndex !== null ? filteredEvidence[galleryIndex] : null
    const galleryFiles = galleryItem ? getAllFiles(galleryItem) : []
    const galleryFile = galleryFiles[currentFileIndex] || null

    const openGallery = (index: number) => {
        setGalleryIndex(index)
        setCurrentFileIndex(0)
    }

    const closeGallery = useCallback(() => {
        setGalleryIndex(null)
        setCurrentFileIndex(0)
    }, [])

    const goToPrevEvidence = useCallback(() => {
        if (galleryIndex === null) return
        const prev = galleryIndex === 0 ? filteredEvidence.length - 1 : galleryIndex - 1
        setGalleryIndex(prev)
        setCurrentFileIndex(0)
    }, [galleryIndex, filteredEvidence.length])

    const goToNextEvidence = useCallback(() => {
        if (galleryIndex === null) return
        const next = (galleryIndex + 1) % filteredEvidence.length
        setGalleryIndex(next)
        setCurrentFileIndex(0)
    }, [galleryIndex, filteredEvidence.length])

    // Keyboard navigation
    useEffect(() => {
        if (galleryIndex === null) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeGallery()
            else if (e.key === 'ArrowLeft') {
                if (e.shiftKey) goToPrevEvidence()
                else if (galleryFiles.length > 1) setCurrentFileIndex(i => i === 0 ? galleryFiles.length - 1 : i - 1)
                else goToPrevEvidence()
            }
            else if (e.key === 'ArrowRight') {
                if (e.shiftKey) goToNextEvidence()
                else if (galleryFiles.length > 1) {
                    setCurrentFileIndex(i => {
                        const next = i + 1
                        // If at last file, go to next evidence
                        if (next >= galleryFiles.length) {
                            goToNextEvidence()
                            return 0
                        }
                        return next
                    })
                }
                else goToNextEvidence()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [galleryIndex, galleryFiles.length, closeGallery, goToPrevEvidence, goToNextEvidence])

    // Lock body scroll when gallery is open
    useEffect(() => {
        if (galleryIndex !== null) {
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = '' }
        }
    }, [galleryIndex])

    if (!evidence) return <LoadingState />
    if (evidence.length === 0) return <EmptyState icon={FileText} message="No evidence available yet." />

    return (
        <div>
            {/* Filter Dropdown */}
            <div className="mb-5 flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Filter by type:</span>
                <div className="relative">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition-all duration-200 shadow-sm ${selectedTypes.length > 0
                            ? 'bg-accent/10 text-accent border-accent/30 hover:bg-accent/20'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                            }`}
                    >
                        <FileText className="w-4 h-4" />
                        <span>
                            {selectedTypes.length === 0
                                ? `All Types`
                                : selectedTypes.length === 1
                                    ? evidenceTypes.find(et => et.value === selectedTypes[0])?.label || '1 type'
                                    : `${selectedTypes.length} types`}
                        </span>
                        {selectedTypes.length > 0 && (
                            <span className="bg-accent text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                                {selectedTypes.length}
                            </span>
                        )}
                        <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                                {selectedTypes.length > 0 && (
                                    <>
                                        <button
                                            onClick={() => { setSelectedTypes([]); setDisplayCount(8) }}
                                            className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                            Clear all filters
                                        </button>
                                        <div className="h-px bg-gray-100 my-1" />
                                    </>
                                )}
                                {evidenceTypes.map((type) => {
                                    const count = typeCounts[type.value] || 0
                                    const isSelected = selectedTypes.includes(type.value)
                                    const TypeIcon = type.icon
                                    return (
                                        <label
                                            key={type.value}
                                            className={`w-full px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer ${count === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => count > 0 && toggleType(type.value)}
                                                disabled={count === 0}
                                                className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                                            />
                                            <TypeIcon className={`w-4 h-4 ${typeConfig[type.value]?.color || 'text-gray-500'}`} />
                                            <span className={`flex-1 ${isSelected ? 'font-medium text-accent' : 'text-gray-700'}`}>{type.label}</span>
                                            <span className="text-xs text-muted-foreground">{count}</span>
                                        </label>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </div>

                {selectedTypes.length > 0 && (
                    <button
                        onClick={() => { setSelectedTypes([]); setDisplayCount(8) }}
                        className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-3.5 h-3.5" /> Clear
                    </button>
                )}
            </div>

            {/* Evidence Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {displayedEvidence.map((item, idx) => {
                    const previewUrl = getPreviewUrl(item)
                    const videoUrl = !previewUrl ? getVideoPreviewUrl(item) : null
                    const fileCount = item.files?.length || (item.file_url ? 1 : 0)
                    const filteredIndex = filteredEvidence.indexOf(item)

                    return (
                        <button
                            key={item.id}
                            onClick={() => openGallery(filteredIndex)}
                            className="rounded-2xl bg-white border border-gray-200/80 shadow-public hover:shadow-public-hover hover:border-gray-300 transition-all overflow-hidden group text-left"
                        >
                            {previewUrl ? (
                                <div className="relative aspect-video bg-gray-100 overflow-hidden">
                                    <img src={previewUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    {fileCount > 1 && (
                                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                                            {fileCount} files
                                        </div>
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
                                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                                            {fileCount} files
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="aspect-video bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center">
                                    <div className="text-center">
                                        <FileText className="w-10 h-10 text-accent/50 mx-auto mb-2" />
                                        <span className="text-sm text-muted-foreground">{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            )}
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeConfig[item.type]?.bg || 'bg-gray-100 text-gray-600'}`}>
                                        {typeConfig[item.type]?.label || item.type}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{formatDate(item.date_represented)}</span>
                                </div>
                                <h3 className="font-semibold text-foreground text-sm mb-1 group-hover:text-accent transition-colors">{item.title}</h3>
                                {item.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</p>}
                                {tagsById && item.tag_ids && item.tag_ids.length > 0 && (
                                    <div className="mt-1 mb-2 flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                                        {item.tag_ids.slice(0, 4).map(id => {
                                            const t = tagsById.get(id)
                                            if (!t) return null
                                            return (
                                                <PublicTagChip
                                                    key={id}
                                                    name={t.name}
                                                    size="xs"
                                                    selected={selectedTagIds?.includes(id)}
                                                    onClick={onTagClick ? () => onTagClick(id) : undefined}
                                                />
                                            )
                                        })}
                                        {item.tag_ids.length > 4 && (
                                            <span className="text-xs text-muted-foreground px-1">+{item.tag_ids.length - 4}</span>
                                        )}
                                    </div>
                                )}
                                {/* Impact Claims */}
                                {item.impact_claims && item.impact_claims.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                                        {item.impact_claims.slice(0, 2).map((claim) => {
                                            const matchedKpi = item.kpis?.find(k => k.id === claim.kpi_id)
                                            const cat = matchedKpi?.category || 'output'
                                            const catColor = cat === 'impact' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : cat === 'output' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-evidence-100 text-evidence-700 hover:bg-evidence-200'
                                            const label = claim.kpis?.title ? `${claim.value} ${claim.kpis.unit_of_measurement || ''}` : `${claim.value}`
                                            return (
                                                <Link key={claim.id} to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/claim/${claim.id}${dateQS}`} className={`text-xs px-1.5 py-0.5 rounded font-medium ${catColor} transition-colors`} onClick={e => e.stopPropagation()}>
                                                    {claim.kpis?.title || label}
                                                </Link>
                                            )
                                        })}
                                        {item.impact_claims.length > 2 && (
                                            <span className="text-xs text-muted-foreground">+{item.impact_claims.length - 2}</span>
                                        )}
                                    </div>
                                ) : item.kpis && item.kpis.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                                        {item.kpis.slice(0, 2).map((kpi) => {
                                            const catColor = kpi.category === 'impact' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : kpi.category === 'output' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-evidence-100 text-evidence-700 hover:bg-evidence-200'
                                            return (
                                                <Link key={kpi.id} to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${generateMetricSlug(kpi.title)}${dateQS}`} className={`text-xs px-1.5 py-0.5 rounded font-medium ${catColor} transition-colors`} onClick={e => e.stopPropagation()}>
                                                    {kpi.title}
                                                </Link>
                                            )
                                        })}
                                        {item.kpis.length > 2 && (
                                            <span className="text-xs text-muted-foreground">+{item.kpis.length - 2}</span>
                                        )}
                                    </div>
                                ) : null}
                                {item.locations && item.locations.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                        {item.locations.map((loc) => (
                                            <span key={loc.id} className="text-xs bg-accent/10 text-accent px-1.5 py-0.5 rounded">{loc.name}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Load More */}
            {hasMore && (
                <div className="text-center mt-6">
                    <button
                        onClick={() => setDisplayCount(prev => prev + 8)}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-accent/10 text-accent rounded-xl hover:bg-accent/20 transition-colors font-medium border border-accent/20 hover:border-accent"
                    >
                        <ChevronDown className="w-4 h-4" />
                        Load More ({filteredEvidence.length - displayCount} remaining)
                    </button>
                </div>
            )}

            {/* ===== Evidence Gallery Modal ===== */}
            {galleryIndex !== null && galleryItem && (
                <div className="fixed inset-0 z-[100]">
                    {/* Backdrop - light frosted glass */}
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-2xl" onClick={closeGallery} />

                    {/* Gallery Content */}
                    <div className="relative z-10 w-full h-full max-w-6xl mx-auto flex flex-col p-3 sm:p-6">
                        {/* Top bar */}
                        <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={closeGallery}
                                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-sm font-medium">Back to Evidence</span>
                                </button>
                                <div className="h-5 w-px bg-gray-200" />
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${typeConfig[galleryItem.type]?.bg || 'bg-gray-100 text-gray-600'}`}>
                                    {typeConfig[galleryItem.type]?.label || galleryItem.type}
                                </span>
                                <span className="text-muted-foreground text-sm">
                                    {galleryIndex + 1} of {filteredEvidence.length}
                                </span>
                            </div>
                            <button
                                onClick={closeGallery}
                                className="w-9 h-9 rounded-full bg-white hover:bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm"
                            >
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
                                                <img
                                                    src={galleryFile.file_url}
                                                    alt={galleryFile.file_name || galleryItem.title}
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            ) : isVideoFile(galleryFile.file_url) ? (
                                                <video src={galleryFile.file_url} controls className="max-w-full max-h-full rounded-xl" preload="metadata" />
                                            ) : isPdfFile(galleryFile.file_url) ? (
                                                <iframe
                                                    src={galleryFile.file_url}
                                                    className="w-full h-full"
                                                    title={galleryFile.file_name || galleryItem.title}
                                                />
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
                                                    <a
                                                        href={galleryFile.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
                                                    >
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

                                        {/* File navigation arrows (within one evidence item) */}
                                        {galleryFiles.length > 1 && (
                                            <>
                                                <button
                                                    onClick={() => setCurrentFileIndex(i => i === 0 ? galleryFiles.length - 1 : i - 1)}
                                                    className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
                                                >
                                                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                                <button
                                                    onClick={() => setCurrentFileIndex(i => (i + 1) % galleryFiles.length)}
                                                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
                                                >
                                                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                                                    {galleryFiles.map((_, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => setCurrentFileIndex(i)}
                                                            className={`h-1.5 rounded-full transition-all ${i === currentFileIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'}`}
                                                        />
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* File info bar */}
                                    <div className="px-3 sm:px-4 py-2 sm:py-3 bg-white/30 border-t border-white/30 flex items-center justify-between gap-2">
                                        <span className="text-xs sm:text-sm text-gray-600 truncate flex-1">
                                            {galleryFile?.file_name}
                                            {galleryFiles.length > 1 && (
                                                <span className="text-xs text-gray-400 ml-2">
                                                    ({currentFileIndex + 1}/{galleryFiles.length})
                                                </span>
                                            )}
                                        </span>
                                        {galleryFile?.file_url && (
                                            <a
                                                href={galleryFile.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-xs font-medium flex-shrink-0"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Open in New Tab</span>
                                                <span className="sm:hidden">Open</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Info sidebar - glass card style */}
                            <div className="lg:col-span-1 flex flex-col gap-3 sm:gap-4 min-h-0 overflow-y-auto">
                                {/* Evidence Info Card */}
                                <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-4 sm:p-5 flex-shrink-0">
                                    <h2 className="font-semibold text-foreground text-base sm:text-lg mb-1">{galleryItem.title}</h2>
                                    {galleryItem.description && (
                                        <p className="text-muted-foreground text-xs sm:text-sm mb-3 line-clamp-4">{galleryItem.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {formatDate(galleryItem.date_represented)}
                                    </div>
                                    {galleryItem.locations && galleryItem.locations.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1">
                                            {galleryItem.locations.map((loc) => (
                                                <span key={loc.id} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded font-medium">{loc.name}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Impact Claims Card */}
                                {galleryItem.impact_claims && galleryItem.impact_claims.length > 0 ? (
                                    <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-4 sm:p-5 flex-shrink-0">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Supporting Impact Claims</h3>
                                        <div className="space-y-2">
                                            {galleryItem.impact_claims.map((claim: any) => {
                                                const metricTitle = claim.kpis?.title || 'Unknown Metric'
                                                const dateLabel = claim.date_range_start && claim.date_range_end
                                                    ? `${formatDate(claim.date_range_start, { month: 'short', day: 'numeric' })} – ${formatDate(claim.date_range_end)}`
                                                    : claim.date_represented
                                                        ? formatDate(claim.date_represented)
                                                        : ''
                                                return (
                                                    <Link key={claim.id} to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/claim/${claim.id}${dateQS}`} className="block p-3 rounded-xl bg-white border border-gray-200/80 shadow-public hover:shadow-public-hover hover:border-gray-300 transition-all group">
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
                                                <Link key={kpi.id} to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${generateMetricSlug(kpi.title)}${dateQS}`} className="block p-3 rounded-xl bg-white border border-gray-200/80 shadow-public hover:shadow-public-hover hover:border-gray-300 transition-all group">
                                                    <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">{kpi.title}</p>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Bottom evidence navigation */}
                        <div className="flex items-center justify-between mt-3 sm:mt-4 flex-shrink-0">
                            <button
                                onClick={goToPrevEvidence}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-foreground rounded-xl transition-colors text-sm font-medium shadow-sm"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Previous</span>
                            </button>

                            {/* Thumbnail strip */}
                            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[50vw] scrollbar-hide px-2">
                                {filteredEvidence.slice(
                                    Math.max(0, galleryIndex - 3),
                                    Math.min(filteredEvidence.length, galleryIndex + 4)
                                ).map((item, i) => {
                                    const actualIndex = Math.max(0, galleryIndex - 3) + i
                                    const thumb = getPreviewUrl(item)
                                    const vidThumb = !thumb ? getVideoPreviewUrl(item) : null
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => { setGalleryIndex(actualIndex); setCurrentFileIndex(0) }}
                                            className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shadow-sm ${actualIndex === galleryIndex
                                                ? 'border-gray-800 scale-110 shadow-md'
                                                : 'border-white/60 opacity-60 hover:opacity-90 hover:border-gray-300'
                                                }`}
                                        >
                                            {thumb ? (
                                                <img src={thumb} alt="" className="w-full h-full object-cover" />
                                            ) : vidThumb ? (
                                                <video src={vidThumb} className="w-full h-full object-cover" muted preload="metadata" />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                                    <FileText className="w-4 h-4 text-gray-400" />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>

                            <button
                                onClick={goToNextEvidence}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 text-foreground rounded-xl transition-colors text-sm font-medium shadow-sm"
                            >
                                <span className="hidden sm:inline">Next</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
