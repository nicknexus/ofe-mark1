import React, { useState, useEffect } from 'react'
import { TrendingUp, Target, BarChart3, Calendar, FileText, Filter, ChevronDown, X, MapPin } from 'lucide-react'
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

interface MetricsDashboardProps {
    kpis: any[]
    kpiTotals: Record<string, number>
    stats: {
        total_kpis: number
        evidence_coverage_percentage: number
        recent_updates: number
    }
    kpiUpdates?: any[] // Add KPI updates data
}

export default function MetricsDashboard({ kpis, kpiTotals, stats, kpiUpdates = [] }: MetricsDashboardProps) {
    const [timeFrame, setTimeFrame] = useState<'1month' | '6months' | '1year' | '5years'>('1month')
    const [visibleKPIs, setVisibleKPIs] = useState<Set<string>>(new Set())
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false)

    // Master filter state
    const [selectedDate, setSelectedDate] = useState<string>('')
    const [dateRangeStart, setDateRangeStart] = useState<string>('')
    const [dateRangeEnd, setDateRangeEnd] = useState<string>('')
    const [selectedLocation, setSelectedLocation] = useState<string>('')
    const [showDatePicker, setShowDatePicker] = useState(false)
    const [showDateRangePicker, setShowDateRangePicker] = useState(false)
    const [showLocationPicker, setShowLocationPicker] = useState(false)

    // Initialize visible KPIs with all KPIs when component mounts or kpis change
    useEffect(() => {
        if (kpis && kpis.length > 0) {
            setVisibleKPIs(new Set(kpis.map(kpi => kpi.id)))
        }
    }, [kpis])

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
    const getEffectiveDate = (update: any): Date => {
        if (update.date_range_end) {
            return new Date(update.date_range_end)
        }
        return new Date(update.date_represented)
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

        // Location filter (placeholder for now)
        if (selectedLocation) {
            // TODO: Apply location filter when location feature is implemented
        }

        return filtered
    }

    // Calculate filtered totals
    const getFilteredTotals = () => {
        const filteredUpdates = getFilteredUpdates()
        const filteredTotals: Record<string, number> = {}

        kpis.forEach(kpi => {
            const kpiFilteredUpdates = filteredUpdates.filter(update => update.kpi_id === kpi.id)
            filteredTotals[kpi.id] = kpiFilteredUpdates.reduce((sum, update) => sum + (update.value || 0), 0)
        })

        return filteredTotals
    }

    // Generate cumulative data for all KPIs
    const generateChartData = () => {
        const filteredUpdates = getFilteredUpdates()

        if (!kpis || kpis.length === 0 || filteredUpdates.length === 0) {
            return []
        }

        // Group updates by KPI
        const updatesByKPI: Record<string, any[]> = {}
        filteredUpdates.forEach(update => {
            const kpiId = update.kpi_id
            if (!updatesByKPI[kpiId]) {
                updatesByKPI[kpiId] = []
            }
            updatesByKPI[kpiId].push(update)
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
            startDate = new Date(selectedDate)
            endDate = new Date(selectedDate)
            // Set to end of day
            endDate.setHours(23, 59, 59, 999)
        }
        // If a date range is selected, use that range
        else if (dateRangeStart && dateRangeEnd) {
            startDate = new Date(dateRangeStart)
            endDate = new Date(dateRangeEnd)
            endDate.setHours(23, 59, 59, 999)
        }
        // Otherwise, use time frame
        else {
            const now = new Date()
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
            endDate = new Date()
        }

        // Filter updates within the time frame for each KPI (using effective date)
        const filteredUpdatesByKPI: Record<string, any[]> = {}
        Object.keys(updatesByKPI).forEach(kpiId => {
            filteredUpdatesByKPI[kpiId] = updatesByKPI[kpiId].filter(update =>
                getEffectiveDate(update) >= startDate
            )
        })

        // Generate time series data
        const data: Array<{
            date: string;
            fullDate: Date;
            [kpiId: string]: any; // Dynamic keys for each KPI
        }> = []

        // Calculate time range
        const timeDiff = endDate.getTime() - startDate.getTime()
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))

        // Create daily data points for the entire period
        for (let i = 0; i <= daysDiff; i++) {
            const currentDate = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000))
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
                    .filter(update => getEffectiveDate(update) <= currentDate)
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

    return (
        <div className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-4 shadow-xl shadow-gray-900/5 mb-4">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
                        Impact Dashboard
                    </h2>
                    <p className="text-gray-500 text-xs">Real-time view of your initiative's key metrics and progress</p>
                </div>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <Calendar className="w-3 h-3" />
                    <span>Last 12 months</span>
                </div>
            </div>

            {/* Master Filter Bar */}
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200/60 rounded-xl p-3 mb-4 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-700">Filters:</span>

                    {/* Date Filter */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setShowDatePicker(!showDatePicker)
                                setShowDateRangePicker(false)
                                setShowLocationPicker(false)
                            }}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors border border-blue-200"
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Date</span>
                            {selectedDate && <X className="w-3 h-3 ml-1" onClick={(e) => { e.stopPropagation(); setSelectedDate(''); setDateRangeStart(''); setDateRangeEnd('') }} />}
                        </button>
                        {showDatePicker && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowDatePicker(false)} />
                                <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-3">
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => {
                                            setSelectedDate(e.target.value)
                                            setDateRangeStart('')
                                            setDateRangeEnd('')
                                        }}
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Date Range Filter */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setShowDateRangePicker(!showDateRangePicker)
                                setShowDatePicker(false)
                                setShowLocationPicker(false)
                            }}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-medium transition-colors border border-purple-200"
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Date Range</span>
                            {(dateRangeStart || dateRangeEnd) && <X className="w-3 h-3 ml-1" onClick={(e) => { e.stopPropagation(); setDateRangeStart(''); setDateRangeEnd('') }} />}
                        </button>
                        {showDateRangePicker && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowDateRangePicker(false)} />
                                <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-3 space-y-2 min-w-[200px]">
                                    <div>
                                        <label className="text-xs text-gray-600 mb-1 block">Start Date</label>
                                        <input
                                            type="date"
                                            value={dateRangeStart}
                                            onChange={(e) => {
                                                setDateRangeStart(e.target.value)
                                                setSelectedDate('')
                                            }}
                                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-600 mb-1 block">End Date</label>
                                        <input
                                            type="date"
                                            value={dateRangeEnd}
                                            onChange={(e) => {
                                                setDateRangeEnd(e.target.value)
                                                setSelectedDate('')
                                            }}
                                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Location Filter (Placeholder) */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setShowLocationPicker(!showLocationPicker)
                                setShowDatePicker(false)
                                setShowDateRangePicker(false)
                            }}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium transition-colors border border-green-200 opacity-60 cursor-not-allowed"
                            disabled
                        >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Location</span>
                            {selectedLocation && <X className="w-3 h-3 ml-1" onClick={(e) => { e.stopPropagation(); setSelectedLocation('') }} />}
                        </button>
                        {showLocationPicker && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowLocationPicker(false)} />
                                <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-3 min-w-[200px]">
                                    <p className="text-xs text-gray-500">Location filtering coming soon</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Clear All Filters */}
                    {(selectedDate || dateRangeStart || dateRangeEnd || selectedLocation) && (
                        <button
                            onClick={() => {
                                setSelectedDate('')
                                setDateRangeStart('')
                                setDateRangeEnd('')
                                setSelectedLocation('')
                            }}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Clear All</span>
                        </button>
                    )}
                </div>

                {/* Active Filters Display */}
                {(selectedDate || dateRangeStart || dateRangeEnd || selectedLocation) && (
                    <div className="flex items-center space-x-2 text-xs text-gray-600">
                        <span className="font-medium">Active:</span>
                        {selectedDate && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">Date: {selectedDate}</span>}
                        {dateRangeStart && dateRangeEnd && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded">{dateRangeStart} - {dateRangeEnd}</span>}
                        {selectedLocation && <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded">Location: {selectedLocation}</span>}
                    </div>
                )}
            </div>

            <div className="flex flex-col h-[calc(100vh-240px)] min-h-[600px]">
                {/* Charts Row - 2/3 Activity + 1/3 Support */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0 mb-3">
                    {/* Activity Chart - 2/3 width */}
                    <div className="lg:col-span-2 bg-gradient-to-br from-blue-50/30 to-indigo-50/20 border border-blue-100/60 rounded-xl p-4 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Metrics Over Time</h3>
                                <p className="text-sm text-gray-500">Cumulative metric values across all KPIs</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                {/* Filter Dropdown */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                                        className="flex items-center space-x-2 px-3 py-1.5 bg-white/80 hover:bg-white rounded-lg border border-gray-200 text-xs font-medium text-gray-700 transition-colors"
                                    >
                                        <Filter className="w-3.5 h-3.5" />
                                        <span>Metrics</span>
                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isFilterDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isFilterDropdownOpen && (
                                        <>
                                            {/* Backdrop to close dropdown */}
                                            <div
                                                className="fixed inset-0 z-10"
                                                onClick={() => setIsFilterDropdownOpen(false)}
                                            />
                                            {/* Dropdown Menu */}
                                            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px] max-h-64 overflow-y-auto">
                                                <div className="p-2">
                                                    {/* Select All / Deselect All */}
                                                    <button
                                                        onClick={toggleAllKPIs}
                                                        className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-md mb-1"
                                                    >
                                                        {visibleKPIs.size === kpis.length ? 'Deselect All' : 'Select All'}
                                                    </button>
                                                    <div className="border-t border-gray-200 my-1"></div>

                                                    {/* KPI Checkboxes */}
                                                    {kpis.map((kpi, index) => (
                                                        <label
                                                            key={kpi.id}
                                                            className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-50 rounded-md cursor-pointer"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={visibleKPIs.has(kpi.id)}
                                                                onChange={() => toggleKPI(kpi.id)}
                                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                                style={{ accentColor: getKPIColor(kpi.category, index) }}
                                                            />
                                                            <div
                                                                className="w-3 h-3 rounded-full flex-shrink-0"
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
                                <div className="flex items-center space-x-1 bg-white/80 rounded-lg p-1">
                                    <button
                                        onClick={() => setTimeFrame('1month')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${timeFrame === '1month'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        1M
                                    </button>
                                    <button
                                        onClick={() => setTimeFrame('6months')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${timeFrame === '6months'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        6M
                                    </button>
                                    <button
                                        onClick={() => setTimeFrame('1year')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${timeFrame === '1year'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        1Y
                                    </button>
                                    <button
                                        onClick={() => setTimeFrame('5years')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${timeFrame === '5years'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        5Y
                                    </button>
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
                                            fontSize={11}
                                            tick={{ fill: '#6b7280' }}
                                        />
                                        <YAxis
                                            stroke="#6b7280"
                                            fontSize={11}
                                            tick={{ fill: '#6b7280' }}
                                            domain={[0, 'dataMax']}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'white',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px',
                                                padding: '8px 12px'
                                            }}
                                            formatter={(value: any, name: string) => {
                                                // Find KPI name by ID
                                                const kpi = kpis.find(k => k.id === name)
                                                const kpiName = kpi ? kpi.title : name
                                                return [
                                                    typeof value === 'number' ? value.toLocaleString() : value,
                                                    kpiName
                                                ]
                                            }}
                                            labelFormatter={(label) => `Date: ${label}`}
                                        />
                                        <Legend
                                            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                                            formatter={(value) => {
                                                const kpi = kpis.find(k => k.id === value)
                                                return kpi ? kpi.title : value
                                            }}
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
                                                        strokeWidth={2}
                                                        dot={false}
                                                        activeDot={{ r: 5 }}
                                                    />
                                                )
                                            })}
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                    <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                                    <h4 className="text-lg font-semibold text-gray-700 mb-2">
                                        {visibleKPIs.size === 0 ? 'No Metrics Selected' : 'No Data Yet'}
                                    </h4>
                                    <p className="text-sm text-center max-w-xs">
                                        {visibleKPIs.size === 0
                                            ? 'Select at least one metric from the filter dropdown to view the graph'
                                            : 'Come back when you add data to see your metrics over time'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Metrics List - 1/3 width */}
                    <div className="bg-gradient-to-br from-green-50/30 to-emerald-50/20 border border-green-100/60 rounded-xl p-4 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Metrics</h3>
                                <p className="text-sm text-gray-500">All metrics and their totals</p>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
                            {kpis.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No metrics yet</p>
                                </div>
                            ) : (
                                kpis.map((kpi, index) => {
                                    const metricColor = getKPIColor(kpi.category, index)
                                    return (
                                        <div key={kpi.id} className="bg-white/60 border border-gray-200/60 rounded-lg p-3">
                                            <div className="text-sm font-semibold text-gray-900 mb-1 truncate">
                                                {kpi.title}
                                            </div>
                                            <div className="text-xl font-bold" style={{ color: metricColor }}>
                                                {(filteredTotals[kpi.id] || 0).toLocaleString()} {kpi.unit_of_measurement || ''}
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Key Metrics - 2 skinny boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-shrink-0 h-auto">
                    {/* Total Data Points */}
                    <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border border-blue-100/60 rounded-lg p-2">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-1.5">
                                <div className="p-1 bg-blue-100 rounded-md">
                                    <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                                </div>
                                <h4 className="text-xs font-semibold text-gray-900">Total Data Points</h4>
                            </div>
                        </div>
                        <div className="flex items-baseline space-x-1.5">
                            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                                {filteredUpdates.length.toLocaleString()}
                            </span>
                            <span className="text-xs text-gray-500">points</span>
                        </div>
                        <div className="flex items-center mt-1 text-xs text-blue-600">
                            <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                            <span className="text-xs">Across all KPIs</span>
                        </div>
                    </div>

                    {/* Evidence Coverage */}
                    <div className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 border border-green-100/60 rounded-lg p-2">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-1.5">
                                <div className="p-1 bg-green-100 rounded-md">
                                    <Target className="w-3.5 h-3.5 text-green-600" />
                                </div>
                                <h4 className="text-xs font-semibold text-gray-900">Evidence Coverage</h4>
                            </div>
                        </div>
                        <div className="flex items-baseline space-x-1.5">
                            <span className="text-lg font-bold text-green-600">
                                {stats.evidence_coverage_percentage}%
                            </span>
                            <span className="text-xs text-gray-500">supported</span>
                        </div>
                        <div className="flex items-center mt-1 text-xs text-green-600">
                            <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                            <span className="text-xs">Data points with evidence</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}