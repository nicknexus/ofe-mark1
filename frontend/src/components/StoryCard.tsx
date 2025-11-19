import React, { useState } from 'react'
import { MapPin, Calendar, Users, Image, Video, Mic } from 'lucide-react'
import { Story } from '../types'
import { formatDate } from '../utils'

interface StoryCardProps {
    story: Story
    onView: (story: Story) => void
}

export default function StoryCard({ story, onView }: StoryCardProps) {
    const [imageError, setImageError] = useState(false)

    const handleImageError = () => setImageError(true)
    const showReadMore = (story.description?.length ?? 0) > 120

    return (
        <div className="w-[220px] h-[360px]">
            <div
                className="flex flex-col h-full bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow cursor-pointer group relative"
                onClick={() => onView(story)}
            >
                {/* MEDIA: square like Instagram grid */}
                <div className="relative aspect-square bg-gradient-to-br from-green-50 to-green-100 overflow-hidden">
                    {story.media_url && story.media_url.trim() ? (
                        story.media_type === 'photo' && !imageError ? (
                            <img
                                src={story.media_url}
                                alt={story.title}
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={handleImageError}
                            />
                        ) : story.media_type === 'video' ? (
                            <video
                                src={story.media_url}
                                className="absolute inset-0 w-full h-full object-cover"
                                controls={false}
                                muted
                            />
                        ) : (
                            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-200">
                                <div className="text-center p-2">
                                    <div className="w-8 h-8 bg-gray-300 rounded-full mx-auto mb-1 flex items-center justify-center">
                                        <Mic className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <p className="text-xs text-gray-600">Audio</p>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-green-100 to-green-200">
                            <div className="text-center p-3">
                                <div className="w-12 h-12 bg-green-300 rounded-full mx-auto mb-2 flex items-center justify-center">
                                    {story.media_type === 'photo' ? (
                                        <Image className="w-6 h-6 text-green-600" />
                                    ) : story.media_type === 'video' ? (
                                        <Video className="w-6 h-6 text-green-600" />
                                    ) : (
                                        <Mic className="w-6 h-6 text-green-600" />
                                    )}
                                </div>
                                <p className="text-sm font-medium text-green-700">No Media</p>
                            </div>
                        </div>
                    )}

                </div>

                {/* CONTENT: fixed slots so nothing overlaps */}
                <div className="flex flex-col flex-1 min-h-0 p-3">
                    {/* Title: 2-line slot */}
                    <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 h-[36px]">
                        {story.title}
                    </h3>

                    {/* Description: 2–3 lines with fade; read more absolute so it doesn't change height */}
                    <div className="relative mt-1 h-[48px] overflow-hidden">
                        {story.description ? (
                            <p className="text-xs text-gray-600 leading-snug line-clamp-3">
                                {story.description}
                            </p>
                        ) : (
                            <div className="h-full" />
                        )}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-white to-transparent" />
                        {showReadMore && (
                            <span
                                className="absolute right-0 bottom-0 mb-0.5 text-[11px] font-medium text-blue-600 underline cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); onView(story) }}
                            >
                                Read more
                            </span>
                        )}
                    </div>

                    {/* Push meta to bottom */}
                    <div className="flex-1" />

                    {/* Meta: fixed rows */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1 text-[11px] text-gray-500 h-5">
                            <Calendar className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{formatDate(story.date_represented)}</span>
                        </div>

                        {story.location ? (
                            <div className="flex items-center gap-1 text-[11px] text-gray-500 h-5">
                                <MapPin className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{story.location.name}</span>
                            </div>
                        ) : (
                            <div className="h-5" />
                        )}

                        {story.beneficiary_groups?.length ? (
                            <div className="flex items-center gap-1 text-[11px] text-gray-500 h-5">
                                <Users className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">
                                    {story.beneficiary_groups.length === 1
                                        ? story.beneficiary_groups[0].name
                                        : `${story.beneficiary_groups.length} beneficiary groups`}
                                </span>
                            </div>
                        ) : (
                            <div className="h-5" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
