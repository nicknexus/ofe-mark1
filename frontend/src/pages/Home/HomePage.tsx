import React, { useState, useEffect } from 'react'
import { useFilterStore } from '../../state/filters/filterStore'
import DateRangePicker from '../../components/filters/DateRangePicker'
import MetricMultiSelect from '../../components/filters/MetricMultiSelect'
import LocationMultiSelect from '../../components/filters/LocationMultiSelect'
import DailyLineChart from '../../components/charts/DailyLineChart'
import TotalsBarChart from '../../components/charts/TotalsBarChart'
import LocationsMap from '../../components/map/LocationsMap'
import { Labels } from '../../ui/labels'

export default function HomePage() {
    const { dateRange, selectedLocationIds, selectedKpiIds, clearFilters } = useFilterStore()
    const [loading, setLoading] = useState(false)

    const hasFilters = dateRange || selectedLocationIds || selectedKpiIds

    const handleClearFilters = () => {
        clearFilters()
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-600">Overview of your metrics and data</p>
                </div>
                {hasFilters && (
                    <button
                        onClick={handleClearFilters}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md border border-gray-300"
                    >
                        Clear Filters
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Date Range
                        </label>
                        <DateRangePicker />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {Labels.locations}
                        </label>
                        <LocationMultiSelect />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {Labels.kpiPlural}
                        </label>
                        <MetricMultiSelect />
                    </div>
                </div>
            </div>

            {/* Widgets Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Trend Line Chart */}
                <div className="lg:col-span-2">
                    <div className="bg-white p-6 rounded-lg border border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Trend</h2>
                        <DailyLineChart />
                    </div>
                </div>

                {/* Totals Bar Chart */}
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Totals</h2>
                    <TotalsBarChart />
                </div>

                {/* Map */}
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Locations Map</h2>
                    <LocationsMap />
                </div>
            </div>

            {/* Empty State */}
            {!hasFilters && (
                <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No filters applied</h3>
                    <p className="text-gray-600 mb-4">
                        Select a date range and optionally choose {Labels.locations.toLowerCase()} or {Labels.kpiPlural.toLowerCase()} to see your data.
                    </p>
                </div>
            )}
        </div>
    )
}
