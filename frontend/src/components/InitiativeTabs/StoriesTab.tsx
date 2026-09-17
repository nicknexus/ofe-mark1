import React, { useState, useEffect } from 'react'
import { Plus, Search, X, MapPin, Users, Tag as TagIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiService } from '../../services/api'
import { Story, Location, BeneficiaryGroup, MetricTag, KPI } from '../../types'
import { tagsOnProgramMetrics } from '../../utils/programTags'
import StoryCard from '../StoryCard'
import AddStoryModal from '../AddStoryModal'
import StoryDetailModal from '../StoryDetailModal'
import DateRangePicker from '../DateRangePicker'
import ConfirmDialog from '../ConfirmDialog'
import FilterPill from '../shared/FilterPill'
import FiltersToggle from '../shared/FiltersToggle'
import { useTeam } from '../../context/TeamContext'
import { notify } from '../../lib/notify'
import { SectionLoader, EmptyState } from '../ui'

interface StoriesTabProps {
 initiativeId: string
 onRefresh?: () => void
 initialStoryId?: string // Story ID to open when tab loads
}

export default function StoriesTab({ initiativeId, onRefresh, initialStoryId }: StoriesTabProps) {
 const { canAddStories, canEditStories } = useTeam()
 const [stories, setStories] = useState<Story[]>([])
 const [loading, setLoading] = useState(false)
 const [locations, setLocations] = useState<Location[]>([])
 const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
 const [isAddModalOpen, setIsAddModalOpen] = useState(false)
 const [editingStory, setEditingStory] = useState<Story | null>(null)
 const [selectedStory, setSelectedStory] = useState<Story | null>(null)
 const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
 const [searchQuery, setSearchQuery] = useState('')
 const [filtersOpen, setFiltersOpen] = useState(false)
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
 const [programKpis, setProgramKpis] = useState<KPI[]>([])

 // Load locations and beneficiary groups
 useEffect(() => {
 if (initiativeId) {
 Promise.all([
 apiService.getLocations(initiativeId),
 apiService.getBeneficiaryGroups(initiativeId),
 apiService.getMetricTags().catch(() => [] as MetricTag[]),
 apiService.getKPIs(initiativeId).catch(() => [] as KPI[]),
 ]).then(([locs, groups, tags, kpis]) => {
 setLocations(locs || [])
 setBeneficiaryGroups(groups || [])
 setAllTags(tags || [])
 setProgramKpis(kpis || [])
 }).catch(() => {
 setLocations([])
 setBeneficiaryGroups([])
 setAllTags([])
 setProgramKpis([])
 })
 }
 }, [initiativeId])

 const programTags = tagsOnProgramMetrics(allTags, programKpis)

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

 const filterCount =
   (selectedLocations.length ? 1 : 0) +
   (selectedBeneficiaryGroups.length ? 1 : 0) +
   (selectedTags.length ? 1 : 0) +
   (datePickerValue.singleDate || (datePickerValue.startDate && datePickerValue.endDate) ? 1 : 0)

 const clearFilters = () => {
   setSelectedLocations([])
   setSelectedBeneficiaryGroups([])
   setSelectedTags([])
   setDatePickerValue({})
 }

 return (
   <div className="h-full overflow-hidden flex flex-col mobile-content-padding">
     {/* Header + filters */}
     <div className="px-4 sm:px-6 pt-2.5 pb-2 border-b border-gray-100 bg-white space-y-2 flex-shrink-0">
       <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
         <div className="relative flex-1 min-w-[140px] max-w-sm">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
           <input
             type="text"
             placeholder="Search stories"
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
             className="w-full h-8 pl-9 pr-8 bg-white border border-gray-200 rounded-full text-xs md:text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
           />
           {searchQuery && (
             <button
               type="button"
               onClick={() => setSearchQuery('')}
               className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
               aria-label="Clear search"
             >
               <X className="w-3.5 h-3.5" />
             </button>
           )}
         </div>
         <div className="ml-auto flex items-center gap-2 flex-shrink-0">
           <FiltersToggle
             open={filtersOpen}
             count={filterCount}
             onClick={() => setFiltersOpen(o => !o)}
             title="Filter by date, location, tag, or group"
           />
           {canAddStories && (
             <button type="button" onClick={handleAddStory} className="app-btn app-btn-sm app-btn-primary shadow-sm">
               <Plus className="w-4 h-4" />
               <span className="hidden sm:inline">Add story</span>
               <span className="sm:hidden">Add</span>
             </button>
           )}
         </div>
       </div>

       <AnimatePresence initial={false}>
         {filtersOpen && (
           <motion.div
             key="filters"
             initial={{ height: 0, opacity: 0 }}
             animate={{ height: 'auto', opacity: 1 }}
             exit={{ height: 0, opacity: 0 }}
             transition={{ duration: 0.18, ease: 'easeOut' }}
             className="overflow-hidden"
           >
             <div className="flex flex-wrap items-center gap-2 pt-1">
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
               {programTags.length > 0 && (
                 <FilterPill
                   icon={TagIcon}
                   label="Tag"
                   pluralLabel="tags"
                   options={programTags.map(t => ({ id: t.id, name: t.name }))}
                   selected={selectedTags}
                   onChange={setSelectedTags}
                   emptyText="No tags on this program's metrics"
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
                   className="inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                 >
                   <X className="w-3.5 h-3.5" />
                   Clear
                 </button>
               )}
             </div>
           </motion.div>
         )}
       </AnimatePresence>
     </div>

     {/* Stories grid */}
     <div className="flex-1 bg-gray-50 px-4 sm:px-6 pt-2.5 pb-4 overflow-y-auto min-h-0">
       {loading ? (
         <SectionLoader className="h-64" />
       ) : stories.length === 0 ? (
         <div className="rounded-2xl border border-gray-200/70 bg-white shadow-card md:p-8">
           <EmptyState
             title="No stories yet"
             description="Add your first story to showcase your impact"
             action={canAddStories ? (
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
