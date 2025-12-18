import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, X, MapPin, Users, Calendar, ChevronDown } from 'lucide-react'
import { apiService } from '../../services/api'
import { Story, Location, BeneficiaryGroup } from '../../types'
import { formatDate } from '../../utils'
import StoryCard from '../StoryCard'
import AddStoryModal from '../AddStoryModal'
import StoryDetailModal from '../StoryDetailModal'
import DateRangePicker from '../DateRangePicker'
import toast from 'react-hot-toast'

interface StoriesTabProps {
    initiativeId: string
    onRefresh?: () => void
    initialStoryId?: string // Story ID to open when tab loads
}

export default function StoriesTab({ initiativeId, onRefresh, initialStoryId }: StoriesTabProps) {
    const [stories, setStories] = useState<Story[]>([])
    const [loading, setLoading] = useState(false)
    const [locations, setLocations] = useState<Location[]>([])
    const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [editingStory, setEditingStory] = useState<Story | null>(null)
    const [selectedStory, setSelectedStory] = useState<Story | null>(null)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Master filter state
    const [datePickerValue, setDatePickerValue] = useState<{
        singleDate?: string
        startDate?: string
        endDate?: string
    }>({})
    const [selectedLocations, setSelectedLocations] = useState<string[]>([])
    const [selectedBeneficiaryGroups, setSelectedBeneficiaryGroups] = useState<string[]>([])
    const [showLocationPicker, setShowLocationPicker] = useState(false)
    const [showBeneficiaryPicker, setShowBeneficiaryPicker] = useState(false)
    const locationButtonRef = useRef<HTMLButtonElement>(null)
    const beneficiaryButtonRef = useRef<HTMLButtonElement>(null)
    const [locationDropdownPosition, setLocationDropdownPosition] = useState({ top: 0, left: 0 })
    const [beneficiaryDropdownPosition, setBeneficiaryDropdownPosition] = useState({ top: 0, left: 0 })

    // Load locations and beneficiary groups
    useEffect(() => {
        if (initiativeId) {
            Promise.all([
                apiService.getLocations(initiativeId),
                apiService.getBeneficiaryGroups(initiativeId)
            ]).then(([locs, groups]) => {
                setLocations(locs || [])
                setBeneficiaryGroups(groups || [])
            }).catch(() => {
                setLocations([])
                setBeneficiaryGroups([])
            })
        }
    }, [initiativeId])

    // Load stories with filters
    useEffect(() => {
        loadStories()
    }, [initiativeId, selectedLocations, selectedBeneficiaryGroups, datePickerValue, searchQuery])

    // Open story when initialStoryId is provided (only once)
    const [hasOpenedInitialStory, setHasOpenedInitialStory] = useState(false)
    useEffect(() => {
        if (initialStoryId && stories.length > 0 && !isDetailModalOpen && !hasOpenedInitialStory) {
            const story = stories.find(s => s.id === initialStoryId)
            if (story) {
                setSelectedStory(story)
                setIsDetailModalOpen(true)
                setHasOpenedInitialStory(true)
            }
        }
    }, [initialStoryId, stories, hasOpenedInitialStory])

    // Reset hasOpenedInitialStory when initialStoryId changes
    useEffect(() => {
        if (initialStoryId) {
            setHasOpenedInitialStory(false)
        }
    }, [initialStoryId])

    const loadStories = async () => {
        if (!initiativeId) return
        try {
            setLoading(true)
            const filters: any = {}
            if (selectedLocations.length > 0) {
                filters.locationIds = selectedLocations
            }
            if (selectedBeneficiaryGroups.length > 0) {
                filters.beneficiaryGroupIds = selectedBeneficiaryGroups
            }
            if (datePickerValue.startDate) {
                filters.startDate = datePickerValue.startDate
            }
            if (datePickerValue.endDate) {
                filters.endDate = datePickerValue.endDate
            }
            if (datePickerValue.singleDate) {
                filters.startDate = datePickerValue.singleDate
                filters.endDate = datePickerValue.singleDate
            }
            if (searchQuery.trim()) {
                filters.search = searchQuery.trim()
            }
            const data = await apiService.getStories(initiativeId, filters)
            setStories(data || [])
        } catch (error) {
            console.error('Error loading stories:', error)
            toast.error('Failed to load stories')
            setStories([])
        } finally {
            setLoading(false)
        }
    }

    const handleAddStory = () => {
        setEditingStory(null)
        setIsAddModalOpen(true)
    }

    const handleViewStory = (story: Story) => {
        setSelectedStory(story)
        setIsDetailModalOpen(true)
    }

    const handleEditStory = (story: Story) => {
        setIsDetailModalOpen(false)
        setEditingStory(story)
        setIsAddModalOpen(true)
    }

    const handleDeleteStory = async (storyId: string) => {
        if (!confirm('Are you sure you want to delete this story?')) return
        try {
            await apiService.deleteStory(storyId)
            toast.success('Story deleted successfully')
            loadStories()
            onRefresh?.()
        } catch (error) {
            toast.error('Failed to delete story')
        }
    }

    const handleSaveStory = async () => {
        // Clear cache and reload stories immediately
        apiService.clearCache('/stories')
        await loadStories()
        onRefresh?.()
    }

    // Filter dropdown positioning - update when buttons are clicked
    useEffect(() => {
        if (showLocationPicker && locationButtonRef.current) {
            const rect = locationButtonRef.current.getBoundingClientRect()
            setLocationDropdownPosition({
                top: rect.bottom + 4,
                left: rect.left
            })
        }
    }, [showLocationPicker])

    useEffect(() => {
        if (showBeneficiaryPicker && beneficiaryButtonRef.current) {
            const rect = beneficiaryButtonRef.current.getBoundingClientRect()
            setBeneficiaryDropdownPosition({
                top: rect.bottom + 4,
                left: rect.left
            })
        }
    }, [showBeneficiaryPicker])

    const hasActiveFilters = selectedLocations.length > 0 || selectedBeneficiaryGroups.length > 0 || 
        datePickerValue.singleDate || (datePickerValue.startDate && datePickerValue.endDate)

    const clearFilters = () => {
        setSelectedLocations([])
        setSelectedBeneficiaryGroups([])
        setDatePickerValue({})
    }

    return (
        <div className="h-screen overflow-hidden">
            <div className="h-full w-full px-4 sm:px-6 py-6 overflow-y-auto mobile-content-padding">
                <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 overflow-hidden">
                    {/* Header with Search and Add Button */}
                    <div className="p-6 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">Stories</h2>
                                <p className="text-sm text-gray-500">Showcase your impact with photos and stories</p>
                            </div>
                            <button
                                onClick={handleAddStory}
                                className="flex items-center space-x-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl font-medium transition-colors shadow-bubble-sm"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Add Story</span>
                            </button>
                        </div>

                        {/* Search Bar */}
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search stories by title or description..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-gray-50/50 text-sm"
                            />
                        </div>

                {/* Master Filter */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Date Filter - First */}
                    <div className="relative">
                        <DateRangePicker
                            value={datePickerValue}
                            onChange={setDatePickerValue}
                            placeholder="Filter by date"
                            className="w-auto"
                        />
                    </div>

                    {/* Location Filter */}
                    <div className="relative">
                        <button
                            ref={locationButtonRef}
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setLocationDropdownPosition({
                                    top: rect.bottom + 4,
                                    left: rect.left
                                })
                                setShowLocationPicker(!showLocationPicker)
                                setShowBeneficiaryPicker(false)
                            }}
                            className={`flex items-center pl-0 pr-4 h-10 rounded-r-full rounded-l-full text-sm font-medium transition-all duration-200 border-2 border-l-0 shadow-bubble-sm ${
                                selectedLocations.length > 0
                                    ? 'bg-primary-50 border-primary-500 hover:bg-primary-100 text-gray-700'
                                    : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                selectedLocations.length > 0
                                    ? 'bg-primary-100 border-primary-500'
                                    : 'bg-gray-100 border-gray-200'
                            }`}>
                                <MapPin className={`w-5 h-5 ${
                                    selectedLocations.length > 0
                                        ? 'text-primary-500'
                                        : 'text-gray-600'
                                }`} />
                            </div>
                            <span className="ml-3">Location</span>
                            {selectedLocations.length > 0 && (
                                <span className="ml-1 bg-primary-500 text-white text-[10px] px-1 rounded-full">
                                    {selectedLocations.length}
                                </span>
                            )}
                            <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showLocationPicker ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* Beneficiary Filter */}
                    <div className="relative">
                        <button
                            ref={beneficiaryButtonRef}
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setBeneficiaryDropdownPosition({
                                    top: rect.bottom + 4,
                                    left: rect.left
                                })
                                setShowBeneficiaryPicker(!showBeneficiaryPicker)
                                setShowLocationPicker(false)
                            }}
                            className={`flex items-center pl-0 pr-4 h-10 rounded-r-full rounded-l-full text-sm font-medium transition-all duration-200 border-2 border-l-0 shadow-bubble-sm ${
                                selectedBeneficiaryGroups.length > 0
                                    ? 'bg-primary-50 border-primary-500 hover:bg-primary-100 text-gray-700'
                                    : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                            }`}
                        >
                            <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                selectedBeneficiaryGroups.length > 0
                                    ? 'bg-primary-100 border-primary-500'
                                    : 'bg-gray-100 border-gray-200'
                            }`}>
                                <Users className={`w-5 h-5 ${
                                    selectedBeneficiaryGroups.length > 0
                                        ? 'text-primary-500'
                                        : 'text-gray-600'
                                }`} />
                            </div>
                            <span className="ml-3">Beneficiary Group</span>
                            {selectedBeneficiaryGroups.length > 0 && (
                                <span className="ml-1 bg-primary-500 text-white text-[10px] px-1 rounded-full">
                                    {selectedBeneficiaryGroups.length}
                                </span>
                            )}
                            <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showBeneficiaryPicker ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center space-x-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded text-xs font-medium transition-colors border border-gray-200"
                        >
                            <X className="w-3 h-3" />
                            <span>Clear</span>
                        </button>
                    )}
                </div>

                {/* Location Dropdown */}
                {showLocationPicker && createPortal(
                    <>
                        <div className="fixed inset-0 z-[9998]" onClick={() => setShowLocationPicker(false)} />
                        <div
                            className="fixed bg-white border border-gray-100 rounded-xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] z-[9999] p-3 min-w-[200px] max-h-64 overflow-y-auto"
                            style={{
                                top: `${locationDropdownPosition.top}px`,
                                left: `${locationDropdownPosition.left}px`
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {locations.length === 0 ? (
                                <p className="text-xs text-gray-500">No locations available</p>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">Select Locations</span>
                                        {selectedLocations.length > 0 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setSelectedLocations([])
                                                }}
                                                className="text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                    {locations.map((location) => (
                                        <label
                                            key={location.id}
                                            className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedLocations.includes(location.id!)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedLocations([...selectedLocations, location.id!])
                                                    } else {
                                                        setSelectedLocations(selectedLocations.filter(id => id !== location.id))
                                                    }
                                                }}
                                                className="w-3 h-3 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                                            />
                                            <span className="text-xs text-gray-700 truncate flex-1">{location.name}</span>
                                        </label>
                                    ))}
                                </>
                            )}
                        </div>
                    </>,
                    document.body
                )}

                {/* Beneficiary Dropdown */}
                {showBeneficiaryPicker && createPortal(
                    <>
                        <div className="fixed inset-0 z-[9998]" onClick={() => setShowBeneficiaryPicker(false)} />
                        <div
                            className="fixed bg-white border border-gray-100 rounded-xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] z-[9999] p-3 min-w-[200px] max-h-64 overflow-y-auto"
                            style={{
                                top: `${beneficiaryDropdownPosition.top}px`,
                                left: `${beneficiaryDropdownPosition.left}px`
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {beneficiaryGroups.length === 0 ? (
                                <p className="text-xs text-gray-500">No beneficiary groups available</p>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">Select Beneficiary Groups</span>
                                        {selectedBeneficiaryGroups.length > 0 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setSelectedBeneficiaryGroups([])
                                                }}
                                                className="text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                    {beneficiaryGroups.map((group) => (
                                        <label
                                            key={group.id}
                                            className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedBeneficiaryGroups.includes(group.id!)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedBeneficiaryGroups([...selectedBeneficiaryGroups, group.id!])
                                                    } else {
                                                        setSelectedBeneficiaryGroups(selectedBeneficiaryGroups.filter(id => id !== group.id))
                                                    }
                                                }}
                                                className="w-3 h-3 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                                            />
                                            <span className="text-xs text-gray-700 truncate flex-1">{group.name}</span>
                                        </label>
                                    ))}
                                </>
                            )}
                        </div>
                    </>,
                    document.body
                )}
                    </div>

                    {/* Stories Grid */}
                    <div className="p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : stories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <p className="text-lg font-medium mb-2">No stories yet</p>
                        <p className="text-sm mb-4">Add your first story to showcase your impact</p>
                        <button
                            onClick={handleAddStory}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                            Add Story
                        </button>
                    </div>
                ) : (
                    <div className="flex justify-center">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-0.5 gap-y-0 max-w-7xl items-stretch">
                            {stories.map((story) => (
                                <StoryCard
                                    key={story.id}
                                    story={story}
                                    onView={handleViewStory}
                                />
                            ))}
                        </div>
                    </div>
                )}
                    </div>
                </div>
            </div>

            {/* Story Detail Modal */}
            {isDetailModalOpen && (
                <StoryDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => {
                        setIsDetailModalOpen(false)
                        setSelectedStory(null)
                    }}
                    story={selectedStory}
                    onEdit={handleEditStory}
                    onDelete={handleDeleteStory}
                />
            )}

            {/* Add/Edit Story Modal */}
            {isAddModalOpen && (
                <AddStoryModal
                    isOpen={isAddModalOpen}
                    onClose={() => {
                        setIsAddModalOpen(false)
                        setEditingStory(null)
                    }}
                    onSubmit={handleSaveStory}
                    initiativeId={initiativeId}
                    editData={editingStory}
                />
            )}
        </div>
    )
}

