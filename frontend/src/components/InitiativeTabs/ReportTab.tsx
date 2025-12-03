import React, { useState, useEffect, useRef } from 'react'
import { FileText, Calendar, BarChart3, MapPin, Users, Sparkles, Download, Loader2 } from 'lucide-react'
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

    // Refs for click outside detection
    const kpiPickerRef = useRef<HTMLDivElement>(null)
    const locationPickerRef = useRef<HTMLDivElement>(null)
    const beneficiaryPickerRef = useRef<HTMLDivElement>(null)

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
            setReportText(null)
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
                            // Initialize map with canvas renderer - top-down view (no tilt)
                            const map = L.map('pdf-map-temp', {
                                renderer: L.canvas(),
                                center: [locations[0].latitude, locations[0].longitude],
                                zoom: locations.length > 1 ? 0 : 1, // Even more zoomed out
                                zoomControl: false,
                                attributionControl: false,
                                maxBoundsViscosity: 1.0,
                                worldCopyJump: false
                            })

                            // Ensure top-down view (disable any tilt/rotation)
                            map.dragging.disable()
                            map.touchZoom.disable()
                            map.doubleClickZoom.disable()
                            map.scrollWheelZoom.disable()
                            map.boxZoom.disable()
                            map.keyboard.disable()

                            // Add tile layer
                            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                attribution: '',
                                maxZoom: 18
                            }).addTo(map)

                            // Add modern markers - green pins with modern styling
                            locations.forEach(loc => {
                                // Modern pin style - using dashboard green color
                                L.circleMarker([loc.latitude, loc.longitude], {
                                    radius: 12,
                                    color: '#ffffff',
                                    fillColor: '#97b599', // Dashboard green color
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
                                    fillColor: '#97b599',
                                    fillOpacity: 0.2,
                                    weight: 0,
                                    className: 'modern-pin-glow'
                                })
                                    .addTo(map)
                            })

                            // Fit bounds if multiple locations - more padding for zoomed out view
                            if (locations.length > 1) {
                                const bounds = L.latLngBounds(locations.map(loc => [loc.latitude, loc.longitude]))
                                map.fitBounds(bounds, { padding: [60, 60] })
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

    return (
        <div className="h-[calc(100vh-64px)] overflow-y-auto relative">
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
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="icon-bubble">
                            <Sparkles className="w-5 h-5 text-primary-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-gray-800">AI Report Generator</h1>
                            <p className="text-sm text-gray-500">Generate professional impact reports powered by AI</p>
                        </div>
                    </div>
                </div>

                {/* Filters Panel */}
                <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                    <h2 className="text-base font-semibold text-gray-800 mb-4">Filters</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {/* Date Range */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Date Range
                            </label>
                            <DateRangePicker
                                value={dateRange}
                                onChange={setDateRange}
                            />
                        </div>

                        {/* KPI Multi-Select */}
                        <div className="relative" ref={kpiPickerRef}>
                            <label className="block text-sm font-medium text-gray-600 mb-2">
                                <BarChart3 className="w-4 h-4 inline mr-1" />
                                Metrics ({selectedKPIIds.length} selected)
                            </label>
                            <button
                                onClick={() => setShowKPIPicker(!showKPIPicker)}
                                className="w-full px-4 py-2.5 text-left bg-white border border-gray-200 rounded-xl hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-bubble-sm"
                            >
                                {selectedKPIIds.length === 0
                                    ? 'Select metrics...'
                                    : `${selectedKPIIds.length} metric${selectedKPIIds.length > 1 ? 's' : ''} selected`
                                }
                            </button>
                            {showKPIPicker && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-bubble max-h-60 overflow-y-auto">
                                    {kpis.length === 0 ? (
                                        <div className="p-4 text-sm text-gray-500">No metrics available</div>
                                    ) : (
                                        kpis.map(kpi => (
                                            <label
                                                key={kpi.id}
                                                className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedKPIIds.includes(kpi.id!)}
                                                    onChange={() => toggleKPI(kpi.id!)}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">{kpi.title}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Location Multi-Select */}
                        <div className="relative" ref={locationPickerRef}>
                            <label className="block text-sm font-medium text-gray-600 mb-2">
                                <MapPin className="w-4 h-4 inline mr-1" />
                                Locations ({selectedLocationIds.length} selected)
                            </label>
                            <button
                                onClick={() => setShowLocationPicker(!showLocationPicker)}
                                className="w-full px-4 py-2.5 text-left bg-white border border-gray-200 rounded-xl hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-bubble-sm"
                            >
                                {selectedLocationIds.length === 0
                                    ? 'Select locations...'
                                    : `${selectedLocationIds.length} location${selectedLocationIds.length > 1 ? 's' : ''} selected`
                                }
                            </button>
                            {showLocationPicker && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-bubble max-h-60 overflow-y-auto">
                                    {locations.length === 0 ? (
                                        <div className="p-4 text-sm text-gray-500">No locations available</div>
                                    ) : (
                                        locations.map(location => (
                                            <label
                                                key={location.id}
                                                className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedLocationIds.includes(location.id!)}
                                                    onChange={() => toggleLocation(location.id!)}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">{location.name}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Beneficiary Group Multi-Select */}
                        <div className="relative" ref={beneficiaryPickerRef}>
                            <label className="block text-sm font-medium text-gray-600 mb-2">
                                <Users className="w-4 h-4 inline mr-1" />
                                Beneficiary Groups ({selectedBeneficiaryGroupIds.length} selected)
                            </label>
                            <button
                                onClick={() => setShowBeneficiaryPicker(!showBeneficiaryPicker)}
                                className="w-full px-4 py-2.5 text-left bg-white border border-gray-200 rounded-xl hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm shadow-bubble-sm"
                            >
                                {selectedBeneficiaryGroupIds.length === 0
                                    ? 'Select beneficiary groups...'
                                    : `${selectedBeneficiaryGroupIds.length} group${selectedBeneficiaryGroupIds.length > 1 ? 's' : ''} selected`
                                }
                            </button>
                            {showBeneficiaryPicker && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-bubble max-h-60 overflow-y-auto">
                                    {beneficiaryGroups.length === 0 ? (
                                        <div className="p-4 text-sm text-gray-500">No beneficiary groups available</div>
                                    ) : (
                                        beneficiaryGroups.map(group => (
                                            <label
                                                key={group.id}
                                                className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedBeneficiaryGroupIds.includes(group.id!)}
                                                    onChange={() => toggleBeneficiaryGroup(group.id!)}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">{group.name}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Apply Filters Button */}
                    <button
                        onClick={handleApplyFilters}
                        disabled={loadingData}
                        className="w-full md:w-auto px-6 py-2.5 bg-primary-500 text-white rounded-2xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 font-medium transition-all duration-200 shadow-bubble-sm"
                    >
                        {loadingData ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Loading...</span>
                            </>
                        ) : (
                            <>
                                <FileText className="w-4 h-4" />
                                <span>Apply Filters</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Results Preview Panel - Shown after filters applied */}
                {reportData && (
                    <div className="space-y-6">
                        {/* Totals Section */}
                        {reportData.totals.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                                <h2 className="text-base font-semibold text-gray-800 mb-4">Metrics Summary</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {reportData.totals.map(total => (
                                        <div key={total.kpi_id} className="p-4 bg-gray-50/50 rounded-xl border border-gray-100">
                                            <h3 className="font-medium text-gray-700 text-sm">{total.kpi_title}</h3>
                                            <p className="text-2xl font-semibold text-impact-500 mt-2">
                                                {total.total_value} <span className="text-sm font-normal text-gray-500">{total.unit_of_measurement}</span>
                                            </p>
                                            {total.kpi_description && (
                                                <p className="text-xs text-gray-500 mt-1">{total.kpi_description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Stories List */}
                        {reportData.stories.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                                <h2 className="text-base font-semibold text-gray-800 mb-4">Stories ({reportData.stories.length})</h2>
                                <div className="space-y-3">
                                    {reportData.stories.map(story => (
                                        <div
                                            key={story.id}
                                            onClick={() => setSelectedStory(story)}
                                            className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${selectedStory?.id === story.id
                                                ? 'border-primary-300 bg-primary-50 shadow-bubble-sm'
                                                : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            <h3 className="font-medium text-gray-800">{story.title}</h3>
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
                                                <span>{story.date_represented}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Locations List */}
                        {reportData.locations.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                                <h2 className="text-base font-semibold text-gray-800 mb-4">Locations ({reportData.locations.length})</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {reportData.locations.map(location => (
                                        <div key={location.id} className="p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                            <div className="flex items-center space-x-2">
                                                <MapPin className="w-4 h-4 text-primary-500" />
                                                <span className="font-medium text-gray-800 text-sm">{location.name}</span>
                                            </div>
                                            {location.description && (
                                                <p className="text-xs text-gray-500 mt-1">{location.description}</p>
                                            )}
                                            <p className="text-xs text-gray-400 mt-1">
                                                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Story Selection and Generate Button */}
                        <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                            <h2 className="text-base font-semibold text-gray-800 mb-4">Generate Report</h2>
                            {reportData.stories.length > 0 && !selectedStory ? (
                                <p className="text-sm text-gray-500 mb-4">Optional: Select a story above to anchor the report narrative, or generate without a story.</p>
                            ) : selectedStory ? (
                                <p className="text-sm text-gray-600 mb-4">
                                    Selected story: <strong className="text-gray-800">{selectedStory.title}</strong>
                                </p>
                            ) : null}
                            <button
                                onClick={handleGenerateReport}
                                disabled={loadingReport}
                                className="px-6 py-2.5 bg-primary-500 text-white rounded-2xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-medium transition-all duration-200 shadow-bubble-sm"
                            >
                                {loadingReport ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        <span>Generate AI Report</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Report Dashboard */}
                        {reportText && reportDashboardData && reportData && (
                            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-base font-semibold text-gray-800">Report Dashboard</h2>
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
                        )}
                    </div>
                )}

                {/* Empty State */}
                {!reportData && (
                    <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-12 text-center">
                        <div className="icon-bubble mx-auto mb-4">
                            <FileText className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Report Data</h3>
                        <p className="text-gray-500 text-sm">
                            Apply filters above to see metrics, stories, and locations for your report.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

