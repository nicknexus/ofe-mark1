import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
    ArrowLeft, Calendar, MapPin, Users, FileText, BookOpen
} from 'lucide-react'
import { publicApi, PublicStoryDetail } from '../services/publicApi'
import PublicBreadcrumb from '../components/public/PublicBreadcrumb'
import PublicLoader from '../components/public/PublicLoader'

export default function PublicStoryPage() {
    const { orgSlug, initiativeSlug, storyId } = useParams<{ 
        orgSlug: string
        initiativeSlug: string
        storyId: string 
    }>()
    
    const [story, setStory] = useState<PublicStoryDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (orgSlug && initiativeSlug && storyId) {
            loadStory()
        }
    }, [orgSlug, initiativeSlug, storyId])

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
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <Link to={`/org/${orgSlug}/${initiativeSlug}?tab=stories`} 
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                            <span className="font-medium">Back to Stories</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 max-w-4xl mx-auto px-6 py-8">
                {/* Breadcrumb */}
                <PublicBreadcrumb 
                    orgSlug={orgSlug!}
                    orgName={story.initiative.org_name || ''}
                    items={[
                        { label: story.initiative.title, href: `/org/${orgSlug}/${initiativeSlug}` },
                        { label: story.title }
                    ]}
                />

                {/* Story Card */}
                <div className="bg-white/50 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-2xl shadow-black/10 overflow-hidden">
                    {/* Media */}
                    {story.media_url && story.media_type === 'photo' && (
                        <div className="w-full aspect-video bg-gray-100 overflow-hidden">
                            <img 
                                src={story.media_url} 
                                alt={story.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                    {story.media_type === 'video' && story.media_url && (
                        <div className="w-full aspect-video bg-black">
                            <video 
                                src={story.media_url} 
                                controls 
                                className="w-full h-full"
                            />
                        </div>
                    )}
                    {story.media_type === 'text' && !story.media_url && (
                        <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                            <FileText className="w-16 h-16 text-gray-300" />
                        </div>
                    )}

                    {/* Content */}
                    <div className="p-8">
                        {/* Title */}
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">{story.title}</h1>

                        {/* Meta */}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6 pb-6 border-b border-gray-100">
                            <span className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                {new Date(story.date_represented).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                })}
                            </span>
                            {story.location && (
                                <span className="flex items-center gap-1.5">
                                    <MapPin className="w-4 h-4" />
                                    {story.location.name}
                                </span>
                            )}
                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-xs font-medium">
                                {story.media_type}
                            </span>
                        </div>

                        {/* Description */}
                        {story.description && (
                            <div className="prose prose-gray max-w-none">
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-lg">
                                    {story.description}
                                </p>
                            </div>
                        )}

                        {/* Beneficiary Groups */}
                        {story.beneficiary_groups && story.beneficiary_groups.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    People in this Story
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {story.beneficiary_groups.map((group) => (
                                        <span 
                                            key={group.id}
                                            className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm font-medium"
                                        >
                                            {group.name}
                                            {group.total_number && <span className="ml-1 opacity-70">({group.total_number})</span>}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Initiative Link */}
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <p className="text-sm text-gray-500 mb-2">From initiative:</p>
                            <Link 
                                to={`/org/${orgSlug}/${initiativeSlug}`}
                                className="inline-flex items-center gap-2 text-gray-800 hover:text-primary-600 font-medium transition-colors"
                            >
                                {story.initiative.title}
                                <ArrowLeft className="w-4 h-4 rotate-180" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
