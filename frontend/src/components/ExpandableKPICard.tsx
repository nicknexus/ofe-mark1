import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
    ChevronDown,
    ChevronUp,
    Plus,
    Upload,
    Edit,
    Trash2,
    BarChart3,
    FileText,
    TrendingUp,
    Calendar,
    Target,
    X,
    Eye,
    MapPin,
    Camera,
    MessageSquare,
    DollarSign,
    Heart,
    Check
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { getCategoryColor, parseLocalDate, isSameDay, compareDates, formatDate, getEvidenceTypeInfo, getLocalDateString } from '../utils'
import DateRangePicker from './DateRangePicker'
import EvidencePreviewModal from './EvidencePreviewModal'
import DataPointPreviewModal from './DataPointPreviewModal'
import AddKPIUpdateModal from './AddKPIUpdateModal'
import AddEvidenceModal from './AddEvidenceModal'
import MetricCreditingModal from './MetricCreditingModal'
import EasyEvidenceModal from './EasyEvidenceModal'
import AllEvidenceModal from './AllEvidenceModal'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'

interface ExpandableKPICardProps {
    kpi: any
    kpiTotal: number
    isExpanded: boolean
    renderAsPage?: boolean // When true, renders as full page instead of portal overlay
    onToggleExpand: () => void
    onAddUpdate: () => void
    onAddEvidence: () => void
    onEdit: () => void
    onDelete: () => void
    kpiUpdates?: any[] // Add KPI updates data for this specific KPI
    initiativeId?: string // Initiative ID for fetching evidence
    onRefresh?: () => void // Optional callback to refresh data after updates
    metricColor?: string // Color for the metric's chart line (matches home tab color)
}

// Color palette matching MetricsDashboard - for metrics past 12, default to site green
const METRIC_COLOR_PALETTE = [
    '#3b82f6', // blue
    '#10b981', // green
    '#8b5cf6', // purple
    '#f59e0b', // amber
    '#ef4444', // red
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
    '#f97316', // orange
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#a855f7', // violet
]
const DEFAULT_METRIC_COLOR = '#c0dfa1' // site green (primary-500)

export default function ExpandableKPICard({
    kpi,
    kpiTotal,
    isExpanded,
    renderAsPage = false,
    onToggleExpand,
    onAddUpdate,
    onAddEvidence,
    onEdit,
    onDelete,
    kpiUpdates = [],
    initiativeId,
    onRefresh,
    metricColor
}: ExpandableKPICardProps) {

    // Use provided color or default to site green
    const chartColor = metricColor || DEFAULT_METRIC_COLOR

    // Lock body scroll when expanded (only for portal mode, not page mode)
    useEffect(() => {
        if (isExpanded && !renderAsPage) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }

        // Cleanup on unmount
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isExpanded, renderAsPage])

    // Time frame filter state
    const [timeFrame, setTimeFrame] = useState<'all' | '1month' | '6months' | '1year' | '5years'>('all')
    const [isCumulative, setIsCumulative] = useState(true)
    const [datePickerValue, setDatePickerValue] = useState<{
        singleDate?: string
        startDate?: string
        endDate?: string
    }>({})
    const [expandedDataPoints, setExpandedDataPoints] = useState<string[]>([])
    const [expandedEvidence, setExpandedEvidence] = useState<string[]>([])
    const [selectedEvidence, setSelectedEvidence] = useState<any>(null)
    const [selectedDataPoint, setSelectedDataPoint] = useState<any>(null)
    const [isEvidencePreviewOpen, setIsEvidencePreviewOpen] = useState(false)
    const [isDataPointPreviewOpen, setIsDataPointPreviewOpen] = useState(false)
    const [isEditDataPointModalOpen, setIsEditDataPointModalOpen] = useState(false)
    const [isEditEvidenceModalOpen, setIsEditEvidenceModalOpen] = useState(false)
    const [deleteConfirmDataPoint, setDeleteConfirmDataPoint] = useState<any>(null)
    const [deleteConfirmEvidence, setDeleteConfirmEvidence] = useState<any>(null)
    const [editingDataPoint, setEditingDataPoint] = useState<any>(null)
    const [evidence, setEvidence] = useState<any[]>([])
    const [loadingEvidence, setLoadingEvidence] = useState(false)
    const [updateLocations, setUpdateLocations] = useState<Record<string, any>>({})
    const [isCreditingModalOpen, setIsCreditingModalOpen] = useState(false)
    const [selectedClaimForEvidence, setSelectedClaimForEvidence] = useState<any>(null)
    const [isEasyEvidenceModalOpen, setIsEasyEvidenceModalOpen] = useState(false)
    const [isAllEvidenceModalOpen, setIsAllEvidenceModalOpen] = useState(false)


    const handleDataPointClick = (update: any) => {
        setSelectedDataPoint(update)
        setIsDataPointPreviewOpen(true)
    }

    const toggleEvidenceExpanded = (evidenceId: string) => {
        setExpandedEvidence(prev =>
            prev.includes(evidenceId)
                ? prev.filter(id => id !== evidenceId)
                : [...prev, evidenceId]
        )
    }

    // Load evidence for all cards (needed for evidence type percentages in collapsed view)
    useEffect(() => {
        if (kpi.id && initiativeId) {
            loadEvidence()
        }
    }, [kpi.id, initiativeId])

    // Load update locations when expanded
    useEffect(() => {
        if (isExpanded && kpiUpdates && kpiUpdates.length > 0) {
            loadUpdateLocations()
        }
    }, [isExpanded, kpiUpdates])

    const loadEvidence = async () => {
        if (!kpi.id || !initiativeId) return
        try {
            setLoadingEvidence(true)
            const data = await apiService.getEvidence(initiativeId, kpi.id)
            setEvidence(data || [])
        } catch (error) {
            console.error('Error loading evidence:', error)
            setEvidence([])
        } finally {
            setLoadingEvidence(false)
        }
    }

    const loadUpdateLocations = async () => {
        if (!kpiUpdates || kpiUpdates.length === 0) return

        // Get unique location IDs from updates
        const locationIds = [...new Set(kpiUpdates
            .filter((update: any) => update.location_id)
            .map((update: any) => update.location_id)
        )]

        if (locationIds.length === 0) {
            setUpdateLocations({})
            return
        }

        try {
            const locationPromises = locationIds.map((id: string) =>
                apiService.getLocation(id).catch(() => null)
            )
            const locations = await Promise.all(locationPromises)
            const locationMap: Record<string, any> = {}
            locationIds.forEach((id: string, index: number) => {
                if (locations[index]) {
                    locationMap[id] = locations[index]
                }
            })
            setUpdateLocations(locationMap)
        } catch (error) {
            console.error('Error loading update locations:', error)
            setUpdateLocations({})
        }
    }

    const handleEvidenceClick = (evidenceItem: any) => {
        setSelectedEvidence(evidenceItem)
        setIsEvidencePreviewOpen(true)
    }

    // Data Point handlers
    const handleEditDataPoint = (dataPoint: any) => {
        setEditingDataPoint(dataPoint)
        setIsEditDataPointModalOpen(true)
    }

    const handleDeleteDataPoint = async (dataPoint: any) => {
        if (!dataPoint.id) return
        try {
            await apiService.deleteKPIUpdate(dataPoint.id)
            toast.success('Impact claim deleted successfully!')

            // Clear cache and refresh data
            if (initiativeId) {
                apiService.clearCache(`/initiatives/${initiativeId}/dashboard`)
            }
            apiService.clearCache(`/kpis/${kpi.id}/updates`)
            onRefresh?.()

            // Reload evidence if expanded
            if (isExpanded && kpi.id && initiativeId) {
                loadEvidence()
            }

            setDeleteConfirmDataPoint(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete impact claim'
            toast.error(message)
        }
    }

    const handleUpdateDataPoint = async (updateData: any) => {
        if (!editingDataPoint?.id) return
        try {
            await apiService.updateKPIUpdate(editingDataPoint.id, updateData)
            toast.success('Impact claim updated successfully!')

            // Clear cache and refresh data
            if (initiativeId) {
                apiService.clearCache(`/initiatives/${initiativeId}/dashboard`)
            }
            apiService.clearCache(`/kpis/${kpi.id}/updates`)
            onRefresh?.()

            // Reload evidence if expanded
            if (isExpanded && kpi.id && initiativeId) {
                loadEvidence()
            }

            setIsEditDataPointModalOpen(false)
            setEditingDataPoint(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update impact claim'
            toast.error(message)
            throw error
        }
    }

    // Evidence handlers
    const handleEditEvidence = (evidence: any) => {
        setSelectedEvidence(evidence)
        setIsEditEvidenceModalOpen(true)
    }

    const handleDeleteEvidence = async (evidence: any) => {
        if (!evidence.id) return
        try {
            await apiService.deleteEvidence(evidence.id)
            toast.success('Evidence deleted successfully!')

            // Clear cache and refresh data
            if (initiativeId) {
                apiService.clearCache(`/initiatives/${initiativeId}/dashboard`)
            }
            onRefresh?.()

            // Reload evidence if expanded
            if (isExpanded && kpi.id && initiativeId) {
                loadEvidence()
            }

            setDeleteConfirmEvidence(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete evidence'
            toast.error(message)
        }
    }

    const handleUpdateEvidence = async (evidenceData: any) => {
        if (!selectedEvidence?.id) return
        try {
            await apiService.updateEvidence(selectedEvidence.id, evidenceData)
            toast.success('Evidence updated successfully!')

            // Clear cache and refresh data
            if (initiativeId) {
                apiService.clearCache(`/initiatives/${initiativeId}/dashboard`)
            }
            onRefresh?.()

            // Reload evidence if expanded
            if (isExpanded && kpi.id && initiativeId) {
                loadEvidence()
            }

            setIsEditEvidenceModalOpen(false)
            setSelectedEvidence(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update evidence'
            toast.error(message)
            throw error
        }
    }

    // Handler for easy evidence upload (single claim)
    const handleEasyEvidenceSubmit = async (evidenceData: any) => {
        try {
            await apiService.createEvidence(evidenceData)

            // Clear cache and refresh data
            if (initiativeId) {
                apiService.clearCache(`/initiatives/${initiativeId}/dashboard`)
            }
            apiService.clearCache(`/evidence?initiative_id=${initiativeId}&kpi_id=${kpi.id}`)
            onRefresh?.()

            // Reload evidence immediately to update UI
            if (kpi.id && initiativeId) {
                await loadEvidence()
            }

            setIsEasyEvidenceModalOpen(false)
            setSelectedClaimForEvidence(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add evidence'
            toast.error(message)
            throw error
        }
    }

    // Open easy evidence modal for a specific claim
    const handleAddEvidenceForClaim = (claim: any, e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        setSelectedClaimForEvidence(claim)
        setIsEasyEvidenceModalOpen(true)
    }

    // Calculate support percentage for an impact claim based on date overlap with evidence
    const getClaimSupportPercentage = (claim: any): number => {
        if (!claim || !claim.id || !evidence || evidence.length === 0) return 0

        // Find all evidence linked to this claim
        const linkedEvidence = evidence.filter((ev: any) => {
            // Check new precise linking
            if (ev.kpi_update_ids && Array.isArray(ev.kpi_update_ids)) {
                return ev.kpi_update_ids.includes(claim.id)
            }
            // Check nested evidence_kpi_updates
            if (ev.evidence_kpi_updates && Array.isArray(ev.evidence_kpi_updates)) {
                return ev.evidence_kpi_updates.some((link: any) => link.kpi_update_id === claim.id)
            }
            return false
        })

        if (linkedEvidence.length === 0) return 0

        // Calculate claim date range
        const claimStart = claim.date_range_start
            ? parseLocalDate(claim.date_range_start)
            : parseLocalDate(claim.date_represented)
        const claimEnd = claim.date_range_end
            ? parseLocalDate(claim.date_range_end)
            : parseLocalDate(claim.date_represented)

        const claimDays = Math.round((claimEnd.getTime() - claimStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

        // Collect all covered days from evidence
        const coveredDays = new Set<string>()

        linkedEvidence.forEach((ev: any) => {
            if (ev.date_range_start && ev.date_range_end) {
                // Evidence has date range
                const evidenceStart = parseLocalDate(ev.date_range_start)
                const evidenceEnd = parseLocalDate(ev.date_range_end)

                // Find overlap
                const overlapStart = new Date(Math.max(claimStart.getTime(), evidenceStart.getTime()))
                const overlapEnd = new Date(Math.min(claimEnd.getTime(), evidenceEnd.getTime()))

                if (overlapEnd >= overlapStart) {
                    // Add all days in the overlap using local date strings
                    for (let d = new Date(overlapStart); d <= overlapEnd; d.setDate(d.getDate() + 1)) {
                        if (d >= claimStart && d <= claimEnd) {
                            coveredDays.add(getLocalDateString(d))
                        }
                    }
                }
            } else if (ev.date_represented) {
                // Evidence has single date
                const evidenceDate = parseLocalDate(ev.date_represented)
                if (evidenceDate >= claimStart && evidenceDate <= claimEnd) {
                    coveredDays.add(ev.date_represented.split('T')[0])
                }
            }
        })

        // Calculate percentage
        const percentage = Math.round((coveredDays.size / claimDays) * 100)
        return Math.min(percentage, 100) // Cap at 100%
    }

    // Check if an impact claim has evidence supporting it (for boolean checks)
    const isClaimSupported = (claimId: string): boolean => {
        const claim = kpiUpdates.find((u: any) => u.id === claimId)
        if (!claim) return false
        return getClaimSupportPercentage(claim) > 0
    }

    // Get effective date for an update - use end date for ranges, otherwise use date_represented
    // Parse as local date to avoid timezone shifts
    const getEffectiveDate = (update: any): Date => {
        if (update.date_range_end) {
            return parseLocalDate(update.date_range_end)
        }
        return parseLocalDate(update.date_represented)
    }

    // Generate cumulative data for this specific KPI
    const generateChartData = () => {
        if (!kpiUpdates || kpiUpdates.length === 0) {
            return []
        }

        // Sort updates by effective date (end date for ranges, date_represented otherwise)
        const sortedUpdates = [...kpiUpdates].sort((a, b) =>
            getEffectiveDate(a).getTime() - getEffectiveDate(b).getTime()
        )

        // Calculate date range based on date picker, time frame, or all time
        const now = new Date()
        let startDate: Date
        let endDate: Date

        // If a single date is selected, only show that date
        if (datePickerValue.singleDate) {
            startDate = parseLocalDate(datePickerValue.singleDate)
            startDate.setHours(0, 0, 0, 0)
            endDate = parseLocalDate(datePickerValue.singleDate)
            endDate.setHours(23, 59, 59, 999)
        }
        // If a date range is selected, use that range
        else if (datePickerValue.startDate && datePickerValue.endDate) {
            startDate = parseLocalDate(datePickerValue.startDate)
            startDate.setHours(0, 0, 0, 0)
            endDate = parseLocalDate(datePickerValue.endDate)
            endDate.setHours(23, 59, 59, 999)
        }
        // Otherwise, use time frame
        else {
            if (timeFrame === 'all') {
                // Find the oldest update date for this KPI
                if (sortedUpdates.length > 0) {
                    startDate = getEffectiveDate(sortedUpdates[0])
                    startDate.setHours(0, 0, 0, 0)
                    // Subtract 1 day to show the graph starting at 0 before the first impact claim
                    startDate.setDate(startDate.getDate() - 1)
                } else {
                    // Fallback to 1 month if no updates
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
                    startDate.setHours(0, 0, 0, 0)
                }
            } else {
                switch (timeFrame) {
                    case '1month':
                        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
                        break
                    case '6months':
                        startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
                        break
                    case '1year':
                        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
                        break
                    case '5years':
                        startDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
                        break
                    default:
                        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
                }
                startDate.setHours(0, 0, 0, 0)
            }
            endDate = new Date(now)
            endDate.setHours(23, 59, 59, 999) // End of today
        }

        // Filter updates within the date range (using effective date)
        const filteredUpdates = sortedUpdates.filter(update => {
            const updateDate = getEffectiveDate(update)
            updateDate.setHours(0, 0, 0, 0)
            const updateStart = update.date_range_start ? parseLocalDate(update.date_range_start) : null
            const updateEnd = update.date_range_end ? parseLocalDate(update.date_range_end) : null

            // If update is a date range, check if it overlaps with filter range
            if (updateStart && updateEnd) {
                updateStart.setHours(0, 0, 0, 0)
                updateEnd.setHours(23, 59, 59, 999)
                return updateStart <= endDate && updateEnd >= startDate
            }
            // If update is a single date, check if it's within the range
            return compareDates(updateDate, startDate) >= 0 && compareDates(updateDate, endDate) <= 0
        })

        // Generate time series data with proper spacing
        const data: Array<{
            date: string;
            cumulative: number;
            value: number;
            fullDate: Date;
        }> = []

        // Non-cumulative mode: group by month (only when timeFrame is 'all' and no date picker)
        if (!isCumulative && timeFrame === 'all' && !datePickerValue.singleDate && !datePickerValue.startDate) {
            // Start from the month before the first impact claim
            const firstMonthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
            firstMonthStart.setMonth(firstMonthStart.getMonth() - 1)

            const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)

            // Group updates by month
            const monthlyTotals: Record<string, number> = {}

            filteredUpdates.forEach(update => {
                const updateDate = getEffectiveDate(update)
                const monthKey = `${updateDate.getFullYear()}-${String(updateDate.getMonth() + 1).padStart(2, '0')}`

                if (!monthlyTotals[monthKey]) {
                    monthlyTotals[monthKey] = 0
                }
                monthlyTotals[monthKey] += (update.value || 0)
            })

            // Generate monthly data points
            let currentMonthDate = new Date(firstMonthStart)
            while (currentMonthDate <= currentMonth) {
                const monthKey = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`
                const monthName = currentMonthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                const monthlyTotal = monthlyTotals[monthKey] || 0

                data.push({
                    date: monthName,
                    cumulative: monthlyTotal,
                    value: monthlyTotal,
                    fullDate: new Date(currentMonthDate)
                })

                // Move to next month
                currentMonthDate.setMonth(currentMonthDate.getMonth() + 1)
            }

            return data
        }

        // Cumulative mode: daily data points
        // Normalize startDate to midnight
        startDate.setHours(0, 0, 0, 0)
        const endDateNormalized = new Date(endDate)
        endDateNormalized.setHours(0, 0, 0, 0)

        const timeDiff = endDateNormalized.getTime() - startDate.getTime()
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))

        // Create daily data points for the entire period
        for (let i = 0; i <= daysDiff; i++) {
            const currentDate = new Date(startDate)
            currentDate.setDate(startDate.getDate() + i)
            currentDate.setHours(0, 0, 0, 0) // Normalize to midnight local time

            // Don't create dates beyond endDate
            if (compareDates(currentDate, endDateNormalized) > 0) {
                break
            }

            const dateString = formatDate(currentDate).split(',')[0] // Get just the date part without year

            // Find if there's an update on this date (using effective date)
            const updateOnThisDate = filteredUpdates.find(update => {
                const updateDate = getEffectiveDate(update)
                updateDate.setHours(0, 0, 0, 0)
                return isSameDay(updateDate, currentDate)
            })

            // Calculate cumulative value up to this point (using effective date)
            const cumulative = filteredUpdates
                .filter(update => {
                    const updateDate = getEffectiveDate(update)
                    updateDate.setHours(0, 0, 0, 0)
                    return compareDates(updateDate, currentDate) <= 0
                })
                .reduce((sum, update) => sum + (update.value || 0), 0)

            data.push({
                date: dateString,
                cumulative: cumulative,
                value: updateOnThisDate ? (updateOnThisDate.value || 0) : 0,
                fullDate: currentDate
            })
        }

        return data
    }

    const chartData = generateChartData()

    // Calculate x-axis interval to always show approximately 30 labels (1 month's worth)
    // For 1 month view, show every single day
    const getXAxisInterval = () => {
        // Non-cumulative mode: show every month (interval 0)
        if (!isCumulative && timeFrame === 'all' && !datePickerValue.singleDate && !datePickerValue.startDate) return 0

        // If viewing 1 month, show all labels (every day)
        if (timeFrame === '1month') return 0

        const dataPointCount = chartData.length
        if (dataPointCount <= 30) return 0 // Show all labels if we have 30 or fewer data points
        // Calculate interval to show ~30 labels: interval = floor((count - 1) / 30)
        return Math.floor((dataPointCount - 1) / 30)
    }

    // Calculate dynamic max value with headroom for the graph
    const calculateMaxWithHeadroom = () => {
        if (!chartData || chartData.length === 0) return 0

        // Find the maximum cumulative value
        let maxValue = 0
        chartData.forEach((dataPoint) => {
            if (dataPoint.cumulative && typeof dataPoint.cumulative === 'number' && isFinite(dataPoint.cumulative)) {
                maxValue = Math.max(maxValue, dataPoint.cumulative)
            }
        })

        if (maxValue === 0) return 0

        // Add dynamic headroom: more percentage for smaller values, less for larger values
        let headroomPercentage = 0.15 // Default 15%
        if (maxValue < 100) {
            headroomPercentage = 0.20 // 20% for small values
        } else if (maxValue < 1000) {
            headroomPercentage = 0.15 // 15% for medium values
        } else if (maxValue < 10000) {
            headroomPercentage = 0.12 // 12% for larger values
        } else {
            headroomPercentage = 0.10 // 10% for very large values
        }

        return maxValue * (1 + headroomPercentage)
    }

    const maxDomainValue = calculateMaxWithHeadroom()
    const actualMaxValue = Math.max(...chartData.map(d =>
        typeof d.cumulative === 'number' && isFinite(d.cumulative) ? d.cumulative : 0
    ).filter(v => v > 0), 0)

    // Generate ticks that include the actual max value
    const generateYTicks = () => {
        if (maxDomainValue === 0) return []
        const ticks: number[] = []
        const numTicks = 5
        const step = maxDomainValue / numTicks

        for (let i = 0; i <= numTicks; i++) {
            ticks.push(Math.round(i * step))
        }

        // Ensure the actual max value is included if it's not already close to a tick
        if (actualMaxValue > 0 && !ticks.some(t => Math.abs(t - actualMaxValue) < step * 0.1)) {
            ticks.push(actualMaxValue)
            ticks.sort((a, b) => a - b)
        }

        return ticks
    }

    const yTicks = generateYTicks()

    // Calculate evidence type percentages based on data point coverage
    const calculateEvidenceTypePercentages = () => {
        // Total data points (claims) for this KPI
        const totalDataPoints = kpiUpdates?.length || 0

        if (!evidence || evidence.length === 0 || totalDataPoints === 0) {
            return {
                visual_proof: { count: 0, percentage: 0 },
                documentation: { count: 0, percentage: 0 },
                testimony: { count: 0, percentage: 0 },
                financials: { count: 0, percentage: 0 }
            }
        }

        // For each evidence type, track which unique data points it covers
        const dataPointsCoveredByType: Record<string, Set<string>> = {
            visual_proof: new Set(),
            documentation: new Set(),
            testimony: new Set(),
            financials: new Set()
        }

        // Create a Set of valid update IDs for this KPI only
        const validUpdateIds = new Set(kpiUpdates.map((update: any) => update.id).filter(Boolean))

        // Go through each evidence item and track which data points it covers
        evidence.forEach((ev: any) => {
            if (!ev.type || !dataPointsCoveredByType.hasOwnProperty(ev.type)) return

            // Get data points covered by this evidence
            // Check if evidence has kpi_update_ids (new precise linking)
            if (ev.kpi_update_ids && Array.isArray(ev.kpi_update_ids)) {
                ev.kpi_update_ids.forEach((updateId: string) => {
                    // Only count updates that belong to THIS KPI
                    if (validUpdateIds.has(updateId)) {
                        dataPointsCoveredByType[ev.type as keyof typeof dataPointsCoveredByType].add(updateId)
                    }
                })
            } else if (ev.evidence_kpi_updates && Array.isArray(ev.evidence_kpi_updates)) {
                // Alternative: check if evidence has nested evidence_kpi_updates
                ev.evidence_kpi_updates.forEach((link: any) => {
                    if (link.kpi_update_id && validUpdateIds.has(link.kpi_update_id)) {
                        // Only count updates that belong to THIS KPI
                        dataPointsCoveredByType[ev.type as keyof typeof dataPointsCoveredByType].add(link.kpi_update_id)
                    }
                })
            } else if (kpi.id && ev.kpi_ids?.includes(kpi.id)) {
                // Legacy: if evidence is linked to the KPI (not specific updates), 
                // it covers all data points for this KPI
                kpiUpdates.forEach((update: any) => {
                    if (update.id) {
                        dataPointsCoveredByType[ev.type as keyof typeof dataPointsCoveredByType].add(update.id)
                    }
                })
            }
        })

        // Calculate percentage for each type: (unique data points covered / total data points) * 100
        return {
            visual_proof: {
                count: dataPointsCoveredByType.visual_proof.size,
                percentage: totalDataPoints > 0 ? Math.round((dataPointsCoveredByType.visual_proof.size / totalDataPoints) * 100) : 0
            },
            documentation: {
                count: dataPointsCoveredByType.documentation.size,
                percentage: totalDataPoints > 0 ? Math.round((dataPointsCoveredByType.documentation.size / totalDataPoints) * 100) : 0
            },
            testimony: {
                count: dataPointsCoveredByType.testimony.size,
                percentage: totalDataPoints > 0 ? Math.round((dataPointsCoveredByType.testimony.size / totalDataPoints) * 100) : 0
            },
            financials: {
                count: dataPointsCoveredByType.financials.size,
                percentage: totalDataPoints > 0 ? Math.round((dataPointsCoveredByType.financials.size / totalDataPoints) * 100) : 0
            }
        }
    }

    const evidenceTypePercentages = calculateEvidenceTypePercentages()

    // Get evidence type icon component
    const getEvidenceIcon = (type: 'visual_proof' | 'documentation' | 'testimony' | 'financials') => {
        switch (type) {
            case 'visual_proof': return Camera
            case 'documentation': return FileText
            case 'testimony': return MessageSquare
            case 'financials': return DollarSign
            default: return FileText
        }
    }

    // When renderAsPage is true, skip the card wrapper and collapsed view entirely
    if (renderAsPage && isExpanded) {
        return (
            <>
                {/* Full Page View - No card wrapper */}
                <div className="h-screen flex flex-col overflow-hidden">
                    {/* Header - Compact */}
                    <div className="flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-gray-100/60 px-4 py-2 shadow-soft-float">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <button onClick={(e) => { e.stopPropagation(); onToggleExpand() }} className="p-1.5 hover:bg-red-50 rounded-lg transition-all duration-200 border border-gray-100">
                                    <X className="w-4 h-4 text-red-500" />
                                </button>
                                <div>
                                    <h2 className="text-base font-bold text-gray-800">{kpi.title}</h2>
                                    <p className="text-xs text-gray-500 line-clamp-1 max-w-md">{kpi.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-1.5">
                                <button onClick={(e) => { e.stopPropagation(); onEdit() }} className="p-1.5 bg-white/60 hover:bg-white/80 border border-gray-200/60 text-gray-600 rounded-lg transition-all duration-200">
                                    <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-1.5 bg-red-50/80 hover:bg-red-100 text-red-500 rounded-lg transition-all duration-200">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content - Fit to screen */}
                    <div className="flex-1 p-3 flex flex-col gap-2 max-w-[1800px] mx-auto overflow-hidden w-full min-h-0">
                        {kpiUpdates.length === 0 && !loadingEvidence && evidence.length === 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6">
                                <div className="bg-white/80 backdrop-blur-xl border border-evidence-200/60 rounded-2xl p-6 shadow-soft-float hover:shadow-soft-float-hover transition-all duration-200">
                                    <div className="text-center">
                                        <div className="w-16 h-16 mx-auto mb-4 bg-evidence-100/80 rounded-2xl flex items-center justify-center">
                                            <BarChart3 className="w-8 h-8 text-evidence-500" />
                                        </div>
                                        <h5 className="text-lg font-bold text-gray-800 mb-2">Impact Claims</h5>
                                        <p className="text-sm text-gray-500 mb-4">You haven't added any of this type, add it here!</p>
                                        <button onClick={(e) => { e.stopPropagation(); onAddUpdate() }} className="inline-flex items-center space-x-2 px-5 py-2.5 bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-evidence-500/25">
                                            <Plus className="w-4 h-4" /><span>Add Impact Claim</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-white/80 backdrop-blur-xl border border-impact-200/60 rounded-2xl p-6 shadow-soft-float hover:shadow-soft-float-hover transition-all duration-200">
                                    <div className="text-center">
                                        <div className="w-16 h-16 mx-auto mb-4 bg-impact-100/80 rounded-2xl flex items-center justify-center">
                                            <FileText className="w-8 h-8 text-impact-500" />
                                        </div>
                                        <h5 className="text-lg font-bold text-gray-800 mb-2">Evidence</h5>
                                        <p className="text-sm text-gray-500 mb-4">You haven't added any of this type, add it here!</p>
                                        <button onClick={(e) => { e.stopPropagation(); onAddEvidence() }} className="inline-flex items-center space-x-2 px-5 py-2.5 bg-impact-500 hover:bg-impact-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-impact-500/25">
                                            <Plus className="w-4 h-4" /><span>Add Evidence</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-3 gap-2 flex-shrink-0">
                                    <div className="bg-white/80 backdrop-blur-xl border border-evidence-100/60 rounded-xl p-2.5 shadow-soft-float">
                                        <div className="flex items-center space-x-2">
                                            <div className="p-1.5 bg-evidence-100/80 rounded-lg"><BarChart3 className="w-4 h-4 text-evidence-500" /></div>
                                            <div><p className="text-xs text-gray-500">Impact Claims</p><p className="text-lg font-bold text-evidence-500">{kpi.total_updates}</p></div>
                                        </div>
                                    </div>
                                    <div className="bg-white/80 backdrop-blur-xl border border-impact-100/60 rounded-xl p-2.5 shadow-soft-float">
                                        <div className="flex items-center space-x-2">
                                            <div className="p-1.5 bg-impact-100/80 rounded-lg"><FileText className="w-4 h-4 text-impact-500" /></div>
                                            <div><p className="text-xs text-gray-500">Evidence Items</p><p className="text-lg font-bold text-impact-500">{kpi.evidence_count}</p></div>
                                        </div>
                                    </div>
                                    <div className="bg-white/80 backdrop-blur-xl border border-primary-100/60 rounded-xl p-2.5 shadow-soft-float">
                                        <div className="flex items-center space-x-2">
                                            <div className="p-1.5 bg-primary-100/80 rounded-lg"><Target className="w-4 h-4 text-primary-500" /></div>
                                            <div><p className="text-xs text-gray-500">Evidence Coverage</p><p className="text-lg font-bold text-primary-500">{kpi.evidence_percentage}%</p></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 h-8 bg-white/60 backdrop-blur-sm border border-gray-100/60 rounded-lg px-3 flex-shrink-0">
                                    {(['visual_proof', 'documentation', 'testimony', 'financials'] as const).map((type) => {
                                        const IconComponent = getEvidenceIcon(type)
                                        const typeInfo = getEvidenceTypeInfo(type)
                                        const percentage = evidenceTypePercentages[type].percentage
                                        const colorClasses = typeInfo.color.includes('pink') ? 'text-pink-600' : typeInfo.color.includes('blue') ? 'text-blue-600' : typeInfo.color.includes('orange') ? 'text-orange-600' : typeInfo.color.includes('green') ? 'text-primary-500' : 'text-gray-600'
                                        return (
                                            <div key={type} className="flex items-center gap-1.5 flex-1 min-w-0">
                                                <IconComponent className={`w-3.5 h-3.5 ${colorClasses} flex-shrink-0`} />
                                                <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
                                                    <span className="text-[9px] font-medium text-gray-700 truncate w-full leading-tight">{typeInfo.label}</span>
                                                    <span className="text-[8px] font-bold text-gray-600 leading-tight whitespace-nowrap">{percentage}%</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 flex-1 min-h-0 overflow-hidden">
                                    <div className="lg:col-span-3 bg-white/80 backdrop-blur-xl border border-gray-100/60 rounded-xl p-3 flex flex-col shadow-soft-float min-h-0 overflow-hidden">
                                        <div className="flex items-center justify-between mb-2 flex-shrink-0 gap-2">
                                            <div className="flex-shrink-0 min-w-0">
                                                <h5 className="text-sm lg:text-base font-semibold text-gray-900 truncate">{isCumulative ? 'Cumulative Progress' : 'Monthly Progress'}</h5>
                                                <p className="text-[10px] lg:text-xs text-gray-500 hidden sm:block">{isCumulative ? 'Running total over time' : 'Monthly totals'}</p>
                                            </div>
                                            <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
                                                <DateRangePicker value={datePickerValue} onChange={setDatePickerValue} maxDate={getLocalDateString(new Date())} placeholder="Date" className="w-auto text-[10px] lg:text-xs" />
                                                {timeFrame === 'all' && !datePickerValue.singleDate && !datePickerValue.startDate && (
                                                    <div className="flex items-center bg-gray-100 rounded-md lg:rounded-lg p-0.5">
                                                        <button onClick={() => setIsCumulative(true)} className={`px-2 lg:px-2.5 py-0.5 lg:py-1 text-[10px] lg:text-xs rounded-sm lg:rounded-md font-medium transition-colors ${isCumulative ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Cumulative</button>
                                                        <button onClick={() => setIsCumulative(false)} className={`px-2 lg:px-2.5 py-0.5 lg:py-1 text-[10px] lg:text-xs rounded-sm lg:rounded-md font-medium transition-colors ${!isCumulative ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Monthly</button>
                                                    </div>
                                                )}
                                                <div className="flex bg-gray-100 rounded-md lg:rounded-lg p-0.5">
                                                    {['all', '1month', '6months', '1year', '5years'].map((tf) => (
                                                        <button key={tf} onClick={() => { setTimeFrame(tf as any); setDatePickerValue({}); setIsCumulative(true) }} className={`px-1.5 lg:px-2.5 py-0.5 lg:py-1 text-[10px] lg:text-xs rounded-sm lg:rounded-md font-medium transition-colors ${timeFrame === tf && !datePickerValue.singleDate && !datePickerValue.startDate ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                                                            {tf === 'all' ? 'All' : tf === '1month' ? '1M' : tf === '6months' ? '6M' : tf === '1year' ? '1Y' : '5Y'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-h-[120px] flex items-center justify-center">
                                            {kpiUpdates && kpiUpdates.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={chartData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={10} tick={{ fill: '#9ca3af' }} angle={-45} textAnchor="end" height={50} interval={getXAxisInterval()} tickMargin={6} />
                                                        <YAxis stroke="#9ca3af" fontSize={10} tick={{ fill: '#9ca3af' }} domain={maxDomainValue > 0 ? [0, maxDomainValue] : [0, 'dataMax']} ticks={yTicks.length > 0 ? yTicks : undefined} tickFormatter={(value) => { if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`; if (value >= 1000) return `${(value / 1000).toFixed(1)}K`; return value.toString() }} />
                                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '10px', padding: '8px 10px', fontSize: '11px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} formatter={(value: any) => [typeof value === 'number' ? value.toLocaleString() + (kpi.unit_of_measurement ? ` ${kpi.unit_of_measurement}` : '') : value, 'Cumulative Total']} labelFormatter={(label) => { const dp = chartData.find(d => d.date === label); return dp?.fullDate ? formatDate(dp.fullDate) : `Date: ${label}` }} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5 5' }} />
                                                        <Line type="monotone" dataKey="cumulative" stroke={chartColor} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: chartColor, stroke: 'white', strokeWidth: 2 }} strokeLinecap="round" />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                                    <BarChart3 className="w-10 h-10 mb-3 opacity-50" />
                                                    <h4 className="text-base font-semibold text-gray-700 mb-1">No Data Yet</h4>
                                                    <p className="text-xs text-center max-w-xs">Add data to see your activity over time</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Impact Claims - Full Height */}
                                    <div className="lg:col-span-2 flex flex-col min-h-0 overflow-hidden">
                                        {kpiUpdates && kpiUpdates.length > 0 ? (
                                            <div className="bg-white/80 backdrop-blur-xl border border-evidence-100/60 rounded-xl p-3 shadow-soft-float flex flex-col flex-1 min-h-0">
                                                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                                                    <h5 className="text-sm font-semibold text-gray-800">Impact Claims ({kpiUpdates.length})</h5>
                                                    <button onClick={(e) => { e.stopPropagation(); onAddUpdate() }} className="flex items-center space-x-1.5 px-3 py-1.5 bg-evidence-500 hover:bg-evidence-600 text-white rounded-lg font-semibold text-xs transition-all duration-200 shadow-lg shadow-evidence-500/25"><Plus className="w-3.5 h-3.5" /><span>Add</span></button>
                                                </div>
                                                <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0">
                                                    {kpiUpdates.map((update, index) => (
                                                        <div key={update.id || index} className="border border-gray-100/80 rounded-lg bg-white/60 hover:bg-evidence-50/50 hover:border-evidence-200 cursor-pointer transition-all duration-200 p-2" onClick={() => handleDataPointClick(update)}>
                                                            <div className="flex items-center justify-between">
                                                                <div className="min-w-0 flex-1">
                                                                    <span className="text-xs font-semibold text-evidence-600">{update.value?.toLocaleString()} {kpi.unit_of_measurement}</span>
                                                                    <div className="flex items-center space-x-1.5 mt-0.5"><Calendar className="w-2.5 h-2.5 text-gray-400" /><span className="text-[10px] text-gray-500">{update.date_range_start && update.date_range_end ? `${formatDate(update.date_range_start)} - ${formatDate(update.date_range_end)}` : formatDate(update.date_represented)}</span></div>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    {(() => {
                                                                        const supportPercentage = getClaimSupportPercentage(update)
                                                                        return (
                                                                            <>
                                                                                {supportPercentage > 0 && (
                                                                                    <div className={`flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-medium w-[85px] whitespace-nowrap ${supportPercentage === 100
                                                                                        ? 'bg-primary-100 text-primary-700'
                                                                                        : 'bg-yellow-100 text-yellow-700'
                                                                                        }`}>
                                                                                        <span>{supportPercentage}% Supported</span>
                                                                                    </div>
                                                                                )}
                                                                                {supportPercentage === 0 && (
                                                                                    <div className="flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-medium w-[85px] whitespace-nowrap bg-red-100 text-red-700">
                                                                                        <span>0% Supported</span>
                                                                                    </div>
                                                                                )}
                                                                                {supportPercentage < 100 && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => handleAddEvidenceForClaim(update, e)}
                                                                                        className="flex items-center gap-1 px-2 py-1 bg-impact-100 hover:bg-impact-200 text-impact-700 rounded-md text-[10px] font-medium transition-colors"
                                                                                        title="Add supporting evidence for this claim"
                                                                                    >
                                                                                        <Upload className="w-2.5 h-2.5" />
                                                                                        <span>Support</span>
                                                                                    </button>
                                                                                )}
                                                                            </>
                                                                        )
                                                                    })()}
                                                                    <Eye className="w-3 h-3 text-gray-400" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* View All Evidence Button */}
                                                <div className="pt-2 mt-2 border-t border-gray-100 flex-shrink-0">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setIsAllEvidenceModalOpen(true) }}
                                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-impact-50 hover:bg-impact-100 text-impact-700 rounded-lg font-semibold text-xs transition-all duration-200 border border-impact-200"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" />
                                                        <span>View All Evidence ({evidence.length})</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-white/80 backdrop-blur-xl border-2 border-evidence-300/60 rounded-xl p-4 shadow-soft-float flex-1">
                                                <div className="text-center">
                                                    <div className="w-10 h-10 mx-auto mb-2 bg-evidence-100/80 rounded-lg flex items-center justify-center"><BarChart3 className="w-5 h-5 text-evidence-500" /></div>
                                                    <h5 className="text-sm font-semibold text-gray-800 mb-2">Impact Claims</h5>
                                                    <button onClick={(e) => { e.stopPropagation(); onAddUpdate() }} className="inline-flex items-center space-x-1.5 px-4 py-2 bg-evidence-500 hover:bg-evidence-600 text-white rounded-lg font-semibold text-xs transition-all duration-200 shadow-lg shadow-evidence-500/25"><Plus className="w-4 h-4" /><span>Add</span></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Modals for page mode */}
                {selectedDataPoint && createPortal(
                    <DataPointPreviewModal
                        dataPoint={selectedDataPoint}
                        kpi={selectedDataPoint.kpi || kpi}
                        isOpen={isDataPointPreviewOpen}
                        onClose={() => { setIsDataPointPreviewOpen(false); setSelectedDataPoint(null) }}
                        onEdit={(dp) => { setEditingDataPoint(dp); setIsDataPointPreviewOpen(false); setSelectedDataPoint(null); setIsEditDataPointModalOpen(true) }}
                        onDelete={(dp) => { setDeleteConfirmDataPoint(dp); setIsDataPointPreviewOpen(false); setSelectedDataPoint(null) }}
                        onEvidenceClick={(ev) => { setSelectedEvidence(ev); setIsDataPointPreviewOpen(false); setIsEvidencePreviewOpen(true) }}
                        onAddEvidence={(dp) => { setIsDataPointPreviewOpen(false); setSelectedDataPoint(null); setSelectedClaimForEvidence(dp); setIsEasyEvidenceModalOpen(true) }}
                    />,
                    document.body
                )}

                {selectedEvidence && createPortal(
                    <EvidencePreviewModal
                        evidence={selectedEvidence}
                        isOpen={isEvidencePreviewOpen}
                        onClose={() => setIsEvidencePreviewOpen(false)}
                        onEdit={(ev) => { setSelectedEvidence(ev); setIsEvidencePreviewOpen(false); setIsEditEvidenceModalOpen(true) }}
                        onDelete={(ev) => { setDeleteConfirmEvidence(ev); setIsEvidencePreviewOpen(false) }}
                        onDataPointClick={(dp) => { setSelectedDataPoint(dp); setIsEvidencePreviewOpen(false); setIsDataPointPreviewOpen(true) }}
                    />,
                    document.body
                )}

                {editingDataPoint && createPortal(
                    <AddKPIUpdateModal
                        isOpen={isEditDataPointModalOpen}
                        onClose={() => { setIsEditDataPointModalOpen(false); setEditingDataPoint(null) }}
                        onSubmit={handleUpdateDataPoint}
                        kpiTitle={kpi.title}
                        kpiId={kpi.id}
                        metricType={kpi.metric_type || 'number'}
                        unitOfMeasurement={kpi.unit_of_measurement || ''}
                        initiativeId={initiativeId}
                        editData={editingDataPoint}
                    />,
                    document.body
                )}

                {selectedEvidence && createPortal(
                    <AddEvidenceModal
                        isOpen={isEditEvidenceModalOpen}
                        onClose={() => { setIsEditEvidenceModalOpen(false); setSelectedEvidence(null) }}
                        onSubmit={handleUpdateEvidence}
                        availableKPIs={[kpi]}
                        initiativeId={kpi.initiative_id}
                        preSelectedKPIId={kpi.id}
                        editData={selectedEvidence}
                    />,
                    document.body
                )}

                {deleteConfirmDataPoint && createPortal(
                    <div className="fixed inset-0 bg-black/10 backdrop-blur-md flex items-center justify-center p-4 z-[80]">
                        <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl max-w-md w-full p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)]">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2.5 bg-red-100/80 rounded-xl"><Trash2 className="w-5 h-5 text-red-500" /></div>
                                <div><h3 className="text-lg font-semibold text-gray-800">Delete Impact Claim</h3><p className="text-sm text-gray-500">This action cannot be undone</p></div>
                            </div>
                            <p className="text-gray-600 mb-6">Are you sure you want to delete this impact claim?</p>
                            <div className="flex space-x-3">
                                <button onClick={() => setDeleteConfirmDataPoint(null)} className="flex-1 px-5 py-3 text-gray-600 bg-white/60 backdrop-blur-sm border border-gray-200/60 rounded-xl hover:bg-white/80 font-medium transition-all duration-200">Cancel</button>
                                <button onClick={() => handleDeleteDataPoint(deleteConfirmDataPoint)} className="flex-1 px-5 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 font-semibold shadow-lg shadow-red-500/25">Delete</button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {deleteConfirmEvidence && createPortal(
                    <div className="fixed inset-0 bg-black/10 backdrop-blur-md flex items-center justify-center p-4 z-[80]">
                        <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl max-w-md w-full p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)]">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2.5 bg-red-100/80 rounded-xl"><Trash2 className="w-5 h-5 text-red-500" /></div>
                                <div><h3 className="text-lg font-semibold text-gray-800">Delete Evidence</h3><p className="text-sm text-gray-500">This action cannot be undone</p></div>
                            </div>
                            <p className="text-gray-600 mb-6">Are you sure you want to delete this evidence?</p>
                            <div className="flex space-x-3">
                                <button onClick={() => setDeleteConfirmEvidence(null)} className="flex-1 px-5 py-3 text-gray-600 bg-white/60 backdrop-blur-sm border border-gray-200/60 rounded-xl hover:bg-white/80 font-medium transition-all duration-200">Cancel</button>
                                <button onClick={() => handleDeleteEvidence(deleteConfirmEvidence)} className="flex-1 px-5 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 font-semibold shadow-lg shadow-red-500/25">Delete</button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {isCreditingModalOpen && initiativeId && (
                    <MetricCreditingModal
                        isOpen={isCreditingModalOpen}
                        onClose={() => setIsCreditingModalOpen(false)}
                        onSave={async () => { onRefresh?.() }}
                        kpi={kpi}
                        kpiUpdates={kpiUpdates}
                        initiativeId={initiativeId}
                    />
                )}

                {/* Easy Evidence Modal - For single claim evidence upload */}
                {selectedClaimForEvidence && createPortal(
                    <EasyEvidenceModal
                        isOpen={isEasyEvidenceModalOpen}
                        onClose={() => {
                            setIsEasyEvidenceModalOpen(false)
                            setSelectedClaimForEvidence(null)
                        }}
                        onSubmit={handleEasyEvidenceSubmit}
                        impactClaim={selectedClaimForEvidence}
                        kpi={kpi}
                        initiativeId={initiativeId || kpi.initiative_id || ''}
                    />,
                    document.body
                )}

                {/* All Evidence Modal - View all evidence grouped by type */}
                {createPortal(
                    <AllEvidenceModal
                        isOpen={isAllEvidenceModalOpen}
                        onClose={() => setIsAllEvidenceModalOpen(false)}
                        evidence={evidence}
                        kpi={kpi}
                        onEvidenceClick={(ev) => {
                            setSelectedEvidence(ev)
                            setIsAllEvidenceModalOpen(false)
                            setIsEvidencePreviewOpen(true)
                        }}
                    />,
                    document.body
                )}
            </>
        )
    }

    return (
        <div className={`bg-white/90 backdrop-blur-xl border-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden ${(kpi.evidence_percentage || 0) >= 80
            ? 'border-primary-300/60 hover:border-primary-400/60'
            : (kpi.evidence_percentage || 0) >= 30
                ? 'border-yellow-300/60 hover:border-yellow-400/60'
                : 'border-red-300/60 hover:border-red-400/60'
            }`}>
            {/* Collapsed View - New Layout */}
            <div
                className="cursor-pointer h-full flex flex-col"
                onClick={onToggleExpand}
            >
                {/* Main Content Section */}
                <div className="flex flex-1 min-h-0">
                    {/* Left Section - ~70% width */}
                    <div className="w-[70%] bg-gradient-to-br from-blue-50/50 to-indigo-50/30 p-2.5 flex flex-col">
                        {/* Category Badge */}
                        <div className="mb-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getCategoryColor(kpi.category)}`}>
                                {kpi.category}
                            </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 leading-tight">{kpi.title}</h3>

                        {/* Metric Number */}
                        {kpiTotal !== undefined ? (
                            <div className="flex-1 flex flex-col justify-center">
                                <span className="text-5xl font-extrabold text-gray-900 tracking-tight leading-none">
                                    {kpiTotal.toLocaleString()}
                                </span>
                                <span className="text-sm font-medium text-gray-600 mt-1">
                                    {kpi.metric_type === 'percentage' ? '%' : kpi.unit_of_measurement}
                                </span>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center">
                                <div className="text-sm text-gray-400 font-medium">No data yet</div>
                            </div>
                        )}
                    </div>

                    {/* Right Section - ~30% width */}
                    <div className="w-[30%] bg-gradient-to-br from-purple-50/50 to-pink-50/30 p-3 flex flex-col border-l border-gray-200/50">
                        {/* Impact Claims */}
                        <div className="mb-2">
                            <div className="text-[9px] font-semibold text-gray-600 uppercase tracking-wide mb-0.5">
                                Impact Claims
                            </div>
                            <div className="text-2xl font-extrabold text-purple-700">
                                {kpi.total_updates || 0}
                            </div>
                        </div>

                        {/* Evidence Claims */}
                        <div className="mb-3">
                            <div className="text-[9px] font-semibold text-gray-600 uppercase tracking-wide mb-0.5">
                                Evidence Claims
                            </div>
                            <div className="text-2xl font-extrabold text-pink-700">
                                {kpi.evidence_count || 0}
                            </div>
                        </div>

                        {/* Evidence Type Grid - 2x2 */}
                        <div className="grid grid-cols-2 gap-1.5 mt-auto">
                            {(['visual_proof', 'documentation', 'testimony', 'financials'] as const).map((type) => {
                                const IconComponent = getEvidenceIcon(type)
                                const typeInfo = getEvidenceTypeInfo(type)
                                const percentage = evidenceTypePercentages[type].percentage

                                // Extract color classes from typeInfo
                                const colorClasses = typeInfo.color.includes('pink') ? 'text-pink-600' :
                                    typeInfo.color.includes('blue') ? 'text-blue-600' :
                                        typeInfo.color.includes('orange') ? 'text-orange-600' :
                                            typeInfo.color.includes('green') ? 'text-primary-500' :
                                                'text-gray-600'

                                return (
                                    <div
                                        key={type}
                                        className={`p-1.5 rounded bg-white/60 border border-gray-200/50 flex flex-col items-center justify-center ${percentage > 0 ? 'hover:bg-white/80' : 'opacity-50'}`}
                                    >
                                        <IconComponent className={`w-3 h-3 ${colorClasses}`} />
                                        <div className="text-[8px] font-bold text-gray-700 mt-0.5">
                                            {percentage}%
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Progress Bar Section - Full width at bottom */}
                <div className="px-3 py-2 bg-gradient-to-r from-gray-50 to-gray-100/50 border-t border-gray-200/50">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="font-semibold text-gray-600">Evidence Coverage</span>
                        <span className={`font-bold ${(kpi.evidence_percentage || 0) >= 80
                            ? 'text-primary-500'
                            : (kpi.evidence_percentage || 0) >= 30
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}>
                            {kpi.evidence_percentage || 0}%
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${(kpi.evidence_percentage || 0) >= 80
                                ? 'bg-gradient-to-r from-primary-500 to-primary-600'
                                : (kpi.evidence_percentage || 0) >= 30
                                    ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                                    : 'bg-gradient-to-r from-red-500 to-red-600'
                                }`}
                            style={{
                                width: `${Math.min(kpi.evidence_percentage || 0, 100)}%`
                            }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Expanded View - Full Screen (as page or portal) */}
            {isExpanded && (renderAsPage ? (
                // Render as inline page content (not portal)
                <div className="h-screen overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-100/60 p-4 shadow-soft-float">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onToggleExpand()
                                    }}
                                    className="p-2.5 hover:bg-red-50 rounded-xl transition-all duration-200 border border-gray-100"
                                >
                                    <X className="w-5 h-5 text-red-500" />
                                </button>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">{kpi.title}</h2>
                                    <p className="text-sm text-gray-500">{kpi.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onAddUpdate()
                                    }}
                                    className="flex items-center space-x-2 px-4 py-2.5 bg-evidence-100/80 hover:bg-evidence-200/80 text-evidence-700 rounded-xl text-sm font-medium transition-all duration-200"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add Impact Claim</span>
                                </button>
                                {kpi.total_updates > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onAddEvidence()
                                        }}
                                        className="flex items-center space-x-2 px-4 py-2.5 bg-impact-100/80 hover:bg-impact-200/80 text-impact-700 rounded-xl text-sm font-medium transition-all duration-200"
                                    >
                                        <Upload className="w-4 h-4" />
                                        <span>Add Evidence</span>
                                    </button>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setIsCreditingModalOpen(true)
                                    }}
                                    className="flex items-center space-x-2 px-4 py-2.5 bg-purple-100/80 hover:bg-purple-200/80 text-purple-700 rounded-xl text-sm font-medium transition-all duration-200"
                                >
                                    <Heart className="w-4 h-4" />
                                    <span>Credit to Donor</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onEdit()
                                    }}
                                    className="flex items-center space-x-2 px-4 py-2.5 bg-white/60 hover:bg-white/80 border border-gray-200/60 text-gray-600 rounded-xl text-sm font-medium transition-all duration-200"
                                >
                                    <Edit className="w-4 h-4" />
                                    <span>Edit</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onDelete()
                                    }}
                                    className="p-2.5 bg-red-50/80 hover:bg-red-100 text-red-500 rounded-xl transition-all duration-200"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content - Reuse the same content structure */}
                    <div className="p-4 space-y-4 max-w-[1600px] mx-auto">
                        {/* Check if metric is completely fresh (no claims AND no evidence) */}
                        {kpiUpdates.length === 0 && !loadingEvidence && evidence.length === 0 ? (
                            /* Fresh Metric - Show only Add buttons */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-8">
                                {/* Add Impact Claim */}
                                <div className="bg-white/80 backdrop-blur-xl border border-evidence-200/60 rounded-2xl p-8 shadow-soft-float hover:shadow-soft-float-hover transition-all duration-200">
                                    <div className="text-center">
                                        <div className="w-20 h-20 mx-auto mb-5 bg-evidence-100/80 rounded-2xl flex items-center justify-center">
                                            <BarChart3 className="w-10 h-10 text-evidence-500" />
                                        </div>
                                        <h5 className="text-xl font-bold text-gray-800 mb-2">Impact Claims</h5>
                                        <p className="text-sm text-gray-500 mb-6">You haven't added any of this type, add it here!</p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onAddUpdate()
                                            }}
                                            className="inline-flex items-center space-x-2 px-6 py-3 bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-evidence-500/25"
                                        >
                                            <Plus className="w-5 h-5" />
                                            <span>Add Impact Claim</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Add Evidence */}
                                <div className="bg-white/80 backdrop-blur-xl border border-impact-200/60 rounded-2xl p-8 shadow-soft-float hover:shadow-soft-float-hover transition-all duration-200">
                                    <div className="text-center">
                                        <div className="w-20 h-20 mx-auto mb-5 bg-impact-100/80 rounded-2xl flex items-center justify-center">
                                            <FileText className="w-10 h-10 text-impact-500" />
                                        </div>
                                        <h5 className="text-xl font-bold text-gray-800 mb-2">Evidence</h5>
                                        <p className="text-sm text-gray-500 mb-6">You haven't added any of this type, add it here!</p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onAddEvidence()
                                            }}
                                            className="inline-flex items-center space-x-2 px-6 py-3 bg-impact-500 hover:bg-impact-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-impact-500/25"
                                        >
                                            <Plus className="w-5 h-5" />
                                            <span>Add Evidence</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="bg-white/80 backdrop-blur-xl border border-evidence-100/60 rounded-2xl p-4 shadow-soft-float">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2.5 bg-evidence-100/80 rounded-xl">
                                                <BarChart3 className="w-5 h-5 text-evidence-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Impact Claims</p>
                                                <p className="text-xl font-bold text-evidence-500">{kpi.total_updates}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white/80 backdrop-blur-xl border border-impact-100/60 rounded-2xl p-4 shadow-soft-float">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2.5 bg-impact-100/80 rounded-xl">
                                                <FileText className="w-5 h-5 text-impact-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Evidence Items</p>
                                                <p className="text-xl font-bold text-impact-500">{kpi.evidence_count}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white/80 backdrop-blur-xl border border-primary-100/60 rounded-2xl p-4 shadow-soft-float">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2.5 bg-primary-100/80 rounded-xl">
                                                <Target className="w-5 h-5 text-primary-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Evidence Coverage</p>
                                                <p className="text-xl font-bold text-primary-500">{kpi.evidence_percentage}%</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Evidence Type Icons Row */}
                                <div className="flex items-center justify-between gap-2 h-10 bg-white/60 backdrop-blur-sm border border-gray-100/60 rounded-xl px-4 py-1">
                                    {(['visual_proof', 'documentation', 'testimony', 'financials'] as const).map((type) => {
                                        const IconComponent = getEvidenceIcon(type)
                                        const typeInfo = getEvidenceTypeInfo(type)
                                        const percentage = evidenceTypePercentages[type].percentage

                                        const colorClasses = typeInfo.color.includes('pink') ? 'text-pink-600' :
                                            typeInfo.color.includes('blue') ? 'text-blue-600' :
                                                typeInfo.color.includes('orange') ? 'text-orange-600' :
                                                    typeInfo.color.includes('green') ? 'text-primary-500' :
                                                        'text-gray-600'

                                        return (
                                            <div key={type} className="flex items-center gap-1.5 flex-1 min-w-0">
                                                <IconComponent className={`w-3.5 h-3.5 ${colorClasses} flex-shrink-0`} />
                                                <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
                                                    <span className="text-[9px] font-medium text-gray-700 truncate w-full leading-tight">
                                                        {typeInfo.label}
                                                    </span>
                                                    <span className="text-[8px] font-bold text-gray-600 leading-tight whitespace-nowrap">
                                                        {percentage}%
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Chart and Data Sections */}
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                                    {/* Chart Section */}
                                    <div className="lg:col-span-3 bg-white/80 backdrop-blur-xl border border-gray-100/60 rounded-2xl p-4 flex flex-col shadow-soft-float">
                                        <div className="flex items-center justify-between mb-4 gap-2">
                                            <div className="flex-shrink-0 min-w-0">
                                                <h5 className="text-base lg:text-lg font-semibold text-gray-900 truncate">{isCumulative ? 'Cumulative Progress' : 'Monthly Progress'}</h5>
                                                <p className="text-xs lg:text-sm text-gray-500 hidden sm:block">{isCumulative ? 'Running total over time' : 'Monthly totals over time'}</p>
                                            </div>
                                            <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
                                                <DateRangePicker value={datePickerValue} onChange={setDatePickerValue} maxDate={getLocalDateString(new Date())} placeholder="Date" className="w-auto" />
                                                {timeFrame === 'all' && !datePickerValue.singleDate && !datePickerValue.startDate && (
                                                    <div className="flex items-center bg-gray-100 rounded-md lg:rounded-lg p-0.5">
                                                        <button onClick={() => setIsCumulative(true)} className={`px-2 lg:px-2.5 py-0.5 lg:py-1 text-[10px] lg:text-xs rounded-sm lg:rounded-md font-medium transition-colors ${isCumulative ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Cumulative</button>
                                                        <button onClick={() => setIsCumulative(false)} className={`px-2 lg:px-2.5 py-0.5 lg:py-1 text-[10px] lg:text-xs rounded-sm lg:rounded-md font-medium transition-colors ${!isCumulative ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Monthly</button>
                                                    </div>
                                                )}
                                                <div className="flex bg-gray-100 rounded-md lg:rounded-lg p-0.5">
                                                    {['all', '1month', '6months', '1year', '5years'].map((tf) => (
                                                        <button key={tf} onClick={() => { setTimeFrame(tf as any); setDatePickerValue({}); setIsCumulative(true) }} className={`px-1.5 lg:px-2.5 py-0.5 lg:py-1 text-[10px] lg:text-xs rounded-sm lg:rounded-md font-medium transition-colors ${timeFrame === tf && !datePickerValue.singleDate && !datePickerValue.startDate ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                                                            {tf === 'all' ? 'All' : tf === '1month' ? '1M' : tf === '6months' ? '6M' : tf === '1year' ? '1Y' : '5Y'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 h-64 flex items-center justify-center">
                                            {kpiUpdates && kpiUpdates.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={chartData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tick={{ fill: '#9ca3af' }} angle={-45} textAnchor="end" height={60} interval={getXAxisInterval()} tickMargin={8} />
                                                        <YAxis stroke="#9ca3af" fontSize={11} tick={{ fill: '#9ca3af' }} domain={maxDomainValue > 0 ? [0, maxDomainValue] : [0, 'dataMax']} ticks={yTicks.length > 0 ? yTicks : undefined} tickFormatter={(value) => { if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`; if (value >= 1000) return `${(value / 1000).toFixed(1)}K`; return value.toString() }} />
                                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: '12px', padding: '10px 12px', fontSize: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} formatter={(value: any) => { const unit = kpi.unit_of_measurement || ''; const formattedValue = typeof value === 'number' ? value.toLocaleString() + (unit ? ` ${unit}` : '') : value; return [formattedValue, 'Cumulative Total'] }} labelFormatter={(label) => { const dataPoint = chartData.find(d => d.date === label); if (dataPoint?.fullDate) { return formatDate(dataPoint.fullDate) } return `Date: ${label}` }} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5 5' }} />
                                                        <Line type="monotone" dataKey="cumulative" stroke={chartColor} strokeWidth={3.5} dot={false} activeDot={{ r: 6, fill: chartColor, stroke: 'white', strokeWidth: 2 }} strokeLinecap="round" />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                                    <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                                                    <h4 className="text-lg font-semibold text-gray-700 mb-2">No Data Yet</h4>
                                                    <p className="text-sm text-center max-w-xs">Come back when you add data to see your activity over time</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Impact Claims - Full Height */}
                                    <div className="lg:col-span-2 flex flex-col">
                                        {kpiUpdates && kpiUpdates.length > 0 ? (
                                            <div className="bg-white/80 backdrop-blur-xl border border-evidence-100/60 rounded-2xl p-4 shadow-soft-float flex flex-col flex-1 max-h-[calc(100vh-400px)]">
                                                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                                                    <h5 className="text-base font-semibold text-gray-800">Impact Claims ({kpiUpdates.length})</h5>
                                                    <button onClick={(e) => { e.stopPropagation(); onAddUpdate() }} className="flex items-center space-x-2 px-4 py-2 bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-evidence-500/25">
                                                        <Plus className="w-4 h-4" /><span>Add</span>
                                                    </button>
                                                </div>
                                                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                                                    {kpiUpdates.map((update, index) => (
                                                        <div key={update.id || index} className="border border-gray-100/80 rounded-xl bg-white/60 hover:bg-evidence-50/50 hover:border-evidence-200 cursor-pointer transition-all duration-200 p-2.5" onClick={() => handleDataPointClick(update)}>
                                                            <div className="flex items-center justify-between">
                                                                <div className="min-w-0 flex-1">
                                                                    <span className="text-sm font-semibold text-evidence-600">{update.value?.toLocaleString()} {kpi.unit_of_measurement}</span>
                                                                    <div className="flex items-center space-x-2 mt-0.5">
                                                                        <Calendar className="w-3 h-3 text-gray-400" />
                                                                        <span className="text-xs text-gray-500">{update.date_range_start && update.date_range_end ? `${formatDate(update.date_range_start)} - ${formatDate(update.date_range_end)}` : formatDate(update.date_represented)}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {(() => {
                                                                        const supportPercentage = getClaimSupportPercentage(update)
                                                                        return (
                                                                            <>
                                                                                {supportPercentage > 0 && (
                                                                                    <div className={`flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs font-medium w-[110px] whitespace-nowrap ${supportPercentage === 100
                                                                                        ? 'bg-primary-100 text-primary-700'
                                                                                        : 'bg-yellow-100 text-yellow-700'
                                                                                        }`}>
                                                                                        <span>{supportPercentage}% Supported</span>
                                                                                    </div>
                                                                                )}
                                                                                {supportPercentage === 0 && (
                                                                                    <div className="flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs font-medium w-[110px] whitespace-nowrap bg-red-100 text-red-700">
                                                                                        <span>0% covered</span>
                                                                                    </div>
                                                                                )}
                                                                                {supportPercentage < 100 && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => handleAddEvidenceForClaim(update, e)}
                                                                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-impact-100 hover:bg-impact-200 text-impact-700 rounded-lg text-xs font-medium transition-colors"
                                                                                        title="Add supporting evidence for this claim"
                                                                                    >
                                                                                        <Upload className="w-3 h-3" />
                                                                                        <span>Support</span>
                                                                                    </button>
                                                                                )}
                                                                            </>
                                                                        )
                                                                    })()}
                                                                    <Eye className="w-3.5 h-3.5 text-gray-400" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                {/* View All Evidence Button */}
                                                <div className="pt-3 mt-3 border-t border-gray-100 flex-shrink-0">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setIsAllEvidenceModalOpen(true) }}
                                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-impact-50 hover:bg-impact-100 text-impact-700 rounded-xl font-semibold text-sm transition-all duration-200 border border-impact-200"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                        <span>View All Evidence ({evidence.length})</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-white/80 backdrop-blur-xl border-2 border-evidence-300/60 rounded-2xl p-6 shadow-soft-float flex-1">
                                                <div className="text-center">
                                                    <div className="w-14 h-14 mx-auto mb-3 bg-evidence-100/80 rounded-xl flex items-center justify-center"><BarChart3 className="w-7 h-7 text-evidence-500" /></div>
                                                    <h5 className="text-base font-semibold text-gray-800 mb-2">Impact Claims</h5>
                                                    <button onClick={(e) => { e.stopPropagation(); onAddUpdate() }} className="inline-flex items-center space-x-2 px-5 py-2.5 bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-evidence-500/25">
                                                        <Plus className="w-5 h-5" /><span>Add Impact Claim</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : createPortal(
                <div className="fixed top-0 right-0 bottom-0 z-50 overflow-y-auto" style={{ position: 'fixed', top: 0, left: '224px', right: 0, bottom: 0, width: 'calc(100vw - 224px)', height: '100vh' }}>
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-100/60 p-4 shadow-soft-float">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onToggleExpand()
                                    }}
                                    className="p-2.5 hover:bg-red-50 rounded-xl transition-all duration-200 border border-gray-100"
                                >
                                    <X className="w-5 h-5 text-red-500" />
                                </button>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-800">{kpi.title}</h2>
                                    <p className="text-sm text-gray-500">{kpi.description}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onAddUpdate()
                                    }}
                                    className="flex items-center space-x-2 px-4 py-2.5 bg-evidence-100/80 hover:bg-evidence-200/80 text-evidence-700 rounded-xl text-sm font-medium transition-all duration-200"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add Impact Claim</span>
                                </button>
                                {kpi.total_updates > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onAddEvidence()
                                        }}
                                        className="flex items-center space-x-2 px-4 py-2.5 bg-impact-100/80 hover:bg-impact-200/80 text-impact-700 rounded-xl text-sm font-medium transition-all duration-200"
                                    >
                                        <Upload className="w-4 h-4" />
                                        <span>Add Evidence</span>
                                    </button>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setIsCreditingModalOpen(true)
                                    }}
                                    className="flex items-center space-x-2 px-4 py-2.5 bg-purple-100/80 hover:bg-purple-200/80 text-purple-700 rounded-xl text-sm font-medium transition-all duration-200"
                                >
                                    <Heart className="w-4 h-4" />
                                    <span>Credit to Donor</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onEdit()
                                    }}
                                    className="flex items-center space-x-2 px-4 py-2.5 bg-white/60 hover:bg-white/80 border border-gray-200/60 text-gray-600 rounded-xl text-sm font-medium transition-all duration-200"
                                >
                                    <Edit className="w-4 h-4" />
                                    <span>Edit</span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onDelete()
                                    }}
                                    className="p-2.5 bg-red-50/80 hover:bg-red-100 text-red-500 rounded-xl transition-all duration-200"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4 max-w-[1600px] mx-auto">
                        {/* Check if metric is completely fresh (no claims AND no evidence) */}
                        {kpiUpdates.length === 0 && !loadingEvidence && evidence.length === 0 ? (
                            /* Fresh Metric - Show only Add buttons */
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-8">
                                {/* Add Impact Claim */}
                                <div className="bg-white/80 backdrop-blur-xl border border-evidence-200/60 rounded-2xl p-8 shadow-soft-float hover:shadow-soft-float-hover transition-all duration-200">
                                    <div className="text-center">
                                        <div className="w-20 h-20 mx-auto mb-5 bg-evidence-100/80 rounded-2xl flex items-center justify-center">
                                            <BarChart3 className="w-10 h-10 text-evidence-500" />
                                        </div>
                                        <h5 className="text-xl font-bold text-gray-800 mb-2">Impact Claims</h5>
                                        <p className="text-sm text-gray-500 mb-6">You haven't added any of this type, add it here!</p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onAddUpdate()
                                            }}
                                            className="inline-flex items-center space-x-2 px-6 py-3 bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-evidence-500/25"
                                        >
                                            <Plus className="w-5 h-5" />
                                            <span>Add Impact Claim</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Add Evidence */}
                                <div className="bg-white/80 backdrop-blur-xl border border-impact-200/60 rounded-2xl p-8 shadow-soft-float hover:shadow-soft-float-hover transition-all duration-200">
                                    <div className="text-center">
                                        <div className="w-20 h-20 mx-auto mb-5 bg-impact-100/80 rounded-2xl flex items-center justify-center">
                                            <FileText className="w-10 h-10 text-impact-500" />
                                        </div>
                                        <h5 className="text-xl font-bold text-gray-800 mb-2">Evidence</h5>
                                        <p className="text-sm text-gray-500 mb-6">You haven't added any of this type, add it here!</p>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onAddEvidence()
                                            }}
                                            className="inline-flex items-center space-x-2 px-6 py-3 bg-impact-500 hover:bg-impact-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-impact-500/25"
                                        >
                                            <Plus className="w-5 h-5" />
                                            <span>Add Evidence</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="bg-white/80 backdrop-blur-xl border border-evidence-100/60 rounded-2xl p-4 shadow-soft-float">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2.5 bg-evidence-100/80 rounded-xl">
                                                <BarChart3 className="w-5 h-5 text-evidence-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Impact Claims</p>
                                                <p className="text-xl font-bold text-evidence-500">{kpi.total_updates}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white/80 backdrop-blur-xl border border-impact-100/60 rounded-2xl p-4 shadow-soft-float">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2.5 bg-impact-100/80 rounded-xl">
                                                <FileText className="w-5 h-5 text-impact-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Evidence Items</p>
                                                <p className="text-xl font-bold text-impact-500">{kpi.evidence_count}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white/80 backdrop-blur-xl border border-primary-100/60 rounded-2xl p-4 shadow-soft-float">
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2.5 bg-primary-100/80 rounded-xl">
                                                <Target className="w-5 h-5 text-primary-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Evidence Coverage</p>
                                                <p className="text-xl font-bold text-primary-500">{kpi.evidence_percentage}%</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Evidence Type Icons Row - Below Stats Cards */}
                                <div className="flex items-center justify-between gap-2 h-10 bg-white/60 backdrop-blur-sm border border-gray-100/60 rounded-xl px-4 py-1">
                                    {(['visual_proof', 'documentation', 'testimony', 'financials'] as const).map((type) => {
                                        const IconComponent = getEvidenceIcon(type)
                                        const typeInfo = getEvidenceTypeInfo(type)
                                        const percentage = evidenceTypePercentages[type].percentage

                                        // Extract color classes from typeInfo
                                        const colorClasses = typeInfo.color.includes('pink') ? 'text-pink-600' :
                                            typeInfo.color.includes('blue') ? 'text-blue-600' :
                                                typeInfo.color.includes('orange') ? 'text-orange-600' :
                                                    typeInfo.color.includes('green') ? 'text-primary-500' :
                                                        'text-gray-600'

                                        return (
                                            <div
                                                key={type}
                                                className="flex items-center gap-1.5 flex-1 min-w-0"
                                            >
                                                <IconComponent className={`w-3.5 h-3.5 ${colorClasses} flex-shrink-0`} />
                                                <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
                                                    <span className="text-[9px] font-medium text-gray-700 truncate w-full leading-tight">
                                                        {typeInfo.label}
                                                    </span>
                                                    <span className="text-[8px] font-bold text-gray-600 leading-tight whitespace-nowrap">
                                                        {percentage}%
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Chart and Data Sections - 3/5 chart + 2/5 data/evidence */}
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                                    {/* Chart Section - 3/5 width */}
                                    <div className="lg:col-span-3 bg-white/80 backdrop-blur-xl border border-gray-100/60 rounded-2xl p-4 flex flex-col shadow-soft-float">
                                        <div className="flex items-center justify-between mb-4 gap-2">
                                            <div className="flex-shrink-0 min-w-0">
                                                <h5 className="text-base lg:text-lg font-semibold text-gray-900 truncate">{isCumulative ? 'Cumulative Progress' : 'Monthly Progress'}</h5>
                                                <p className="text-xs lg:text-sm text-gray-500 hidden sm:block">{isCumulative ? 'Running total over time' : 'Monthly totals over time'}</p>
                                            </div>
                                            <div className="flex items-center gap-1 lg:gap-2 flex-shrink-0">
                                                <DateRangePicker value={datePickerValue} onChange={setDatePickerValue} maxDate={getLocalDateString(new Date())} placeholder="Date" className="w-auto" />
                                                {timeFrame === 'all' && !datePickerValue.singleDate && !datePickerValue.startDate && (
                                                    <div className="flex items-center bg-gray-100 rounded-md lg:rounded-lg p-0.5">
                                                        <button onClick={() => setIsCumulative(true)} className={`px-2 lg:px-2.5 py-0.5 lg:py-1 text-[10px] lg:text-xs rounded-sm lg:rounded-md font-medium transition-colors ${isCumulative ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Cumulative</button>
                                                        <button onClick={() => setIsCumulative(false)} className={`px-2 lg:px-2.5 py-0.5 lg:py-1 text-[10px] lg:text-xs rounded-sm lg:rounded-md font-medium transition-colors ${!isCumulative ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Monthly</button>
                                                    </div>
                                                )}
                                                <div className="flex bg-gray-100 rounded-md lg:rounded-lg p-0.5">
                                                    {['all', '1month', '6months', '1year', '5years'].map((tf) => (
                                                        <button key={tf} onClick={() => { setTimeFrame(tf as any); setDatePickerValue({}); setIsCumulative(true) }} className={`px-1.5 lg:px-2.5 py-0.5 lg:py-1 text-[10px] lg:text-xs rounded-sm lg:rounded-md font-medium transition-colors ${timeFrame === tf && !datePickerValue.singleDate && !datePickerValue.startDate ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                                                            {tf === 'all' ? 'All' : tf === '1month' ? '1M' : tf === '6months' ? '6M' : tf === '1year' ? '1Y' : '5Y'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 h-64 flex items-center justify-center">
                                            {kpiUpdates && kpiUpdates.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <LineChart data={chartData}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                                        <XAxis
                                                            dataKey="date"
                                                            stroke="#6b7280"
                                                            fontSize={11}
                                                            tick={{ fill: '#6b7280' }}
                                                            angle={-45}
                                                            textAnchor="end"
                                                            height={60}
                                                            interval={getXAxisInterval()}
                                                            tickMargin={8}
                                                        />
                                                        <YAxis
                                                            stroke="#6b7280"
                                                            fontSize={11}
                                                            tick={{ fill: '#6b7280' }}
                                                            domain={maxDomainValue > 0 ? [0, maxDomainValue] : [0, 'dataMax']}
                                                            ticks={yTicks.length > 0 ? yTicks : undefined}
                                                            tickFormatter={(value) => {
                                                                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                                                                if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                                                                return value.toString()
                                                            }}
                                                        />
                                                        <Tooltip
                                                            contentStyle={{
                                                                backgroundColor: 'rgba(255,255,255,0.95)',
                                                                backdropFilter: 'blur(8px)',
                                                                border: '1px solid rgba(0,0,0,0.05)',
                                                                borderRadius: '12px',
                                                                padding: '10px 12px',
                                                                fontSize: '12px',
                                                                boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                                                            }}
                                                            formatter={(value: any, name: string) => {
                                                                const unit = kpi.unit_of_measurement || ''
                                                                const formattedValue = typeof value === 'number'
                                                                    ? value.toLocaleString() + (unit ? ` ${unit}` : '')
                                                                    : value
                                                                return [formattedValue, 'Cumulative Total']
                                                            }}
                                                            labelFormatter={(label) => {
                                                                // Find the actual date from chartData
                                                                const dataPoint = chartData.find(d => d.date === label)
                                                                if (dataPoint?.fullDate) {
                                                                    return formatDate(dataPoint.fullDate)
                                                                }
                                                                return `Date: ${label}`
                                                            }}
                                                            cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5 5' }}
                                                        />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="cumulative"
                                                            stroke={chartColor}
                                                            strokeWidth={3.5}
                                                            dot={false}
                                                            activeDot={{ r: 6, fill: chartColor, stroke: 'white', strokeWidth: 2 }}
                                                            strokeLinecap="round"
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                                    <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                                                    <h4 className="text-lg font-semibold text-gray-700 mb-2">No Data Yet</h4>
                                                    <p className="text-sm text-center max-w-xs">
                                                        Come back when you add data to see your activity over time
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Impact Claims - Full Height */}
                                    <div className="lg:col-span-2 flex flex-col">
                                        {kpiUpdates && kpiUpdates.length > 0 ? (
                                            <div className="bg-white/80 backdrop-blur-xl border border-evidence-100/60 rounded-2xl p-4 shadow-soft-float flex flex-col flex-1 max-h-[calc(100vh-400px)]">
                                                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                                                    <h5 className="text-base font-semibold text-gray-800">Impact Claims ({kpiUpdates.length})</h5>
                                                    <div className="flex items-center space-x-3">
                                                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                                                            <BarChart3 className="w-4 h-4" />
                                                            <span>{kpi.total_updates || 0} total</span>
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                onAddUpdate()
                                                            }}
                                                            className="flex items-center space-x-2 px-4 py-2 bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-evidence-500/25"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                            <span>Add</span>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                                                    {kpiUpdates.map((update, index) => {
                                                        const hasDateRange = update.date_range_start && update.date_range_end
                                                        const displayDate = hasDateRange
                                                            ? `${formatDate(update.date_range_start)} - ${formatDate(update.date_range_end)}`
                                                            : formatDate(update.date_represented)

                                                        const updateLocation = update.location_id ? updateLocations[update.location_id] : null

                                                        return (
                                                            <div
                                                                key={update.id || index}
                                                                className="border border-gray-100/80 rounded-xl bg-white/60 hover:bg-evidence-50/50 hover:border-evidence-200 cursor-pointer transition-all duration-200 p-2.5"
                                                                onClick={() => handleDataPointClick(update)}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center space-x-2">
                                                                            <span className="text-sm font-semibold text-evidence-600">
                                                                                {update.value?.toLocaleString()} {kpi.unit_of_measurement}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center space-x-2 mt-0.5">
                                                                            <Calendar className="w-3 h-3 text-gray-400" />
                                                                            <span className="text-xs text-gray-500">{displayDate}</span>
                                                                        </div>
                                                                        {updateLocation && (
                                                                            <div className="flex items-center space-x-1 mt-0.5">
                                                                                <MapPin className="w-3 h-3 text-gray-400" />
                                                                                <span className="text-xs text-gray-500">{updateLocation.name}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        {(() => {
                                                                            const supportPercentage = getClaimSupportPercentage(update)
                                                                            return (
                                                                                <>
                                                                                    {supportPercentage > 0 && (
                                                                                        <div className={`flex items-center justify-center px-2.5 py-1.5 rounded-lg text-xs font-medium w-[110px] whitespace-nowrap ${supportPercentage === 100
                                                                                            ? 'bg-primary-100 text-primary-700'
                                                                                            : 'bg-yellow-100 text-yellow-700'
                                                                                            }`}>
                                                                                            <span>{supportPercentage}% Supported</span>
                                                                                        </div>
                                                                                    )}
                                                                                    {supportPercentage < 100 && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => handleAddEvidenceForClaim(update, e)}
                                                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-impact-100 hover:bg-impact-200 text-impact-700 rounded-lg text-xs font-medium transition-colors"
                                                                                            title="Add supporting evidence for this claim"
                                                                                        >
                                                                                            <Upload className="w-3 h-3" />
                                                                                            <span>Support</span>
                                                                                        </button>
                                                                                    )}
                                                                                </>
                                                                            )
                                                                        })()}
                                                                        <Eye className="w-3.5 h-3.5 text-gray-400" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                                {/* View All Evidence Button */}
                                                <div className="pt-3 mt-3 border-t border-gray-100 flex-shrink-0">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setIsAllEvidenceModalOpen(true) }}
                                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-impact-50 hover:bg-impact-100 text-impact-700 rounded-xl font-semibold text-sm transition-all duration-200 border border-impact-200"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                        <span>View All Evidence ({evidence.length})</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-white/80 backdrop-blur-xl border-2 border-evidence-300/60 rounded-2xl p-6 shadow-soft-float flex-1">
                                                <div className="text-center">
                                                    <div className="w-14 h-14 mx-auto mb-3 bg-evidence-100/80 rounded-xl flex items-center justify-center">
                                                        <BarChart3 className="w-7 h-7 text-evidence-500" />
                                                    </div>
                                                    <h5 className="text-base font-semibold text-gray-800 mb-2">Impact Claims</h5>
                                                    <p className="text-sm text-gray-500 mb-4">You haven't added any of this type, add it here!</p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onAddUpdate()
                                                        }}
                                                        className="inline-flex items-center space-x-2 px-5 py-2.5 bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-evidence-500/25"
                                                    >
                                                        <Plus className="w-5 h-5" />
                                                        <span>Add Impact Claim</span>
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            ))}

            {/* Data Point Preview Modal */}
            {selectedDataPoint && createPortal(
                <DataPointPreviewModal
                    dataPoint={selectedDataPoint}
                    kpi={selectedDataPoint.kpi || kpi}
                    isOpen={isDataPointPreviewOpen}
                    onClose={() => {
                        setIsDataPointPreviewOpen(false)
                        setSelectedDataPoint(null)
                    }}
                    onEdit={(dataPoint) => {
                        setEditingDataPoint(dataPoint)
                        setIsDataPointPreviewOpen(false)
                        setSelectedDataPoint(null)
                        setIsEditDataPointModalOpen(true)
                    }}
                    onDelete={(dataPoint) => {
                        setDeleteConfirmDataPoint(dataPoint)
                        setIsDataPointPreviewOpen(false)
                        setSelectedDataPoint(null)
                    }}
                    onEvidenceClick={(evidence) => {
                        setSelectedEvidence(evidence)
                        setIsDataPointPreviewOpen(false)
                        setIsEvidencePreviewOpen(true)
                    }}
                    onAddEvidence={(dp) => {
                        setIsDataPointPreviewOpen(false)
                        setSelectedDataPoint(null)
                        setSelectedClaimForEvidence(dp)
                        setIsEasyEvidenceModalOpen(true)
                    }}
                />,
                document.body
            )}

            {/* Evidence Preview Modal - Rendered outside portal */}
            {selectedEvidence && createPortal(
                <EvidencePreviewModal
                    evidence={selectedEvidence}
                    isOpen={isEvidencePreviewOpen}
                    onClose={() => setIsEvidencePreviewOpen(false)}
                    onEdit={(evidence) => {
                        setSelectedEvidence(evidence)
                        setIsEvidencePreviewOpen(false)
                        setIsEditEvidenceModalOpen(true)
                    }}
                    onDelete={(evidence) => {
                        setDeleteConfirmEvidence(evidence)
                        setIsEvidencePreviewOpen(false)
                    }}
                    onDataPointClick={(dataPoint, kpiData) => {
                        setSelectedDataPoint(dataPoint)
                        setIsEvidencePreviewOpen(false)
                        setIsDataPointPreviewOpen(true)
                    }}
                />,
                document.body
            )}

            {/* Edit Data Point Modal */}
            {editingDataPoint && createPortal(
                <AddKPIUpdateModal
                    isOpen={isEditDataPointModalOpen}
                    onClose={() => {
                        setIsEditDataPointModalOpen(false)
                        setEditingDataPoint(null)
                    }}
                    onSubmit={handleUpdateDataPoint}
                    kpiTitle={kpi.title}
                    kpiId={kpi.id}
                    metricType={kpi.metric_type || 'number'}
                    unitOfMeasurement={kpi.unit_of_measurement || ''}
                    initiativeId={initiativeId}
                    editData={editingDataPoint}
                />,
                document.body
            )}

            {/* Edit Evidence Modal */}
            {selectedEvidence && createPortal(
                <AddEvidenceModal
                    isOpen={isEditEvidenceModalOpen}
                    onClose={() => {
                        setIsEditEvidenceModalOpen(false)
                        setSelectedEvidence(null)
                    }}
                    onSubmit={handleUpdateEvidence}
                    availableKPIs={[kpi]}
                    initiativeId={kpi.initiative_id}
                    preSelectedKPIId={kpi.id}
                    editData={selectedEvidence}
                />,
                document.body
            )}

            {/* Delete Data Point Confirmation */}
            {deleteConfirmDataPoint && createPortal(
                <div className="fixed inset-0 bg-black/10 backdrop-blur-md flex items-center justify-center p-4 z-[80]">
                    <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl max-w-md w-full p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)]">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="p-2.5 bg-red-100/80 rounded-xl">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">Delete Impact Claim</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete this impact claim and its associated information?
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setDeleteConfirmDataPoint(null)}
                                className="flex-1 px-5 py-3 text-gray-600 bg-white/60 backdrop-blur-sm border border-gray-200/60 rounded-xl hover:bg-white/80 font-medium transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteDataPoint(deleteConfirmDataPoint)}
                                className="flex-1 px-5 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 font-semibold shadow-lg shadow-red-500/25"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Evidence Confirmation */}
            {deleteConfirmEvidence && createPortal(
                <div className="fixed inset-0 bg-black/10 backdrop-blur-md flex items-center justify-center p-4 z-[80]">
                    <div className="bg-white/90 backdrop-blur-xl border border-white/60 rounded-3xl max-w-md w-full p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)]">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="p-2.5 bg-red-100/80 rounded-xl">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">Delete Evidence</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete this evidence and its associated information?
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setDeleteConfirmEvidence(null)}
                                className="flex-1 px-5 py-3 text-gray-600 bg-white/60 backdrop-blur-sm border border-gray-200/60 rounded-xl hover:bg-white/80 font-medium transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteEvidence(deleteConfirmEvidence)}
                                className="flex-1 px-5 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 font-semibold shadow-lg shadow-red-500/25"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Credit to Donor Modal */}
            {isCreditingModalOpen && initiativeId && (
                <MetricCreditingModal
                    isOpen={isCreditingModalOpen}
                    onClose={() => setIsCreditingModalOpen(false)}
                    onSave={async () => {
                        onRefresh?.()
                    }}
                    kpi={kpi}
                    kpiUpdates={kpiUpdates}
                    initiativeId={initiativeId}
                />
            )}

            {/* Easy Evidence Modal - For single claim evidence upload */}
            {selectedClaimForEvidence && createPortal(
                <EasyEvidenceModal
                    isOpen={isEasyEvidenceModalOpen}
                    onClose={() => {
                        setIsEasyEvidenceModalOpen(false)
                        setSelectedClaimForEvidence(null)
                    }}
                    onSubmit={handleEasyEvidenceSubmit}
                    impactClaim={selectedClaimForEvidence}
                    kpi={kpi}
                    initiativeId={initiativeId || kpi.initiative_id || ''}
                />,
                document.body
            )}

            {/* All Evidence Modal - View all evidence grouped by type */}
            {createPortal(
                <AllEvidenceModal
                    isOpen={isAllEvidenceModalOpen}
                    onClose={() => setIsAllEvidenceModalOpen(false)}
                    evidence={evidence}
                    kpi={kpi}
                    onEvidenceClick={(ev) => {
                        setSelectedEvidence(ev)
                        setIsAllEvidenceModalOpen(false)
                        setIsEvidencePreviewOpen(true)
                    }}
                />,
                document.body
            )}
        </div>
    )
}
