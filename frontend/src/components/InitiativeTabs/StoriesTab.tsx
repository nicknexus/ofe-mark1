import React, { useState, useEffect } from 'react'
import { Plus, Search, X, MapPin, Users, Tag as TagIcon } from 'lucide-react'
import { apiService } from '../../services/api'
import { Story, Location, BeneficiaryGroup, MetricTag } from '../../types'
import StoryCard from '../StoryCard'
import AddStoryModal from '../AddStoryModal'
import StoryDetailModal from '../StoryDetailModal'
import DateRangePicker from '../DateRangePicker'
import ConfirmDialog from '../ConfirmDialog'
import FilterPill from '../shared/FilterPill'
import { useTeam } from '../../context/TeamContext'
import { notify } from '../../lib/notify'
import { SectionLoader, EmptyState } from '../ui'

interface StoriesTabProps {
 initiativeId: string
 onRefresh?: () => void
 initialStoryId?: string // Story ID to open when tab loads
}

export default function StoriesTab({ initiativeId, onRefresh, initialStoryId }: StoriesTabProps) {
 const { canEditStories } = useTeam()
 const [stories, setStories] = useState<Story[]>([])
 const [loading, setLoading] = useState(false)
 const [locations, setLocations] = useState<Location[]>([])
 const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
 const [isAddModalOpen, setIsAddModalOpen] = useState(false)
 const [editingStory, setEditingStory] = useState<Story | null>(null)
 const [selectedStory, setSelectedStory] = useState<Story | null>(null)
 const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
 const [searchQuery, setSearchQuery] = useState('')
 const [deleteStoryId, setDeleteStoryId] = useState<string | null>(null)

 // Master filter state
 const [datePickerValue, setDatePickerValue] = useState<{
 singleDate?: string
 startDate?: string
 endDate?: string
 }>({})
 const [selectedLocations, setSelectedLocations] = useState<string[]>([])
 const [selectedBeneficiaryGroups, setSelectedBeneficiaryGroups] = useState<string[]>([])
 const [selectedTags, setSelectedTags] = useState<string[]>([])
 const [allTags, setAllTags] = useState<MetricTag[]>([])

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

 // Load org-wide metric tags for the tag filter.
 useEffect(() => {
 apiService.getMetricTags()
 .then((tags) => setAllTags(tags || []))
 .catch(() => setAllTags([]))
 }, [])

 // Load stories with filters
 useEffect(() => {
 loadStories()
 }, [initiativeId, selectedLocations, selectedBeneficiaryGroups, selectedTags, datePickerValue, searchQuery])

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
 if (selectedTags.length > 0) {
 filters.tagIds = selectedTags
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
 notify.error('Failed to load stories')
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
 try {
 await apiService.deleteStory(storyId)
 notify.success('Story deleted successfully')
 setDeleteStoryId(null)
 setIsDetailModalOpen(false)
 setSelectedStory(null)
 loadStories()
 onRefresh?.()
 } catch (error) {
 notify.error('Failed to delete story')
 }
 }

 const handleSaveStory = async () => {
 // Clear cache and reload stories immediately
 apiService.clearCache('/stories')
 await loadStories()
 onRefresh?.()
 }

 const hasActiveFilters = selectedLocations.length > 0 || selectedBeneficiaryGroups.length > 0 ||
   selectedTags.length > 0 ||
   datePickerValue.singleDate || (datePickerValue.startDate && datePickerValue.endDate)

 const clearFilters = () => {
   setSelectedLocations([])
   setSelectedBeneficiaryGroups([])
   setSelectedTags([])
   setDatePickerValue({})
 }

 return (
   <div className="h-screen overflow-hidden flex flex-col mobile-content-padding">
     {/* Header + filters */}
     <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-gray-100 bg-white space-y-3 flex-shrink-0">
       <div className="flex items-center justify-between gap-3">
         <div className="min-w-0">
           <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 leading-tight tracking-tight">Stories</h2>
           <p className="text-sm text-gray-500 mt-1 hidden sm:block">Showcase your impact with photos and stories</p>
         </div>
         {canEditStories && (
           <button type="button" onClick={handleAddStory} className="app-btn app-btn-primary app-btn-lg shadow-sm flex-shrink-0">
             <Plus className="w-5 h-5" />
             <span>Add Story</span>
           </button>
         )}
       </div>

       <div className="relative max-w-sm">
         <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
         <input
           type="text"
           placeholder="Search stories by title or description…"
           value={searchQuery}
           onChange={(e) => setSearchQuery(e.target.value)}
           className="w-full h-9 pl-10 pr-3 bg-white border border-gray-200 rounded-full text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
         />
       </div>

       <div className="flex flex-wrap items-center gap-2">
         <DateRangePicker
           value={datePickerValue}
           onChange={setDatePickerValue}
           placeholder="Date"
           variant="pill"
         />
         <FilterPill
           icon={MapPin}
           label="Location"
           pluralLabel="locations"
           options={locations.map(l => ({ id: l.id!, name: l.name }))}
           selected={selectedLocations}
           onChange={setSelectedLocations}
           emptyText="No locations available"
         />
         {allTags.length > 0 && (
           <FilterPill
             icon={TagIcon}
             label="Tag"
             pluralLabel="tags"
             options={allTags.map(t => ({ id: t.id, name: t.name }))}
             selected={selectedTags}
             onChange={setSelectedTags}
             emptyText="No tags available"
           />
         )}
         <FilterPill
           icon={Users}
           label="Group"
           pluralLabel="groups"
           options={beneficiaryGroups.map(g => ({ id: g.id!, name: g.name }))}
           selected={selectedBeneficiaryGroups}
           onChange={setSelectedBeneficiaryGroups}
           emptyText="No beneficiary groups available"
         />
         {hasActiveFilters && (
           <button
             onClick={clearFilters}
             className="inline-flex items-center gap-1 h-9 px-3 rounded-full text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
           >
             <X className="w-3.5 h-3.5" />
             Clear all
           </button>
         )}
       </div>
     </div>

     {/* Stories grid */}
     <div className="flex-1 bg-gray-50 px-4 sm:px-6 py-4 overflow-y-auto min-h-0">
       {loading ? (
         <SectionLoader className="h-64" />
       ) : stories.length === 0 ? (
         <div className="rounded-2xl border border-gray-200/70 bg-white shadow-card md:p-8">
           <EmptyState
             title="No stories yet"
             description="Add your first story to showcase your impact"
             action={canEditStories ? (
               <button type="button" onClick={handleAddStory} className="app-btn app-btn-primary">
                 Add Story
               </button>
             ) : undefined}
             className="min-h-[16rem]"
           />
         </div>
       ) : (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
           {stories.map((story) => (
             <StoryCard key={story.id} story={story} onView={handleViewStory} />
           ))}
         </div>
       )}
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
 onEdit={canEditStories ? handleEditStory : undefined}
 onDelete={canEditStories ? setDeleteStoryId : undefined}
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

 {deleteStoryId && (
 <ConfirmDialog
 title="Delete Story"
 message={`Delete ${stories.find(story => story.id === deleteStoryId)?.title || 'this story'}? This action cannot be undone.`}
 confirmLabel="Delete Story"
 tone="danger"
 onConfirm={() => handleDeleteStory(deleteStoryId)}
 onCancel={() => setDeleteStoryId(null)}
 />
 )}
 </div>
 )
}
