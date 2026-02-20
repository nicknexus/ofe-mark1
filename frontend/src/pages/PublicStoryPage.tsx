import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
    ArrowLeft, Calendar, MapPin, Users, FileText, BookOpen, ChevronLeft, ChevronRight
} from 'lucide-react'
import { publicApi, PublicStoryDetail, PublicStory } from '../services/publicApi'
import PublicBreadcrumb from '../components/public/PublicBreadcrumb'
import PublicLoader from '../components/public/PublicLoader'
import DateRangePicker from '../components/DateRangePicker'
import { getLocalDateString } from '../utils'

export default function PublicStoryPage() {
    const { orgSlug, initiativeSlug, storyId } = useParams<{
        orgSlug: string
        initiativeSlug: string
        storyId: string
    }>()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const [dateFilter, setDateFilter] = useState<{ singleDate?: string; startDate?: string; endDate?: string }>(() => {
        const s = searchParams.get('startDate')
        const e = searchParams.get('endDate')
        if (s && e) return { startDate: s, endDate: e }
        if (s) return { singleDate: s }
        return {}
    })

    const [story, setStory] = useState<PublicStoryDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // All stories for prev/next navigation
    const [allStories, setAllStories] = useState<PublicStory[]>([])

    useEffect(() => {
        if (orgSlug && initiativeSlug && storyId) {
            loadStory()
        }
    }, [orgSlug, initiativeSlug, storyId])

    // Load story list for navigation
    useEffect(() => {
        if (orgSlug && initiativeSlug) {
            publicApi.getInitiativeStories(orgSlug, initiativeSlug)
                .then(setAllStories)
                .catch(console.error)
        }
    }, [orgSlug, initiativeSlug])

    // Find current position
    const currentIndex = allStories.findIndex(s => s.id === storyId)
    const prevStory = currentIndex > 0 ? allStories[currentIndex - 1] : null
    const nextStory = currentIndex >= 0 && currentIndex < allStories.length - 1 ? allStories[currentIndex + 1] : null

    const goToPrev = useCallback(() => {
        if (prevStory) navigate(`/org/${orgSlug}/${initiativeSlug}/story/${prevStory.id}`)
    }, [prevStory, orgSlug, initiativeSlug, navigate])

    const goToNext = useCallback(() => {
        if (nextStory) navigate(`/org/${orgSlug}/${initiativeSlug}/story/${nextStory.id}`)
    }, [nextStory, orgSlug, initiativeSlug, navigate])

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') goToPrev()
            else if (e.key === 'ArrowRight') goToNext()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [goToPrev, goToNext])

    const loadStory = async () => {
        try {
            setLoading(true)
            setError(null)
            const data = await publicApi.getStoryDetail(orgSlug!, initiativeSlug!, storyId!)
            setStory(data)
        } catch (err) {
            console.error('Error loading story:', err)
            setError('Failed to load story')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <PublicLoader message="Loading story..." />
    }

    if (error || !story) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="bg-white/40 backdrop-blur-2xl p-12 rounded-3xl text-center max-w-md border border-white/60 shadow-xl">
                    <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-gray-800 mb-3">Story Not Found</h1>
                    <p className="text-gray-500 mb-8">{error || 'This story does not exist.'}</p>
                    <Link to={`/org/${orgSlug}/${initiativeSlug}?tab=stories`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4" /> Back to Stories
                    </Link>
                </div>
            </div>
        )
    }

    // Brand color (could be passed from initiative if available)
    const brandColor = story.initiative.brand_color || '#c0dfa1'

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
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex items-center justify-between">
                        <Link to={`/org/${orgSlug}/${initiativeSlug}?tab=stories`}
                            className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-gray-800 transition-colors">
                            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="text-sm sm:text-base font-medium">Back</span>
                        </Link>
                        <DateRangePicker
                            value={dateFilter}
                            onChange={setDateFilter}
                            maxDate={getLocalDateString(new Date())}
                            placeholder="Filter by date"
                            className="w-auto"
                        />
                        <Link to="/" className="flex items-center gap-2">
                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
                {/* Breadcrumb - Hidden on mobile */}
                <div className="hidden sm:block">
                    <PublicBreadcrumb
                        orgSlug={orgSlug!}
                        orgName={story.initiative.org_name || ''}
                        items={[
                            { label: story.initiative.title, href: `/org/${orgSlug}/${initiativeSlug}?tab=stories` },
                            { label: story.title }
                        ]}
                    />
                </div>

                {/* Story Card */}
                <div className="bg-white/50 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-2xl shadow-black/10 overflow-hidden">
                    {/* Media */}
                    {story.media_url && /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(story.media_url) ? (
                        <div className="w-full aspect-video bg-black">
                            <iframe
                                src={`https://www.youtube.com/embed/${(story.media_url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/) || [])[1]}`}
                                title="YouTube video"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full"
                            />
                        </div>
                    ) : null}
                    {story.media_url && story.media_type === 'photo' && !/(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(story.media_url) && (
                        <div className="w-full min-h-[150px] sm:min-h-[200px] max-h-[50vh] sm:max-h-[70vh] bg-transparent flex items-center justify-center overflow-hidden">
                            <img
                                src={story.media_url}
                                alt={story.title}
                                className="max-w-full max-h-[50vh] sm:max-h-[70vh] object-contain"
                            />
                        </div>
                    )}
                    {story.media_type === 'video' && story.media_url && !/(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(story.media_url) && (
                        <div className="w-full aspect-video bg-black">
                            <video
                                src={story.media_url}
                                controls
                                className="w-full h-full"
                            />
                        </div>
                    )}
                    {story.media_type === 'text' && !story.media_url && (
                        <div className="w-full h-32 sm:h-48 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                            <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300" />
                        </div>
                    )}

                    {/* Content */}
                    <div className="p-4 sm:p-8">
                        {/* Title */}
                        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">{story.title}</h1>

                        {/* Meta */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-gray-100">
                            <span className="flex items-center gap-1 sm:gap-1.5">
                                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                {new Date(story.date_represented).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </span>
                            {story.location && (
                                <span className="flex items-center gap-1 sm:gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    {story.location.name}
                                </span>
                            )}
                            <span className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-gray-100 rounded-full text-[10px] sm:text-xs font-medium">
                                {story.media_type}
                            </span>
                        </div>

                        {/* Description */}
                        {story.description && (
                            <div className="prose prose-gray max-w-none">
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm sm:text-lg">
                                    {story.description}
                                </p>
                            </div>
                        )}

                        {/* Beneficiary Groups */}
                        {story.beneficiary_groups && story.beneficiary_groups.length > 0 && (
                            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-100">
                                <h3 className="text-xs sm:text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    People in this Story
                                </h3>
                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                    {story.beneficiary_groups.map((group) => (
                                        <span
                                            key={group.id}
                                            className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-primary-50 text-primary-700 rounded-full text-xs sm:text-sm font-medium"
                                        >
                                            {group.name}
                                            {group.total_number && <span className="ml-1 opacity-70">({group.total_number})</span>}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Initiative Link */}
                        <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-100">
                            <p className="text-xs sm:text-sm text-gray-500 mb-1.5 sm:mb-2">From initiative:</p>
                            <Link
                                to={`/org/${orgSlug}/${initiativeSlug}`}
                                className="inline-flex items-center gap-1.5 sm:gap-2 text-gray-800 hover:text-primary-600 font-medium transition-colors text-sm sm:text-base"
                            >
                                {story.initiative.title}
                                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 rotate-180" />
                            </Link>
                        </div>

                        {/* Story Navigation */}
                        {allStories.length > 1 && currentIndex >= 0 && (
                            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-100 flex items-center justify-between gap-4">
                                {prevStory ? (
                                    <button
                                        onClick={goToPrev}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-white/60 hover:bg-white/80 border border-gray-200/50 text-foreground rounded-xl transition-colors text-sm font-medium shadow-sm group min-w-0 flex-1"
                                    >
                                        <ChevronLeft className="w-4 h-4 flex-shrink-0 group-hover:-translate-x-0.5 transition-transform" />
                                        <div className="min-w-0 text-left">
                                            <p className="text-[10px] text-muted-foreground">Previous</p>
                                            <p className="truncate text-xs">{prevStory.title}</p>
                                        </div>
                                    </button>
                                ) : <div />}

                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                    {currentIndex + 1} / {allStories.length}
                                </span>

                                {nextStory ? (
                                    <button
                                        onClick={goToNext}
                                        className="flex items-center gap-2 px-4 py-2.5 bg-white/60 hover:bg-white/80 border border-gray-200/50 text-foreground rounded-xl transition-colors text-sm font-medium shadow-sm group min-w-0 flex-1 justify-end"
                                    >
                                        <div className="min-w-0 text-right">
                                            <p className="text-[10px] text-muted-foreground">Next</p>
                                            <p className="truncate text-xs">{nextStory.title}</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                ) : <div />}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
