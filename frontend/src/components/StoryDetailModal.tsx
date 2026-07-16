import React, { useState } from 'react'
import { Edit, Trash2, MapPin, Calendar, Users, Image, Video, Mic, FileText, Tag as TagIcon } from 'lucide-react'
import { Story } from '../types'
import { formatDate } from '../utils'
import EvidenceTagsList from './MetricTags/EvidenceTagsList'
import ConfirmDialog from './ConfirmDialog'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from './ModalFrame'

interface StoryDetailModalProps {
 isOpen: boolean
 onClose: () => void
 story: Story | null
 onEdit?: (story: Story) => void
 onDelete?: (storyId: string) => void
}

export default function StoryDetailModal({ isOpen, onClose, story, onEdit, onDelete }: StoryDetailModalProps) {
 const [imageError, setImageError] = useState(false)
 const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

 const handleImageError = () => setImageError(true)

 const handleDelete = () => {
 if (!story?.id) return
 onDelete?.(story.id)
 setShowDeleteConfirm(false)
 onClose()
 }

 if (!isOpen || !story) return null

 return (
 <>
 <ModalFrame size="lg">
 <ModalHeader icon={FileText} title={story.title} onClose={onClose} />
 <ModalBody>
 <div className="space-y-6">
 {/* Media Section */}
 {story.media_type === 'text' ? (
 <div className="relative w-full bg-gray-50 rounded-2xl p-8 border border-gray-200">
 <div className="text-center">
 <div className="app-icon-tile mx-auto mb-4">
 <FileText className="w-8 h-8 text-primary-500" />
 </div>
 <p className="text-base font-medium text-gray-800">Text Story</p>
 <p className="text-sm text-gray-500 mt-1">This story contains text content only</p>
 </div>
 </div>
 ) : story.media_url && story.media_url.trim() ? (
 /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(story.media_url) ? (
 <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
 <iframe
 src={`https://www.youtube.com/embed/${(story.media_url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/) || [])[1]}`}
 title="YouTube video"
 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
 allowFullScreen
 className="w-full h-full"
 />
 </div>
 ) : story.media_type === 'photo' && !imageError ? (
 <div className="relative w-full bg-black/95 rounded-lg overflow-hidden shadow-lg flex items-center justify-center">
 <img
 src={story.media_url}
 alt={story.title}
 className="w-full max-h-[65vh] object-contain"
 onError={handleImageError}
 />
 </div>
 ) : story.media_type === 'video' ? (
 <div className="relative w-full bg-black rounded-lg overflow-hidden shadow-lg flex items-center justify-center">
 <video
 src={story.media_url}
 className="w-full max-h-[65vh] object-contain"
 controls
 />
 </div>
 ) : (
 <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden shadow-lg">
 <div className="w-full h-full flex items-center justify-center bg-gray-200">
 <div className="text-center p-4">
 <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-3 flex items-center justify-center">
 <Mic className="w-8 h-8 text-gray-500" />
 </div>
 <p className="text-sm text-gray-600">Audio Recording</p>
 </div>
 </div>
 </div>
 )
 ) : (
 <div className="relative w-full aspect-video bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-center">
 <div className="text-center p-6">
 <div className="app-icon-tile mx-auto mb-3">
 {story.media_type === 'photo' ? (
 <Image className="w-8 h-8 text-gray-400" />
 ) : story.media_type === 'video' ? (
 <Video className="w-8 h-8 text-gray-400" />
 ) : (
 <Mic className="w-8 h-8 text-gray-400" />
 )}
 </div>
 <p className="text-base font-medium text-gray-700">No Media</p>
 <p className="text-sm text-gray-500 mt-1">Media not uploaded</p>
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

 {/* Locations */}
 {(story.locations?.length || story.location) ? (
 <div className="flex items-start space-x-3">
 <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
 <div>
 <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
 {(story.locations?.length || 0) > 1 ? 'Locations' : 'Location'}
 </p>
 <div className="flex flex-wrap gap-2 mt-1">
 {(story.locations?.length ? story.locations : story.location ? [story.location] : []).map(loc => (
 <span key={loc.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-sm text-gray-900">
 <MapPin className="w-3 h-3 text-gray-400" />
 {loc.name}
 </span>
 ))}
 </div>
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
 className="app-chip"
 >
 {group.name}
 </span>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* Tags */}
 {story.tag_ids && story.tag_ids.length > 0 && (
 <div className="flex items-start space-x-3 md:col-span-2">
 <TagIcon className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
 <div className="min-w-0 flex-1">
 <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Tags</p>
 <EvidenceTagsList tagIds={story.tag_ids} visibleCap={8} clickable size="sm" />
 </div>
 </div>
 )}
 </div>
 </div>
 </ModalBody>
 <ModalFooter>
 <button onClick={onClose} className="app-btn app-btn-secondary">
 Close
 </button>
 {onEdit && (
 <button
 onClick={() => {
 onEdit(story)
 onClose()
 }}
 className="app-btn app-btn-primary"
 >
 <Edit className="w-4 h-4" />
 <span>Edit</span>
 </button>
 )}
 {onDelete && (
 <button
 onClick={() => setShowDeleteConfirm(true)}
 className="app-btn app-btn-danger"
 >
 <Trash2 className="w-4 h-4" />
 <span>Delete</span>
 </button>
 )}
 </ModalFooter>
 </ModalFrame>
 {showDeleteConfirm && (
 <ConfirmDialog
 title="Delete story"
 message={`Delete story "${story.title}"? This cannot be undone.`}
 confirmLabel="Delete story"
 tone="danger"
 onConfirm={handleDelete}
 onCancel={() => setShowDeleteConfirm(false)}
 />
 )}
 </>
 )
}






