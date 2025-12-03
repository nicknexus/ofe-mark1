import React, { useState, useEffect } from 'react'
import { TrendingUp, Target, BarChart3, Calendar, FileText, Filter, ChevronDown, X, MapPin, ExternalLink, Plus, Users, GripVertical } from 'lucide-react'
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
    useSortable,
    horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Tooltip,
    CartesianGrid,
    Legend
} from 'recharts'
import LocationMap from './LocationMap'
import DateRangePicker from './DateRangePicker'
import { apiService } from '../services/api'
import { Location, BeneficiaryGroup } from '../types'
import { getCategoryColor, parseLocalDate, isSameDay, compareDates, getLocalDateString, formatDate } from '../utils'
import toast from 'react-hot-toast'

// Sortable Metric Card Component
function SortableMetricCard({ kpi, metricColor, filteredTotal, onMetricCardClick }: {
    kpi: any
    metricColor: string
    filteredTotal: number
    onMetricCardClick?: (kpiId: string) => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: kpi.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-white rounded-xl shadow-bubble-sm border border-gray-100 p-3 hover:shadow-bubble hover:border-gray-200 cursor-pointer transition-all duration-200 relative group"
        >
            {/* Drag Handle - Top Right Corner */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-1 right-1 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ opacity: isDragging ? 1 : undefined }}
            >
                <GripVertical className="w-3 h-3 text-gray-400" />
            </div>
            <div
                onClick={() => onMetricCardClick?.(kpi.id)}
            >
                <div className="flex items-center justify-between mb-1">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: metricColor }} />
                    <span className="text-xs text-gray-400 truncate ml-1 flex-1">{kpi.unit_of_measurement || ''}</span>
                </div>
                <div className="text-xs font-medium text-gray-700 truncate mb-1" title={kpi.title}>
                    {kpi.title}
                </div>
                <div className="text-base font-semibold" style={{ color: metricColor }}>
                    {filteredTotal.toLocaleString()}
                </div>
            </div>
        </div>
    )
}

interface MetricsDashboardProps {
    kpis: any[]
    kpiTotals: Record<string, number>
    stats: {
        total_kpis: number
        evidence_coverage_percentage: number
        recent_updates: number
    }
    kpiUpdates?: any[]
    initiativeId?: string
    onNavigateToLocations?: () => void
    onMetricCardClick?: (kpiId: string) => void
    onAddKPI?: () => void
    onStoryClick?: (storyId: string) => void
}

export default function MetricsDashboard({ kpis, kpiTotals, stats, kpiUpdates = [], initiativeId, onNavigateToLocations, onMetricCardClick, onAddKPI, onStoryClick }: MetricsDashboardProps) {
    const [timeFrame, setTimeFrame] = useState<'all' | '1month' | '6months' | '1year' | '5years'>('all')
    const [isCumulative, setIsCumulative] = useState(true)
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
        const { active, over } = event

        if (!over || active.id === over.id) return

        const oldIndex = orderedKPIs.findIndex((kpi) => kpi.id === active.id)
        const newIndex = orderedKPIs.findIndex((kpi) => kpi.id === over.id)

        if (oldIndex === -1 || newIndex === -1) return

        const newOrderedKPIs = arrayMove(orderedKPIs, oldIndex, newIndex)
        setOrderedKPIs(newOrderedKPIs)

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
                toast.error('Failed to save order')
                // Revert on error
                setOrderedKPIs(orderedKPIs)
            }
        }
    }
    const [locations, setLocations] = useState<Location[]>([])
    const [mapRefreshKey, setMapRefreshKey] = useState(0) // Key to trigger map refresh
    const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
    const [updateBeneficiaryGroupsCache, setUpdateBeneficiaryGroupsCache] = useState<Record<string, string[]>>({})

    // Master filter state
    const [datePickerValue, setDatePickerValue] = useState<{
        singleDate?: string
        startDate?: string
        endDate?: string
    }>({})
    const [selectedLocations, setSelectedLocations] = useState<string[]>([])
    const [selectedBeneficiaryGroups, setSelectedBeneficiaryGroups] = useState<string[]>([])
    const [showLocationPicker, setShowLocationPicker] = useState(false)
    const [showBeneficiaryPicker, setShowBeneficiaryPicker] = useState(false)
    const [showMetricsPicker, setShowMetricsPicker] = useState(false)
    const locationButtonRef = React.useRef<HTMLButtonElement>(null)
    const beneficiaryButtonRef = React.useRef<HTMLButtonElement>(null)
    const metricsButtonRef = React.useRef<HTMLButtonElement>(null)
    const [locationDropdownPosition, setLocationDropdownPosition] = useState({ top: 0, left: 0 })
    const [beneficiaryDropdownPosition, setBeneficiaryDropdownPosition] = useState({ top: 0, left: 0 })
    const [metricsDropdownPosition, setMetricsDropdownPosition] = useState({ top: 0, left: 0 })

    // Load locations
    useEffect(() => {
        if (initiativeId) {
            apiService.getLocations(initiativeId)
                .then((locs) => setLocations(locs || []))
                .catch(() => setLocations([]))
        }
    }, [initiativeId])

    // Load beneficiary groups
    useEffect(() => {
        if (initiativeId) {
            apiService.getBeneficiaryGroups(initiativeId)
                .then((groups) => setBeneficiaryGroups(groups || []))
                .catch(() => setBeneficiaryGroups([]))
        }
    }, [initiativeId])

    // Load beneficiary groups for updates (cache them)
    useEffect(() => {
        if (kpiUpdates.length === 0) return

        const loadBeneficiaryGroupsForUpdates = async () => {
            const cache: Record<string, string[]> = {}
            const promises = kpiUpdates.map(async (update) => {
                if (!update.id) return
                try {
                    const groups = await apiService.getBeneficiaryGroupsForUpdate(update.id)
                    const groupIds = Array.isArray(groups) ? groups.map((g: any) => g.id).filter(Boolean) : []
                    cache[update.id] = groupIds
                } catch (error) {
                    cache[update.id] = []
                }
            })
            await Promise.all(promises)
            setUpdateBeneficiaryGroupsCache(cache)
        }

        loadBeneficiaryGroupsForUpdates()
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
        const filteredKPIs = getFilteredKPIs()
        if (filteredKPIs && filteredKPIs.length > 0) {
            setVisibleKPIs(new Set(filteredKPIs.map(kpi => kpi.id)))
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

    // Get effective date for an update - use end date for ranges, otherwise use date_represented
    // Parse as local date to avoid timezone shifts
    const getEffectiveDate = (update: any): Date => {
        if (update.date_range_end) {
            return parseLocalDate(update.date_range_end)
        }
        return parseLocalDate(update.date_represented)
    }

    // Get color for each KPI - use unique colors based on index to ensure all metrics have different colors
    const getKPIColor = (category: string, index: number): string => {
        // Extended color palette for unique colors per metric
        const colorPalette = [
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
            '#22c55e', // emerald
            '#eab308', // yellow
            '#64748b', // slate
        ]
        // Always use index-based colors to ensure uniqueness
        return colorPalette[index % colorPalette.length]
    }

    // Filter updates based on date filters
    const getFilteredUpdates = () => {
        if (!kpiUpdates || kpiUpdates.length === 0) {
            return []
        }

        let filtered = [...kpiUpdates]

        // Filter by single date or date range
        if (datePickerValue.singleDate) {
            filtered = filtered.filter(update => {
                const updateDate = update.date_represented ? getLocalDateString(parseLocalDate(update.date_represented)) : ''
                return updateDate === datePickerValue.singleDate
            })
        } else if (datePickerValue.startDate && datePickerValue.endDate) {
            const filterStartDate = datePickerValue.startDate
            const filterEndDate = datePickerValue.endDate
            filtered = filtered.filter(update => {
                const updateDate = update.date_represented ? getLocalDateString(parseLocalDate(update.date_represented)) : ''
                const updateStart = update.date_range_start ? getLocalDateString(parseLocalDate(update.date_range_start)) : ''
                const updateEnd = update.date_range_end ? getLocalDateString(parseLocalDate(update.date_range_end)) : ''

                // If update is a date range, check if it overlaps with filter range
                if (updateStart && updateEnd) {
                    return updateStart <= filterEndDate && updateEnd >= filterStartDate
                }
                // If update is a single date, check if it's within the range
                return updateDate >= filterStartDate && updateDate <= filterEndDate
            })
        }

        // Filter by location(s) - impact claims must have location_id in selected locations
        if (selectedLocations.length > 0) {
            filtered = filtered.filter(update => {
                return update.location_id && selectedLocations.includes(update.location_id)
            })
        }

        // Filter by beneficiary group(s) - impact claims must be linked to selected beneficiary groups
        if (selectedBeneficiaryGroups.length > 0) {
            filtered = filtered.filter(update => {
                if (!update.id) return false
                const updateGroupIds = updateBeneficiaryGroupsCache[update.id] || []
                // Check if update is linked to any of the selected beneficiary groups
                return updateGroupIds.some(groupId => selectedBeneficiaryGroups.includes(groupId))
            })
        }

        return filtered
    }

    // Filter KPIs by selected locations
    const getFilteredKPIs = () => {
        // Always return all KPIs - we don't filter KPIs by location
        // Only impact claims are filtered by location
        return kpis
    }

    // Initialize visible KPIs with all KPIs when component mounts or kpis change
    useEffect(() => {
        const filtered = getFilteredKPIs()
        if (filtered && filtered.length > 0) {
            setVisibleKPIs(new Set(filtered.map(kpi => kpi.id)))
        }
    }, [kpis, selectedLocations])

    // Calculate filtered totals
    const getFilteredTotals = () => {
        const filteredUpdates = getFilteredUpdates()
        const filteredKPIs = getFilteredKPIs()
        const filteredTotals: Record<string, number> = {}

        filteredKPIs.forEach(kpi => {
            const kpiFilteredUpdates = filteredUpdates.filter(update => update.kpi_id === kpi.id)
            filteredTotals[kpi.id] = kpiFilteredUpdates.reduce((sum, update) => sum + (update.value || 0), 0)
        })

        return filteredTotals
    }

    // Generate cumulative data for all KPIs
    const generateChartData = () => {
        const filteredUpdates = getFilteredUpdates()
        const filteredKPIs = getFilteredKPIs()

        if (!filteredKPIs || filteredKPIs.length === 0) {
            return []
        }

        // Group updates by KPI (only for filtered KPIs)
        const filteredKPIIds = new Set(filteredKPIs.map(kpi => kpi.id))
        const updatesByKPI: Record<string, any[]> = {}
        filteredUpdates.forEach(update => {
            const kpiId = update.kpi_id
            if (filteredKPIIds.has(kpiId)) {
                if (!updatesByKPI[kpiId]) {
                    updatesByKPI[kpiId] = []
                }
                updatesByKPI[kpiId].push(update)
            }
        })

        // Sort updates by effective date for each KPI (end date for ranges, date_represented otherwise)
        Object.keys(updatesByKPI).forEach(kpiId => {
            updatesByKPI[kpiId].sort((a, b) =>
                getEffectiveDate(a).getTime() - getEffectiveDate(b).getTime()
            )
        })

        // Calculate date range based on filters or time frame
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
            const now = new Date()
            now.setHours(0, 0, 0, 0) // Normalize to midnight local time

            if (timeFrame === 'all') {
                // Find the oldest update date across visible KPIs only
                // Filter updates to only include those from visible KPIs
                const visibleKPIUpdates = filteredUpdates.filter(update => {
                    const kpiId = update.kpi_id
                    return visibleKPIs.has(kpiId) && filteredKPIIds.has(kpiId)
                })

                if (visibleKPIUpdates.length > 0) {
                    const oldestUpdate = visibleKPIUpdates.reduce((oldest, update) => {
                        const updateDate = getEffectiveDate(update)
                        const oldestDate = getEffectiveDate(oldest)
                        return updateDate < oldestDate ? update : oldest
                    })
                    startDate = getEffectiveDate(oldestUpdate)
                    startDate.setHours(0, 0, 0, 0)
                    // Subtract 1 day to show the graph starting at 0 before the first impact claim
                    startDate.setDate(startDate.getDate() - 1)
                } else {
                    // Fallback to 1 month if no updates from visible KPIs
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
                startDate.setHours(0, 0, 0, 0) // Normalize to midnight local time
            }
            endDate = new Date(now)
            endDate.setHours(23, 59, 59, 999) // End of today
        }

        // Filter updates within the time frame for each KPI (using effective date)
        const filteredUpdatesByKPI: Record<string, any[]> = {}
        Object.keys(updatesByKPI).forEach(kpiId => {
            filteredUpdatesByKPI[kpiId] = updatesByKPI[kpiId].filter(update => {
                const updateDate = getEffectiveDate(update)
                updateDate.setHours(0, 0, 0, 0)
                return compareDates(updateDate, startDate) >= 0 && compareDates(updateDate, endDate) <= 0
            })
        })

        // Generate time series data
        const data: Array<{
            date: string;
            fullDate: Date;
            [kpiId: string]: any; // Dynamic keys for each KPI
        }> = []

        // Non-cumulative mode: group by month (persist even when date filters are applied)
        if (!isCumulative) {
            // Start from the month before the first impact claim (or filtered start date)
            const firstMonthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
            firstMonthStart.setMonth(firstMonthStart.getMonth() - 1)

            // Use endDate for the last month to show (respects date filters if applied)
            const lastMonthDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

            // Group updates by month for each visible KPI only
            const monthlyTotals: Record<string, Record<string, number>> = {} // [monthKey][kpiId] = total

            Object.keys(filteredUpdatesByKPI).forEach(kpiId => {
                // Only process visible KPIs
                if (!visibleKPIs.has(kpiId)) return

                filteredUpdatesByKPI[kpiId].forEach(update => {
                    const updateDate = getEffectiveDate(update)
                    const monthKey = `${updateDate.getFullYear()}-${String(updateDate.getMonth() + 1).padStart(2, '0')}`

                    if (!monthlyTotals[monthKey]) {
                        monthlyTotals[monthKey] = {}
                    }
                    if (!monthlyTotals[monthKey][kpiId]) {
                        monthlyTotals[monthKey][kpiId] = 0
                    }
                    monthlyTotals[monthKey][kpiId] += (update.value || 0)
                })
            })

            // Generate monthly data points
            let currentMonthDate = new Date(firstMonthStart)
            while (currentMonthDate <= lastMonthDate) {
                const monthKey = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`
                const monthName = currentMonthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

                const dataPoint: any = {
                    date: monthName,
                    fullDate: new Date(currentMonthDate)
                }

                // Set value for each visible KPI (0 if no updates for that month)
                Array.from(visibleKPIs).forEach(kpiId => {
                    dataPoint[kpiId] = monthlyTotals[monthKey]?.[kpiId] || 0
                })

                data.push(dataPoint)

                // Move to next month
                currentMonthDate.setMonth(currentMonthDate.getMonth() + 1)
            }

            return data
        }

        // Cumulative mode: daily data points
        // Calculate time range
        // Normalize dates to ensure accurate day calculation - use date-only values
        const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
        startDateOnly.setHours(0, 0, 0, 0)
        const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
        endDateOnly.setHours(0, 0, 0, 0)

        const timeDiff = endDateOnly.getTime() - startDateOnly.getTime()
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))

        // Create daily data points for the entire period
        for (let i = 0; i <= daysDiff; i++) {
            const currentDate = new Date(startDateOnly)
            currentDate.setDate(startDateOnly.getDate() + i)
            currentDate.setHours(0, 0, 0, 0) // Normalize to midnight local time

            // Don't create dates beyond today
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            if (compareDates(currentDate, today) > 0) {
                break
            }

            const dateString = formatDate(currentDate).split(',')[0] // Get just the date part without year

            const dataPoint: any = {
                date: dateString,
                fullDate: currentDate
            }

            // Calculate cumulative value for each KPI up to this date (using effective date)
            Object.keys(filteredUpdatesByKPI).forEach(kpiId => {
                const cumulative = filteredUpdatesByKPI[kpiId]
                    .filter(update => {
                        const updateDate = getEffectiveDate(update)
                        updateDate.setHours(0, 0, 0, 0)
                        return compareDates(updateDate, currentDate) <= 0
                    })
                    .reduce((sum, update) => sum + (update.value || 0), 0)

                dataPoint[kpiId] = cumulative
            })

            data.push(dataPoint)
        }

        return data
    }

    const chartData = generateChartData()
    const filteredTotals = getFilteredTotals()
    const filteredUpdates = getFilteredUpdates()
    const filteredKPIs = getFilteredKPIs()

    // Calculate x-axis interval to always show approximately 30 labels (1 month's worth)
    // For 1 month view, show every single day
    const getXAxisInterval = () => {
        // Non-cumulative mode: show every month (interval 0)
        if (!isCumulative && timeFrame === 'all') return 0

        // If viewing 1 month without custom date range, show all labels (every day)
        if (timeFrame === '1month' && !datePickerValue.singleDate && !datePickerValue.startDate) return 0

        const dataPointCount = chartData.length
        if (dataPointCount <= 30) return 0 // Show all labels if we have 30 or fewer data points
        // Calculate interval to show ~30 labels: interval = floor((count - 1) / 30)
        return Math.floor((dataPointCount - 1) / 30)
    }

    // Get top 6 KPIs for metric cards (from ordered KPIs, then filtered)
    const displayKPIs = orderedKPIs.filter(kpi => filteredKPIs.some(fk => fk.id === kpi.id)).slice(0, 6)

    // Calculate dynamic max value with headroom for the graph
    const calculateMaxWithHeadroom = () => {
        if (!chartData || chartData.length === 0 || visibleKPIs.size === 0) return 0

        // Find the maximum value across visible KPIs only
        let maxValue = 0
        chartData.forEach((dataPoint) => {
            // Only check values for visible KPIs
            Array.from(visibleKPIs).forEach(kpiId => {
                const value = dataPoint[kpiId]
                if (typeof value === 'number' && isFinite(value) && value > 0) {
                    maxValue = Math.max(maxValue, value)
                }
            })
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
    const actualMaxValue = Math.max(...chartData.flatMap(d =>
        Array.from(visibleKPIs).map(kpiId => {
            const val = d[kpiId]
            return typeof val === 'number' && isFinite(val) ? val : 0
        })
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
        // But avoid duplicates by checking if the value is already in the array
        if (actualMaxValue > 0) {
            const isCloseToExistingTick = ticks.some(t => Math.abs(t - actualMaxValue) < step * 0.1)
            if (!isCloseToExistingTick) {
                ticks.push(actualMaxValue)
                ticks.sort((a, b) => a - b)
                // Remove duplicates after sorting
                const uniqueTicks = ticks.filter((val, idx, arr) => idx === 0 || val !== arr[idx - 1])
                return uniqueTicks
            }
        }

        // Remove duplicates
        return ticks.filter((val, idx, arr) => idx === 0 || val !== arr[idx - 1])
    }

    const yTicks = generateYTicks()

    return (
        <div className="h-full flex flex-col overflow-hidden px-4 pt-4 pb-4 space-y-4">
            {/* Master Filter Bar */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-3 flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
                <div className="flex items-center space-x-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-700">Filters:</span>

                    {/* Date Filter */}
                    <div className="relative">
                        <DateRangePicker
                            value={datePickerValue}
                            onChange={setDatePickerValue}
                            maxDate={getLocalDateString(new Date())}
                            placeholder="Filter by date"
                            className="w-auto"
                        />
                    </div>

                    {/* Metrics Filter */}
                    <div className="relative">
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
                            }}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-evidence-50 hover:bg-evidence-100 text-evidence-600 rounded-xl text-xs font-medium transition-all duration-200 border border-evidence-200"
                        >
                            <Filter className="w-3 h-3" />
                            <span>Metrics</span>
                            {visibleKPIs.size > 0 && visibleKPIs.size < kpis.length && (
                                <span className="ml-1 bg-blue-600 text-white text-[10px] px-1 rounded-full">
                                    {visibleKPIs.size}
                                </span>
                            )}
                            <ChevronDown className={`w-3 h-3 transition-transform ${showMetricsPicker ? 'rotate-180' : ''}`} />
                        </button>
                        {showMetricsPicker && createPortal(
                            <>
                                <div className="fixed inset-0 z-[9998]" onClick={() => setShowMetricsPicker(false)} />
                                <div
                                    className="fixed bg-white border border-gray-100 rounded-xl shadow-bubble z-[9999] p-3 min-w-[200px] max-h-64 overflow-y-auto"
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
                                                        className="text-xs text-blue-600 hover:text-blue-800"
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
                                                        className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
                    <div className="relative">
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
                            }}
                            className="flex items-center space-x-1 px-2 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded text-xs font-medium transition-colors border border-primary-200"
                        >
                            <MapPin className="w-3 h-3" />
                            <span>Location</span>
                            {selectedLocations.length > 0 && (
                                <span className="ml-1 bg-primary-500 text-white text-[10px] px-1 rounded-full">
                                    {selectedLocations.length}
                                </span>
                            )}
                            <ChevronDown className={`w-3 h-3 transition-transform ${showLocationPicker ? 'rotate-180' : ''}`} />
                        </button>
                        {showLocationPicker && createPortal(
                            <>
                                <div className="fixed inset-0 z-[9998]" onClick={() => setShowLocationPicker(false)} />
                                <div
                                    className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] p-2 min-w-[200px] max-h-64 overflow-y-auto"
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
                                                        className="text-xs text-blue-600 hover:text-blue-800"
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

                    {/* Beneficiary Groups Filter */}
                    <div className="relative">
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
                                setShowMetricsPicker(false)
                            }}
                            className="flex items-center space-x-1 px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded text-xs font-medium transition-colors border border-orange-200"
                        >
                            <Users className="w-3 h-3" />
                            <span>Beneficiaries</span>
                            {selectedBeneficiaryGroups.length > 0 && (
                                <span className="ml-1 bg-orange-600 text-white text-[10px] px-1 rounded-full">
                                    {selectedBeneficiaryGroups.length}
                                </span>
                            )}
                            <ChevronDown className={`w-3 h-3 transition-transform ${showBeneficiaryPicker ? 'rotate-180' : ''}`} />
                        </button>
                        {showBeneficiaryPicker && createPortal(
                            <>
                                <div className="fixed inset-0 z-[9998]" onClick={() => setShowBeneficiaryPicker(false)} />
                                <div
                                    className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] p-2 min-w-[200px] max-h-64 overflow-y-auto"
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
                                                        className="text-xs text-blue-600 hover:text-blue-800"
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

                    {/* Clear All Filters */}
                    {(datePickerValue.singleDate || datePickerValue.startDate || datePickerValue.endDate || selectedLocations.length > 0 || selectedBeneficiaryGroups.length > 0) && (
                        <button
                            onClick={() => {
                                setDatePickerValue({})
                                setSelectedLocations([])
                                setSelectedBeneficiaryGroups([])
                            }}
                            className="flex items-center space-x-1 px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded text-xs font-medium transition-colors border border-gray-200"
                        >
                            <X className="w-3 h-3" />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Top Metric Cards - 6 across max */}
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
                            return (
                                <SortableMetricCard
                                    key={kpi.id}
                                    kpi={kpi}
                                    metricColor={metricColor}
                                    filteredTotal={filteredTotals[kpi.id] || 0}
                                    onMetricCardClick={onMetricCardClick}
                                />
                            )
                        })}
                        {/* Plus box to add new metric - only show if fewer than 6 KPIs */}
                        {kpis.length < 6 && onAddKPI && (
                            <button
                                onClick={onAddKPI}
                                className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-3 hover:shadow-bubble hover:border-primary-300 hover:bg-primary-50/30 cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[80px]"
                            >
                                <Plus className="w-5 h-5 text-gray-400 mb-1" />
                                <span className="text-xs text-gray-500 font-medium">Add Metric</span>
                            </button>
                        )}
                    </div>
                </SortableContext>
            </DndContext>

            {/* Graph and Map Row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-[25vh] lg:h-[50vh] overflow-hidden">
                {/* Graph - Left - 3/5 width */}
                <div className="lg:col-span-3 bg-white rounded-2xl shadow-bubble border border-gray-100 p-4 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-800">Metrics Over Time</h3>
                        </div>
                        <div className="flex items-center space-x-2">
                            {/* Cumulative/Non-cumulative Toggle - Always visible to persist month-to-month view */}
                            <div className="flex items-center bg-gray-50 rounded-xl p-0.5">
                                <button
                                    onClick={() => setIsCumulative(true)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${isCumulative
                                        ? 'bg-white text-gray-800 shadow-bubble-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Cumulative
                                </button>
                                <button
                                    onClick={() => setIsCumulative(false)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${!isCumulative
                                        ? 'bg-white text-gray-800 shadow-bubble-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    Monthly
                                </button>
                            </div>
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
                                            ? 'bg-white text-gray-800 shadow-bubble-sm'
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
                        {chartData && chartData.length > 0 && kpis && kpis.length > 0 && visibleKPIs.size > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#6b7280"
                                        fontSize={10}
                                        tick={{ fill: '#6b7280' }}
                                        angle={-45}
                                        textAnchor="end"
                                        height={60}
                                        interval={getXAxisInterval()}
                                        tickMargin={8}
                                    />
                                    <YAxis
                                        stroke="#6b7280"
                                        fontSize={10}
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
                                            backgroundColor: 'white',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            padding: '10px 12px',
                                            fontSize: '12px',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
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
                                            // Find the actual date from chartData
                                            const dataPoint = chartData.find(d => d.date === label)
                                            if (dataPoint?.fullDate) {
                                                return formatDate(dataPoint.fullDate)
                                            }
                                            return `Date: ${label}`
                                        }}
                                        cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '5 5' }}
                                    />
                                    <Legend
                                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                                        formatter={(value) => {
                                            const kpi = kpis.find(k => k.id === value)
                                            return kpi ? kpi.title : value
                                        }}
                                        iconType="line"
                                    />
                                    {kpis
                                        .filter(kpi => visibleKPIs.has(kpi.id))
                                        .map((kpi) => {
                                            const originalIndex = kpis.findIndex(k => k.id === kpi.id)
                                            return (
                                                <Line
                                                    key={kpi.id}
                                                    type="monotone"
                                                    dataKey={kpi.id}
                                                    stroke={getKPIColor(kpi.category, originalIndex)}
                                                    strokeWidth={3.5}
                                                    dot={false}
                                                    activeDot={{ r: 6, fill: getKPIColor(kpi.category, originalIndex), stroke: 'white', strokeWidth: 2 }}
                                                    strokeLinecap="round"
                                                />
                                            )
                                        })}
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
                                <p className="text-xs text-center">
                                    {visibleKPIs.size === 0 ? 'Select metrics to view' : 'No data yet'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Map - Right - 2/5 width */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-bubble border border-gray-100 p-4 flex flex-col relative min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-3 flex-shrink-0">
                        <h3 className="text-sm font-semibold text-gray-800">Locations</h3>
                        {onNavigateToLocations && (
                            <button
                                onClick={onNavigateToLocations}
                                className="flex items-center space-x-1 px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-600 rounded-lg text-xs font-medium transition-all duration-200"
                            >
                                <ExternalLink className="w-3 h-3" />
                                <span>View All</span>
                            </button>
                        )}
                    </div>
                    <div className="flex-1 min-h-0">
                        <LocationMap
                            locations={locations.filter(loc => {
                                // If beneficiary groups are selected, only show locations that have those groups
                                if (selectedBeneficiaryGroups.length > 0) {
                                    const locationIdsFromBeneficiaries = beneficiaryGroups
                                        .filter(bg => selectedBeneficiaryGroups.includes(bg.id!))
                                        .map(bg => bg.location_id)
                                        .filter(Boolean)
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
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Stats Cards - Skinnier */}
            <div className="grid grid-cols-2 gap-4 flex-shrink-0 h-auto">
                {/* Total Data Points */}
                <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-4 impact-border">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-lg bg-impact-50 flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-impact-400" />
                            </div>
                            <h4 className="text-xs font-medium text-gray-600">Impact Claims</h4>
                        </div>
                    </div>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-xl font-semibold text-impact-500">
                            {filteredUpdates.length.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Evidence Coverage */}
                <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-4 evidence-border">
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
            </div>
        </div>
    )
}