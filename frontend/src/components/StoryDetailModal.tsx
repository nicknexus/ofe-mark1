import React, { useState } from 'react'
import { X, Edit, Trash2, MapPin, Calendar, Users, Image, Video, Mic, FileText } from 'lucide-react'
import { Story } from '../types'
import { formatDate } from '../utils'

interface StoryDetailModalProps {
    isOpen: boolean
    onClose: () => void
    story: Story | null
    onEdit: (story: Story) => void
    onDelete: (storyId: string) => void
}

export default function StoryDetailModal({ isOpen, onClose, story, onEdit, onDelete }: StoryDetailModalProps) {
    const [imageError, setImageError] = useState(false)

    const handleImageError = () => setImageError(true)

    const handleDelete = () => {
        if (story?.id && confirm('Are you sure you want to delete this story?')) {
            onDelete(story.id)
            onClose()
        }
    }

    if (!isOpen || !story) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-fade-in">
            <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] transform transition-all duration-200 ease-out animate-slide-up-fast">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
                    <h2 className="text-2xl font-semibold text-gray-900">{story.title}</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 min-h-0">
                    <div className="p-6 space-y-6">
                        {/* Media Section */}
                        {story.media_type === 'text' ? (
                            <div className="relative w-full bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-8 border-2 border-blue-200">
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-blue-300 rounded-full mx-auto mb-4 flex items-center justify-center">
                                        <FileText className="w-10 h-10 text-blue-600" />
                                    </div>
                                    <p className="text-lg font-medium text-blue-700">Text Story</p>
                                    <p className="text-sm text-blue-600 mt-1">This story contains text content only</p>
                                </div>
                            </div>
                        ) : story.media_url && story.media_url.trim() ? (
                            <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden shadow-lg">
                                {story.media_type === 'photo' && !imageError ? (
                                    <img
                                        src={story.media_url}
                                        alt={story.title}
                                        className="w-full h-full object-cover"
                                        onError={handleImageError}
                                    />
                                ) : story.media_type === 'video' ? (
                                    <video
                                        src={story.media_url}
                                        className="w-full h-full object-cover"
                                        controls
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                        <div className="text-center p-4">
                                            <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-3 flex items-center justify-center">
                                                <Mic className="w-8 h-8 text-gray-500" />
                                            </div>
                                            <p className="text-sm text-gray-600">Audio Recording</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="relative w-full aspect-video bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex items-center justify-center">
                                <div className="text-center p-6">
                                    <div className="w-20 h-20 bg-primary-300 rounded-full mx-auto mb-3 flex items-center justify-center">
                                        {story.media_type === 'photo' ? (
                                            <Image className="w-10 h-10 text-primary-500" />
                                        ) : story.media_type === 'video' ? (
                                            <Video className="w-10 h-10 text-primary-500" />
                                        ) : (
                                            <Mic className="w-10 h-10 text-primary-500" />
                                        )}
                                    </div>
                                    <p className="text-lg font-medium text-primary-700">No Media</p>
                                    <p className="text-sm text-primary-500 mt-1">Media not uploaded</p>
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        {story.description && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</h3>
                                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{story.description}</p>
                            </div>
                        )}

                        {/* Meta Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                            {/* Date */}
                            <div className="flex items-start space-x-3">
                                <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Date</p>
                                    <p className="text-gray-900 mt-1">{formatDate(story.date_represented)}</p>
                                </div>
                            </div>

                            {/* Location */}
                            {story.location ? (
                                <div className="flex items-start space-x-3">
                                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Location</p>
                                        <p className="text-gray-900 mt-1">{story.location.name}</p>
                                    </div>
                                </div>
                            ) : null}

                            {/* Beneficiary Groups */}
                            {story.beneficiary_groups && story.beneficiary_groups.length > 0 && (
                                <div className="flex items-start space-x-3 md:col-span-2">
                                    <Users className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Beneficiary Groups</p>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {story.beneficiary_groups.map((group) => (
                                                <span
                                                    key={group.id}
                                                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-700"
                                                >
                                                    {group.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer with Actions */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => {
                            onEdit(story)
                            onClose()
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                    >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                    </button>
                    <button
                        onClick={handleDelete}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                    </button>
                </div>
            </div>
        </div>
    )
}







