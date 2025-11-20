import React, { useState, useEffect, useRef } from 'react'
import { FileText, Calendar, BarChart3, MapPin, Users, Sparkles, Download, Loader2 } from 'lucide-react'
import { apiService } from '../../services/api'
import { KPI, Location, BeneficiaryGroup, Story, InitiativeDashboard } from '../../types'
import DateRangePicker from '../DateRangePicker'
import toast from 'react-hot-toast'
import L from 'leaflet'
import html2canvas from 'html2canvas'
import { buildImpactPDF } from '../../pdf/pdfGenerator'

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
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
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

            setLoadingMessage('Generating PDF preview...')

            setReportText(result.reportText)

            // Generate PDF blob for preview
            await new Promise(resolve => setTimeout(resolve, 500)) // Small delay for UX

            // Helper function to load image as base64 using fetch + blob (bypasses CORS)
            const loadImageAsBase64 = async (url: string): Promise<string> => {
                try {
                    console.log('Fetching image from URL:', url)
                    const res = await fetch(url)
                    if (!res.ok) {
                        throw new Error(`HTTP error! status: ${res.status}`)
                    }
                    const blob = await res.blob()
                    console.log('Image fetched as blob, size:', blob.size)

                    return new Promise((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onloadend = () => {
                            const result = reader.result as string
                            console.log('Image converted to base64, length:', result.length)
                            resolve(result)
                        }
                        reader.onerror = () => reject(new Error('FileReader error'))
                        reader.readAsDataURL(blob)
                    })
                } catch (error) {
                    console.error('Failed to load image:', error)
                    throw error
                }
            }

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
                        width: 600,
                        height: 300,
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

                    // Create hidden div for map
                    const mapDiv = document.createElement('div')
                    mapDiv.id = 'pdf-map-temp'
                    mapDiv.style.width = '600px'
                    mapDiv.style.height = '300px'
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
                                zoom: locations.length > 1 ? 2 : 3,
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

                            // Add modern markers - green pins without names
                            locations.forEach(loc => {
                                // Modern pin style - larger, with shadow effect
                                L.circleMarker([loc.latitude, loc.longitude], {
                                    radius: 10,
                                    color: '#ffffff',
                                    fillColor: '#22C55E', // Green color
                                    fillOpacity: 1,
                                    weight: 2.5,
                                    className: 'modern-pin'
                                })
                                    .bindPopup(loc.name)
                                    .addTo(map)
                            })

                            // Fit bounds if multiple locations
                            if (locations.length > 1) {
                                const bounds = L.latLngBounds(locations.map(loc => [loc.latitude, loc.longitude]))
                                map.fitBounds(bounds, { padding: [20, 20] })
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

            // Build PDF using modular generator
            const pdfBlob = await buildImpactPDF({
                dashboard,
                overviewSummary: overviewSummary || 'No overview available',
                totals: reportData.totals,
                beneficiaryText: beneficiaryText || 'No beneficiary information available',
                selectedStory: selectedStory || undefined,
                mapImage: mapImage || undefined,
                locations: reportData.locations,
                dateStart,
                dateEnd,
                loadImageAsBase64
            })

            setPdfBlob(pdfBlob)

        } catch (error: any) {
            console.error('Error generating report:', error)

            // Clear PDF state on error
            setPdfBlob(null)
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
        <div className="h-[calc(100vh-64px)] overflow-y-auto bg-gray-50 relative">
            {/* Full-screen loading overlay */}
            {loadingReport && (
                <div className="fixed inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="text-center max-w-md mx-auto px-6">
                        <div className="relative mb-8">
                            <div className="w-20 h-20 mx-auto mb-6">
                                <div className="relative w-full h-full">
                                    <div className="absolute inset-0 border-4 border-primary-200 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent animate-spin"></div>
                                </div>
                            </div>
                            <Sparkles className="w-12 h-12 text-primary-600 mx-auto mb-4 animate-pulse" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Generating Impact Report</h2>
                        <p className="text-lg text-gray-600 mb-8">{loadingMessage || 'Processing...'}</p>
                        <div className="flex items-center justify-center space-x-2">
                            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                    <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-primary-100 rounded-lg">
                            <Sparkles className="w-6 h-6 text-primary-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">AI Report Generator</h1>
                            <p className="text-sm text-gray-500">Generate professional impact reports powered by AI</p>
                        </div>
                    </div>
                </div>

                {/* Filters Panel */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>

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
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <BarChart3 className="w-4 h-4 inline mr-1" />
                                Metrics ({selectedKPIIds.length} selected)
                            </label>
                            <button
                                onClick={() => setShowKPIPicker(!showKPIPicker)}
                                className="w-full px-4 py-2 text-left bg-white border border-gray-300 rounded-lg hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                {selectedKPIIds.length === 0
                                    ? 'Select metrics...'
                                    : `${selectedKPIIds.length} metric${selectedKPIIds.length > 1 ? 's' : ''} selected`
                                }
                            </button>
                            {showKPIPicker && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <MapPin className="w-4 h-4 inline mr-1" />
                                Locations ({selectedLocationIds.length} selected)
                            </label>
                            <button
                                onClick={() => setShowLocationPicker(!showLocationPicker)}
                                className="w-full px-4 py-2 text-left bg-white border border-gray-300 rounded-lg hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                {selectedLocationIds.length === 0
                                    ? 'Select locations...'
                                    : `${selectedLocationIds.length} location${selectedLocationIds.length > 1 ? 's' : ''} selected`
                                }
                            </button>
                            {showLocationPicker && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Users className="w-4 h-4 inline mr-1" />
                                Beneficiary Groups ({selectedBeneficiaryGroupIds.length} selected)
                            </label>
                            <button
                                onClick={() => setShowBeneficiaryPicker(!showBeneficiaryPicker)}
                                className="w-full px-4 py-2 text-left bg-white border border-gray-300 rounded-lg hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                {selectedBeneficiaryGroupIds.length === 0
                                    ? 'Select beneficiary groups...'
                                    : `${selectedBeneficiaryGroupIds.length} group${selectedBeneficiaryGroupIds.length > 1 ? 's' : ''} selected`
                                }
                            </button>
                            {showBeneficiaryPicker && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
                        className="w-full md:w-auto px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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
                            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Metrics Summary</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {reportData.totals.map(total => (
                                        <div key={total.kpi_id} className="p-4 bg-gray-50 rounded-lg">
                                            <h3 className="font-medium text-gray-900">{total.kpi_title}</h3>
                                            <p className="text-2xl font-bold text-primary-600 mt-2">
                                                {total.total_value} {total.unit_of_measurement}
                                            </p>
                                            {total.kpi_description && (
                                                <p className="text-sm text-gray-500 mt-1">{total.kpi_description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Stories List */}
                        {reportData.stories.length > 0 && (
                            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Stories ({reportData.stories.length})</h2>
                                <div className="space-y-3">
                                    {reportData.stories.map(story => (
                                        <div
                                            key={story.id}
                                            onClick={() => setSelectedStory(story)}
                                            className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedStory?.id === story.id
                                                ? 'border-primary-500 bg-primary-50'
                                                : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            <h3 className="font-medium text-gray-900">{story.title}</h3>
                                            {story.description && (
                                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{story.description}</p>
                                            )}
                                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
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
                            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Locations ({reportData.locations.length})</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {reportData.locations.map(location => (
                                        <div key={location.id} className="p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center space-x-2">
                                                <MapPin className="w-4 h-4 text-primary-600" />
                                                <span className="font-medium text-gray-900">{location.name}</span>
                                            </div>
                                            {location.description && (
                                                <p className="text-sm text-gray-600 mt-1">{location.description}</p>
                                            )}
                                            <p className="text-xs text-gray-500 mt-1">
                                                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Story Selection and Generate Button */}
                        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Report</h2>
                            {reportData.stories.length > 0 && !selectedStory ? (
                                <p className="text-sm text-gray-500 mb-4">Optional: Select a story above to anchor the report narrative, or generate without a story.</p>
                            ) : selectedStory ? (
                                <p className="text-sm text-gray-600 mb-4">
                                    Selected story: <strong>{selectedStory.title}</strong>
                                </p>
                            ) : null}
                            <button
                                onClick={handleGenerateReport}
                                disabled={loadingReport}
                                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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

                        {/* Report Preview */}
                        {reportText && pdfBlob && (
                            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-gray-900">Report Preview</h2>
                                    <button
                                        onClick={() => {
                                            if (!pdfBlob) return

                                            try {
                                                const url = URL.createObjectURL(pdfBlob)
                                                const link = document.createElement('a')
                                                link.href = url
                                                link.download = `${dashboard?.initiative.title.replace(/[^a-z0-9]/gi, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`
                                                document.body.appendChild(link)
                                                link.click()
                                                document.body.removeChild(link)
                                                URL.revokeObjectURL(url)

                                                toast.success('PDF downloaded successfully!')
                                            } catch (error) {
                                                console.error('Error downloading PDF:', error)
                                                toast.error('Failed to download PDF')
                                            }
                                        }}
                                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center space-x-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>Download PDF</span>
                                    </button>
                                </div>
                                <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: '800px' }}>
                                    <iframe
                                        src={URL.createObjectURL(pdfBlob)}
                                        className="w-full h-full"
                                        title="PDF Preview"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Empty State */}
                {!reportData && (
                    <div className="bg-white rounded-lg shadow-sm p-12 border border-gray-200 text-center">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Report Data</h3>
                        <p className="text-gray-500 mb-6">
                            Apply filters above to see metrics, stories, and locations for your report.
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

