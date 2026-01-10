import React, { useState, useEffect, useRef } from 'react'
import { 
    Plus, 
    BookOpen, 
    Camera, 
    Video, 
    Mic, 
    FileText,
    Upload,
    X,
    Check,
    MapPin,
    Calendar,
    Loader2
} from 'lucide-react'
import { apiService } from '../../services/api'
import { Story, Location, BeneficiaryGroup } from '../../types'
import { formatDate, getLocalDateString } from '../../utils'
import DateRangePicker from '../DateRangePicker'
import StoryDetailModal from '../StoryDetailModal'
import toast from 'react-hot-toast'

interface MobileStoriesTabProps {
    initiativeId: string
}

export default function MobileStoriesTab({ initiativeId }: MobileStoriesTabProps) {
    const [stories, setStories] = useState<Story[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreateFlow, setShowCreateFlow] = useState(false)
    const [selectedStory, setSelectedStory] = useState<Story | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)

    useEffect(() => {
        loadStories()
    }, [initiativeId])

    const loadStories = async () => {
        try {
            setLoading(true)
            const data = await apiService.getStories(initiativeId)
            setStories(data || [])
        } catch (error) {
            console.error('Error loading stories:', error)
            toast.error('Failed to load stories')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteStory = async (storyId: string) => {
        try {
            await apiService.deleteStory(storyId)
            toast.success('Story deleted')
            setIsDetailOpen(false)
            setSelectedStory(null)
            loadStories()
        } catch (error) {
            toast.error('Failed to delete story')
        }
    }

    if (showCreateFlow) {
        return (
            <MobileStoryForm
                initiativeId={initiativeId}
                onClose={() => setShowCreateFlow(false)}
                onSuccess={() => {
                    setShowCreateFlow(false)
                    loadStories()
                }}
            />
        )
    }

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Stories</h1>
                    <p className="text-sm text-gray-500">{stories.length} stor{stories.length !== 1 ? 'ies' : 'y'}</p>
                </div>
                <button
                    onClick={() => setShowCreateFlow(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-primary-500/25 active:scale-[0.98]"
                >
                    <Plus className="w-4 h-4" />
                    Add
                </button>
            </div>

            {/* Stories Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
            ) : stories.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                    <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BookOpen className="w-8 h-8 text-primary-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Stories Yet</h3>
                    <p className="text-gray-500 text-sm px-6 mb-6">
                        Share your impact with photos and stories.
                    </p>
                    <button
                        onClick={() => setShowCreateFlow(true)}
                        className="px-6 py-3 bg-primary-500 text-white rounded-xl font-medium text-sm"
                    >
                        Create Story
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {stories.map((story) => {
                        const mediaIcon = 
                            story.media_type === 'photo' ? Camera :
                            story.media_type === 'video' ? Video :
                            story.media_type === 'recording' ? Mic :
                            FileText

                        return (
                            <button
                                key={story.id}
                                onClick={() => {
                                    setSelectedStory(story)
                                    setIsDetailOpen(true)
                                }}
                                className="bg-white rounded-xl border border-gray-100 overflow-hidden text-left active:scale-[0.98] transition-transform"
                            >
                                {/* Media Preview */}
                                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                                    {story.media_url && (story.media_type === 'photo' || !story.media_type) ? (
                                        <img
                                            src={story.media_url}
                                            alt={story.title}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none'
                                            }}
                                        />
                                    ) : story.media_url && story.media_type === 'video' ? (
                                        <video
                                            src={story.media_url}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            {React.createElement(mediaIcon, { className: 'w-10 h-10 text-gray-300' })}
                                        </div>
                                    )}
                                </div>
                                {/* Info */}
                                <div className="p-3">
                                    <h3 className="font-medium text-gray-800 text-sm truncate">
                                        {story.title}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {formatDate(story.date_represented)}
                                    </p>
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Story Detail Modal */}
            {isDetailOpen && selectedStory && (
                <StoryDetailModal
                    isOpen={isDetailOpen}
                    onClose={() => {
                        setIsDetailOpen(false)
                        setSelectedStory(null)
                    }}
                    story={selectedStory}
                    onEdit={() => {}}
                    onDelete={handleDeleteStory}
                />
            )}
        </div>
    )
}

// Mobile Story Form
interface StoryFormProps {
    initiativeId: string
    onClose: () => void
    onSuccess: () => void
}

function MobileStoryForm({ initiativeId, onClose, onSuccess }: StoryFormProps) {
    const [loading, setLoading] = useState(false)
    const [locations, setLocations] = useState<Location[]>([])
    const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        media_type: 'photo' as 'photo' | 'video' | 'recording' | 'text',
        media_url: '',
        file: null as File | null,
        date_represented: getLocalDateString(new Date()),
        location_id: '',
        beneficiary_group_ids: [] as string[]
    })

    const mediaTypes = [
        { value: 'photo', label: 'Photo', icon: Camera },
        { value: 'video', label: 'Video', icon: Video },
        { value: 'recording', label: 'Audio', icon: Mic },
        { value: 'text', label: 'Text', icon: FileText }
    ]

    useEffect(() => {
        Promise.all([
            apiService.getLocations(initiativeId),
            apiService.getBeneficiaryGroups(initiativeId)
        ]).then(([locs, groups]) => {
            setLocations(locs || [])
            setBeneficiaryGroups(groups || [])
        })
    }, [initiativeId])

    const handleFileSelect = async (file: File) => {
        setFormData(prev => ({ ...prev, file }))
        
        try {
            const uploadResult = await apiService.uploadFile(file)
            setFormData(prev => ({ ...prev, media_url: uploadResult.file_url, file: null }))
            toast.success('File uploaded!')
        } catch (error) {
            toast.error('Upload failed')
            setFormData(prev => ({ ...prev, file: null }))
        }
    }

    const handleSubmit = async () => {
        if (!formData.title.trim()) {
            toast.error('Please enter a title')
            return
        }
        if (!formData.location_id) {
            toast.error('Please select a location')
            return
        }

        setLoading(true)
        try {
            await apiService.createStory({
                title: formData.title.trim(),
                description: formData.description.trim(),
                media_type: formData.media_type,
                media_url: formData.media_url || undefined,
                date_represented: formData.date_represented,
                location_id: formData.location_id,
                beneficiary_group_ids: formData.beneficiary_group_ids,
                initiative_id: initiativeId
            })
            toast.success('Story created!')
            onSuccess()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create story'
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <button onClick={onClose} className="p-2 -ml-2">
                    <X className="w-5 h-5 text-gray-500" />
                </button>
                <span className="font-semibold text-gray-800">Create Story</span>
                <div className="w-9" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Title */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Enter story title"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                    </label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Tell the story..."
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none"
                    />
                </div>

                {/* Media Type */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Media Type
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {mediaTypes.map((type) => {
                            const Icon = type.icon
                            const isSelected = formData.media_type === type.value
                            return (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, media_type: type.value as any })}
                                    className={`p-3 rounded-xl border-2 transition-all ${
                                        isSelected 
                                            ? 'border-primary-500 bg-primary-50' 
                                            : 'border-gray-200'
                                    }`}
                                >
                                    <Icon className={`w-5 h-5 mx-auto ${isSelected ? 'text-primary-500' : 'text-gray-400'}`} />
                                    <div className={`text-xs mt-1 ${isSelected ? 'text-primary-600 font-medium' : 'text-gray-500'}`}>
                                        {type.label}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* File Upload - only for non-text types */}
                {formData.media_type !== 'text' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Upload {formData.media_type === 'photo' ? 'Photo' : formData.media_type === 'video' ? 'Video' : 'Audio'}
                        </label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleFileSelect(file)
                            }}
                            accept={
                                formData.media_type === 'photo' ? 'image/*' :
                                formData.media_type === 'video' ? 'video/*' :
                                'audio/*'
                            }
                            className="hidden"
                        />

                        {formData.media_url ? (
                            <div className="bg-primary-50 border-2 border-primary-300 rounded-xl p-4 text-center">
                                {formData.media_type === 'photo' && (
                                    <img 
                                        src={formData.media_url} 
                                        alt="Preview" 
                                        className="max-h-48 mx-auto rounded-lg mb-2"
                                    />
                                )}
                                <p className="text-sm text-primary-700 font-medium">File uploaded</p>
                                <button
                                    onClick={() => setFormData({ ...formData, media_url: '' })}
                                    className="mt-2 text-sm text-red-600 font-medium"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-primary-400 transition-colors"
                            >
                                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-600">Tap to upload</p>
                            </button>
                        )}
                    </div>
                )}

                {/* Date */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Date
                    </label>
                    <DateRangePicker
                        value={{ singleDate: formData.date_represented }}
                        onChange={(value) => setFormData({ 
                            ...formData, 
                            date_represented: value.singleDate || getLocalDateString(new Date())
                        })}
                        placeholder="Select date"
                    />
                </div>

                {/* Location */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Location <span className="text-red-500">*</span>
                    </label>
                    {locations.length === 0 ? (
                        <div className="text-center py-4 bg-gray-50 rounded-xl">
                            <p className="text-sm text-gray-500">No locations available</p>
                            <p className="text-xs text-gray-400">Add locations in the Locations tab</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {locations.map((location) => {
                                const isSelected = formData.location_id === location.id
                                return (
                                    <button
                                        key={location.id}
                                        onClick={() => setFormData({ ...formData, location_id: location.id! })}
                                        className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                                            isSelected 
                                                ? 'border-primary-500 bg-primary-50' 
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-gray-800 text-sm">{location.name}</span>
                                            {isSelected && <Check className="w-4 h-4 text-primary-500" />}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Beneficiary Groups (optional) */}
                {beneficiaryGroups.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Beneficiary Groups (optional)
                        </label>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {beneficiaryGroups.map((group) => {
                                const isSelected = formData.beneficiary_group_ids.includes(group.id!)
                                return (
                                    <button
                                        key={group.id}
                                        onClick={() => {
                                            setFormData(prev => ({
                                                ...prev,
                                                beneficiary_group_ids: isSelected
                                                    ? prev.beneficiary_group_ids.filter(id => id !== group.id)
                                                    : [...prev.beneficiary_group_ids, group.id!]
                                            }))
                                        }}
                                        className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                                            isSelected 
                                                ? 'border-primary-500 bg-primary-50' 
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-800">{group.name}</span>
                                            {isSelected && <Check className="w-4 h-4 text-primary-500" />}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 safe-area-pb">
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                Create Story
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}


