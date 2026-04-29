import React, { useState } from 'react'
import { MapPin, Calendar, Users, Image as ImageIcon, Video, Mic, FileText, Play } from 'lucide-react'
import { Story } from '../types'
import { formatDate } from '../utils'
import EvidenceTagsList from './MetricTags/EvidenceTagsList'

interface StoryCardProps {
    story: Story
    onView: (story: Story) => void
}

const YT_DETECT = /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/
const YT_ID = /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

const MEDIA_BADGE: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
    photo: { label: 'Photo', Icon: ImageIcon },
    video: { label: 'Video', Icon: Video },
    recording: { label: 'Audio', Icon: Mic },
    text: { label: 'Text', Icon: FileText },
}

export default function StoryCard({ story, onView }: StoryCardProps) {
    const [imageError, setImageError] = useState(false)
    const handleImageError = () => setImageError(true)

    const youtubeId = story.media_url && YT_DETECT.test(story.media_url)
        ? (story.media_url.match(YT_ID) || [])[1]
        : null
    const isYouTube = !!youtubeId
    const isPhoto = !isYouTube && story.media_url && story.media_type === 'photo' && !imageError
    const isVideoFile = !isYouTube && story.media_url && story.media_type === 'video'
    const hasNoUsableMedia = !isYouTube && !isPhoto && !isVideoFile && story.media_type !== 'text'

    const badge = MEDIA_BADGE[story.media_type || 'photo']
    const locName = story.locations?.length
        ? (story.locations.length === 1 ? story.locations[0].name : `${story.locations[0].name} +${story.locations.length - 1}`)
        : story.location?.name

    return (
        <button
            type="button"
            onClick={() => onView(story)}
            className="group relative w-full text-left bg-white rounded-2xl ring-1 ring-gray-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.10)] hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_20px_40px_-16px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col"
        >
            {/* Media */}
            <div className="relative w-full aspect-[16/10] bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                {story.media_type === 'text' ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
                        <div className="w-14 h-14 rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center">
                            <FileText className="w-7 h-7 text-blue-600" />
                        </div>
                    </div>
                ) : isYouTube ? (
                    <>
                        <img
                            src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                            alt={story.title}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-transparent" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                                <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
                            </div>
                        </div>
                    </>
                ) : isPhoto ? (
                    <img
                        src={story.media_url}
                        alt={story.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        onError={handleImageError}
                    />
                ) : isVideoFile ? (
                    <>
                        <video
                            src={story.media_url}
                            className="absolute inset-0 w-full h-full object-cover"
                            controls={false}
                            muted
                            preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center backdrop-blur-sm">
                                <Play className="w-5 h-5 text-white ml-0.5" fill="currentColor" />
                            </div>
                        </div>
                    </>
                ) : hasNoUsableMedia ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                        <div className="w-14 h-14 rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center">
                            <Mic className="w-7 h-7 text-gray-500" />
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
                        <div className="w-14 h-14 rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center">
                            <ImageIcon className="w-7 h-7 text-primary-500" />
                        </div>
                    </div>
                )}

                {/* Media type badge */}
                {badge && (
                    <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-[11px] font-medium text-gray-700 shadow-sm">
                        <badge.Icon className="w-3 h-3" />
                        {badge.label}
                    </div>
                )}
            </div>

            {/* Body */}
            <div className="flex flex-col flex-1 min-h-0 p-5 gap-3">
                <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2">
                    {story.title}
                </h3>

                {story.description && (
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                        {story.description}
                    </p>
                )}

                {/* Spacer to push meta to bottom */}
                <div className="flex-1" />

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 pt-1">
                    <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {formatDate(story.date_represented)}
                    </span>
                    {locName && (
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{locName}</span>
                        </span>
                    )}
                    {story.beneficiary_groups?.length ? (
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                            <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">
                                {story.beneficiary_groups.length === 1
                                    ? story.beneficiary_groups[0].name
                                    : `${story.beneficiary_groups.length} groups`}
                            </span>
                        </span>
                    ) : null}
                </div>

                {/* Tag chips */}
                {story.tag_ids && story.tag_ids.length > 0 && (
                    <div onClick={(e) => e.stopPropagation()}>
                        <EvidenceTagsList tagIds={story.tag_ids} visibleCap={3} clickable={false} size="xs" />
                    </div>
                )}
            </div>
        </button>
    )
}
