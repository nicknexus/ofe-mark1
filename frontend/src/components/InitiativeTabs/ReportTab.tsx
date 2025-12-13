import React, { useState, useEffect, useRef } from 'react'
import { FileText, Calendar, BarChart3, MapPin, Users, Sparkles, Download, Loader2, X, ChevronLeft, ChevronRight, Check, BookOpen, Plus } from 'lucide-react'
import { apiService } from '../../services/api'
import { KPI, Location, BeneficiaryGroup, Story, InitiativeDashboard } from '../../types'
import DateRangePicker from '../DateRangePicker'
import toast from 'react-hot-toast'
import L from 'leaflet'
import html2canvas from 'html2canvas'
import ReportDashboard from '../ReportDashboard'
import { convertReportToPDF } from '../../utils/reportToPDF'

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

export default function ReportTab({ initiativeId, dashboard }: ReportTabProps) {
    // Filter state
    const [dateRange, setDateRange] = useState<{
        singleDate?: string
        startDate?: string
        endDate?: string
    }>({})
    const [selectedKPIIds, setSelectedKPIIds] = useState<string[]>([])
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
    const [selectedBeneficiaryGroupIds, setSelectedBeneficiaryGroupIds] = useState<string[]>([])

    // Data state
    const [kpis, setKPIs] = useState<KPI[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
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
    const [loadingFilters, setLoadingFilters] = useState(false)
    const [loadingReport, setLoadingReport] = useState(false)
    const [loadingData, setLoadingData] = useState(false)

    // UI state
    const [showKPIPicker, setShowKPIPicker] = useState(false)
    const [showLocationPicker, setShowLocationPicker] = useState(false)
    const [showBeneficiaryPicker, setShowBeneficiaryPicker] = useState(false)
    const [showDashboard, setShowDashboard] = useState(true)

    // Step wizard state
    const [currentStep, setCurrentStep] = useState(1)
    const totalSteps = 4
    const containerRef = useRef<HTMLDivElement>(null)
    const formContentRef = useRef<HTMLDivElement>(null)

    // Refs for click outside detection
    const kpiPickerRef = useRef<HTMLDivElement>(null)
    const locationPickerRef = useRef<HTMLDivElement>(null)
    const beneficiaryPickerRef = useRef<HTMLDivElement>(null)

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
                if (parsed.reportDashboardData) setReportDashboardData(parsed.reportDashboardData)
                if (parsed.reportData) setReportData(parsed.reportData)
                if (parsed.selectedStory) setSelectedStory(parsed.selectedStory)
                if (parsed.dateRange) setDateRange(parsed.dateRange)
                if (typeof parsed.showDashboard === 'boolean') setShowDashboard(parsed.showDashboard)
            } else {
                // Clear state if no saved data for this initiative
                setReportText(null)
                setReportDashboardData(null)
                setReportData(null)
                setSelectedStory(null)
                setShowDashboard(true)
            }
        } catch (error) {
            console.error('Failed to load saved report:', error)
            // Clear state on error
            setReportText(null)
            setReportDashboardData(null)
            setReportData(null)
            setSelectedStory(null)
            setShowDashboard(true)
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
                    showDashboard
                }
                localStorage.setItem(storageKey, JSON.stringify(dataToSave))
            } catch (error) {
                console.error('Failed to save report to localStorage:', error)
            }
        }
    }, [reportText, reportDashboardData, reportData, selectedStory, dateRange, showDashboard, storageKey])

    // Load filter options
    useEffect(() => {
        if (initiativeId) {
            Promise.all([
                apiService.getKPIs(initiativeId),
                apiService.getLocations(initiativeId),
                apiService.getBeneficiaryGroups(initiativeId)
            ]).then(([kpisData, locationsData, groupsData]) => {
                setKPIs(kpisData || [])
                setLocations(locationsData || [])
                setBeneficiaryGroups(groupsData || [])
            }).catch(() => {
                toast.error('Failed to load filter options')
            })
        }
    }, [initiativeId])

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (kpiPickerRef.current && !kpiPickerRef.current.contains(event.target as Node)) {
                setShowKPIPicker(false)
            }
            if (locationPickerRef.current && !locationPickerRef.current.contains(event.target as Node)) {
                setShowLocationPicker(false)
            }
            if (beneficiaryPickerRef.current && !beneficiaryPickerRef.current.contains(event.target as Node)) {
                setShowBeneficiaryPicker(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

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
                beneficiaryGroupIds: selectedBeneficiaryGroupIds.length > 0 ? selectedBeneficiaryGroupIds : undefined
            })

            setReportData(data)
            setSelectedStory(null)
            // Move to next step after loading data
            setCurrentStep(2)
        } catch (error) {
            console.error('Error loading report data:', error)
            toast.error('Failed to load report data')
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
                    toast.error('Could not render map. Report will be generated without map.')
                }
            }

            // Store dashboard data for rendering
            setReportDashboardData({
                overviewSummary: overviewSummary || 'No overview available',
                beneficiaryText: beneficiaryText || 'No beneficiary information available',
                mapImage,
                hasBeneficiaryGroups: selectedBeneficiaryGroupIds.length > 0
            })

            // Show dashboard when report is generated
            setShowDashboard(true)

            // Save to localStorage (will be handled by useEffect, but ensure it's saved immediately)
            try {
                const dataToSave = {
                    reportText: result.reportText,
                    reportDashboardData: {
                        overviewSummary: overviewSummary || 'No overview available',
                        beneficiaryText: beneficiaryText || 'No beneficiary information available',
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
                toast.error('OpenAI quota exceeded. Please add credits to your OpenAI account.', {
                    duration: 6000
                })
            } else if (error?.message?.includes('Rate Limit')) {
                toast.error('Rate limit exceeded. Please try again in a moment.', {
                    duration: 4000
                })
            } else {
                toast.error(error?.message || 'Failed to generate report')
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

    const toggleLocation = (locationId: string) => {
        setSelectedLocationIds(prev =>
            prev.includes(locationId)
                ? prev.filter(id => id !== locationId)
                : [...prev, locationId]
        )
    }

    const toggleBeneficiaryGroup = (groupId: string) => {
        setSelectedBeneficiaryGroupIds(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
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
        setCurrentStep(1)
        setShowDashboard(true)

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
    const NewReportButton = () => (
        <button
            onClick={handleStartNewReport}
            className="flex items-center space-x-2 px-6 py-3 bg-primary-100 text-primary-700 rounded-2xl hover:bg-primary-200 font-semibold transition-all duration-200 shadow-bubble-sm"
        >
            <Plus className="w-5 h-5" />
            <span>Make New Report</span>
        </button>
    )

    return (
        <div ref={containerRef} className="h-screen overflow-y-auto relative">
            {/* Full-screen loading overlay */}
            {loadingReport && (
                <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="text-center max-w-md mx-auto px-6">
                        <div className="relative mb-8">
                            <div className="w-20 h-20 mx-auto mb-6">
                                <div className="relative w-full h-full">
                                    <div className="absolute inset-0 border-4 border-primary-200 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-primary-500 rounded-full border-t-transparent animate-spin"></div>
                                </div>
                            </div>
                            <Sparkles className="w-12 h-12 text-primary-500 mx-auto mb-4 animate-pulse" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Generating Impact Report</h2>
                        <p className="text-lg text-gray-600 mb-8">{loadingMessage || 'Processing...'}</p>
                        <div className="flex items-center justify-center space-x-2">
                            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Report Dashboard - Shown at top when generated */}
                {showDashboard && reportText && reportDashboardData && reportData && (
                    <>
                        {/* Make New Report Button - Above Dashboard */}
                        <div className="flex justify-center">
                            <NewReportButton />
                        </div>

                        <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-base font-semibold text-gray-800">Report Dashboard</h2>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={async () => {
                                            try {
                                                toast.loading('Generating PDF...', { id: 'pdf-download' })
                                                const filename = `${dashboard?.initiative.title.replace(/[^a-z0-9]/gi, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`
                                                const pdfBlob = await convertReportToPDF('report-dashboard', filename)

                                                const url = URL.createObjectURL(pdfBlob)
                                                const link = document.createElement('a')
                                                link.href = url
                                                link.download = filename
                                                document.body.appendChild(link)
                                                link.click()
                                                document.body.removeChild(link)
                                                URL.revokeObjectURL(url)

                                                toast.success('PDF downloaded successfully!', { id: 'pdf-download' })
                                            } catch (error) {
                                                console.error('Error downloading PDF:', error)
                                                toast.error('Failed to download PDF', { id: 'pdf-download' })
                                            }
                                        }}
                                        className="px-4 py-2 bg-primary-500 text-white rounded-2xl hover:bg-primary-600 flex items-center space-x-2 text-sm font-medium transition-all duration-200 shadow-bubble-sm"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>Download as PDF</span>
                                    </button>
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
                                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all duration-200"
                                        title="Close dashboard"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="border border-gray-100 rounded-xl overflow-auto bg-gray-50/50" style={{ maxHeight: '900px' }}>
                                {dashboard && (
                                    <ReportDashboard
                                        dashboard={dashboard}
                                        overviewSummary={reportDashboardData.overviewSummary}
                                        totals={reportData.totals}
                                        beneficiaryText={reportDashboardData.beneficiaryText}
                                        hasBeneficiaryGroups={reportDashboardData.hasBeneficiaryGroups}
                                        selectedStory={selectedStory || undefined}
                                        locations={reportData.locations}
                                        dateStart={dateRange.startDate || dateRange.singleDate}
                                        dateEnd={dateRange.endDate || dateRange.singleDate}
                                        mapImage={reportDashboardData.mapImage}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Make New Report Button - Below Dashboard */}
                        <div className="flex justify-center">
                            <NewReportButton />
                        </div>
                    </>
                )}

                {/* Step Wizard - Only show if no report generated OR dashboard is hidden */}
                {(!reportText || !reportDashboardData || !showDashboard) && (
                    <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.15)] border border-white/60 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-primary-200/40 bg-gradient-to-r from-primary-100/50 to-primary-50/30 backdrop-blur-xl">
                            <div className="flex items-center space-x-3 flex-1">
                                <div className="w-11 h-11 rounded-xl bg-primary-500/15 backdrop-blur-sm flex items-center justify-center border border-primary-300/30">
                                    <Sparkles className="w-6 h-6 text-primary-500" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-gray-800">AI Report Generator</h2>
                                    <p className="text-sm text-gray-500 mt-0.5">Generate professional impact reports powered by AI</p>
                                </div>
                            </div>
                        </div>

                        {/* Progress Steps Indicator */}
                        <div className="px-6 py-4 border-b border-primary-100/40 bg-white/30 backdrop-blur-xl">
                            <div className="flex items-center justify-center">
                                {steps.map((step, index) => (
                                    <React.Fragment key={step.number}>
                                        <div className="flex flex-col items-center">
                                            <div className={`flex items-center justify-center w-10 h-10 rounded-xl border-2 transition-all duration-200 ${currentStep > step.number
                                                ? 'bg-primary-500 border-primary-500 text-white shadow-lg shadow-primary-500/30'
                                                : currentStep === step.number
                                                    ? 'bg-primary-500 border-primary-500 text-white ring-4 ring-primary-200/50 shadow-lg shadow-primary-500/30'
                                                    : 'bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-400'
                                                }`}>
                                                {currentStep > step.number ? (
                                                    <Check className="w-5 h-5" />
                                                ) : (
                                                    <step.icon className="w-5 h-5" />
                                                )}
                                            </div>
                                            <div className="mt-2 text-center">
                                                <div className={`text-xs font-medium whitespace-nowrap ${currentStep >= step.number ? 'text-gray-700' : 'text-gray-400'
                                                    }`}>
                                                    {step.title}
                                                </div>
                                            </div>
                                        </div>
                                        {index < steps.length - 1 && (
                                            <div className={`flex-1 h-0.5 mx-4 rounded-full transition-all duration-200 ${currentStep > step.number ? 'bg-primary-500' : 'bg-gray-200/60'
                                                }`} style={{ maxWidth: '120px' }} />
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        {/* Step Content */}
                        <div ref={formContentRef} className="p-8 min-h-[400px] max-h-[60vh] overflow-y-auto">
                            {/* Step 1: Filters */}
                            {currentStep === 1 && (
                                <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
                                    <div className="text-center mb-8">
                                        <h3 className="text-2xl font-semibold text-gray-900 mb-2">Select Report Filters</h3>
                                        <p className="text-gray-600">Choose the data you want to include in your report</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Date Range */}
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-900 mb-3">
                                                <Calendar className="w-5 h-5 inline mr-2 text-primary-600" />
                                                Date Range
                                            </label>
                                            <DateRangePicker
                                                value={dateRange}
                                                onChange={setDateRange}
                                            />
                                        </div>

                                        {/* KPI Multi-Select */}
                                        <div className="relative" ref={kpiPickerRef}>
                                            <label className="block text-sm font-semibold text-gray-900 mb-3">
                                                <BarChart3 className="w-5 h-5 inline mr-2 text-primary-600" />
                                                Metrics ({selectedKPIIds.length} selected)
                                            </label>
                                            <button
                                                onClick={() => setShowKPIPicker(!showKPIPicker)}
                                                className="w-full px-4 py-3 text-left bg-white border-2 border-gray-200 rounded-xl hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-bubble-sm transition-all"
                                            >
                                                {selectedKPIIds.length === 0
                                                    ? 'All metrics (default)'
                                                    : `${selectedKPIIds.length} metric${selectedKPIIds.length > 1 ? 's' : ''} selected`
                                                }
                                            </button>
                                            {showKPIPicker && (
                                                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-bubble max-h-60 overflow-y-auto">
                                                    {kpis.length === 0 ? (
                                                        <div className="p-4 text-sm text-gray-500">No metrics available</div>
                                                    ) : (
                                                        kpis.map(kpi => (
                                                            <label
                                                                key={kpi.id}
                                                                className={`flex items-center px-4 py-3 cursor-pointer transition-all ${selectedKPIIds.includes(kpi.id!) ? 'bg-primary-50' : 'hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedKPIIds.includes(kpi.id!)}
                                                                    onChange={() => toggleKPI(kpi.id!)}
                                                                    className="mr-3 w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                                                />
                                                                <span className="text-sm font-medium">{kpi.title}</span>
                                                            </label>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Location Multi-Select */}
                                        <div className="relative" ref={locationPickerRef}>
                                            <label className="block text-sm font-semibold text-gray-900 mb-3">
                                                <MapPin className="w-5 h-5 inline mr-2 text-primary-600" />
                                                Locations ({selectedLocationIds.length} selected)
                                            </label>
                                            <button
                                                onClick={() => setShowLocationPicker(!showLocationPicker)}
                                                className="w-full px-4 py-3 text-left bg-white border-2 border-gray-200 rounded-xl hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-bubble-sm transition-all"
                                            >
                                                {selectedLocationIds.length === 0
                                                    ? 'All locations (default)'
                                                    : `${selectedLocationIds.length} location${selectedLocationIds.length > 1 ? 's' : ''} selected`
                                                }
                                            </button>
                                            {showLocationPicker && (
                                                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-bubble max-h-60 overflow-y-auto">
                                                    {locations.length === 0 ? (
                                                        <div className="p-4 text-sm text-gray-500">No locations available</div>
                                                    ) : (
                                                        locations.map(location => (
                                                            <label
                                                                key={location.id}
                                                                className={`flex items-center px-4 py-3 cursor-pointer transition-all ${selectedLocationIds.includes(location.id!) ? 'bg-primary-50' : 'hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedLocationIds.includes(location.id!)}
                                                                    onChange={() => toggleLocation(location.id!)}
                                                                    className="mr-3 w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                                                />
                                                                <span className="text-sm font-medium">{location.name}</span>
                                                            </label>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Beneficiary Group Multi-Select */}
                                        <div className="relative" ref={beneficiaryPickerRef}>
                                            <label className="block text-sm font-semibold text-gray-900 mb-3">
                                                <Users className="w-5 h-5 inline mr-2 text-primary-600" />
                                                Beneficiary Groups ({selectedBeneficiaryGroupIds.length} selected)
                                            </label>
                                            <button
                                                onClick={() => setShowBeneficiaryPicker(!showBeneficiaryPicker)}
                                                className="w-full px-4 py-3 text-left bg-white border-2 border-gray-200 rounded-xl hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-bubble-sm transition-all"
                                            >
                                                {selectedBeneficiaryGroupIds.length === 0
                                                    ? 'All groups (default)'
                                                    : `${selectedBeneficiaryGroupIds.length} group${selectedBeneficiaryGroupIds.length > 1 ? 's' : ''} selected`
                                                }
                                            </button>
                                            {showBeneficiaryPicker && (
                                                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-bubble max-h-60 overflow-y-auto">
                                                    {beneficiaryGroups.length === 0 ? (
                                                        <div className="p-4 text-sm text-gray-500">No beneficiary groups available</div>
                                                    ) : (
                                                        beneficiaryGroups.map(group => (
                                                            <label
                                                                key={group.id}
                                                                className={`flex items-center px-4 py-3 cursor-pointer transition-all ${selectedBeneficiaryGroupIds.includes(group.id!) ? 'bg-primary-50' : 'hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedBeneficiaryGroupIds.includes(group.id!)}
                                                                    onChange={() => toggleBeneficiaryGroup(group.id!)}
                                                                    className="mr-3 w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                                                />
                                                                <span className="text-sm font-medium">{group.name}</span>
                                                            </label>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Step 2: Review Data */}
                            {currentStep === 2 && (
                                <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
                                    <div className="text-center mb-8">
                                        <h3 className="text-2xl font-semibold text-gray-900 mb-2">Review Your Data</h3>
                                        <p className="text-gray-600">Here's a summary of the data that will be included in your report</p>
                                    </div>

                                    {loadingData ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                                            <span className="ml-3 text-gray-600">Loading data...</span>
                                        </div>
                                    ) : reportData ? (
                                        <div className="space-y-6">
                                            {/* Metrics Summary */}
                                            {reportData.totals.length > 0 && (
                                                <div className="bg-gray-50 rounded-xl border-2 border-gray-200 p-6">
                                                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                                                        <BarChart3 className="w-5 h-5 mr-2 text-primary-600" />
                                                        Metrics Summary ({reportData.totals.length})
                                                    </h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {reportData.totals.map(total => (
                                                            <div key={total.kpi_id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                                                                <h5 className="font-medium text-gray-700 text-sm truncate">{total.kpi_title}</h5>
                                                                <p className="text-2xl font-bold text-evidence-500 mt-2">
                                                                    {total.total_value} <span className="text-sm font-normal text-gray-500">{total.unit_of_measurement}</span>
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Locations */}
                                            {reportData.locations.length > 0 && (
                                                <div className="bg-gray-50 rounded-xl border-2 border-gray-200 p-6">
                                                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                                                        <MapPin className="w-5 h-5 mr-2 text-primary-600" />
                                                        Locations ({reportData.locations.length})
                                                    </h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {reportData.locations.map(location => (
                                                            <span key={location.id} className="px-3 py-1.5 bg-white rounded-full border border-gray-200 text-sm font-medium text-gray-700">
                                                                {location.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* No data warning */}
                                            {reportData.totals.length === 0 && reportData.locations.length === 0 && (
                                                <div className="text-center py-12 bg-yellow-50 rounded-xl border-2 border-dashed border-yellow-300">
                                                    <FileText className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                                                    <p className="text-yellow-700 font-medium">No data found for the selected filters.</p>
                                                    <p className="text-yellow-600 text-sm mt-1">Try adjusting your filter selections.</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                                            <p className="text-gray-500">No data loaded. Go back to filters and try again.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Add Story */}
                            {currentStep === 3 && (
                                <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
                                    <div className="text-center mb-8">
                                        <h3 className="text-2xl font-semibold text-gray-900 mb-2">Add a Story (Optional)</h3>
                                        <p className="text-gray-600">Select a story to anchor your report narrative, or skip to generate without one</p>
                                    </div>

                                    {reportData?.stories && reportData.stories.length > 0 ? (
                                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                            {reportData.stories.map(story => (
                                                <div
                                                    key={story.id}
                                                    onClick={() => setSelectedStory(selectedStory?.id === story.id ? null : story)}
                                                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${selectedStory?.id === story.id
                                                        ? 'border-primary-400 bg-primary-50 shadow-lg shadow-primary-500/10'
                                                        : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <h4 className="font-semibold text-gray-800">{story.title}</h4>
                                                            {story.description && (
                                                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{story.description}</p>
                                                            )}
                                                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                                                                {story.location_name && (
                                                                    <span className="flex items-center">
                                                                        <MapPin className="w-3 h-3 mr-1" />
                                                                        {story.location_name}
                                                                    </span>
                                                                )}
                                                                <span className="flex items-center">
                                                                    <Calendar className="w-3 h-3 mr-1" />
                                                                    {story.date_represented}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {selectedStory?.id === story.id && (
                                                            <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center ml-3">
                                                                <Check className="w-4 h-4 text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                                            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                            <p className="text-gray-500 font-medium">No stories available for the selected filters.</p>
                                            <p className="text-gray-400 text-sm mt-1">You can proceed without a story.</p>
                                        </div>
                                    )}

                                    {selectedStory && (
                                        <div className="bg-primary-50 border-2 border-primary-200 rounded-xl p-4">
                                            <p className="text-sm text-primary-800">
                                                <strong>Selected:</strong> {selectedStory.title}
                                            </p>
                                            <button
                                                onClick={() => setSelectedStory(null)}
                                                className="text-xs text-primary-600 hover:text-primary-700 underline mt-1"
                                            >
                                                Clear selection
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 4: Generate */}
                            {currentStep === 4 && (
                                <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                                    <div className="text-center mb-8">
                                        <h3 className="text-2xl font-semibold text-gray-900 mb-2">Ready to Generate</h3>
                                        <p className="text-gray-600">Review your selections and generate your AI-powered impact report</p>
                                    </div>

                                    {/* Summary */}
                                    <div className="bg-gray-50 rounded-xl border-2 border-gray-200 p-6 space-y-4">
                                        <h4 className="font-semibold text-gray-800">Report Summary</h4>

                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div className="bg-white rounded-lg p-3 border border-gray-100">
                                                <span className="text-gray-500">Metrics</span>
                                                <p className="font-semibold text-gray-800">{reportData?.totals.length || 0} included</p>
                                            </div>
                                            <div className="bg-white rounded-lg p-3 border border-gray-100">
                                                <span className="text-gray-500">Locations</span>
                                                <p className="font-semibold text-gray-800">{reportData?.locations.length || 0} included</p>
                                            </div>
                                            <div className="bg-white rounded-lg p-3 border border-gray-100">
                                                <span className="text-gray-500">Date Range</span>
                                                <p className="font-semibold text-gray-800">
                                                    {dateRange.startDate && dateRange.endDate
                                                        ? `${dateRange.startDate} - ${dateRange.endDate}`
                                                        : dateRange.singleDate || 'All dates'
                                                    }
                                                </p>
                                            </div>
                                            <div className="bg-white rounded-lg p-3 border border-gray-100">
                                                <span className="text-gray-500">Featured Story</span>
                                                <p className="font-semibold text-gray-800 truncate">{selectedStory?.title || 'None'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-primary-50 border-2 border-primary-200 rounded-xl p-5 text-center">
                                        <Sparkles className="w-10 h-10 text-primary-500 mx-auto mb-3" />
                                        <p className="text-sm text-primary-800 leading-relaxed">
                                            Our AI will analyze your data and generate a professional impact report with insights, metrics visualization, and narrative content.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Navigation Footer */}
                        <div className="border-t border-primary-100/40 p-6 bg-white/30 backdrop-blur-xl">
                            <div className="flex items-center justify-between max-w-3xl mx-auto">
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    disabled={currentStep === 1}
                                    className={`flex items-center space-x-2 px-5 py-3 text-gray-600 bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-xl font-medium transition-all duration-200 ${currentStep === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/70'
                                        }`}
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                    <span>Back</span>
                                </button>

                                <div className="flex items-center space-x-3">
                                    {currentStep < totalSteps ? (
                                        <button
                                            type="button"
                                            onClick={handleNext}
                                            disabled={loadingData || !canProceedToNextStep()}
                                            className="flex items-center space-x-2 px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200 shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40"
                                        >
                                            {loadingData ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span>Loading...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>{currentStep === 1 ? 'Apply & Continue' : 'Next'}</span>
                                                    <ChevronRight className="w-5 h-5" />
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleGenerateReport}
                                            disabled={loadingReport || !reportData}
                                            className="flex items-center space-x-2 px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200 shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40"
                                        >
                                            {loadingReport ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span>Generating...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-5 h-5" />
                                                    <span>Generate Report</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Show dashboard link if hidden but report exists */}
                {reportText && reportDashboardData && !showDashboard && (
                    <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6 text-center">
                        <p className="text-gray-600 mb-4">
                            You have a previously generated report.
                        </p>
                        <div className="flex items-center justify-center gap-4">
                            <button
                                onClick={() => {
                                    setShowDashboard(true)
                                    try {
                                        const saved = localStorage.getItem(storageKey)
                                        if (saved) {
                                            const parsed = JSON.parse(saved)
                                            parsed.showDashboard = true
                                            localStorage.setItem(storageKey, JSON.stringify(parsed))
                                        }
                                    } catch (error) {
                                        console.error('Failed to update localStorage:', error)
                                    }
                                }}
                                className="px-6 py-3 bg-primary-500 text-white rounded-2xl hover:bg-primary-600 font-semibold transition-all duration-200 shadow-bubble-sm"
                            >
                                Show Report Dashboard
                            </button>
                            <NewReportButton />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
