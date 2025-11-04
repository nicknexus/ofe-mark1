import React, { useState, useEffect } from 'react'
import { TrendingUp, Target, BarChart3, Calendar, FileText, Filter, ChevronDown, X, MapPin, ExternalLink, Plus } from 'lucide-react'
import { createPortal } from 'react-dom'
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
import { apiService } from '../services/api'
import { Location } from '../types'
import { getCategoryColor, parseLocalDate, isSameDay, compareDates } from '../utils'

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
}

export default function MetricsDashboard({ kpis, kpiTotals, stats, kpiUpdates = [], initiativeId, onNavigateToLocations, onMetricCardClick, onAddKPI }: MetricsDashboardProps) {
    const [timeFrame, setTimeFrame] = useState<'1month' | '6months' | '1year' | '5years'>('1month')
    const [visibleKPIs, setVisibleKPIs] = useState<Set<string>>(new Set())
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)
    const [locations, setLocations] = useState<Location[]>([])
    const [mapRefreshKey, setMapRefreshKey] = useState(0) // Key to trigger map refresh

    // Master filter state
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [dateRangeStart, setDateRangeStart] = useState<string>('')
    const [dateRangeEnd, setDateRangeEnd] = useState<string>('')
    const [selectedLocations, setSelectedLocations] = useState<string[]>([])
    const [showDatePicker, setShowDatePicker] = useState(false)
    const [showDateRangePicker, setShowDateRangePicker] = useState(false)
    const [showLocationPicker, setShowLocationPicker] = useState(false)
    const locationButtonRef = React.useRef<HTMLButtonElement>(null)
    const dateButtonRef = React.useRef<HTMLButtonElement>(null)
    const dateRangeButtonRef = React.useRef<HTMLButtonElement>(null)
    const [locationDropdownPosition, setLocationDropdownPosition] = useState({ top: 0, left: 0 })
    const [dateDropdownPosition, setDateDropdownPosition] = useState({ top: 0, left: 0 })
    const [dateRangeDropdownPosition, setDateRangeDropdownPosition] = useState({ top: 0, left: 0 })

    // Load locations
    useEffect(() => {
        if (initiativeId) {
            apiService.getLocations(initiativeId)
                .then((locs) => setLocations(locs || []))
                .catch(() => setLocations([]))
        }
    }, [initiativeId])

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

        // Filter by single date
        if (selectedDate) {
            filtered = filtered.filter(update => {
                const updateDate = update.date_represented ? new Date(update.date_represented).toISOString().split('T')[0] : ''
                return updateDate === selectedDate
            })
        }

        // Filter by date range
        if (dateRangeStart && dateRangeEnd) {
            filtered = filtered.filter(update => {
                const updateDate = update.date_represented ? new Date(update.date_represented).toISOString().split('T')[0] : ''
                const updateStart = update.date_range_start ? new Date(update.date_range_start).toISOString().split('T')[0] : ''
                const updateEnd = update.date_range_end ? new Date(update.date_range_end).toISOString().split('T')[0] : ''

                // If update is a date range, check if it overlaps with filter range
                if (updateStart && updateEnd) {
                    return updateStart <= dateRangeEnd && updateEnd >= dateRangeStart
                }
                // If update is a single date, check if it's within the range
                return updateDate >= dateRangeStart && updateDate <= dateRangeEnd
            })
        }

        // Filter by location(s) - impact claims must have location_id in selected locations
        if (selectedLocations.length > 0) {
            filtered = filtered.filter(update => {
                return update.location_id && selectedLocations.includes(update.location_id)
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
        if (selectedDate) {
            startDate = parseLocalDate(selectedDate)
            startDate.setHours(0, 0, 0, 0)
            endDate = parseLocalDate(selectedDate)
            endDate.setHours(23, 59, 59, 999)
        }
        // If a date range is selected, use that range
        else if (dateRangeStart && dateRangeEnd) {
            startDate = parseLocalDate(dateRangeStart)
            startDate.setHours(0, 0, 0, 0)
            endDate = parseLocalDate(dateRangeEnd)
            endDate.setHours(23, 59, 59, 999)
        }
        // Otherwise, use time frame
        else {
            const now = new Date()
            now.setHours(0, 0, 0, 0) // Normalize to midnight local time

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

        // Calculate time range
        // Normalize dates to ensure accurate day calculation
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

            // Don't create dates beyond today
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            if (compareDates(currentDate, today) > 0) {
                break
            }

            const dateString = currentDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            })

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

    // Get top 6 KPIs for metric cards (from filtered KPIs)
    const displayKPIs = filteredKPIs.slice(0, 6)

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
        <div className="h-full flex flex-col overflow-hidden px-3 pt-2 pb-2 space-y-1.5">
            {/* Top Metric Cards - 6 across max */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 flex-shrink-0">
                {displayKPIs.map((kpi, index) => {
                    const metricColor = getKPIColor(kpi.category, index)
                    return (
                        <div
                            key={kpi.id}
                            onClick={() => onMetricCardClick?.(kpi.id)}
                            className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-lg p-2 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: metricColor }} />
                                <span className="text-xs text-gray-500 truncate ml-1 flex-1">{kpi.unit_of_measurement || ''}</span>
                            </div>
                            <div className="text-xs font-semibold text-gray-900 truncate mb-1" title={kpi.title}>
                                {kpi.title}
                            </div>
                            <div className="text-base font-bold" style={{ color: metricColor }}>
                                {(filteredTotals[kpi.id] || 0).toLocaleString()}
                            </div>
                        </div>
                    )
                })}
                {/* Plus box to add new metric - only show if fewer than 6 KPIs */}
                {kpis.length < 6 && onAddKPI && (
                    <button
                        onClick={onAddKPI}
                        className="bg-white/80 backdrop-blur-sm border-2 border-dashed border-gray-300/60 rounded-lg p-2 hover:shadow-md hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all flex flex-col items-center justify-center min-h-[80px]"
                    >
                        <Plus className="w-5 h-5 text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500 font-medium">Add Metric</span>
                    </button>
                )}
            </div>

            {/* Master Filter Bar */}
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-lg p-1.5 flex items-center justify-between flex-wrap gap-1.5 flex-shrink-0">
                <div className="flex items-center space-x-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-700">Filters:</span>

                    {/* Date Filter */}
                    <div className="relative">
                        <button
                            ref={dateButtonRef}
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setDateDropdownPosition({
                                    top: rect.bottom + 4,
                                    left: rect.left
                                })
                                setShowDatePicker(!showDatePicker)
                                setShowDateRangePicker(false)
                                setShowLocationPicker(false)
                            }}
                            className="flex items-center space-x-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium transition-colors border border-blue-200"
                        >
                            <Calendar className="w-3 h-3" />
                            <span>Date</span>
                            {selectedDate && <X className="w-2.5 h-2.5 ml-1" onClick={(e) => { e.stopPropagation(); setSelectedDate(''); setDateRangeStart(''); setDateRangeEnd('') }} />}
                        </button>
                        {showDatePicker && createPortal(
                            <>
                                <div className="fixed inset-0 z-[9998]" onClick={() => setShowDatePicker(false)} />
                                <div
                                    className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] p-2"
                                    style={{
                                        top: `${dateDropdownPosition.top}px`,
                                        left: `${dateDropdownPosition.left}px`
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => {
                                            setSelectedDate(e.target.value)
                                            setDateRangeStart('')
                                            setDateRangeEnd('')
                                        }}
                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </>,
                            document.body
                        )}
                    </div>

                    {/* Date Range Filter */}
                    <div className="relative">
                        <button
                            ref={dateRangeButtonRef}
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setDateRangeDropdownPosition({
                                    top: rect.bottom + 4,
                                    left: rect.left
                                })
                                setShowDateRangePicker(!showDateRangePicker)
                                setShowDatePicker(false)
                                setShowLocationPicker(false)
                            }}
                            className="flex items-center space-x-1 px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded text-xs font-medium transition-colors border border-purple-200"
                        >
                            <Calendar className="w-3 h-3" />
                            <span>Range</span>
                            {(dateRangeStart || dateRangeEnd) && <X className="w-2.5 h-2.5 ml-1" onClick={(e) => { e.stopPropagation(); setDateRangeStart(''); setDateRangeEnd('') }} />}
                        </button>
                        {showDateRangePicker && createPortal(
                            <>
                                <div className="fixed inset-0 z-[9998]" onClick={() => setShowDateRangePicker(false)} />
                                <div
                                    className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] p-2 space-y-2 min-w-[180px]"
                                    style={{
                                        top: `${dateRangeDropdownPosition.top}px`,
                                        left: `${dateRangeDropdownPosition.left}px`
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div>
                                        <label className="text-xs text-gray-600 mb-1 block">Start</label>
                                        <input
                                            type="date"
                                            value={dateRangeStart}
                                            onChange={(e) => {
                                                setDateRangeStart(e.target.value)
                                                setSelectedDate('')
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-600 mb-1 block">End</label>
                                        <input
                                            type="date"
                                            value={dateRangeEnd}
                                            onChange={(e) => {
                                                setDateRangeEnd(e.target.value)
                                                setSelectedDate('')
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
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
                                setShowDatePicker(false)
                                setShowDateRangePicker(false)
                            }}
                            className="flex items-center space-x-1 px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded text-xs font-medium transition-colors border border-green-200"
                        >
                            <MapPin className="w-3 h-3" />
                            <span>Location</span>
                            {selectedLocations.length > 0 && (
                                <span className="ml-1 bg-green-600 text-white text-[10px] px-1 rounded-full">
                                    {selectedLocations.length}
                                </span>
                            )}
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
                                                        className="w-3 h-3 text-green-600 border-gray-300 rounded focus:ring-green-500"
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

                    {/* Clear All Filters */}
                    {(selectedDate || dateRangeStart || dateRangeEnd || selectedLocations.length > 0) && (
                        <button
                            onClick={() => {
                                setSelectedDate('')
                                setDateRangeStart('')
                                setDateRangeEnd('')
                                setSelectedLocations([])
                            }}
                            className="flex items-center space-x-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors"
                        >
                            <X className="w-3 h-3" />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Graph and Map Row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-1.5 h-[25vh] lg:h-[50vh] overflow-hidden">
                {/* Graph - Left - 3/5 width */}
                <div className="lg:col-span-3 bg-gradient-to-br from-blue-50/30 to-indigo-50/20 border border-blue-100/60 rounded-lg p-1.5 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900">Metrics Over Time</h3>
                        </div>
                        <div className="flex items-center space-x-1">
                            {/* Filter Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                                    className="flex items-center space-x-1 px-2 py-1 bg-white/80 hover:bg-white rounded border border-gray-200 text-xs font-medium text-gray-700 transition-colors"
                                >
                                    <Filter className="w-3 h-3" />
                                    <span className="text-xs">Metrics</span>
                                    <ChevronDown className={`w-3 h-3 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isFilterDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setIsFilterDropdownOpen(false)} />
                                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[100] min-w-[180px] max-h-48 overflow-y-auto">
                                            <div className="p-2">
                                                <button
                                                    onClick={toggleAllKPIs}
                                                    className="w-full text-left px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded mb-1"
                                                >
                                                    {visibleKPIs.size === kpis.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                                <div className="border-t border-gray-200 my-1"></div>
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
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Time Frame Filters */}
                            <div className="flex items-center space-x-0.5 bg-white/80 rounded p-0.5">
                                {(['1month', '6months', '1year', '5years'] as const).map((tf) => (
                                    <button
                                        key={tf}
                                        onClick={() => setTimeFrame(tf)}
                                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${timeFrame === tf
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        {tf === '1month' ? '1M' : tf === '6months' ? '6M' : tf === '1year' ? '1Y' : '5Y'}
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
                                                return new Date(dataPoint.fullDate).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })
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
                                                    type="basis"
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
                <div className="lg:col-span-2 bg-white border border-gray-200/60 rounded-lg p-1.5 flex flex-col relative min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
                        <h3 className="text-sm font-semibold text-gray-900">Locations</h3>
                        {onNavigateToLocations && (
                            <button
                                onClick={onNavigateToLocations}
                                className="flex items-center space-x-1 px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded text-xs font-medium transition-colors border border-green-200"
                            >
                                <ExternalLink className="w-3 h-3" />
                                <span>View All</span>
                            </button>
                        )}
                    </div>
                    <div className="flex-1 min-h-0">
                        <LocationMap
                            locations={locations.filter(loc => selectedLocations.length === 0 || selectedLocations.includes(loc.id!))}
                            onMapClick={() => {
                                // Navigate to locations tab when clicking map
                                if (onNavigateToLocations) {
                                    onNavigateToLocations()
                                }
                            }}
                            refreshKey={mapRefreshKey}
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Stats Cards - Skinnier */}
            <div className="grid grid-cols-2 gap-1.5 flex-shrink-0 h-auto">
                {/* Total Data Points */}
                <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border border-blue-100/60 rounded-lg p-1.5">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-1">
                            <BarChart3 className="w-3 h-3 text-blue-600" />
                            <h4 className="text-xs font-semibold text-gray-900">Impact Claims</h4>
                        </div>
                    </div>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-base font-bold text-blue-600">
                            {filteredUpdates.length.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Evidence Coverage */}
                <div className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 border border-green-100/60 rounded-lg p-1.5">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-1">
                            <Target className="w-3 h-3 text-green-600" />
                            <h4 className="text-xs font-semibold text-gray-900">Evidence Coverage</h4>
                        </div>
                    </div>
                    <div className="flex items-baseline space-x-1">
                        <span className="text-base font-bold text-green-600">
                            {stats.evidence_coverage_percentage}%
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}