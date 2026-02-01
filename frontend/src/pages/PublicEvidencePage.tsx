import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
    ArrowLeft, Calendar, FileText, ChevronLeft, ChevronRight,
    Image, File, Video, Mic, ExternalLink
} from 'lucide-react'
import { publicApi, PublicEvidenceDetail } from '../services/publicApi'
import PublicBreadcrumb from '../components/public/PublicBreadcrumb'
import PublicLoader from '../components/public/PublicLoader'

// Evidence type config
const evidenceTypeConfig: Record<string, { icon: any; label: string; color: string; bg: string }> = {
    document: { icon: FileText, label: 'Document', color: 'text-blue-600', bg: 'bg-blue-50' },
    photo: { icon: Image, label: 'Photo', color: 'text-green-600', bg: 'bg-green-50' },
    video: { icon: Video, label: 'Video', color: 'text-purple-600', bg: 'bg-purple-50' },
    recording: { icon: Mic, label: 'Recording', color: 'text-orange-600', bg: 'bg-orange-50' },
    external_link: { icon: ExternalLink, label: 'External Link', color: 'text-cyan-600', bg: 'bg-cyan-50' },
}

// Category colors for impact claims
const categoryColors: Record<string, { bg: string; text: string }> = {
    impact: { bg: 'bg-purple-100', text: 'text-purple-700' },
    output: { bg: 'bg-green-100', text: 'text-green-700' },
    input: { bg: 'bg-blue-100', text: 'text-blue-700' },
}

export default function PublicEvidencePage() {
    const { orgSlug, initiativeSlug, evidenceId } = useParams<{
        orgSlug: string
        initiativeSlug: string
        evidenceId: string
    }>()

    const [evidence, setEvidence] = useState<PublicEvidenceDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [currentFileIndex, setCurrentFileIndex] = useState(0)

    useEffect(() => {
        if (orgSlug && initiativeSlug && evidenceId) {
            loadEvidence()
        }
    }, [orgSlug, initiativeSlug, evidenceId])

    const loadEvidence = async () => {
        try {
            setLoading(true)
            setError(null)
            const data = await publicApi.getEvidenceDetail(orgSlug!, initiativeSlug!, evidenceId!)
            setEvidence(data)
        } catch (err) {
            console.error('Error loading evidence:', err)
            setError('Failed to load evidence')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <PublicLoader message="Loading evidence..." />
    }

    if (error || !evidence) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="bg-white/40 backdrop-blur-2xl p-12 rounded-3xl text-center max-w-md border border-white/60 shadow-xl">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-gray-800 mb-3">Evidence Not Found</h1>
                    <p className="text-gray-500 mb-8">{error || 'This evidence does not exist.'}</p>
                    <Link to={`/org/${orgSlug}/${initiativeSlug}?tab=evidence`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4" /> Back to Evidence
                    </Link>
                </div>
            </div>
        )
    }

    const typeConfig = evidenceTypeConfig[evidence.type] || evidenceTypeConfig.document
    const TypeIcon = typeConfig.icon
    const brandColor = evidence.initiative.brand_color || '#c0dfa1'

    // Get all files (either from files array or single file_url)
    const allFiles = evidence.files.length > 0
        ? evidence.files
        : evidence.file_url
            ? [{ id: '0', file_url: evidence.file_url, file_name: evidence.title, file_type: evidence.type }]
            : []

    const currentFile = allFiles[currentFileIndex]
    const hasMultipleFiles = allFiles.length > 1

    const isImage = (file: any) => {
        const url = file.file_url?.toLowerCase() || ''
        const type = file.file_type?.toLowerCase() || ''
        return type.includes('image') || url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    }

    const isPdf = (file: any) => {
        const url = file.file_url?.toLowerCase() || ''
        const type = file.file_type?.toLowerCase() || ''
        return type.includes('pdf') || url.match(/\.pdf$/i)
    }

    return (
        <div className="min-h-screen font-figtree relative animate-fadeIn">
            {/* Flowing gradient background */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(ellipse 80% 50% at 20% 40%, ${brandColor}90, transparent 60%),
                        radial-gradient(ellipse 60% 80% at 80% 20%, ${brandColor}70, transparent 55%),
                        radial-gradient(ellipse 50% 60% at 60% 80%, ${brandColor}60, transparent 55%),
                        radial-gradient(ellipse 70% 40% at 10% 90%, ${brandColor}50, transparent 50%),
                        linear-gradient(180deg, white 0%, #fafafa 100%)
                    `
                }}
            />

            {/* Navigation Header */}
            <div className="sticky top-0 z-50 bg-white/60 backdrop-blur-2xl border-b border-white/40">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link to={`/org/${orgSlug}/${initiativeSlug}?tab=evidence`}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-medium">Back to Evidence</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 max-w-6xl mx-auto px-6 py-6 h-[calc(100vh-80px)] flex flex-col">
                {/* Breadcrumb */}
                <PublicBreadcrumb
                    orgSlug={orgSlug!}
                    orgName={evidence.initiative.org_name || ''}
                    items={[
                        { label: evidence.initiative.title, href: `/org/${orgSlug}/${initiativeSlug}` },
                        { label: evidence.title }
                    ]}
                />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                    {/* File Preview - Takes 2 columns */}
                    <div className="lg:col-span-2 flex flex-col">
                        <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-2xl shadow-black/10 overflow-hidden flex-1 flex flex-col">
                            {/* Preview Area */}
                            <div className="relative bg-gray-900 flex-1 min-h-[400px] flex items-center justify-center">
                                {currentFile ? (
                                    isImage(currentFile) ? (
                                        <img
                                            src={currentFile.file_url}
                                            alt={currentFile.file_name}
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    ) : isPdf(currentFile) ? (
                                        <iframe
                                            src={currentFile.file_url}
                                            className="w-full h-full"
                                            title={currentFile.file_name}
                                        />
                                    ) : (
                                        <div className="text-center text-white">
                                            <TypeIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                            <p className="text-sm opacity-70">{currentFile.file_name}</p>
                                            <a
                                                href={currentFile.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Open File
                                            </a>
                                        </div>
                                    )
                                ) : (
                                    <div className="text-center text-white/50">
                                        <FileText className="w-16 h-16 mx-auto mb-4" />
                                        <p>No preview available</p>
                                    </div>
                                )}

                                {/* Navigation arrows for multiple files */}
                                {hasMultipleFiles && (
                                    <>
                                        <button
                                            onClick={() => setCurrentFileIndex(i => i === 0 ? allFiles.length - 1 : i - 1)}
                                            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                                        >
                                            <ChevronLeft className="w-6 h-6" />
                                        </button>
                                        <button
                                            onClick={() => setCurrentFileIndex(i => (i + 1) % allFiles.length)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                                        >
                                            <ChevronRight className="w-6 h-6" />
                                        </button>
                                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                                            {allFiles.map((_, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => setCurrentFileIndex(index)}
                                                    className={`w-2 h-2 rounded-full transition-all ${index === currentFileIndex
                                                            ? 'w-6 bg-white'
                                                            : 'bg-white/50 hover:bg-white/70'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* File info bar */}
                            <div className="px-4 py-3 bg-white/30 border-t border-white/30 flex items-center justify-between">
                                <span className="text-sm text-gray-600 truncate flex-1">
                                    {currentFile?.file_name}
                                    {hasMultipleFiles && (
                                        <span className="text-xs text-gray-400 ml-2">
                                            ({currentFileIndex + 1} of {allFiles.length})
                                        </span>
                                    )}
                                </span>
                                {currentFile?.file_url && (
                                    <a
                                        href={currentFile.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium ml-4"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Open in New Tab
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Details Sidebar */}
                    <div className="flex flex-col gap-4 min-h-0">
                        {/* Evidence Info */}
                        <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 p-5 flex-shrink-0">
                            {/* Type Badge */}
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${typeConfig.bg} ${typeConfig.color} text-sm font-medium mb-3`}>
                                <TypeIcon className="w-4 h-4" />
                                {typeConfig.label}
                            </div>

                            <h1 className="text-lg font-bold text-gray-900 mb-2">{evidence.title}</h1>

                            {evidence.description && (
                                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{evidence.description}</p>
                            )}

                            {/* Date */}
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Calendar className="w-4 h-4" />
                                {new Date(evidence.date_represented).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </div>

                            {/* Date Range */}
                            {evidence.date_range_start && evidence.date_range_end && (
                                <p className="text-xs text-gray-400 mt-1">
                                    Covers: {new Date(evidence.date_range_start).toLocaleDateString()} - {new Date(evidence.date_range_end).toLocaleDateString()}
                                </p>
                            )}
                        </div>

                        {/* Linked Impact Claims - Scrollable */}
                        {evidence.linked_kpis && evidence.linked_kpis.length > 0 && (
                            <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 p-5 flex-1 min-h-0 flex flex-col">
                                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex-shrink-0">
                                    Supporting Impact Claims
                                </h3>
                                <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                                    {evidence.linked_kpis.map((kpi) => {
                                        const colors = categoryColors[kpi.category] || categoryColors.output
                                        return (
                                            <Link
                                                key={kpi.id}
                                                to={`/org/${orgSlug}/${initiativeSlug}/metric/${kpi.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`}
                                                className="block p-3 bg-white/60 rounded-xl border border-white/50 hover:bg-white/80 hover:shadow-md transition-all group"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-gray-800 text-sm group-hover:text-primary-600 transition-colors">
                                                            {kpi.title}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            {kpi.unit_of_measurement} • <span className={colors.text}>{kpi.category}</span>
                                                        </p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Initiative Link */}
                        <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 p-4 flex-shrink-0">
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">From Initiative</p>
                            <Link
                                to={`/org/${orgSlug}/${initiativeSlug}`}
                                className="flex items-center justify-between text-gray-800 hover:text-primary-600 font-medium transition-colors group"
                            >
                                <span className="text-sm">{evidence.initiative.title}</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
