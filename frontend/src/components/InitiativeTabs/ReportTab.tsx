import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FileText, Calendar, CalendarRange, BarChart3, MapPin, Users, Sparkles, Download, X, ChevronLeft, ChevronRight, Check, BookOpen, Plus, Pencil, Save, Tag } from 'lucide-react'
import { SectionLoader, EmptyState, Spinner, InlineAlert } from '../ui'
import FilterPill from '../shared/FilterPill'
import { ScopeColumn, ScopeChips } from '../shared/ScopeFilterColumns'
import ReportMetricCard, { REPORT_METRIC_CARD_H } from '../report/ReportMetricCard'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'
import { fadeUp, staggerContainer, viewSwap } from '../timeline/motion'
import { getLocalDateString } from '../../utils'
import { apiService } from '../../services/api'
import { KPI, Location, BeneficiaryGroup, Story, InitiativeDashboard, MetricTag } from '../../types'
import StoryCard from '../StoryCard'
import DateRangePicker from '../DateRangePicker'
import { notify } from '../../lib/notify'
import L from 'leaflet'
import html2canvas from 'html2canvas'
import ReportCanvas, { REPORT_CANVAS_ID, REPORT_CANVAS_W, REPORT_CANVAS_H, ReportCanvasProps } from '../report/ReportCanvas'
import { convertReportToImage } from '../../utils/reportToImage'
import { imageToDataUrl } from '../../utils/imageToDataUrl'
import { useTeam } from '../../context/TeamContext'

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
}

function reportStoryToCard(story: ReportData['stories'][number], initiativeId: string): Story {
 return {
 initiative_id: initiativeId,
 id: story.id,
 title: story.title,
 description: story.description,
 date_represented: story.date_represented,
 media_url: story.media_url,
 media_type: story.media_type ?? 'photo',
 location_id: story.location_id,
 location: story.location_name
 ? { id: story.location_id, name: story.location_name, latitude: 0, longitude: 0 }
 : undefined,
 }
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
 metricsNarrative?: string
 beneficiaryText: string
 mapImage: string | null
 hasBeneficiaryGroups: boolean
 } | null>(null)
 const [loadingMessage, setLoadingMessage] = useState('')

 // Loading states
 const [loadingFilters, setLoadingFilters] = useState(false)
 const [loadingReport, setLoadingReport] = useState(false)
 const [loadingData, setLoadingData] = useState(false)

 // UI state
 const [showDashboard, setShowDashboard] = useState(true)
 const [isEditingReport, setIsEditingReport] = useState(false)
 
 // Editable text state (separate from source data so we can edit without losing original)
 const [editableOverview, setEditableOverview] = useState<string>('')
 const [editableMetricsNarrative, setEditableMetricsNarrative] = useState<string>('')
 const [editableBeneficiaryText, setEditableBeneficiaryText] = useState<string>('')
 const [editableStoryTitle, setEditableStoryTitle] = useState<string>('')
 const [editableStoryDescription, setEditableStoryDescription] = useState<string>('')

 // Pre-fetched PNG data URLs for images embedded in the PDF (react-pdf can't
 // rely on remote URLs — CORS/format issues would break rendering).
 const [nexusLogoData, setNexusLogoData] = useState<string | null>(null)
 const [orgLogoData, setOrgLogoData] = useState<string | null>(null)
 const [storyPhotoData, setStoryPhotoData] = useState<string | null>(null)

  // Step wizard state
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 4
  const containerRef = useRef<HTMLDivElement>(null)

  // The report canvas is a fixed 1123×794 landscape frame. We scale it down to
  // fit the preview column; the image is captured from a separate full-size
  // off-screen copy so it stays crisp and un-warped.
  const previewWrapRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0.5)

 // Storage key for this initiative's report
 const storageKey = `report-${initiativeId}`

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
 setEditableMetricsNarrative(parsed.editableMetricsNarrative ?? parsed.reportDashboardData.metricsNarrative ?? '')
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
 setEditableMetricsNarrative('')
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
 setEditableMetricsNarrative('')
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
 editableMetricsNarrative,
 editableBeneficiaryText,
 editableStoryTitle,
 editableStoryDescription
 }
 localStorage.setItem(storageKey, JSON.stringify(dataToSave))
 } catch (error) {
 console.error('Failed to save report to localStorage:', error)
 }
 }
 }, [reportText, reportDashboardData, reportData, selectedStory, dateRange, showDashboard, storageKey, editableOverview, editableMetricsNarrative, editableBeneficiaryText, editableStoryTitle, editableStoryDescription])

 // Pre-fetch images for PDF embedding
 useEffect(() => {
 imageToDataUrl('/Nexuslogo.png').then(setNexusLogoData)
 }, [])

 useEffect(() => {
 const url = activeOrganization?.logo_url
 if (url) {
 imageToDataUrl(url).then(setOrgLogoData)
 } else {
 setOrgLogoData(null)
 }
 }, [activeOrganization?.logo_url])

 useEffect(() => {
 if (selectedStory?.media_url && selectedStory.media_type === 'photo') {
 imageToDataUrl(selectedStory.media_url).then(setStoryPhotoData)
 } else {
 setStoryPhotoData(null)
 }
 }, [selectedStory?.media_url, selectedStory?.media_type])

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
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [currentStep])

  // Keep the scaled preview matched to its column width.
  useEffect(() => {
    const wrap = previewWrapRef.current
    if (!wrap) return
    const update = () => {
      const w = wrap.clientWidth
      if (w > 0) setPreviewScale(w / REPORT_CANVAS_W)
    }
    const raf = requestAnimationFrame(update)
    const ro = new ResizeObserver(update)
    ro.observe(wrap)
    window.addEventListener('resize', update)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [showDashboard, isEditingReport, reportText, reportData])

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
 )
 })
 } finally {
 clearInterval(messageInterval)
 }

 setLoadingMessage('Preparing report...')

 setReportText(result.reportText)

 // Parse report text and extract sections
 const reportText = result.reportText

 // Pull a named "## Section" block out of the markdown, flattened to plain text.
 const extractSection = (heading: string): string => {
 const match = reportText.match(new RegExp(`##?\\s*${heading}[\\s\\S]*?(?=##?\\s|$)`, 'i'))
 if (!match) return ''
 return match[0]
 .replace(new RegExp(`##?\\s*${heading}\\s*`, 'i'), '')
 .split('\n')
 .map(l => l.trim())
 .filter(l => l && !l.startsWith('##'))
 .join(' ')
 .replace(/\*\*/g, '')
 .trim()
 }

 const overviewSummary = extractSection('Overview Summary')
 const metricsNarrative = extractSection('Total Metrics with Descriptions')
 const beneficiaryText = extractSection('Beneficiary Breakdown')

 // Helper function to export Leaflet map as image using html2canvas
 const exportLeafletMapAsImage = async (mapDiv: HTMLElement): Promise<string> => {
 return new Promise((resolve, reject) => {
 html2canvas(mapDiv, {
 useCORS: true,
 allowTaint: true,
 backgroundColor: '#f0f0f0',
 width: 400,
 height: 400,
 scale: 1
 })
 .then((canvas: HTMLCanvasElement) => {
 const dataUrl = canvas.toDataURL('image/png')
 resolve(dataUrl)
 })
 .catch((error: Error) => {
 reject(error)
 })
 })
 }

 // Helper function to render Leaflet map as image using canvas renderer
 const renderMapImage = async (locations: Array<{ latitude: number; longitude: number; name: string }>): Promise<string> => {
 return new Promise((resolve, reject) => {
 console.log('Rendering map with locations:', locations.length)

 if (locations.length === 0) {
 reject(new Error('No locations provided'))
 return
 }

 // Create hidden div for map - square shape
 const mapDiv = document.createElement('div')
 mapDiv.id = 'pdf-map-temp'
 mapDiv.style.width = '400px'
 mapDiv.style.height = '400px'
 mapDiv.style.position = 'absolute'
 mapDiv.style.top = '-9999px'
 mapDiv.style.left = '-9999px'
 mapDiv.style.zIndex = '-9999'
 mapDiv.style.backgroundColor = '#f0f0f0'
 document.body.appendChild(mapDiv)

 setTimeout(() => {
 try {
 // Calculate bounds and spread to determine appropriate zoom
 const bounds = L.latLngBounds(locations.map(loc => [loc.latitude, loc.longitude]))
 const center = bounds.getCenter()

 // Calculate spread (distance in degrees)
 const latDiff = bounds.getNorth() - bounds.getSouth()
 const lngDiff = bounds.getEast() - bounds.getWest()
 const maxSpread = Math.max(latDiff, lngDiff)

 // Determine zoom strategy based on spread
 // Small spread (< 5 degrees) = close together (city/region level) - zoom in more
 // Medium spread (5-30 degrees) = moderate distance (country level) - moderate zoom
 // Large spread (> 30 degrees) = far apart (continent/global) - zoom out
 let padding: [number, number]
 let maxZoom: number

 if (maxSpread < 5) {
 // Very close together - zoom in significantly
 padding = [20, 20]
 maxZoom = 12
 } else if (maxSpread < 15) {
 // Moderately close - zoom in moderately
 padding = [30, 30]
 maxZoom = 8
 } else if (maxSpread < 30) {
 // Moderate distance - country level
 padding = [40, 40]
 maxZoom = 5
 } else {
 // Far apart - continent/global level
 padding = [50, 50]
 maxZoom = 3
 }

 // Initialize map with canvas renderer - top-down view (no tilt)
 const map = L.map('pdf-map-temp', {
 renderer: L.canvas(),
 center: [center.lat, center.lng],
 zoom: 2, // Initial zoom, will be adjusted by fitBounds
 zoomControl: false,
 attributionControl: false,
 maxBoundsViscosity: 1.0,
 worldCopyJump: false,
 maxZoom: maxZoom
 })

 // Ensure top-down view (disable any tilt/rotation)
 map.dragging.disable()
 map.touchZoom.disable()
 map.doubleClickZoom.disable()
 map.scrollWheelZoom.disable()
 map.boxZoom.disable()
 map.keyboard.disable()

 // Add Carto Voyager tile layer - modern with blue water and colors
 const cartoTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
 attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
 subdomains: 'abcd',
 maxZoom: 20
 })

 // Fallback to OpenStreetMap if Carto fails
 cartoTileLayer.on('tileerror', () => {
 console.warn('Carto tiles failed in PDF export, using OSM fallback')
 cartoTileLayer.setUrl('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
 })

 cartoTileLayer.addTo(map)

 // Add modern markers - green pins with modern styling
 locations.forEach(loc => {
 // Modern pin style - using main site green color
 L.circleMarker([loc.latitude, loc.longitude], {
 radius: 12,
 color: '#ffffff',
 fillColor: '#c0dfa1', // Main site green (primary-500)
 fillOpacity: 1,
 weight: 3,
 className: 'modern-pin'
 })
 .bindPopup(loc.name)
 .addTo(map)

 // Add outer glow effect for modern look
 L.circleMarker([loc.latitude, loc.longitude], {
 radius: 18,
 color: 'transparent',
 fillColor: '#c0dfa1', // Main site green (primary-500)
 fillOpacity: 0.2,
 weight: 0,
 className: 'modern-pin-glow'
 })
 .addTo(map)
 })

 // Fit bounds with appropriate padding and max zoom
 if (locations.length > 1) {
 map.fitBounds(bounds, {
 padding: padding,
 maxZoom: maxZoom
 })
 } else {
 // Single location - zoom in closer
 map.setView([locations[0].latitude, locations[0].longitude], 10)
 }

 // Wait for map to be ready, then export using html2canvas
 map.whenReady(() => {
 console.log('Map ready, exporting with html2canvas...')
 setTimeout(() => {
 exportLeafletMapAsImage(mapDiv)
 .then((dataUrl: string) => {
 console.log('Map exported to image, length:', dataUrl.length)
 document.body.removeChild(mapDiv)
 map.remove()
 resolve(dataUrl)
 })
 .catch((error: Error) => {
 console.error('Failed to export map:', error)
 document.body.removeChild(mapDiv)
 map.remove()
 reject(error)
 })
 }, 2000) // Give tiles time to load
 })
 } catch (error) {
 console.error('Error creating map:', error)
 if (document.body.contains(mapDiv)) {
 document.body.removeChild(mapDiv)
 }
 reject(error)
 }
 }, 100)
 })
 }

 // Generate map image if locations exist
 let mapImage: string | null = null
 if (reportData.locations.length > 0) {
 try {
 console.log('Rendering map...')
 mapImage = await renderMapImage(reportData.locations)
 console.log('Map rendered successfully')
 } catch (error) {
 console.error('Failed to render map image:', error)
 notify.error('Could not render map. Report will be generated without map.')
 }
 }

 // Store dashboard data for rendering
 setReportDashboardData({
 overviewSummary: overviewSummary || 'No overview available',
 metricsNarrative,
 beneficiaryText,
 mapImage,
 hasBeneficiaryGroups: selectedBeneficiaryGroupIds.length > 0
 })

 // Initialize editable fields
 setEditableOverview(overviewSummary || 'No overview available')
 setEditableMetricsNarrative(metricsNarrative)
 setEditableBeneficiaryText(beneficiaryText)
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
 metricsNarrative,
 beneficiaryText,
 mapImage,
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

 const toggleKPI = (kpiId: string) => {
 setSelectedKPIIds(prev =>
 prev.includes(kpiId)
 ? prev.filter(id => id !== kpiId)
 : [...prev, kpiId]
 )
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
 setEditableMetricsNarrative('')
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

 const kpiById = useMemo(() => new Map(kpis.map(k => [k.id!, k])), [kpis])

 const kpiColorById = useMemo(() => {
 const map: Record<string, string> = {}
 kpis.forEach((kpi, index) => { map[kpi.id!] = getKPIColor(kpi.category, index) })
 return map
 }, [kpis])

 const stepMeta = useMemo(() => ({
 1: { title: 'Select report filters', subtitle: 'Choose the data you want to include in your report' },
 2: { title: 'Review your data', subtitle: 'Summary of metrics and locations included in this report' },
 3: { title: 'Add a story', subtitle: 'Optionally anchor the report with a beneficiary story' },
 4: { title: 'Generate report', subtitle: 'Confirm scope and create your AI-powered impact report' },
 }), [])

  // The report canvas props — a locked-size (A4 landscape) element rendered
  // twice: a scaled on-screen preview and a full-size off-screen node that is
  // the exact artwork captured into the PDF.
  const canvasProps = useMemo((): ReportCanvasProps | null => {
    if (!reportData || !reportDashboardData || !dashboard) return null
    return {
      initiativeTitle: dashboard.initiative.title,
      organizationName: activeOrganization?.name,
      brandColor: activeOrganization?.brand_color,
      orgLogo: orgLogoData,
      nexusLogo: nexusLogoData,
      storyPhoto: storyPhotoData,
      mapImage: reportDashboardData.mapImage,
      overviewSummary: editableOverview || reportDashboardData.overviewSummary,
      metricsNarrative: editableMetricsNarrative || reportDashboardData.metricsNarrative,
      beneficiaryText: editableBeneficiaryText || reportDashboardData.beneficiaryText,
      hasBeneficiaryGroups: reportDashboardData.hasBeneficiaryGroups,
      totals: reportData.totals.map(t => ({
        ...t,
        color: kpiColorById[t.kpi_id] || '#608341',
        metricType: kpiById.get(t.kpi_id)?.metric_type
      })),
      tags: reportData.tags,
      story: selectedStory ? {
        title: editableStoryTitle || selectedStory.title,
        description: editableStoryDescription || selectedStory.description,
        date_represented: selectedStory.date_represented,
        location_name: selectedStory.location_name
      } : null,
      locations: reportData.locations,
      dateStart: dateRange.startDate || dateRange.singleDate,
      dateEnd: dateRange.endDate || dateRange.singleDate
    }
  }, [
 reportData, reportDashboardData, dashboard, activeOrganization?.name, activeOrganization?.brand_color,
 orgLogoData, nexusLogoData, storyPhotoData, selectedStory, kpiColorById, kpiById,
 editableOverview, editableMetricsNarrative, editableBeneficiaryText, editableStoryTitle, editableStoryDescription,
 dateRange.startDate, dateRange.endDate, dateRange.singleDate
 ])

  const handleDownloadImage = async () => {
    if (!canvasProps) return
    try {
      notify.loading('Generating image...', { id: 'report-download' })
      const filename = `${dashboard?.initiative.title.replace(/[^a-z0-9]/gi, '_')}_Report_${new Date().toISOString().split('T')[0]}.png`
      const blob = await convertReportToImage(REPORT_CANVAS_ID)

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      notify.success('Report downloaded successfully!', { id: 'report-download' })
    } catch (error) {
      console.error('Error downloading report:', error)
      notify.error('Failed to download report', { id: 'report-download' })
    }
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
 {/* Full-screen loading overlay */}
 {loadingReport && (
 <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
 <div className="text-center max-w-md mx-auto px-6">
 <Sparkles className="w-10 h-10 text-primary-500 mx-auto mb-4" />
 <h2 className="text-2xl font-semibold text-secondary-900 mb-2">Generating Impact Report</h2>
 <SectionLoader label={loadingMessage || 'Processing...'} className="py-6" />
 </div>
 </div>
 )}

 <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-gray-100 bg-white flex-shrink-0">
 <div className="min-w-0">
 <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 leading-tight tracking-tight">AI Report</h2>
 <p className="text-sm text-gray-500 mt-1 hidden sm:block">Generate professional impact reports powered by AI</p>
 </div>
 </div>

 <div ref={containerRef} className="flex-1 bg-gray-50 overflow-y-auto min-h-0">
 <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
          {/* Full-size off-screen capture node — the exact 1:1 artwork PDF
              export reads from. Kept off-screen (not scaled) so html2canvas
              captures it without transform warping. */}
          {canvasProps && (
            <div
              aria-hidden
              style={{
                position: 'fixed',
                top: 0,
                left: -99999,
                width: REPORT_CANVAS_W,
                height: REPORT_CANVAS_H,
                pointerEvents: 'none',
                zIndex: -1,
              }}
            >
              <ReportCanvas {...canvasProps} />
            </div>
          )}

          {/* Report preview - Shown at top when generated */}
          {showDashboard && reportText && reportDashboardData && reportData && (
            <>
              {/* Make New Report Button - Above Report */}
              <div className="flex justify-center">
                <NewReportButton />
              </div>

 <div className="app-card-elevated app-pad-lg">
 <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
 <div>
 <h2 className="app-card-title">Impact Report</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Live preview — this is exactly what your downloaded image will look like</p>
 </div>
 <div className="flex items-center gap-2">
 {canExportReports && (isEditingReport ? (
 <button
 type="button"
 onClick={() => setIsEditingReport(false)}
 className="app-btn app-btn-primary app-btn-sm"
 >
 <Save className="w-4 h-4" />
 <span>Done Editing</span>
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
 {canExportReports && (
                    <button
                      onClick={handleDownloadImage}
                      className="app-btn app-btn-primary app-btn-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PNG</span>
                    </button>
 )}
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
 title="Close report"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>

 <div className={`flex gap-4 ${isEditingReport ? 'flex-col lg:flex-row' : ''}`}>
 {/* Edit panel - text fields update the preview live */}
 {isEditingReport && (
 <div className="w-full lg:w-80 flex-shrink-0 space-y-4 overflow-y-auto pr-1" style={{ maxHeight: '640px' }}>
 <div>
 <label className="app-label mb-1.5 block">Overview</label>
 <textarea
 value={editableOverview}
 onChange={(e) => setEditableOverview(e.target.value)}
 rows={6}
 className="app-input w-full text-sm resize-y"
 />
 </div>
 <div>
 <label className="app-label mb-1.5 block">What These Numbers Mean</label>
 <textarea
 value={editableMetricsNarrative}
 onChange={(e) => setEditableMetricsNarrative(e.target.value)}
 rows={6}
 className="app-input w-full text-sm resize-y"
 placeholder="Narrative explaining your metrics..."
 />
 </div>
 {reportDashboardData.hasBeneficiaryGroups && (
 <div>
 <label className="app-label mb-1.5 block">Who We Reached</label>
 <textarea
 value={editableBeneficiaryText}
 onChange={(e) => setEditableBeneficiaryText(e.target.value)}
 rows={5}
 className="app-input w-full text-sm resize-y"
 />
 </div>
 )}
 {selectedStory && (
 <>
 <div>
 <label className="app-label mb-1.5 block">Story Title</label>
 <input
 type="text"
 value={editableStoryTitle}
 onChange={(e) => setEditableStoryTitle(e.target.value)}
 className="app-input w-full text-sm"
 />
 </div>
 <div>
 <label className="app-label mb-1.5 block">Story Description</label>
 <textarea
 value={editableStoryDescription}
 onChange={(e) => setEditableStoryDescription(e.target.value)}
 rows={6}
 className="app-input w-full text-sm resize-y"
 />
 </div>
 </>
 )}
 <p className="text-xs text-gray-400">Changes appear in the preview after a short pause.</p>
 </div>
 )}

                {/* Live report preview — a scaled copy of the report. The
                    exact image artwork is the full-size off-screen node above. */}
                <div
                  ref={previewWrapRef}
                  className="flex-1 min-w-0 border border-gray-200 rounded-xl overflow-hidden bg-gray-100 shadow-inner"
                >
                  {canvasProps && (
                    <div style={{ width: REPORT_CANVAS_W * previewScale, height: REPORT_CANVAS_H * previewScale }}>
                      <div
                        style={{
                          width: REPORT_CANVAS_W,
                          height: REPORT_CANVAS_H,
                          transform: `scale(${previewScale})`,
                          transformOrigin: 'top left',
                        }}
                      >
                        <ReportCanvas {...canvasProps} domId="report-canvas-preview" />
                      </div>
                    </div>
                  )}
                </div>
 </div>
 </div>

 {/* Make New Report Button - Below Report */}
 <div className="flex justify-center">
 <NewReportButton />
 </div>
 </>
 )}

 {/* Step Wizard - Only show if no report generated OR dashboard is hidden */}
 {(!reportText || !reportDashboardData || !showDashboard) && (
 <motion.div
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0, transition: { duration: 0.35 } }}
 className="app-card"
 >
 {/* Stepper */}
 <div className="px-4 sm:px-5 py-3.5 border-b border-gray-100">
 <div className="flex items-center justify-center gap-1 overflow-x-auto">
 {steps.map((step, index) => {
 const isCurrent = currentStep === step.number
 const isDone = currentStep > step.number
 return (
 <React.Fragment key={step.number}>
 {index > 0 && (
 <div className={`w-6 sm:w-10 h-px flex-shrink-0 transition-colors ${isDone || isCurrent ? 'bg-primary-300' : 'bg-gray-200'}`} />
 )}
 <div className="flex items-center gap-1.5 flex-shrink-0">
 <span className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isCurrent
 ? 'bg-primary-500 text-white'
 : isDone
 ? 'bg-primary-100 text-primary-800'
 : 'bg-gray-100 text-gray-400'
 }`}>
 {isDone ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <step.icon className="w-3.5 h-3.5" />}
 </span>
 <span className={`text-xs font-medium whitespace-nowrap hidden sm:inline ${isCurrent ? 'text-gray-800' : isDone ? 'text-gray-500' : 'text-gray-400'}`}>
 {step.title}
 </span>
 </div>
 </React.Fragment>
 )
 })}
 </div>
 </div>

 {/* Step body — scrolls with the page, not in its own pane */}
 <div className="p-5 sm:p-8">
 <AnimatePresence mode="wait">
 <motion.div
 key={currentStep}
 initial={viewSwap.initial}
 animate={viewSwap.animate}
 exit={viewSwap.exit}
 className={`mx-auto ${currentStep === 3 ? 'max-w-6xl' : 'max-w-4xl'}`}
 >
 <h3 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
 {stepMeta[currentStep as 1 | 2 | 3 | 4].title}
 </h3>
 <p className="text-sm text-gray-500 mt-1.5 mb-6">
 {stepMeta[currentStep as 1 | 2 | 3 | 4].subtitle}
 </p>

 {/* Step 1: Filters */}
 {currentStep === 1 && (
 <div className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full">
 <ScopeColumn
 icon={CalendarRange}
 title="Date"
 done={!!(dateRange.singleDate || dateRange.startDate)}
 bodyClassName="max-h-none overflow-visible py-2"
 >
 <DateRangePicker
 variant="inline"
 compact
 value={dateRange}
 onChange={setDateRange}
 maxDate={getLocalDateString(new Date())}
 className="w-full -mx-1"
 />
 </ScopeColumn>

 <ScopeColumn
 icon={MapPin}
 title="Locations"
 done={selectedLocationIds.length > 0}
 >
 <ScopeChips
 icon={MapPin}
 label="Locations"
 options={locations.map(l => ({ id: l.id!, name: l.name }))}
 selected={selectedLocationIds}
 onChange={setSelectedLocationIds}
 hideHeader
 />
 </ScopeColumn>
 </div>

 <div className="flex flex-wrap gap-2">
 <FilterPill
 icon={Users}
 label="All groups"
 pluralLabel="groups"
 options={beneficiaryGroups.map(g => ({ id: g.id!, name: g.name }))}
 selected={selectedBeneficiaryGroupIds}
 onChange={setSelectedBeneficiaryGroupIds}
 emptyText="No beneficiary groups available"
 />
 <FilterPill
 icon={Tag}
 label="All tags"
 pluralLabel="tags"
 options={metricTags.map(t => ({ id: t.id, name: t.name, color: t.color ?? undefined }))}
 selected={selectedTagIds}
 onChange={setSelectedTagIds}
 emptyText="No tags available"
 />
 </div>

 <div>
 <div className="flex items-center justify-between gap-3 mb-3">
 <h4 className="app-section-title flex items-center gap-1.5">
 <BarChart3 className="w-4 h-4 text-primary-600" />
 Metrics
 </h4>
 <p className="text-xs text-gray-500">
 {selectedKPIIds.length === 0
 ? 'All metrics included'
 : `${selectedKPIIds.length} selected`}
 </p>
 </div>
 {kpis.length === 0 ? (
 <EmptyState title="No metrics available" description="Add metrics to your initiative first." />
 ) : (
 <motion.div
 variants={staggerContainer}
 initial="hidden"
 animate="visible"
 className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
 >
 {kpis.map(kpi => (
 <ReportMetricCard
 key={kpi.id}
 animate
 title={kpi.title}
 color={kpiColorById[kpi.id!] || '#608341'}
 metricType={kpi.metric_type}
 selectable
 selected={selectedKPIIds.length > 0 && selectedKPIIds.includes(kpi.id!)}
 onToggle={() => toggleKPI(kpi.id!)}
 />
 ))}
 </motion.div>
 )}
 <p className="text-xs text-gray-400 mt-3">
 Tap metrics to limit scope. Leave none selected to include all.
 </p>
 </div>

 {selectedBeneficiaryGroupIds.length > 0 ? (
 <InlineAlert tone="warning" title="Scoped report">
 Only includes data for selected beneficiary group{selectedBeneficiaryGroupIds.length > 1 ? 's' : ''}.
 </InlineAlert>
 ) : beneficiaryGroups.length > 0 ? (
 <InlineAlert tone="info" title="Full report">
 Includes all metrics across your initiative unless you narrow filters above.
 </InlineAlert>
 ) : null}
 </div>
 )}

 {/* Step 2: Review Data */}
 {currentStep === 2 && (
 <div className="space-y-6">
 {loadingData ? (
 <SectionLoader label="Loading data..." />
 ) : reportData ? (
 <>
 {reportData.totals.length > 0 && (
 <div>
 <h4 className="app-section-title mb-3 flex items-center gap-1.5">
 <BarChart3 className="w-4 h-4 text-primary-600" />
 Metrics ({reportData.totals.length})
 </h4>
 <motion.div
 variants={staggerContainer}
 initial="hidden"
 animate="visible"
 className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
 >
 {reportData.totals.map(total => {
 const kpi = kpiById.get(total.kpi_id)
 return (
 <ReportMetricCard
 key={total.kpi_id}
 animate
 title={total.kpi_title}
 color={kpiColorById[total.kpi_id] || '#608341'}
 total={total.total_value}
 unit={total.unit_of_measurement}
 metricType={kpi?.metric_type}
 />
 )
 })}
 </motion.div>
 </div>
 )}

 {reportData.locations.length > 0 && (
 <div className="app-card-muted p-4 sm:p-5">
 <h4 className="app-section-title mb-3 flex items-center gap-1.5">
 <MapPin className="w-4 h-4 text-primary-600" />
 Locations ({reportData.locations.length})
 </h4>
 <div className="flex flex-wrap gap-2">
 {reportData.locations.map(location => (
 <span
 key={location.id}
 className="inline-flex items-center h-8 px-3 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700"
 >
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
 description="Try adjusting your filter selections."
 />
 )}
 </>
 ) : (
 <EmptyState title="No data loaded" description="Go back to filters and try again." />
 )}
 </div>
 )}

 {/* Step 3: Add Story */}
 {currentStep === 3 && (
 <div className="space-y-4">
 {reportData?.stories && reportData.stories.length > 0 ? (
 <>
 <p className="text-xs text-gray-500">Tap a story to include it, or tap again to clear.</p>
 <motion.div
 variants={staggerContainer}
 initial="hidden"
 animate="visible"
 className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch"
 >
 {reportData.stories.map(story => {
 const isSelected = selectedStory?.id === story.id
 return (
 <motion.div key={story.id} variants={fadeUp} className="h-full">
 <StoryCard
 story={reportStoryToCard(story, initiativeId)}
 selectable
 selected={isSelected}
 onSelect={() => setSelectedStory(isSelected ? null : story)}
 />
 </motion.div>
 )
 })}
 </motion.div>
 </>
 ) : (
 <EmptyState
 icon={BookOpen}
 title="No stories available for the selected filters"
 description="You can proceed without a story."
 />
 )}

 {selectedStory && (
 <InlineAlert tone="info" title={`Selected: ${selectedStory.title}`}>
 <button
 type="button"
 onClick={() => setSelectedStory(null)}
 className="text-xs text-primary-700 hover:text-primary-800 underline mt-1"
 >
 Clear selection
 </button>
 </InlineAlert>
 )}
 </div>
 )}

 {/* Step 4: Generate */}
 {currentStep === 4 && (
 <div className="space-y-6">
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {[
 { label: 'Metrics', value: reportData?.totals.length || 0 },
 { label: 'Locations', value: reportData?.locations.length || 0 },
 {
 label: 'Date range',
 value: dateRange.startDate && dateRange.endDate
 ? `${dateRange.startDate} – ${dateRange.endDate}`
 : dateRange.singleDate || 'All dates',
 small: true,
 },
 { label: 'Story', value: selectedStory?.title || 'None', small: true },
 ].map((item, i) => (
 <motion.div
 key={item.label}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
 className="app-card p-3 sm:p-4"
 >
 <span className="text-xs text-gray-500">{item.label}</span>
 <p className={`font-semibold text-gray-900 mt-1 ${item.small ? 'text-xs leading-snug line-clamp-2' : 'text-lg tabular-nums'}`}>
 {item.value}
 </p>
 </motion.div>
 ))}
 </div>

 {reportData && reportData.totals.length > 0 && (
 <div>
 <h4 className="app-section-title mb-3">Included metrics</h4>
 <motion.div
 variants={staggerContainer}
 initial="hidden"
 animate="visible"
 className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
 >
 {reportData.totals.slice(0, 6).map(total => {
 const kpi = kpiById.get(total.kpi_id)
 return (
 <div key={total.kpi_id} className={REPORT_METRIC_CARD_H}>
 <ReportMetricCard
 title={total.kpi_title}
 color={kpiColorById[total.kpi_id] || '#608341'}
 total={total.total_value}
 unit={total.unit_of_measurement}
 metricType={kpi?.metric_type}
 />
 </div>
 )
 })}
 </motion.div>
 {reportData.totals.length > 6 && (
 <p className="text-xs text-gray-400 mt-2">+ {reportData.totals.length - 6} more</p>
 )}
 </div>
 )}

 <InlineAlert tone="info">
 <span className="inline-flex items-center gap-2">
 <Sparkles className="w-4 h-4 text-primary-600 flex-shrink-0" />
 AI will analyze your filtered data and generate a professional impact report.
 </span>
 </InlineAlert>
 </div>
 )}
 </motion.div>
 </AnimatePresence>
 </div>

 {/* Navigation footer — same scroll as step body */}
 <div className="app-divider px-5 py-3.5 bg-gray-50/80">
 <div className="flex items-center justify-between max-w-4xl mx-auto">
 <button
 type="button"
 onClick={handleBack}
 disabled={currentStep === 1}
 className="app-btn app-btn-secondary app-btn-sm"
 >
 <ChevronLeft className="w-4 h-4" />
 <span>Back</span>
 </button>

 <div className="flex items-center space-x-2">
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
 <span>Loading...</span>
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
 <span>Generating...</span>
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
 </motion.div>
 )}

 </div>
 </div>
 </div>
 )
}
