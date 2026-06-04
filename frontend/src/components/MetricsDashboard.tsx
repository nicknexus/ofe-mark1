import React, { useState, useEffect, useRef } from 'react'
import { TrendingUp, Target, BarChart3, Calendar, FileText, Filter, ChevronDown, X, MapPin, ExternalLink, Plus, Users, Upload } from 'lucide-react'
import { useTeam } from '../context/TeamContext'
import { createPortal } from 'react-dom'
import {
 DndContext,
 closestCenter,
 KeyboardSensor,
 PointerSensor,
 useSensor,
 useSensors,
 DragEndEvent,
} from '@dnd-kit/core'
import {
 arrayMove,
 SortableContext,
 sortableKeyboardCoordinates,
 horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
 LineChart,
 Line,
 XAxis,
 YAxis,
 ResponsiveContainer,
 Tooltip,
 CartesianGrid,
 Legend,
 ReferenceLine
} from 'recharts'
import LocationMap from './LocationMap'
import AllLocationsModal from './AllLocationsModal'
import DateRangePicker from './DateRangePicker'
import { apiService } from '../services/api'
import { Location, BeneficiaryGroup, User, Organization } from '../types'
import { AuthService } from '../services/auth'
import { getCategoryColor, getLocalDateString, formatDate } from '../utils'
import { aggregateKpiUpdates } from '../utils/kpiAggregation'
import { notify } from '../lib/notify'
import { SortableMetricCard } from './metricsDashboard/SortableMetricCard'
import { getKPIColor } from './metricsDashboard/metricColorPalette'
import { filterDashboardKpiUpdates, computeFilteredTotals } from './metricsDashboard/filterDashboardKpiUpdates'
import { generateMetricsDashboardChartData } from './metricsDashboard/generateMetricsDashboardChartData'
import {
 getMetricsDashboardXAxisInterval,
 formatMetricsDashboardXAxisTick,
} from './metricsDashboard/metricsDashboardChartAxis'
import {
 calculateMultiKpiMaxWithHeadroom,
 computeMultiKpiActualMax,
 generateMultiKpiYTicks,
 computeDashboardPercentageYAxis,
} from './metricsDashboard/metricsDashboardChartDomain'
import { MetricsDashboardPercentageTooltip } from './metricsDashboard/MetricsDashboardPercentageTooltip'

interface MetricsDashboardProps {
 kpis: any[]
 kpiTotals: Record<string, number>
 stats: {
 total_kpis: number
 evidence_coverage_percentage: number
 recent_updates: number
 total_evidence?: number
 }
 kpiUpdates?: any[]
 initiativeId?: string
 onNavigateToLocations?: () => void
 onMetricCardClick?: (kpiId: string) => void
 onAddKPI?: () => void
 onStoryClick?: (storyId: string) => void
 user?: User | null
 organization?: Organization | null
 onOrderChange?: (orderedIds: string[]) => void
 onAddImpactClaim?: () => void
 onAddEvidence?: () => void
}

export default function MetricsDashboard({ kpis, kpiTotals, stats, kpiUpdates = [], initiativeId, onNavigateToLocations, onMetricCardClick, onAddKPI, onStoryClick, user, organization, onOrderChange, onAddImpactClaim, onAddEvidence }: MetricsDashboardProps) {
 const { canAddImpactClaims, canEditEvidence, canEditMetrics, ownedOrganization, hasOwnOrganization } = useTeam()
 const [timeFrame, setTimeFrame] = useState<'all' | '1month' | '6months' | '1year' | '5years'>('all')
 const [isCumulative, setIsCumulative] = useState(false)
 const [isPercentageMode, setIsPercentageMode] = useState(false)
 // Tracks whether the user has manually picked a graph mode. If they have,
 // the auto-toggle (based on kpi mix) stops fighting them.
 const userPickedGraphModeRef = useRef(false)
 const [visibleKPIs, setVisibleKPIs] = useState<Set<string>>(new Set())
 const [orderedKPIs, setOrderedKPIs] = useState<any[]>([])

 // Initialize ordered KPIs from props, sorted by display_order
 useEffect(() => {
 const sorted = [...kpis].sort((a, b) => {
 const orderA = a.display_order ?? 0
 const orderB = b.display_order ?? 0
 return orderA - orderB
 })
 setOrderedKPIs(sorted)
 // Notify parent of initial order
 if (onOrderChange) {
 onOrderChange(sorted.map(k => k.id))
 }
 }, [kpis, onOrderChange])

 // Auto-pick the graph mode based on the kpi mix until the user picks one
 // manually. If every metric is a percentage metric, default to Percentages;
 // otherwise default to Monthly.
 useEffect(() => {
 if (userPickedGraphModeRef.current) return
 if (!kpis || kpis.length === 0) return
 const allPercentage = kpis.every(k => k.metric_type === 'percentage')
 setIsPercentageMode(allPercentage)
 if (allPercentage) setIsCumulative(false)
 }, [kpis])

 // Drag and drop sensors
 const sensors = useSensors(
 useSensor(PointerSensor, {
 activationConstraint: {
 distance: 8,
 },
 }),
 useSensor(KeyboardSensor, {
 coordinateGetter: sortableKeyboardCoordinates,
 })
 )

 // Handle drag end
 const handleDragEnd = async (event: DragEndEvent) => {
 if (!canEditMetrics) return
 const { active, over } = event

 if (!over || active.id === over.id) return

 const oldIndex = orderedKPIs.findIndex((kpi) => kpi.id === active.id)
 const newIndex = orderedKPIs.findIndex((kpi) => kpi.id === over.id)

 if (oldIndex === -1 || newIndex === -1) return

 const newOrderedKPIs = arrayMove(orderedKPIs, oldIndex, newIndex)
 setOrderedKPIs(newOrderedKPIs)

 // Notify parent of new order immediately
 if (onOrderChange) {
 onOrderChange(newOrderedKPIs.map(k => k.id))
 }

 // Update display_order in backend
 if (initiativeId) {
 try {
 const order = newOrderedKPIs.map((kpi, index) => ({
 id: kpi.id!,
 display_order: index,
 }))
 await apiService.updateKPIOrder(order)
 } catch (error) {
 console.error('Failed to update KPI order:', error)
 notify.error('Failed to save order')
 // Revert on error
 setOrderedKPIs(orderedKPIs)
 if (onOrderChange) {
 onOrderChange(orderedKPIs.map(k => k.id))
 }
 }
 }
 }
 const [locations, setLocations] = useState<Location[]>([])
 const [mapRefreshKey, setMapRefreshKey] = useState(0) // Key to trigger map refresh
 const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
 const [benGroupDerivedLocations, setBenGroupDerivedLocations] = useState<Record<string, string[]>>({})
 const [updateBeneficiaryGroupsCache, setUpdateBeneficiaryGroupsCache] = useState<Record<string, string[]>>({})

 // Master filter state
 const [datePickerValue, setDatePickerValue] = useState<{
 singleDate?: string
 startDate?: string
 endDate?: string
 }>({})
 const [selectedLocations, setSelectedLocations] = useState<string[]>([])
 const [selectedBeneficiaryGroups, setSelectedBeneficiaryGroups] = useState<string[]>([])
 const [selectedTags, setSelectedTags] = useState<string[]>([])
 const [showAllLocationsModal, setShowAllLocationsModal] = useState(false)
 const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([])
 const [showLocationPicker, setShowLocationPicker] = useState(false)
 const [showBeneficiaryPicker, setShowBeneficiaryPicker] = useState(false)
 const [showTagPicker, setShowTagPicker] = useState(false)
 const [showMetricsPicker, setShowMetricsPicker] = useState(false)
 const locationButtonRef = React.useRef<HTMLButtonElement>(null)
 const beneficiaryButtonRef = React.useRef<HTMLButtonElement>(null)
 const tagButtonRef = React.useRef<HTMLButtonElement>(null)
 const metricsButtonRef = React.useRef<HTMLButtonElement>(null)
 const [locationDropdownPosition, setLocationDropdownPosition] = useState({ top: 0, left: 0 })
 const [beneficiaryDropdownPosition, setBeneficiaryDropdownPosition] = useState({ top: 0, left: 0 })
 const [tagDropdownPosition, setTagDropdownPosition] = useState({ top: 0, left: 0 })
 const [metricsDropdownPosition, setMetricsDropdownPosition] = useState({ top: 0, left: 0 })
 const [userMenuOpen, setUserMenuOpen] = useState(false)
 const userMenuRef = useRef<HTMLDivElement>(null)

 // Close user menu when clicking outside
 useEffect(() => {
 const handleClickOutside = (event: MouseEvent) => {
 if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
 setUserMenuOpen(false)
 }
 }
 if (userMenuOpen) {
 document.addEventListener('mousedown', handleClickOutside)
 }
 return () => {
 document.removeEventListener('mousedown', handleClickOutside)
 }
 }, [userMenuOpen])

 const handleSignOut = async () => {
 try {
 await AuthService.signOut()
 notify.success('Signed out successfully')
 } catch (error) {
 notify.error('Failed to sign out')
 }
 }

 // Load locations
 useEffect(() => {
 if (initiativeId) {
 apiService.getLocations(initiativeId)
 .then((locs) => setLocations(locs || []))
 .catch(() => setLocations([]))
 }
 }, [initiativeId])

 // Load metric tags (org-wide)
 useEffect(() => {
 apiService.getMetricTags()
 .then((tags) => setAllTags((tags || []).map((t: any) => ({ id: t.id, name: t.name }))))
 .catch(() => setAllTags([]))
 }, [])

 // Load beneficiary groups and their derived locations
 useEffect(() => {
 if (initiativeId) {
 apiService.getBeneficiaryGroups(initiativeId)
 .then((groups) => {
 setBeneficiaryGroups(groups || [])
 const groupIds = (groups || []).map(g => g.id!).filter(Boolean)
 if (groupIds.length > 0) {
 apiService.getBulkDerivedLocations(groupIds)
 .then(locs => setBenGroupDerivedLocations(locs || {}))
 .catch(() => setBenGroupDerivedLocations({}))
 }
 })
 .catch(() => setBeneficiaryGroups([]))
 }
 }, [initiativeId])

 // Build ben group cache from kpiUpdates (beneficiary_group_ids now included in getUpdates response)
 useEffect(() => {
 if (kpiUpdates.length === 0) return
 const cache: Record<string, string[]> = {}
 for (const update of kpiUpdates) {
 if (update.id) {
 cache[update.id] = (update as any).beneficiary_group_ids || []
 }
 }
 setUpdateBeneficiaryGroupsCache(cache)
 }, [kpiUpdates])

 // Refresh map when kpiUpdates change (indicating updates/evidence were modified)
 const updateIdsHash = React.useMemo(() => {
 return kpiUpdates.map((u: any) => u.id).sort().join(',')
 }, [kpiUpdates])

 useEffect(() => {
 // Increment refresh key when updates change
 setMapRefreshKey(prev => prev + 1)
 }, [updateIdsHash]) // Trigger refresh when update IDs change

 // Initialize visible KPIs with all KPIs when component mounts or kpis change
 useEffect(() => {
 if (kpis && kpis.length > 0) {
 setVisibleKPIs(new Set(kpis.map(kpi => kpi.id)))
 }
 }, [kpis, selectedLocations])

 const toggleKPI = (kpiId: string) => {
 setVisibleKPIs(prev => {
 const newSet = new Set(prev)
 if (newSet.has(kpiId)) {
 newSet.delete(kpiId)
 } else {
 newSet.add(kpiId)
 }
 return newSet
 })
 }

 const toggleAllKPIs = () => {
 if (visibleKPIs.size === kpis.length) {
 // If all are visible, hide all
 setVisibleKPIs(new Set())
 } else {
 // Show all
 setVisibleKPIs(new Set(kpis.map(kpi => kpi.id)))
 }
 }

 const filteredUpdates = filterDashboardKpiUpdates({
 kpiUpdates,
 datePickerValue,
 selectedLocations,
 selectedBeneficiaryGroups,
 selectedTags,
 updateBeneficiaryGroupsCache,
 })
 const filteredKPIs = kpis
 const filteredTotals = computeFilteredTotals(filteredUpdates, filteredKPIs)
 const chartData = generateMetricsDashboardChartData({
 filteredUpdates,
 filteredKPIs,
 kpis,
 visibleKPIs,
 datePickerValue,
 timeFrame,
 isCumulative,
 isPercentageMode,
 })

 const xAxisInterval = getMetricsDashboardXAxisInterval({
 timeFrame,
 datePickerValue,
 chartData,
 isCumulative,
 isPercentageMode,
 })
 const formatXAxisTickBound = (dateStr: string) => formatMetricsDashboardXAxisTick(chartData, dateStr)

 const displayKPIs = orderedKPIs.filter(kpi => filteredKPIs.some(fk => fk.id === kpi.id)).slice(0, 12)

 const chartKpiIds = new Set<string>(
 kpis
 .filter((kpi: any) => visibleKPIs.has(kpi.id) && kpi.metric_type !== 'percentage')
 .map((kpi: any) => kpi.id as string)
 )

 const maxDomainValue = calculateMultiKpiMaxWithHeadroom(chartData, chartKpiIds)
 const actualMaxValue = computeMultiKpiActualMax(chartData, chartKpiIds)
 const yTicks = generateMultiKpiYTicks(maxDomainValue, actualMaxValue)

 const visiblePercentageKpis = isPercentageMode
 ? kpis.filter(k => k.metric_type === 'percentage' && visibleKPIs.has(k.id))
 : []
 const percentageAveragesById: Record<string, number> = {}
 if (isPercentageMode) {
 visiblePercentageKpis.forEach(k => {
 const updates = (kpiUpdates || []).filter((u: any) => u.kpi_id === k.id)
 percentageAveragesById[k.id] = aggregateKpiUpdates(updates as any, k.metric_type)
 })
 }
 const { percentageYMax, percentageYTicks } = computeDashboardPercentageYAxis({
 isPercentageMode,
 chartData,
 visiblePercentageKpis,
 })

 if (isPercentageMode) {
 for (const d of chartData) {
 visiblePercentageKpis.forEach(k => {
 ;(d as any)[`${k.id}__avg`] = percentageAveragesById[k.id] || 0
 })
 }
 }

 return (
 <div className="h-full flex flex-col overflow-hidden px-4 pt-4 pb-4 space-y-4">
 {/* Master Filter Bar */}
 <div className="bg-transparent p-3 flex items-center justify-between gap-2 flex-shrink-0">
 <div className="flex items-center space-x-2 flex-1 min-w-0">
 {/* Date Filter */}
 <div className="relative shrink-0">
 <DateRangePicker
 value={datePickerValue}
 onChange={setDatePickerValue}
 maxDate={getLocalDateString(new Date())}
 placeholder="Filter by date"
 className="w-auto"
 />
 </div>

 {/* Metrics Filter */}
 <div className="relative shrink-0">
 <button
 ref={metricsButtonRef}
 onClick={(e) => {
 const rect = e.currentTarget.getBoundingClientRect()
 setMetricsDropdownPosition({
 top: rect.bottom + 4,
 left: rect.left
 })
 setShowMetricsPicker(!showMetricsPicker)
 setShowLocationPicker(false)
 setShowBeneficiaryPicker(false)
 setShowTagPicker(false)
 }}
 className={`flex items-center pl-0 pr-3 h-8 rounded-r-full rounded-l-full text-xs font-medium transition-all duration-200 border-2 border-l-0 whitespace-nowrap shrink-0 ${visibleKPIs.size > 0 && visibleKPIs.size < kpis.length
 ? 'bg-primary-50 border-primary-500 hover:bg-primary-100 text-gray-700'
 : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
 }`}
 >
 <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${visibleKPIs.size > 0 && visibleKPIs.size < kpis.length
 ? 'bg-primary-100 border-primary-500'
 : 'bg-gray-100 border-gray-200'
 }`}>
 <Filter className={`w-4 h-4 ${visibleKPIs.size > 0 && visibleKPIs.size < kpis.length
 ? 'text-primary-500'
 : 'text-gray-600'
 }`} />
 </div>
 <span className="ml-2">Metrics</span>
 {visibleKPIs.size > 0 && visibleKPIs.size < kpis.length && (
 <span className="ml-1 app-chip app-chip-accent text-xs px-1.5 py-0">
 {visibleKPIs.size}
 </span>
 )}
 <ChevronDown className={`w-3 h-3 transition-transform ${showMetricsPicker ? 'rotate-180' : ''}`} />
 </button>
 {showMetricsPicker && createPortal(
 <>
 <div className="fixed inset-0 z-[9998]" onClick={() => setShowMetricsPicker(false)} />
 <div
 className="fixed bg-white border border-gray-100 rounded-xl shadow-modal z-[9999] p-3 min-w-[200px] max-h-64 overflow-y-auto"
 style={{
 top: `${metricsDropdownPosition.top}px`,
 left: `${metricsDropdownPosition.left}px`
 }}
 onClick={(e) => e.stopPropagation()}
 >
 {kpis.length === 0 ? (
 <p className="text-xs text-gray-500">No metrics available</p>
 ) : (
 <>
 <div className="flex items-center justify-between mb-2">
 <span className="text-xs font-semibold text-gray-700">Select Metrics</span>
 {visibleKPIs.size > 0 && (
 <button
 onClick={(e) => {
 e.stopPropagation()
 toggleAllKPIs()
 }}
 className="text-xs text-primary-700 hover:text-primary-800"
 >
 {visibleKPIs.size === kpis.length ? 'Deselect All' : 'Select All'}
 </button>
 )}
 </div>
 {kpis.map((kpi, index) => (
 <label
 key={kpi.id}
 className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
 >
 <input
 type="checkbox"
 checked={visibleKPIs.has(kpi.id)}
 onChange={() => toggleKPI(kpi.id)}
 className="w-3 h-3 text-primary-700 border-gray-300 rounded focus:ring-primary-500"
 style={{ accentColor: getKPIColor(kpi.category, index) }}
 />
 <div
 className="w-2 h-2 rounded-full flex-shrink-0"
 style={{ backgroundColor: getKPIColor(kpi.category, index) }}
 />
 <span className="text-xs text-gray-700 truncate flex-1">
 {kpi.title}
 </span>
 </label>
 ))}
 </>
 )}
 </div>
 </>,
 document.body
 )}
 </div>

 {/* Location Filter */}
 <div className="relative shrink-0">
 <button
 ref={locationButtonRef}
 onClick={(e) => {
 const rect = e.currentTarget.getBoundingClientRect()
 setLocationDropdownPosition({
 top: rect.bottom + 4,
 left: rect.left
 })
 setShowLocationPicker(!showLocationPicker)
 setShowMetricsPicker(false)
 setShowBeneficiaryPicker(false)
 setShowTagPicker(false)
 }}
 className={`flex items-center pl-0 pr-3 h-8 rounded-r-full rounded-l-full text-xs font-medium transition-all duration-200 border-2 border-l-0 whitespace-nowrap shrink-0 ${selectedLocations.length > 0
 ? 'bg-primary-50 border-primary-500 hover:bg-primary-100 text-gray-700'
 : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
 }`}
 >
 <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${selectedLocations.length > 0
 ? 'bg-primary-100 border-primary-500'
 : 'bg-gray-100 border-gray-200'
 }`}>
 <MapPin className={`w-4 h-4 ${selectedLocations.length > 0
 ? 'text-primary-500'
 : 'text-gray-600'
 }`} />
 </div>
 <span className="ml-2">Location</span>
 {selectedLocations.length > 0 && (
 <span className="ml-1 app-chip app-chip-accent text-xs px-1.5 py-0">
 {selectedLocations.length}
 </span>
 )}
 <ChevronDown className={`w-3 h-3 transition-transform ${showLocationPicker ? 'rotate-180' : ''}`} />
 </button>
 {showLocationPicker && createPortal(
 <>
 <div className="fixed inset-0 z-[9998]" onClick={() => setShowLocationPicker(false)} />
 <div
 className="fixed bg-white border border-gray-200 rounded-lg shadow-modal z-[9999] p-2 min-w-[200px] max-h-64 overflow-y-auto"
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
 className="text-xs text-primary-700 hover:text-primary-800"
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
 <span className="text-xs text-gray-700 truncate flex-1">
 {location.name}
 </span>
 </label>
 ))}
 </>
 )}
 </div>
 </>,
 document.body
 )}
 </div>

 {/* Tag Filter */}
 <div className="relative shrink-0">
 <button
 ref={tagButtonRef}
 onClick={(e) => {
 const rect = e.currentTarget.getBoundingClientRect()
 setTagDropdownPosition({ top: rect.bottom + 4, left: rect.left })
 setShowTagPicker(!showTagPicker)
 setShowLocationPicker(false)
 setShowBeneficiaryPicker(false)
 setShowMetricsPicker(false)
 }}
 className={`flex items-center pl-0 pr-3 h-8 rounded-r-full rounded-l-full text-xs font-medium transition-all duration-200 border-2 border-l-0 whitespace-nowrap shrink-0 ${selectedTags.length > 0
 ? 'bg-primary-50 border-primary-500 hover:bg-primary-100 text-gray-700'
 : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
 }`}
 >
 <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${selectedTags.length > 0
 ? 'bg-primary-100 border-primary-500'
 : 'bg-gray-100 border-gray-200'
 }`}>
 <Filter className={`w-4 h-4 ${selectedTags.length > 0 ? 'text-primary-500' : 'text-gray-600'}`} />
 </div>
 <span className="ml-2">Tag</span>
 {selectedTags.length > 0 && (
 <span className="ml-1 app-chip app-chip-accent text-xs px-1.5 py-0">
 {selectedTags.length}
 </span>
 )}
 <ChevronDown className={`w-3 h-3 transition-transform ${showTagPicker ? 'rotate-180' : ''}`} />
 </button>
 {showTagPicker && createPortal(
 <>
 <div className="fixed inset-0 z-[9998]" onClick={() => setShowTagPicker(false)} />
 <div
 className="fixed bg-white border border-gray-200 rounded-lg shadow-modal z-[9999] p-2 min-w-[200px] max-h-64 overflow-y-auto"
 style={{ top: `${tagDropdownPosition.top}px`, left: `${tagDropdownPosition.left}px` }}
 onClick={(e) => e.stopPropagation()}
 >
 {allTags.length === 0 ? (
 <p className="text-xs text-gray-500">No tags available</p>
 ) : (
 <>
 <div className="flex items-center justify-between mb-2">
 <span className="text-xs font-semibold text-gray-700">Select Tags</span>
 {selectedTags.length > 0 && (
 <button
 onClick={(e) => { e.stopPropagation(); setSelectedTags([]) }}
 className="text-xs text-primary-700 hover:text-primary-800"
 >
 Clear
 </button>
 )}
 </div>
 {allTags.map((tag) => (
 <label
 key={tag.id}
 className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
 >
 <input
 type="checkbox"
 checked={selectedTags.includes(tag.id)}
 onChange={(e) => {
 if (e.target.checked) setSelectedTags([...selectedTags, tag.id])
 else setSelectedTags(selectedTags.filter(id => id !== tag.id))
 }}
 className="w-3 h-3 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
 />
 <span className="text-xs text-gray-700 truncate flex-1">{tag.name}</span>
 </label>
 ))}
 </>
 )}
 </div>
 </>,
 document.body
 )}
 </div>

 {/* Beneficiary Groups Filter */}
 <div className="relative shrink-0">
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
 setShowTagPicker(false)
 setShowMetricsPicker(false)
 }}
 className={`flex items-center pl-0 pr-3 h-8 rounded-r-full rounded-l-full text-xs font-medium transition-all duration-200 border-2 border-l-0 whitespace-nowrap shrink-0 ${selectedBeneficiaryGroups.length > 0
 ? 'bg-primary-50 border-primary-500 hover:bg-primary-100 text-gray-700'
 : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
 }`}
 >
 <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${selectedBeneficiaryGroups.length > 0
 ? 'bg-primary-100 border-primary-500'
 : 'bg-gray-100 border-gray-200'
 }`}>
 <Users className={`w-4 h-4 ${selectedBeneficiaryGroups.length > 0
 ? 'text-primary-500'
 : 'text-gray-600'
 }`} />
 </div>
 <span className="ml-2">Groups</span>
 {selectedBeneficiaryGroups.length > 0 && (
 <span className="ml-1 app-chip app-chip-accent text-xs px-1.5 py-0">
 {selectedBeneficiaryGroups.length}
 </span>
 )}
 <ChevronDown className={`w-3 h-3 transition-transform ${showBeneficiaryPicker ? 'rotate-180' : ''}`} />
 </button>
 {showBeneficiaryPicker && createPortal(
 <>
 <div className="fixed inset-0 z-[9998]" onClick={() => setShowBeneficiaryPicker(false)} />
 <div
 className="fixed bg-white border border-gray-200 rounded-lg shadow-modal z-[9999] p-2 min-w-[200px] max-h-64 overflow-y-auto"
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
 <span className="text-xs font-semibold text-gray-700">Select Beneficiaries</span>
 {selectedBeneficiaryGroups.length > 0 && (
 <button
 onClick={(e) => {
 e.stopPropagation()
 setSelectedBeneficiaryGroups([])
 }}
 className="text-xs text-primary-700 hover:text-primary-800"
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
 className="w-3 h-3 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
 />
 <span className="text-xs text-gray-700 truncate flex-1">
 {group.name}
 </span>
 </label>
 ))}
 </>
 )}
 </div>
 </>,
 document.body
 )}
 </div>

 </div>

 {/* Right side: Add Impact Claim, Add Evidence, and User Profile */}
 <div className="flex items-center gap-3 shrink-0">
 {/* Add Impact Claim Button */}
 {onAddImpactClaim && canAddImpactClaims && (
 <button
 onClick={onAddImpactClaim}
 className="app-btn app-btn-primary app-btn-sm"
 >
 <Plus className="w-4 h-4" />
 <span>Add Claim</span>
 </button>
 )}
 {/* Add Evidence Button */}
 {onAddEvidence && canEditEvidence && (
 <button
 onClick={onAddEvidence}
 className="app-btn app-btn-evidence app-btn-sm"
 >
 <Upload className="w-4 h-4" />
 <span>Evidence</span>
 </button>
 )}
 {/* User Profile with Organization and Dropdown */}
 {user && (
 <div className="hidden md:block relative" ref={userMenuRef}>
 <button
 onClick={() => setUserMenuOpen(!userMenuOpen)}
 className="flex items-center gap-2 px-3 h-10 app-card-flat hover:bg-gray-50 rounded-full transition-all duration-200 min-w-[180px]"
 >
 <div className="flex flex-col items-start flex-1 min-w-0 justify-center">
 <span className="text-xs font-medium text-gray-900 truncate w-full leading-tight">
 {user.name || user.email}
 </span>
 {organization && (
 <span className="text-xs text-gray-500 truncate w-full leading-tight">
 {organization.name}
 </span>
 )}
 </div>
 <ChevronDown className={`w-3 h-3 text-gray-500 flex-shrink-0 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
 </button>

 {/* Dropdown Menu */}
 {userMenuOpen && (
 <div className="absolute right-0 mt-2 w-48 app-card-lg border border-gray-200 overflow-hidden z-50">
 <button
 onClick={() => {
 handleSignOut()
 setUserMenuOpen(false)
 }}
 className="w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
 >
 Sign Out
 </button>
 </div>
 )}
 </div>
 )}
 </div>
 </div>

 {/* Top Metric Cards - 12 across max (2 rows of 6) */}
 <DndContext
 sensors={sensors}
 collisionDetection={closestCenter}
 onDragEnd={handleDragEnd}
 >
 <SortableContext
 items={displayKPIs.map(kpi => kpi.id!)}
 strategy={horizontalListSortingStrategy}
 >
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 flex-shrink-0">
 {displayKPIs.map((kpi, index) => {
 const metricColor = getKPIColor(kpi.category, index)
 const isLastInFirstRow = index === 5 && displayKPIs.length === 6
 return (
 <div key={kpi.id} className="relative">
 <SortableMetricCard
 kpi={kpi}
 metricColor={metricColor}
 filteredTotal={filteredTotals[kpi.id] || 0}
 onMetricCardClick={onMetricCardClick}
 disabled={!canEditMetrics}
 />
 {/* Small plus button on right edge of last app-card when exactly 6 metrics */}
 {isLastInFirstRow && onAddKPI && (
 <button
 onClick={(e) => {
 e.stopPropagation()
 onAddKPI()
 }}
 className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 app-btn app-btn-primary app-btn-icon rounded-full z-10 min-w-0 p-0"
 title="Add Metric"
 >
 <Plus className="w-3.5 h-3.5 text-white" />
 </button>
 )}
 </div>
 )
 })}
 {/* Plus box to add new metric - show if fewer than 6 OR between 7-11 KPIs (not exactly 6) */}
 {kpis.length < 12 && kpis.length !== 6 && onAddKPI && (
 <button
 onClick={onAddKPI}
 className="app-card-interactive border-2 border-dashed border-gray-200 p-3 hover:border-primary-300 hover:bg-primary-50/30 cursor-pointer flex flex-col items-center justify-center min-h-[80px]"
 >
 <Plus className="w-5 h-5 text-gray-400 mb-1" />
 <span className="text-xs text-gray-500 font-medium">Add Metric</span>
 </button>
 )}
 </div>
 </SortableContext>
 </DndContext>

 {/* Graph and Map Row - dynamically sized based on metric app-card count */}
 <div className={`grid grid-cols-1 lg:grid-cols-5 gap-4 flex-1 ${displayKPIs.length > 6 ? 'min-h-[20vh]' : 'h-[25vh] lg:h-[50vh]'}`}>
 {/* Graph - Left - 3/5 width */}
 <div className="lg:col-span-3 app-card border border-gray-100 p-4 flex flex-col min-h-0 overflow-hidden">
 <div className="flex items-center justify-between mb-3">
 <div>
 <h3 className="text-sm font-semibold text-gray-800">Metrics Over Time</h3>
 </div>
 <div className="flex items-center space-x-2">
 {/* Monthly / Cumulative / Percentages Toggle */}
 {(() => {
 const hasPercentageKpi = kpis.some(k => k.metric_type === 'percentage')
 const hasNonPercentageKpi = kpis.some(k => k.metric_type !== 'percentage')
 return (
 <div className="flex items-center bg-gray-50 rounded-xl p-0.5">
 {hasNonPercentageKpi && (
 <>
 <button
 onClick={() => { userPickedGraphModeRef.current = true; setIsPercentageMode(false); setIsCumulative(false) }}
 className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${!isCumulative && !isPercentageMode
 ? 'bg-primary-500 text-secondary-900 shadow-sm'
 : 'text-gray-500 hover:text-gray-700'
 }`}
 >
 Monthly
 </button>
 <button
 onClick={() => { userPickedGraphModeRef.current = true; setIsPercentageMode(false); setIsCumulative(true) }}
 className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${isCumulative && !isPercentageMode
 ? 'bg-primary-500 text-secondary-900 shadow-sm'
 : 'text-gray-500 hover:text-gray-700'
 }`}
 >
 Cumulative
 </button>
 </>
 )}
 {hasPercentageKpi && (
 <button
 onClick={() => { userPickedGraphModeRef.current = true; setIsPercentageMode(true) }}
 className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${isPercentageMode
 ? 'bg-primary-500 text-secondary-900 shadow-sm'
 : 'text-gray-500 hover:text-gray-700'
 }`}
 >
 Percentages
 </button>
 )}
 </div>
 )
 })()}
 {/* Time Frame Filters */}
 <div className="flex items-center bg-gray-50 rounded-xl p-0.5">
 {(['all', '1month', '6months', '1year', '5years'] as const).map((tf) => (
 <button
 key={tf}
 onClick={() => {
 setTimeFrame(tf)
 // Preserve monthly view state when switching time frames
 }}
 className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${timeFrame === tf
 ? 'bg-primary-500 text-secondary-900 shadow-sm'
 : 'text-gray-500 hover:text-gray-700'
 }`}
 >
 {tf === 'all' ? 'All' : tf === '1month' ? '1M' : tf === '6months' ? '6M' : tf === '1year' ? '1Y' : '5Y'}
 </button>
 ))}
 </div>
 </div>
 </div>

 <div className="flex-1 min-h-0">
 {chartData && chartData.length > 0 && kpis && kpis.length > 0 && (isPercentageMode ? visiblePercentageKpis.length > 0 : chartKpiIds.size > 0) ? (
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={chartData} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
 <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
 <XAxis
 dataKey="date"
 stroke="#cbd5e1"
 fontSize={11}
 tickLine={false}
 axisLine={false}
 tick={{ fill: '#94a3b8' }}
 angle={-45}
 textAnchor="end"
 height={60}
 interval={xAxisInterval}
 tickMargin={8}
 tickFormatter={(isCumulative && !isPercentageMode) ? formatXAxisTickBound : undefined}
 />
 <YAxis
 stroke="#cbd5e1"
 fontSize={11}
 tickLine={false}
 axisLine={false}
 tick={{ fill: '#94a3b8' }}
 domain={isPercentageMode ? [0, percentageYMax] : (maxDomainValue > 0 ? [0, maxDomainValue] : [0, 'dataMax'])}
 ticks={isPercentageMode ? percentageYTicks : (yTicks.length > 0 ? yTicks : undefined)}
 tickFormatter={isPercentageMode ? ((value: any) => `${Math.round(value)}%`) : ((value) => {
 if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
 if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
 return value.toString()
 })}
 />
 {isPercentageMode ? (
 <Tooltip
 content={(tooltipProps) => (
 <MetricsDashboardPercentageTooltip
 {...tooltipProps}
 chartData={chartData}
 visiblePercentageKpis={visiblePercentageKpis}
 kpis={kpis}
 percentageAveragesById={percentageAveragesById}
 getKPIColorFn={getKPIColor}
 />
 )}
 cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
 />
 ) : (
 <Tooltip
 contentStyle={{
 backgroundColor: 'rgba(255,255,255,0.98)',
 backdropFilter: 'blur(8px)',
 border: '1px solid #f1f5f9',
 borderRadius: '12px',
 padding: '10px 12px',
 fontSize: '12px',
 boxShadow: '0 8px 24px rgba(15,23,42,0.08)'
 }}
 formatter={(value: any, name: string) => {
 const kpi = kpis.find(k => k.id === name)
 const kpiName = kpi ? kpi.title : name
 const unit = kpi?.unit_of_measurement || ''
 const formattedValue = typeof value === 'number'
 ? value.toLocaleString() + (unit ? ` ${unit}` : '')
 : value
 return [formattedValue, kpiName]
 }}
 labelFormatter={(label) => {
 const dataPoint = chartData.find(d => d.date === label)
 if (dataPoint?.fullDate) {
 return formatDate(dataPoint.fullDate)
 }
 return `Date: ${label}`
 }}
 cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
 />
 )}
 <Legend
 wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
 formatter={(value) => {
 const kpi = kpis.find(k => k.id === value)
 return kpi ? kpi.title : value
 }}
 iconType="line"
 />
 {isPercentageMode && visiblePercentageKpis.map(kpi => {
 const originalIndex = kpis.findIndex(k => k.id === kpi.id)
 const color = getKPIColor(kpi.category, originalIndex)
 const avg = percentageAveragesById[kpi.id] || 0
 if (avg <= 0) return null
 return (
 <ReferenceLine
 key={`ref-${kpi.id}`}
 y={avg}
 stroke={color}
 strokeOpacity={0.4}
 strokeWidth={1.25}
 strokeDasharray="5 4"
 ifOverflow="extendDomain"
 />
 )
 })}
 {isPercentageMode && visiblePercentageKpis.map(kpi => (
 <Line
 key={`ghost-${kpi.id}`}
 type="monotone"
 dataKey={`${kpi.id}__avg`}
 stroke="transparent"
 dot={false}
 activeDot={false}
 isAnimationActive={false}
 legendType="none"
 />
 ))}
 {(isPercentageMode ? visiblePercentageKpis : kpis.filter(kpi => visibleKPIs.has(kpi.id) && kpi.metric_type !== 'percentage')).map((kpi) => {
 const originalIndex = kpis.findIndex(k => k.id === kpi.id)
 return (
 <Line
 key={kpi.id}
 type="monotone"
 dataKey={kpi.id}
 stroke={getKPIColor(kpi.category, originalIndex)}
 strokeWidth={2.25}
 dot={isPercentageMode ? { r: 2.5, fill: getKPIColor(kpi.category, originalIndex), strokeWidth: 0 } : false}
 activeDot={{ r: 4, fill: getKPIColor(kpi.category, originalIndex), stroke: 'white', strokeWidth: 1.5 }}
 strokeLinecap="round"
 connectNulls={isPercentageMode}
 />
 )
 })}
 </LineChart>
 </ResponsiveContainer>
 ) : (
 <div className="h-full flex flex-col items-center justify-center text-gray-500">
 <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
 <p className="text-xs text-center">
 {isPercentageMode && visiblePercentageKpis.length === 0
 ? 'No percentage metrics selected'
 : !isPercentageMode && chartKpiIds.size === 0
 ? (visibleKPIs.size === 0 ? 'Select metrics to view' : 'Only percentage metrics selected — switch to Percentages')
 : 'No data yet'}
 </p>
 </div>
 )}
 </div>
 </div>

 {/* Map - Right - 2/5 width */}
 <div className="lg:col-span-2 app-card border border-gray-100 p-4 flex flex-col relative min-h-0 overflow-hidden">
 <div className="flex items-center justify-between mb-3 flex-shrink-0">
 <h3 className="text-sm font-semibold text-gray-800">Locations</h3>
 <div className="flex items-center gap-1.5">
 <button
 onClick={() => setShowAllLocationsModal(true)}
 className="flex items-center space-x-1 px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-600 rounded-lg text-xs font-medium transition-all duration-200"
 title="View all org locations"
 >
 <ExternalLink className="w-3 h-3" />
 <span>View All</span>
 </button>
 </div>
 </div>
 <div className="flex-1 min-h-0">
 <LocationMap
 locations={locations.filter(loc => {
 // If beneficiary groups are selected, only show locations derived from those groups
 if (selectedBeneficiaryGroups.length > 0) {
 const locationIdsFromBeneficiaries = selectedBeneficiaryGroups
 .flatMap(bgId => benGroupDerivedLocations[bgId] || [])
 return locationIdsFromBeneficiaries.includes(loc.id!)
 }
 // If locations are selected, only show selected locations
 if (selectedLocations.length > 0) {
 return selectedLocations.includes(loc.id!)
 }
 // Otherwise show all locations
 return true
 })}
 onMapClick={() => {
 // Navigate to locations tab when clicking map
 if (onNavigateToLocations) {
 onNavigateToLocations()
 }
 }}
 onApplyLocationFilter={(locationId) => {
 // Apply location filter when clicking map
 if (!selectedLocations.includes(locationId)) {
 setSelectedLocations([locationId])
 }
 }}
 refreshKey={mapRefreshKey}
 initiativeId={initiativeId}
 onMetricClick={onMetricCardClick}
 onStoryClick={onStoryClick}
 autoFit
 />
 </div>
 </div>
 </div>

 {/* Bottom Stats Cards - Minimal single line when 2 rows of metrics */}
 {displayKPIs.length > 6 ? (
 <div className="flex gap-3 flex-shrink-0">
 {/* Impact Claims - inline minimal */}
 <div className="flex-1 app-card impact-border px-3 py-1.5 flex items-center justify-between">
 <div className="flex items-center space-x-2">
 <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
 <BarChart3 className="w-4 h-4 text-primary-500" />
 </div>
 <span className="text-xs font-medium text-gray-600">Impact Claims</span>
 </div>
 <span className="text-sm font-semibold text-primary-500">{filteredUpdates.length.toLocaleString()}</span>
 </div>
 {/* Evidence Coverage - inline minimal */}
 <div className="flex-1 app-card evidence-border px-3 py-1.5 flex items-center justify-between">
 <div className="flex items-center space-x-2">
 <Target className="w-3.5 h-3.5 text-evidence-400" />
 <span className="text-xs font-medium text-gray-600">Evidence Coverage</span>
 </div>
 <span className="text-sm font-semibold text-evidence-500">{stats.evidence_coverage_percentage}%</span>
 </div>
 {/* Total Evidence - inline minimal */}
 <div className="flex-1 app-card evidence-border px-3 py-1.5 flex items-center justify-between">
 <div className="flex items-center space-x-2">
 <FileText className="w-3.5 h-3.5 text-evidence-400" />
 <span className="text-xs font-medium text-gray-600">Evidence Uploaded</span>
 </div>
 <span className="text-sm font-semibold text-evidence-500">{(stats.total_evidence || 0).toLocaleString()}</span>
 </div>
 </div>
 ) : (
 <div className="grid grid-cols-3 gap-4 flex-shrink-0 h-auto">
 {/* Total Data Points */}
 <div className="app-card border border-gray-100 p-4 impact-border">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center space-x-2">
 <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
 <BarChart3 className="w-4 h-4 text-primary-500" />
 </div>
 <h4 className="text-xs font-medium text-gray-600">Impact Claims</h4>
 </div>
 </div>
 <div className="flex items-baseline space-x-1">
 <span className="text-xl font-semibold text-primary-500">
 {filteredUpdates.length.toLocaleString()}
 </span>
 </div>
 </div>

 {/* Evidence Coverage */}
 <div className="app-card border border-gray-100 p-4 evidence-border">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center space-x-2">
 <div className="w-8 h-8 rounded-lg bg-evidence-50 flex items-center justify-center">
 <Target className="w-4 h-4 text-evidence-400" />
 </div>
 <h4 className="text-xs font-medium text-gray-600">Evidence Coverage</h4>
 </div>
 </div>
 <div className="flex items-baseline space-x-1">
 <span className="text-xl font-semibold text-evidence-500">
 {stats.evidence_coverage_percentage}%
 </span>
 </div>
 </div>

 {/* Total Evidence Uploaded */}
 <div className="app-card border border-gray-100 p-4 evidence-border">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center space-x-2">
 <div className="w-8 h-8 rounded-lg bg-evidence-50 flex items-center justify-center">
 <FileText className="w-4 h-4 text-evidence-400" />
 </div>
 <h4 className="text-xs font-medium text-gray-600">Evidence Uploaded</h4>
 </div>
 </div>
 <div className="flex items-baseline space-x-1">
 <span className="text-xl font-semibold text-evidence-500">
 {(stats.total_evidence || 0).toLocaleString()}
 </span>
 </div>
 </div>
 </div>
 )}

 {/* All Locations modal (org-wide) */}
 <AllLocationsModal
 isOpen={showAllLocationsModal}
 onClose={() => {
 setShowAllLocationsModal(false)
 if (initiativeId) {
 apiService.getLocations(initiativeId)
 .then((locs) => setLocations(locs || []))
 .catch(() => { })
 }
 }}
 />
 </div>
 )
}