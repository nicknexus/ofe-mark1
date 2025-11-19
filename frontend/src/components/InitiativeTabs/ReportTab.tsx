import React, { useState, useEffect, useRef } from 'react'
import { FileText, Calendar, BarChart3, MapPin, Users, Sparkles, Download, Loader2 } from 'lucide-react'
import { apiService } from '../../services/api'
import { KPI, Location, BeneficiaryGroup, Story, InitiativeDashboard } from '../../types'
import DateRangePicker from '../DateRangePicker'
import toast from 'react-hot-toast'
import L from 'leaflet'
import html2canvas from 'html2canvas'

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
        if (!reportData || !selectedStory || !dashboard) return

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
                    selectedStory,
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

            // Create PDF blob
            const { jsPDF } = await import('jspdf')
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            })

            const pageWidth = doc.internal.pageSize.getWidth()
            const pageHeight = doc.internal.pageSize.getHeight()
            const margin = 20
            const contentWidth = pageWidth - (margin * 2)

            // Fixed heights for portrait layout
            const headerHeight = 30
            const storyImageHeight = 60
            const storySummaryHeight = 30
            const metricsHeight = 60
            const columnGap = 10
            const mapTitleHeight = 8
            const mapHeight = 60

            // Calculated fixed Y positions
            const headerY = 0
            const contentStartY = headerHeight + 5
            const colBlockHeight = Math.max(
                storyImageHeight + storySummaryHeight,
                metricsHeight + 30 // summary section
            )

            const topBlockY = contentStartY
            const mapTitleY = topBlockY + colBlockHeight + 10
            const mapY = mapTitleY + mapTitleHeight
            const footerY = pageHeight - 10

            // Green header background
            doc.setFillColor(34, 197, 94) // Green #22C55E
            doc.rect(0, 0, pageWidth, headerHeight, 'F')

            // Set page background color (dark blue)
            doc.setFillColor(74, 81, 99) // #4a5163
            doc.rect(0, headerHeight, pageWidth, pageHeight - headerHeight, 'F')

            // Set text color to white
            doc.setTextColor(255, 255, 255)

            // Format date
            const formatDate = (dateStr: string) => {
                if (!dateStr) return ''
                try {
                    const date = new Date(dateStr)
                    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                } catch {
                    return dateStr
                }
            }

            // Title Header - Green header background
            doc.setFontSize(20)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(255, 255, 255)
            doc.text(dashboard.initiative.title, margin, 12)

            doc.setFontSize(11)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(255, 255, 255)
            const dateRangeText = dateStart && dateEnd
                ? `${formatDate(dateStart)} - ${formatDate(dateEnd)}`
                : dateStart || dateEnd || 'Date range not specified'
            doc.text(dateRangeText, margin, 22)

            // Parse report text and extract sections
            const reportText = result.reportText
            let overviewSummary = ''
            let locationInfo = ''
            let mapSectionText = ''

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

            const locationInfoMatch = reportText.match(/##?\s*Location Information[\s\S]*?(?=##?\s*|$)/i)
            if (locationInfoMatch) {
                locationInfo = locationInfoMatch[0]
                    .replace(/##?\s*Location Information\s*/i, '')
                    .split('\n')
                    .map(l => l.trim())
                    .filter(l => l && !l.startsWith('##'))
                    .join(' ')
                    .trim()
            }

            const mapSectionMatch = reportText.match(/##?\s*Map Section Text[\s\S]*?(?=##?\s*|$)/i)
            if (mapSectionMatch) {
                mapSectionText = mapSectionMatch[0]
                    .replace(/##?\s*Map Section Text\s*/i, '')
                    .split('\n')
                    .map(l => l.trim())
                    .filter(l => l && !l.startsWith('##'))
                    .join(' ')
                    .trim()
            }

            // Dashboard layout: Two columns split down the middle
            const leftColumnWidth = (contentWidth - columnGap) / 2
            const rightColumnWidth = (contentWidth - columnGap) / 2
            const leftX = margin
            const rightX = leftX + leftColumnWidth + columnGap

            // LEFT COLUMN: Story photo + Story description in a box
            if (selectedStory) {
                const storyBoxHeight = storyImageHeight + storySummaryHeight + 8
                const storyBoxPadding = 3

                // Draw story box background
                doc.setFillColor(60, 70, 90)
                doc.setDrawColor(100, 100, 100)
                doc.setLineWidth(0.5)
                doc.roundedRect(leftX, topBlockY, leftColumnWidth, storyBoxHeight, 3, 3, 'FD')

                const storyContentX = leftX + storyBoxPadding
                const storyContentWidth = leftColumnWidth - (storyBoxPadding * 2)

                // Story photo
                if (selectedStory.media_url && selectedStory.media_type === 'photo') {
                    const photoWidth = storyContentWidth
                    const photoY = topBlockY + storyBoxPadding

                    try {
                        console.log('Loading story photo...')
                        const base64 = await loadImageAsBase64(selectedStory.media_url)
                        console.log('Adding image to PDF...')
                        // Determine format from base64 string
                        const format = base64.startsWith('data:image/png') ? 'PNG' : 'JPEG'
                        doc.addImage(base64, format, storyContentX, photoY, photoWidth, storyImageHeight)
                        console.log('Image added to PDF successfully')
                    } catch (error) {
                        // Fallback to placeholder if image fails to load
                        console.error('Failed to load story image:', error)
                        toast.error('Could not load story photo. Using placeholder.')
                        doc.setFillColor(50, 60, 80)
                        doc.setDrawColor(150, 150, 150)
                        doc.setLineWidth(1)
                        doc.rect(storyContentX, photoY, photoWidth, storyImageHeight, 'FD')

                        doc.setFontSize(8)
                        doc.setFont('helvetica', 'italic')
                        doc.setTextColor(200, 200, 200)
                        doc.text('[Photo]', storyContentX + photoWidth / 2, photoY + storyImageHeight / 2, { align: 'center' })
                    }
                }

                // Story description
                if (selectedStory.description) {
                    const storySummaryY = topBlockY + storyImageHeight + storyBoxPadding + 4
                    doc.setFontSize(9)
                    doc.setFont('helvetica', 'normal')
                    doc.setTextColor(255, 255, 255)
                    const descLines = doc.splitTextToSize(selectedStory.description, storyContentWidth)
                    const maxLines = Math.floor(storySummaryHeight / 5)
                    let currentY = storySummaryY
                    descLines.slice(0, maxLines).forEach((line: string) => {
                        doc.text(line, storyContentX, currentY)
                        currentY += 5
                    })
                }
            }

            // RIGHT COLUMN: Metrics boxes
            if (reportData.totals.length > 0) {
                // Metrics title
                doc.setFontSize(12)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(255, 255, 255)
                doc.text('Metrics', rightX, topBlockY)

                const boxHeight = 18
                const boxSpacing = 6
                const boxesPerRow = 2
                const boxWidth = (rightColumnWidth - boxSpacing) / boxesPerRow
                let currentBoxX = rightX
                let currentBoxY = topBlockY + 8
                let boxesInCurrentRow = 0

                // Calculate how many rows fit in metricsHeight
                const maxRows = Math.floor((metricsHeight - 8) / (boxHeight + boxSpacing))
                const maxBoxes = maxRows * boxesPerRow

                reportData.totals.slice(0, maxBoxes).forEach((total) => {
                    // Draw metric box
                    doc.setFillColor(60, 70, 90)
                    doc.setDrawColor(106, 114, 133)
                    doc.setLineWidth(0.5)
                    doc.roundedRect(currentBoxX, currentBoxY, boxWidth, boxHeight, 2, 2, 'FD')

                    // Metric title - wrap if too long
                    doc.setFontSize(7)
                    doc.setFont('helvetica', 'bold')
                    doc.setTextColor(255, 255, 255)
                    const titleLines = doc.splitTextToSize(total.kpi_title, boxWidth - 6)
                    // Allow up to 2 lines for title
                    const titleY = currentBoxY + 6
                    titleLines.slice(0, 2).forEach((line: string, index: number) => {
                        doc.text(line, currentBoxX + 3, titleY + (index * 4))
                    })

                    // Metric value - Green (position based on title lines)
                    const valueY = currentBoxY + (titleLines.length > 1 ? 12 : 14)
                    doc.setFontSize(10)
                    doc.setFont('helvetica', 'bold')
                    doc.setTextColor(34, 197, 94) // Green
                    const valueText = `${total.total_value} ${total.unit_of_measurement}`
                    doc.text(valueText, currentBoxX + 3, valueY)

                    boxesInCurrentRow++
                    if (boxesInCurrentRow >= boxesPerRow) {
                        currentBoxY += boxHeight + boxSpacing
                        currentBoxX = rightX
                        boxesInCurrentRow = 0
                    } else {
                        currentBoxX += boxWidth + boxSpacing
                    }
                })
            }

            // Summary text
            if (overviewSummary) {
                const overviewY = topBlockY + metricsHeight + 4
                // Summary title
                doc.setFontSize(12)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(255, 255, 255)
                doc.text('Summary', rightX, overviewY)

                // Summary text
                const summaryTextY = overviewY + 8
                doc.setFontSize(9)
                doc.setFont('helvetica', 'normal')
                doc.setTextColor(255, 255, 255)
                const summaryLines = doc.splitTextToSize(overviewSummary, rightColumnWidth)
                const maxLines = Math.floor(30 / 5) // 30mm height
                let currentY = summaryTextY
                summaryLines.slice(0, maxLines).forEach((line: string) => {
                    doc.text(line, rightX, currentY)
                    currentY += 5
                })
            }

            // Map Section - Clean, professional layout
            if (reportData.locations.length > 0) {
                // Map Title - Professional typography
                doc.setFontSize(12)
                doc.setFont('helvetica', 'bold')
                doc.setTextColor(255, 255, 255)
                doc.text('Geographic Distribution', margin, mapTitleY)

                // Map - Full width, centered, with border radius
                try {
                    console.log('Rendering map...')
                    const mapImage = await renderMapImage(reportData.locations)
                    console.log('Adding map to PDF...')

                    // Create a rounded rectangle mask effect by drawing rounded rect background
                    // Note: jsPDF doesn't support rounded corners on images directly,
                    // so we'll draw a rounded rect and clip, or use a workaround
                    const radius = 5

                    // Draw rounded rectangle background
                    doc.setFillColor(60, 70, 90)
                    doc.setDrawColor(100, 100, 100)
                    doc.setLineWidth(0.5)
                    doc.roundedRect(margin, mapY, contentWidth, mapHeight, radius, radius, 'FD')

                    // Add image (will be clipped by the rounded rect if we use save/restore)
                    // For now, just add the image - the rounded rect gives the border effect
                    doc.addImage(mapImage, 'PNG', margin, mapY, contentWidth, mapHeight)
                    console.log('Map added to PDF successfully')

                    // Location List - Clean format, 2 columns
                    const locationsListY = mapY + mapHeight + 8
                    doc.setFontSize(9)
                    doc.setFont('helvetica', 'normal')
                    doc.setTextColor(255, 255, 255)

                    const locationsPerColumn = Math.ceil(reportData.locations.length / 2)
                    const columnWidth = contentWidth / 2

                    reportData.locations.forEach((loc, index) => {
                        const column = index < locationsPerColumn ? 0 : 1
                        const row = index < locationsPerColumn ? index : index - locationsPerColumn
                        const locX = margin + (column * columnWidth)
                        const locY = locationsListY + (row * 5)
                        const locText = `• ${loc.name} (${loc.latitude.toFixed(3)}, ${loc.longitude.toFixed(3)})`
                        doc.text(locText, locX, locY)
                    })
                } catch (error) {
                    console.error('Failed to render map image:', error)
                    toast.error('Could not render map. Using placeholder.')
                    // Fallback: draw simple placeholder
                    doc.setFillColor(60, 80, 100)
                    doc.setDrawColor(200, 200, 200)
                    doc.setLineWidth(1)
                    doc.rect(margin, mapY, contentWidth, mapHeight, 'FD')

                    doc.setFontSize(10)
                    doc.setFont('helvetica', 'italic')
                    doc.setTextColor(200, 200, 200)
                    doc.text('Map unavailable', margin + contentWidth / 2, mapY + mapHeight / 2, { align: 'center' })
                }
            }

            // Footer - Subtle, centered, professional
            let footerYPosition = footerY
            if (reportData.locations.length > 0) {
                // Calculate where location list ends (accounting for 2 columns)
                const locationsListY = mapY + mapHeight + 8
                const locationsPerColumn = Math.ceil(reportData.locations.length / 2)
                const locationsListEndY = locationsListY + (locationsPerColumn * 5)
                // Footer should be at least 5mm below location list
                footerYPosition = Math.min(locationsListEndY + 5, pageHeight - 10)
            }

            const totalPages = doc.getNumberOfPages()
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i)
                doc.setFontSize(7) // Smaller, subtle
                doc.setTextColor(180, 180, 180) // Lighter gray
                doc.text(
                    'Nexus Impacts | Know Your Mark On The World',
                    pageWidth / 2,
                    footerYPosition,
                    { align: 'center' }
                )
                doc.text(
                    `Page ${i} of ${totalPages}`,
                    pageWidth - margin,
                    footerYPosition,
                    { align: 'right' }
                )
            }

            // Convert to blob
            const pdfBlob = doc.output('blob')
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
                        {reportData.stories.length > 0 && (
                            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Generate Report</h2>
                                {!selectedStory ? (
                                    <p className="text-sm text-gray-500 mb-4">Please select a story above to anchor the report narrative.</p>
                                ) : (
                                    <div className="mb-4">
                                        <p className="text-sm text-gray-600 mb-4">
                                            Selected story: <strong>{selectedStory.title}</strong>
                                        </p>
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
                                )}
                            </div>
                        )}

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

