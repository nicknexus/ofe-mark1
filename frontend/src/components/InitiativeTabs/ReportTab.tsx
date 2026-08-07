import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react'
import { FileText, Calendar, BarChart3, MapPin, Users, Sparkles, X, ChevronLeft, ChevronRight, Check, BookOpen, Plus, Pencil, Save, Tag } from 'lucide-react'
import { SectionLoader, EmptyState, Spinner, InlineAlert } from '../ui'
import { apiService } from '../../services/api'
import { KPI, Location, BeneficiaryGroup, InitiativeDashboard, MetricTag } from '../../types'
import DateRangePicker from '../DateRangePicker'
import FilterPill from '../shared/FilterPill'
import { notify } from '../../lib/notify'
import { useTeam } from '../../context/TeamContext'
import { narrativeBudget } from '../../utils/reportLayout'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'

// @react-pdf/renderer is heavy; keep it out of the main bundle until a user
// actually opens a report.
const ReportPdfPanel = React.lazy(() => import('../reports/ReportPdfPanel'))

interface ReportTabProps {
 initiativeId: string
 dashboard: InitiativeDashboard | null
}

interface ReportData {
 metrics: Array<{
 id: string
 kpi_id: string
 kpi_title: string
 kpi_description: string
 value: number
 unit_of_measurement: string
 date_represented: string
 location_id?: string
 location_name?: string
 }>
 totals: Array<{
 kpi_id: string
 kpi_title: string
 kpi_description: string
 unit_of_measurement: string
 total_value: number
 count: number
 tag_ids?: string[]
 }>
 tags?: Array<{
 id: string
 name: string
 color?: string | null
 }>
 locations: Array<{
 id: string
 name: string
 description?: string
 latitude: number
 longitude: number
 }>
 stories: Array<{
 id: string
 title: string
 description?: string
 date_represented: string
 location_id?: string
 location_name?: string
 media_url?: string
 media_type?: 'photo' | 'video' | 'recording'
 }>
 mapPoints: Array<{
 lat: number
 lng: number
 name: string
 type: 'location' | 'story'
 }>
 beneficiaryGroups?: Array<{
 id: string
 name: string
 description?: string
 total_number?: number | null
 }>
 branding?: {
 organization_name: string
 logo_url?: string | null
 brand_color?: string | null
 }
}

/** Human-readable label for the report header, e.g. "Jan 2025 – Dec 2025". */
function formatDateRangeLabel(range: { singleDate?: string; startDate?: string; endDate?: string }): string {
 const fmt = (iso?: string) =>
 iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''
 if (range.singleDate) return fmt(range.singleDate)
 const start = fmt(range.startDate)
 const end = fmt(range.endDate)
 if (start && end) return start === end ? start : `${start} – ${end}`
 return start || end || 'All time'
}

export default function ReportTab({ initiativeId, dashboard }: ReportTabProps) {
 const { canExportReports, activeOrganization } = useTeam()
 // Filter state
 const [dateRange, setDateRange] = useState<{
 singleDate?: string
 startDate?: string
 endDate?: string
 }>({})
 const [selectedKPIIds, setSelectedKPIIds] = useState<string[]>([])
 const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
 const [selectedBeneficiaryGroupIds, setSelectedBeneficiaryGroupIds] = useState<string[]>([])
 const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

 // Data state
 const [kpis, setKPIs] = useState<KPI[]>([])
 const [locations, setLocations] = useState<Location[]>([])
 const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
 const [metricTags, setMetricTags] = useState<MetricTag[]>([])
 const [reportData, setReportData] = useState<ReportData | null>(null)
 const [selectedStory, setSelectedStory] = useState<ReportData['stories'][0] | null>(null)
 const [reportText, setReportText] = useState<string | null>(null)
 const [reportDashboardData, setReportDashboardData] = useState<{
 overviewSummary: string
 beneficiaryText: string
 mapImage: string | null
 hasBeneficiaryGroups: boolean
 } | null>(null)
 const [loadingMessage, setLoadingMessage] = useState('')

 // Loading states
 const [loadingReport, setLoadingReport] = useState(false)
 const [loadingData, setLoadingData] = useState(false)

 // UI state
 const [showDashboard, setShowDashboard] = useState(true)
 const [isEditingReport, setIsEditingReport] = useState(false)
 
 // Editable text state (separate from source data so we can edit without losing original)
 const [editableOverview, setEditableOverview] = useState<string>('')
 const [editableBeneficiaryText, setEditableBeneficiaryText] = useState<string>('')
 const [editableStoryTitle, setEditableStoryTitle] = useState<string>('')
 const [editableStoryDescription, setEditableStoryDescription] = useState<string>('')

 // Step wizard state
 const [currentStep, setCurrentStep] = useState(1)
 const totalSteps = 4
 const containerRef = useRef<HTMLDivElement>(null)
 const formContentRef = useRef<HTMLDivElement>(null)

 // Storage key for this initiative's report
 const storageKey = `report-${initiativeId}`

 const colorByKpiId = useMemo(() => {
 const map: Record<string, string> = {}
 kpis.forEach((kpi, index) => {
 if (kpi.id) map[kpi.id] = getKPIColor(kpi.category || 'output', index)
 })
 return map
 }, [kpis])

 // Steps definition
 const steps = [
 { number: 1, title: 'Filters', icon: Calendar },
 { number: 2, title: 'Review Data', icon: BarChart3 },
 { number: 3, title: 'Add Story', icon: BookOpen },
 { number: 4, title: 'Generate', icon: Sparkles }
 ]

 // Load saved report data from localStorage on mount or when initiativeId changes
 useEffect(() => {
 try {
 const saved = localStorage.getItem(storageKey)
 if (saved) {
 const parsed = JSON.parse(saved)
 if (parsed.reportText) setReportText(parsed.reportText)
 if (parsed.reportDashboardData) {
 setReportDashboardData(parsed.reportDashboardData)
 // Initialize editable fields from saved data
 setEditableOverview(parsed.editableOverview ?? parsed.reportDashboardData.overviewSummary ?? '')
 setEditableBeneficiaryText(parsed.editableBeneficiaryText ?? parsed.reportDashboardData.beneficiaryText ?? '')
 }
 if (parsed.reportData) setReportData(parsed.reportData)
 if (parsed.selectedStory) {
 setSelectedStory(parsed.selectedStory)
 setEditableStoryTitle(parsed.editableStoryTitle ?? parsed.selectedStory.title ?? '')
 setEditableStoryDescription(parsed.editableStoryDescription ?? parsed.selectedStory.description ?? '')
 }
 if (parsed.dateRange) setDateRange(parsed.dateRange)
 if (typeof parsed.showDashboard === 'boolean') setShowDashboard(parsed.showDashboard)
 } else {
 // Clear state if no saved data for this initiative
 setReportText(null)
 setReportDashboardData(null)
 setReportData(null)
 setSelectedStory(null)
 setShowDashboard(true)
 setEditableOverview('')
 setEditableBeneficiaryText('')
 setEditableStoryTitle('')
 setEditableStoryDescription('')
 }
 } catch (error) {
 console.error('Failed to load saved report:', error)
 // Clear state on error
 setReportText(null)
 setReportDashboardData(null)
 setReportData(null)
 setSelectedStory(null)
 setShowDashboard(true)
 setEditableOverview('')
 setEditableBeneficiaryText('')
 setEditableStoryTitle('')
 setEditableStoryDescription('')
 }
 }, [initiativeId, storageKey])

 // Save report data to localStorage whenever it changes
 useEffect(() => {
 if (reportText && reportDashboardData && reportData) {
 try {
 const dataToSave = {
 reportText,
 reportDashboardData,
 reportData,
 selectedStory,
 dateRange,
 showDashboard,
 editableOverview,
 editableBeneficiaryText,
 editableStoryTitle,
 editableStoryDescription
 }
 localStorage.setItem(storageKey, JSON.stringify(dataToSave))
 } catch (error) {
 console.error('Failed to save report to localStorage:', error)
 }
 }
 }, [reportText, reportDashboardData, reportData, selectedStory, dateRange, showDashboard, storageKey, editableOverview, editableBeneficiaryText, editableStoryTitle, editableStoryDescription])

 // Load filter options
 useEffect(() => {
 if (initiativeId) {
 Promise.all([
 apiService.getKPIs(initiativeId),
 apiService.getLocations(initiativeId),
 apiService.getBeneficiaryGroups(initiativeId),
 apiService.getMetricTags().catch(() => [])
 ]).then(([kpisData, locationsData, groupsData, tagsData]) => {
 setKPIs(kpisData || [])
 setLocations(locationsData || [])
 setBeneficiaryGroups(groupsData || [])
 setMetricTags(tagsData || [])
 }).catch(() => {
 notify.error('Failed to load filter options')
 })
 }
 }, [initiativeId])

 // Scroll to top when step changes
 useEffect(() => {
 if (formContentRef.current) {
 formContentRef.current.scrollTop = 0
 }
 }, [currentStep])

 const handleApplyFilters = async () => {
 if (!initiativeId) return

 try {
 setLoadingData(true)
 const dateStart = dateRange.startDate || dateRange.singleDate
 const dateEnd = dateRange.endDate || dateRange.singleDate

 const data = await apiService.getReportData({
 initiativeId,
 dateStart,
 dateEnd,
 kpiIds: selectedKPIIds.length > 0 ? selectedKPIIds : undefined,
 locationIds: selectedLocationIds.length > 0 ? selectedLocationIds : undefined,
 beneficiaryGroupIds: selectedBeneficiaryGroupIds.length > 0 ? selectedBeneficiaryGroupIds : undefined,
 tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined
 })

 setReportData(data)
 setSelectedStory(null)
 // Move to next step after loading data
 setCurrentStep(2)
 } catch (error) {
 console.error('Error loading report data:', error)
 notify.error('Failed to load report data')
 } finally {
 setLoadingData(false)
 }
 }

 const handleGenerateReport = async () => {
 if (!reportData || !dashboard) return

 try {
 setLoadingReport(true)
 setLoadingMessage('Initializing report generation...')

 const dateStart = dateRange.startDate || dateRange.singleDate || ''
 const dateEnd = dateRange.endDate || dateRange.singleDate || ''

 // Simulate progress messages
 const messages = [
 'Processing data...',
 'Analyzing impact metrics...',
 'Evaluating claims and evidence...',
 'Compiling location data...',
 'Reviewing beneficiary information...',
 'Generating narrative content...',
 'Finalizing report...'
 ]

 let messageIndex = 0
 const messageInterval = setInterval(() => {
 if (messageIndex < messages.length) {
 setLoadingMessage(messages[messageIndex])
 messageIndex++
 }
 }, 800)

 let result
 try {
 result = await apiService.generateReport({
 initiativeId,
 initiativeTitle: dashboard.initiative.title,
 dateRange: {
 start: dateStart,
 end: dateEnd
 },
 totals: reportData.totals,
 rawMetrics: reportData.metrics,
 selectedStory: selectedStory || undefined,
 locations: reportData.locations,
 tags: reportData.tags,
 beneficiaryGroups: beneficiaryGroups.filter(bg =>
 selectedBeneficiaryGroupIds.length === 0 || selectedBeneficiaryGroupIds.includes(bg.id!)
 ),
 // Tell the model how much room the one-page layout leaves it, so the
 // prose fits instead of being truncated with an ellipsis on render.
 lengthBudget: narrativeBudget({
 hasStory: Boolean(selectedStory),
 hasMap: reportData.mapPoints.length > 0,
 hasContext:
 reportData.locations.length > 0 ||
 (reportData.beneficiaryGroups || []).length > 0 ||
 (reportData.tags || []).length > 0,
 metricCount: reportData.totals.length,
 })
 })
 } finally {
 clearInterval(messageInterval)
 }

 setLoadingMessage('Preparing report...')

 setReportText(result.reportText)

 // Parse report text and extract sections
 const reportText = result.reportText
 let overviewSummary = ''
 let beneficiaryText = ''

 // Extract Overview Summary and limit to 2 sentences
 const overviewMatch = reportText.match(/##?\s*Overview Summary[\s\S]*?(?=##?\s*|$)/i)
 if (overviewMatch) {
 const fullSummary = overviewMatch[0]
 .replace(/##?\s*Overview Summary\s*/i, '')
 .split('\n')
 .map(l => l.trim())
 .filter(l => l && !l.startsWith('##'))
 .join(' ')
 .trim()

 // Extract first 2 sentences
 const sentences = fullSummary.match(/[^.!?]+[.!?]+/g) || []
 overviewSummary = sentences.slice(0, 2).join(' ').trim()
 }

 // Extract Beneficiary Breakdown
 const beneficiaryMatch = reportText.match(/##?\s*Beneficiary Breakdown[\s\S]*?(?=##?\s*|$)/i)
 if (beneficiaryMatch) {
 beneficiaryText = beneficiaryMatch[0]
 .replace(/##?\s*Beneficiary Breakdown\s*/i, '')
 .split('\n')
 .map(l => l.trim())
 .filter(l => l && !l.startsWith('##'))
 .join(' ')
 .trim()
 }

 // Locations are drawn as vectors inside the PDF now, so there is no
 // map image to pre-render here.
 setReportDashboardData({
 overviewSummary: overviewSummary || 'No overview available',
 beneficiaryText: beneficiaryText || 'No beneficiary information available',
 mapImage: null,
 hasBeneficiaryGroups: selectedBeneficiaryGroupIds.length > 0
 })
 
 // Initialize editable fields
 setEditableOverview(overviewSummary || 'No overview available')
 setEditableBeneficiaryText(beneficiaryText || 'No beneficiary information available')
 if (selectedStory) {
 setEditableStoryTitle(selectedStory.title)
 setEditableStoryDescription(selectedStory.description || '')
 }

 // Show dashboard when report is generated
 setShowDashboard(true)

 // Save to localStorage (will be handled by useEffect, but ensure it's saved immediately)
 try {
 const dataToSave = {
 reportText: result.reportText,
 reportDashboardData: {
 overviewSummary: overviewSummary || 'No overview available',
 beneficiaryText: beneficiaryText || 'No beneficiary information available',
 mapImage: null,
 hasBeneficiaryGroups: selectedBeneficiaryGroupIds.length > 0
 },
 reportData,
 selectedStory: selectedStory || null,
 dateRange,
 showDashboard: true
 }
 localStorage.setItem(storageKey, JSON.stringify(dataToSave))
 } catch (error) {
 console.error('Failed to save report to localStorage:', error)
 }

 // Scroll to top after report is generated
 setTimeout(() => {
 if (containerRef.current) {
 containerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
 }
 // Also scroll the window in case the container is the viewport
 window.scrollTo({ top: 0, behavior: 'smooth' })
 }, 100)

 } catch (error: any) {
 console.error('Error generating report:', error)

 // Clear report state on error
 setReportDashboardData(null)
 setReportText(null)

 // Handle specific error types
 if (error?.message?.includes('Quota Exceeded') || error?.message?.includes('insufficient_quota')) {
 notify.error('OpenAI quota exceeded. Please add credits to your OpenAI account.', {
 duration: 6000
 })
 } else if (error?.message?.includes('Rate Limit')) {
 notify.error('Rate limit exceeded. Please try again in a moment.', {
 duration: 4000
 })
 } else {
 notify.error(error?.message || 'Failed to generate report')
 }
 } finally {
 setLoadingReport(false)
 setLoadingMessage('')
 }
 }

 const canProceedToNextStep = () => {
 switch (currentStep) {
 case 1:
 // Can proceed from filters - no mandatory selection needed
 return true
 case 2:
 // Must have report data loaded
 return !!reportData
 case 3:
 // Story is optional, can always proceed
 return true
 case 4:
 // Generate step - need report data
 return !!reportData
 default:
 return false
 }
 }

 const handleNext = () => {
 if (currentStep === 1) {
 // On step 1, apply filters and then move to step 2
 handleApplyFilters()
 } else if (canProceedToNextStep() && currentStep < totalSteps) {
 setCurrentStep(currentStep + 1)
 }
 }

 const handleBack = () => {
 if (currentStep > 1) {
 setCurrentStep(currentStep - 1)
 }
 }

 const handleStartNewReport = () => {
 // Reset everything for a new report
 setReportText(null)
 setReportDashboardData(null)
 setReportData(null)
 setSelectedStory(null)
 setDateRange({})
 setSelectedKPIIds([])
 setSelectedLocationIds([])
 setSelectedBeneficiaryGroupIds([])
 setSelectedTagIds([])
 setCurrentStep(1)
 setShowDashboard(true)
 setIsEditingReport(false)
 setEditableOverview('')
 setEditableBeneficiaryText('')
 setEditableStoryTitle('')
 setEditableStoryDescription('')

 // Clear localStorage
 try {
 localStorage.removeItem(storageKey)
 } catch (error) {
 console.error('Failed to clear localStorage:', error)
 }

 // Scroll to top
 setTimeout(() => {
 if (containerRef.current) {
 containerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
 }
 window.scrollTo({ top: 0, behavior: 'smooth' })
 }, 100)
 }

 // New Report Button Component
 const NewReportButton = () => {
 if (!canExportReports) return null
 return (
 <button
 type="button"
 onClick={handleStartNewReport}
 className="app-btn app-btn-secondary app-btn-lg"
 >
 <Plus className="w-5 h-5" />
 <span>Make New Report</span>
 </button>
 )
 }

 return (
 <div className="h-screen overflow-hidden flex flex-col mobile-content-padding relative">
 {loadingReport && (
 <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
 <div className="text-center max-w-md mx-auto px-6">
 <div className="w-14 h-14 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center mx-auto mb-4">
 <Sparkles className="w-7 h-7 text-primary-600" />
 </div>
 <h2 className="text-2xl font-semibold text-gray-900 mb-1">Generating impact report</h2>
 <SectionLoader label={loadingMessage || 'Processing…'} className="py-6" />
 </div>
 </div>
 )}

 <div className="px-4 sm:px-6 lg:px-8 xl:px-10 pt-4 sm:pt-5 pb-3 border-b border-gray-100 bg-white flex-shrink-0">
 <div className="min-w-0 max-w-[1800px] mx-auto w-full">
 <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 leading-tight tracking-tight">AI Report</h2>
 <p className="text-sm text-gray-500 mt-1 hidden sm:block">Filter your data, preview what will be included, then generate a one-page PDF</p>
 </div>
 </div>

 <div ref={containerRef} className="flex-1 bg-gray-50 overflow-y-auto min-h-0">
 <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
 {/* Report Dashboard - Shown at top when generated */}
 {showDashboard && reportText && reportDashboardData && reportData && (
 <>
 {/* Make New Report Button - Above Dashboard */}
 <div className="flex justify-center">
 <NewReportButton />
 </div>

 <div className="app-card p-5 sm:p-6">
 <div className="flex items-center justify-between mb-4 gap-3">
 <h2 className="text-base font-semibold text-gray-800">Report preview</h2>
 <div className="flex items-center gap-2">
 {canExportReports && (isEditingReport ? (
 <button
 type="button"
 onClick={() => setIsEditingReport(false)}
 className="app-btn app-btn-primary app-btn-sm"
 >
 <Save className="w-4 h-4" />
 <span>Save Changes</span>
 </button>
 ) : (
 <button
 type="button"
 onClick={() => setIsEditingReport(true)}
 className="app-btn app-btn-secondary app-btn-sm"
 >
 <Pencil className="w-4 h-4" />
 <span>Edit Text</span>
 </button>
 ))}
 <button
 onClick={() => {
 setShowDashboard(false)
 // Update localStorage with new showDashboard state
 try {
 const saved = localStorage.getItem(storageKey)
 if (saved) {
 const parsed = JSON.parse(saved)
 parsed.showDashboard = false
 localStorage.setItem(storageKey, JSON.stringify(parsed))
 }
 } catch (error) {
 console.error('Failed to update localStorage:', error)
 }
 }}
 className="app-btn app-btn-icon app-btn-ghost"
 title="Close dashboard"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>
 <Suspense
 fallback={
 <div className="h-[840px] flex items-center justify-center text-sm text-gray-500">
 Loading report…
 </div>
 }
 >
 <ReportPdfPanel
 canDownload={canExportReports}
 fileName={`${(dashboard?.initiative.title || 'Impact').replace(/[^a-z0-9]/gi, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`}
 initiativeTitle={dashboard?.initiative.title || 'Impact report'}
 dateRangeLabel={formatDateRangeLabel(dateRange)}
 organizationName={reportData.branding?.organization_name || activeOrganization?.name || ''}
 orgLogoUrl={reportData.branding?.logo_url ?? activeOrganization?.logo_url ?? null}
 brandColor={reportData.branding?.brand_color ?? activeOrganization?.brand_color ?? null}
 overview={editableOverview || reportDashboardData.overviewSummary}
 beneficiaryText={editableBeneficiaryText || reportDashboardData.beneficiaryText}
 metrics={reportData.totals.map(t => ({
 kpi_id: t.kpi_id,
 kpi_title: t.kpi_title,
 unit_of_measurement: t.unit_of_measurement,
 metric_type: (t as any).metric_type,
 total_value: t.total_value,
 }))}
 story={selectedStory ? {
 title: editableStoryTitle || selectedStory.title,
 description: editableStoryDescription || selectedStory.description || '',
 date: selectedStory.date_represented,
 locationName: selectedStory.location_name,
 // Anything that isn't explicitly video/audio is treated as an image;
 // media_type is often absent on older stories that do have a photo.
 imageUrl: selectedStory.media_type === 'video' || selectedStory.media_type === 'recording'
 ? null
 : selectedStory.media_url || null,
 } : null}
 locations={reportData.locations.map(l => ({ id: l.id, name: l.name }))}
 beneficiaryGroups={reportData.beneficiaryGroups || []}
 tags={(reportData.tags || []).map(t => ({ id: t.id, name: t.name }))}
 mapPoints={reportData.mapPoints}
 />
 </Suspense>
 </div>

 {/* Make New Report Button - Below Dashboard */}
 <div className="flex justify-center">
 <NewReportButton />
 </div>
 </>
 )}

 {/* Step Wizard - Only show if no report generated OR dashboard is hidden */}
 {(!reportText || !reportDashboardData || !showDashboard) && (
 <div className="app-card overflow-hidden p-0">
 {/* Progress Steps Indicator */}
 <div className="px-5 py-4 border-b border-gray-100 bg-white">
 <div className="flex items-center justify-center gap-1 sm:gap-0">
 {steps.map((step, index) => (
 <React.Fragment key={step.number}>
 <div className="flex flex-col items-center min-w-[4.5rem] sm:min-w-[5.5rem]">
 <div className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-200 ${currentStep > step.number
 ? 'bg-primary-500 border-primary-500 text-white'
 : currentStep === step.number
 ? 'bg-primary-50 border-primary-400 text-primary-700 ring-2 ring-primary-100'
 : 'bg-white border-gray-200 text-gray-400'
 }`}>
 {currentStep > step.number ? (
 <Check className="w-4 h-4" />
 ) : (
 <step.icon className="w-4 h-4" />
 )}
 </div>
 <div className={`mt-1.5 text-[11px] sm:text-xs font-medium whitespace-nowrap ${currentStep >= step.number ? 'text-gray-700' : 'text-gray-400'}`}>
 {step.title}
 </div>
 </div>
 {index < steps.length - 1 && (
 <div className={`hidden sm:block flex-1 h-0.5 mx-2 rounded-full transition-all duration-200 ${currentStep > step.number ? 'bg-primary-400' : 'bg-gray-200/70'}`} style={{ maxWidth: '72px' }} />
 )}
 </React.Fragment>
 ))}
 </div>
 </div>

 {/* Step Content */}
 <div ref={formContentRef} className="p-5 sm:p-6 min-h-[440px] max-h-[70vh] overflow-y-auto">
 {/* Step 1: Filters */}
 {currentStep === 1 && (
 <div className="space-y-5 animate-fade-in max-w-3xl mx-auto">
 <div className="text-center mb-2">
 <h3 className="text-lg font-semibold text-gray-900 mb-1">Select report filters</h3>
 <p className="text-sm text-gray-500">Leave a filter empty to include everything in that category</p>
 </div>

 <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
 <DateRangePicker
 value={dateRange}
 onChange={setDateRange}
 placeholder="Date"
 variant="pill"
 />
 <FilterPill
 icon={BarChart3}
 label="Metrics"
 pluralLabel="metrics"
 options={kpis.filter(k => k.id).map(k => ({ id: k.id!, name: k.title }))}
 selected={selectedKPIIds}
 onChange={setSelectedKPIIds}
 emptyText="No metrics available"
 />
 <FilterPill
 icon={MapPin}
 label="Location"
 pluralLabel="locations"
 options={locations.filter(l => l.id).map(l => ({ id: l.id!, name: l.name }))}
 selected={selectedLocationIds}
 onChange={setSelectedLocationIds}
 emptyText="No locations available"
 />
 {metricTags.length > 0 && (
 <FilterPill
 icon={Tag}
 label="Tag"
 pluralLabel="tags"
 options={metricTags.map(t => ({ id: t.id, name: t.name, color: t.color || undefined }))}
 selected={selectedTagIds}
 onChange={setSelectedTagIds}
 emptyText="No tags available"
 />
 )}
 {beneficiaryGroups.length > 0 && (
 <FilterPill
 icon={Users}
 label="Groups"
 pluralLabel="groups"
 options={beneficiaryGroups.filter(g => g.id).map(g => ({ id: g.id!, name: g.name }))}
 selected={selectedBeneficiaryGroupIds}
 onChange={setSelectedBeneficiaryGroupIds}
 emptyText="No beneficiary groups available"
 />
 )}
 </div>

 {selectedBeneficiaryGroupIds.length > 0 ? (
 <InlineAlert tone="warning" title="Scoped report">
 Only includes data for the selected beneficiary group{selectedBeneficiaryGroupIds.length > 1 ? 's' : ''}.
 </InlineAlert>
 ) : beneficiaryGroups.length > 0 ? (
 <InlineAlert tone="info" title="Full report">
 Includes all metrics across your initiative unless you narrow the filters above.
 </InlineAlert>
 ) : null}
 </div>
 )}

 {/* Step 2: Review Data */}
 {currentStep === 2 && (
 <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">
 <div className="text-center mb-2">
 <h3 className="text-lg font-semibold text-gray-900 mb-1">Review your data</h3>
 <p className="text-sm text-gray-500">This is what will feed the report</p>
 </div>

 {loadingData ? (
 <SectionLoader label="Loading data…" />
 ) : reportData ? (
 <div className="space-y-5">
 {reportData.totals.length > 0 && (
 <div>
 <div className="flex items-center gap-2 mb-3">
 <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
 Metrics ({reportData.totals.length})
 </h4>
 </div>
 {/* 2 rows of 112px cards + 12px gap, then scroll */}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[calc(2*112px+12px)] overflow-y-auto pr-1">
 {reportData.totals.map((total, index) => {
 const isPercentage = (total as any).metric_type === 'percentage'
 const color = colorByKpiId[total.kpi_id] || getKPIColor('output', index)
 return (
 <div
 key={total.kpi_id}
 className="h-[112px] bg-white rounded-2xl border border-gray-200/70 shadow-card p-4 flex flex-col overflow-hidden"
 >
 <div className="flex items-start gap-2 min-h-0 overflow-hidden">
 <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: color }} />
 <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2" title={total.kpi_title}>
 {total.kpi_title}
 </p>
 </div>
 <div className="flex items-baseline gap-1.5 mt-auto flex-shrink-0 pt-2">
 <span className="text-2xl font-semibold text-gray-900 tabular-nums leading-none">
 {isPercentage ? `${Math.round(total.total_value)}%` : total.total_value.toLocaleString()}
 </span>
 {!isPercentage && total.unit_of_measurement && (
 <span className="text-xs text-gray-400 truncate">{total.unit_of_measurement}</span>
 )}
 </div>
 </div>
 )
 })}
 </div>
 </div>
 )}

 {reportData.locations.length > 0 && (
 <div>
 <div className="flex items-center gap-2 mb-3">
 <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
 Locations ({reportData.locations.length})
 </h4>
 </div>
 <div className="flex flex-wrap gap-1.5">
 {reportData.locations.map(location => (
 <span key={location.id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-full border border-gray-200/70 shadow-card text-xs font-medium text-gray-700">
 <MapPin className="w-3 h-3 text-gray-400" />
 {location.name}
 </span>
 ))}
 </div>
 </div>
 )}

 {reportData.totals.length === 0 && reportData.locations.length === 0 && (
 <EmptyState
 icon={FileText}
 title="No data found for the selected filters"
 description="Go back and adjust your filter selections."
 />
 )}
 </div>
 ) : (
 <EmptyState
 title="No data loaded"
 description="Go back to filters and try again."
 />
 )}
 </div>
 )}

 {/* Step 3: Add Story */}
 {currentStep === 3 && (
 <div className="space-y-5 animate-fade-in max-w-3xl mx-auto">
 <div className="text-center mb-2">
 <h3 className="text-lg font-semibold text-gray-900 mb-1">Add a story (optional)</h3>
 <p className="text-sm text-gray-500">Pick one story to anchor the narrative, or skip</p>
 </div>

 {reportData?.stories && reportData.stories.length > 0 ? (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[420px] overflow-y-auto pr-1">
 {reportData.stories.map(story => {
 const isSelected = selectedStory?.id === story.id
 const thumb = story.media_type === 'video' || story.media_type === 'recording'
 ? null
 : story.media_url
 return (
 <button
 key={story.id}
 type="button"
 onClick={() => setSelectedStory(isSelected ? null : story)}
 className={`group relative text-left rounded-2xl border overflow-hidden bg-white shadow-card transition-all duration-200 flex flex-col ${isSelected
 ? 'border-primary-400 ring-2 ring-primary-100'
 : 'border-gray-200/70 hover:border-primary-300/70 hover:shadow-card-hover'
 }`}
 >
 <div className="relative aspect-[16/10] bg-gray-50 overflow-hidden flex-shrink-0">
 {thumb ? (
 <img
 src={thumb}
 alt=""
 loading="lazy"
 className="w-full h-full object-cover"
 onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
 />
 ) : (
 <div className="w-full h-full flex items-center justify-center">
 <BookOpen className="w-7 h-7 text-gray-300" />
 </div>
 )}
 {isSelected && (
 <div className="absolute top-2 right-2 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center shadow-card ring-2 ring-white">
 <Check className="w-3.5 h-3.5 text-white" />
 </div>
 )}
 </div>

 <div className="p-3 flex flex-col gap-1 flex-1 min-h-0">
 <h4 className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2">
 {story.title}
 </h4>
 {story.description && (
 <p className="text-xs text-gray-500 line-clamp-2">{story.description}</p>
 )}
 <div className="flex items-center gap-3 mt-auto pt-1.5 text-[11px] text-gray-400">
 {story.location_name && (
 <span className="flex items-center truncate">
 <MapPin className="w-3 h-3 mr-0.5 flex-shrink-0" />
 <span className="truncate">{story.location_name}</span>
 </span>
 )}
 <span className="flex items-center flex-shrink-0">
 <Calendar className="w-3 h-3 mr-0.5" />
 {story.date_represented}
 </span>
 </div>
 </div>
 </button>
 )
 })}
 </div>
 ) : (
 <EmptyState
 icon={BookOpen}
 title="No stories for these filters"
 description="You can proceed without a story."
 />
 )}

 {selectedStory && (
 <InlineAlert tone="success" title="Story selected">
 <div className="flex items-center justify-between gap-3">
 <span className="truncate">{selectedStory.title}</span>
 <button
 type="button"
 onClick={() => setSelectedStory(null)}
 className="text-xs font-medium text-impact-700 hover:text-impact-800 flex-shrink-0"
 >
 Clear
 </button>
 </div>
 </InlineAlert>
 )}
 </div>
 )}

 {/* Step 4: Generate */}
 {currentStep === 4 && (
 <div className="space-y-5 animate-fade-in max-w-2xl mx-auto">
 <div className="text-center mb-2">
 <h3 className="text-lg font-semibold text-gray-900 mb-1">Ready to generate</h3>
 <p className="text-sm text-gray-500">Confirm the scope, then generate your one-page PDF</p>
 </div>

 <div className="grid grid-cols-2 gap-3">
 {[
 { label: 'Metrics', value: String(reportData?.totals.length || 0) },
 { label: 'Locations', value: String(reportData?.locations.length || 0) },
 {
 label: 'Date range',
 value: dateRange.startDate && dateRange.endDate
 ? formatDateRangeLabel(dateRange)
 : dateRange.singleDate
 ? formatDateRangeLabel(dateRange)
 : 'All dates',
 },
 { label: 'Story', value: selectedStory?.title || 'None' },
 ].map(item => (
 <div key={item.label} className="rounded-2xl bg-white border border-gray-200/70 shadow-card p-4">
 <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{item.label}</span>
 <p className="mt-1 text-sm font-semibold text-gray-800 truncate" title={item.value}>{item.value}</p>
 </div>
 ))}
 </div>

 <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-5 text-center">
 <div className="w-10 h-10 rounded-xl bg-white border border-primary-100 flex items-center justify-center mx-auto mb-3 shadow-card">
 <Sparkles className="w-5 h-5 text-primary-600" />
 </div>
 <p className="text-sm text-primary-800 leading-relaxed">
 AI will analyze your filtered data and write a professional impact narrative that fits the one-page layout.
 </p>
 </div>
 </div>
 )}
 </div>

 {/* Navigation Footer */}
 <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/80">
 <div className="flex items-center justify-between max-w-3xl mx-auto">
 <button
 type="button"
 onClick={handleBack}
 disabled={currentStep === 1}
 className="app-btn app-btn-secondary app-btn-sm"
 >
 <ChevronLeft className="w-4 h-4" />
 <span>Back</span>
 </button>

 <div className="flex items-center gap-2">
 {currentStep < totalSteps ? (
 <button
 type="button"
 onClick={handleNext}
 disabled={loadingData || !canProceedToNextStep()}
 className="app-btn app-btn-primary app-btn-sm"
 >
 {loadingData ? (
 <>
 <Spinner className="w-4 h-4" />
 <span>Loading…</span>
 </>
 ) : (
 <>
 <span>{currentStep === 1 ? 'Apply & continue' : 'Next'}</span>
 <ChevronRight className="w-4 h-4" />
 </>
 )}
 </button>
 ) : canExportReports ? (
 <button
 type="button"
 onClick={handleGenerateReport}
 disabled={loadingReport || !reportData}
 className="app-btn app-btn-primary app-btn-sm"
 >
 {loadingReport ? (
 <>
 <Spinner className="w-4 h-4" />
 <span>Generating…</span>
 </>
 ) : (
 <>
 <Sparkles className="w-4 h-4" />
 <span>Generate report</span>
 </>
 )}
 </button>
 ) : null}
 </div>
 </div>
 </div>
 </div>
 )}

 </div>
 </div>
 </div>
 )
}
