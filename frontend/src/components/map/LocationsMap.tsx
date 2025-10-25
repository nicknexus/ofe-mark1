import React, { useState, useEffect } from 'react'
import { useFilterStore } from '../../state/filters/filterStore'
import { analyticsService, LocationKpiTotalsData } from '../../services/analytics'
import { locationsService, Location } from '../../services/locations'
import { Labels } from '../../ui/labels'

export default function LocationsMap() {
    const { dateRange, selectedLocationIds, selectedKpiIds } = useFilterStore()
    const [locations, setLocations] = useState<Location[]>([])
    const [locationTotals, setLocationTotals] = useState<LocationKpiTotalsData[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (dateRange) {
            loadData()
        }
    }, [dateRange, selectedLocationIds, selectedKpiIds])

    const loadData = async () => {
        if (!dateRange) return

        setLoading(true)
        setError(null)

        try {
            // Load locations
            const locationList = await locationsService.getLocations()
            setLocations(locationList)

            // Try to load location totals
            try {
                const totals = await analyticsService.getLocationKpiTotals(
                    dateRange.start,
                    dateRange.end,
                    selectedKpiIds || undefined,
                    selectedLocationIds || undefined
                )
                setLocationTotals(totals)
            } catch (rpcError) {
                console.warn('RPC not available, using empty totals')
                setLocationTotals([])
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    if (!dateRange) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <p>Select a date range to view locations</p>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64 text-red-500">
                <div className="text-center">
                    <p>Error loading data: {error}</p>
                    <button
                        onClick={loadData}
                        className="mt-2 px-4 py-2 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    if (locations.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <p>No locations found</p>
                </div>
            </div>
        )
    }

    // Group totals by location
    const locationTotalsMap = locationTotals.reduce((acc, item) => {
        if (!acc[item.location_id]) {
            acc[item.location_id] = {
                location_name: item.location_name,
                totals: []
            }
        }
        acc[item.location_id].totals.push({
            kpi_name: item.kpi_name,
            total_value: item.total_value,
            unit: item.unit
        })
        return acc
    }, {} as Record<string, { location_name: string; totals: Array<{ kpi_name: string; total_value: number; unit: string }> }>)

    return (
        <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
                {locations.length} {Labels.locations.toLowerCase()} with data in selected range
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto">
                {locations.map((location) => {
                    const totals = locationTotalsMap[location.id]
                    const hasData = totals && totals.totals.length > 0

                    return (
                        <div
                            key={location.id}
                            className={`p-3 rounded-lg border ${hasData
                                    ? 'border-primary-200 bg-primary-50'
                                    : 'border-gray-200 bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 rounded-full bg-primary-500" />
                                    <h4 className="font-medium text-gray-900">{location.name}</h4>
                                </div>
                                <span className="text-xs text-gray-500 capitalize">
                                    {location.type}
                                </span>
                            </div>

                            <div className="mt-1 text-sm text-gray-600">
                                {location.city || location.region}
                            </div>

                            {hasData && (
                                <div className="mt-2 space-y-1">
                                    {totals.totals.map((total, index) => (
                                        <div key={index} className="text-xs text-gray-600">
                                            {total.kpi_name}: {total.total_value.toLocaleString()} {total.unit}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!hasData && (
                                <div className="mt-2 text-xs text-gray-500">
                                    No data in selected range
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
