import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, MapPin, Edit, Trash2 } from 'lucide-react'
import { locationsService, Location } from '../../services/locations'
import { analyticsService, LocationKpiTotalsData } from '../../services/analytics'
import { useFilterStore } from '../../state/filters/filterStore'
import { Labels } from '../../ui/labels'
import toast from 'react-hot-toast'

export default function LocationDetailPage() {
    const { id } = useParams<{ id: string }>()
    const { dateRange } = useFilterStore()
    const [location, setLocation] = useState<Location | null>(null)
    const [totals, setTotals] = useState<LocationKpiTotalsData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (id) {
            loadLocation()
        }
    }, [id])

    useEffect(() => {
        if (location && dateRange) {
            loadTotals()
        }
    }, [location, dateRange])

    const loadLocation = async () => {
        if (!id) return

        setLoading(true)
        setError(null)

        try {
            const locationData = await locationsService.getLocation(id)
            setLocation(locationData)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load location')
        } finally {
            setLoading(false)
        }
    }

    const loadTotals = async () => {
        if (!location || !dateRange) return

        try {
            const totalsData = await analyticsService.getLocationKpiTotals(
                dateRange.start,
                dateRange.end,
                undefined, // All KPIs
                [location.id]
            )
            setTotals(totalsData)
        } catch (err) {
            console.warn('Failed to load totals:', err)
            setTotals([])
        }
    }

    const handleDelete = async () => {
        if (!location) return

        if (!confirm(`Are you sure you want to delete "${location.name}"?`)) {
            return
        }

        try {
            await locationsService.deleteLocation(location.id)
            toast.success('Location deleted successfully')
            // Redirect to locations list
            window.location.href = '/locations'
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete location')
        }
    }

    const getLocationTypeIcon = (type: string) => {
        switch (type) {
            case 'clinic':
                return '🏥'
            case 'site':
                return '📍'
            case 'region':
                return '🗺️'
            default:
                return '📍'
        }
    }

    const getLocationTypeColor = (type: string) => {
        switch (type) {
            case 'clinic':
                return 'bg-blue-100 text-blue-800'
            case 'site':
                return 'bg-green-100 text-green-800'
            case 'region':
                return 'bg-purple-100 text-purple-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (error || !location) {
        return (
            <div className="flex items-center justify-center h-64 text-red-500">
                <div className="text-center">
                    <p>Error loading location: {error}</p>
                    <Link
                        to="/locations"
                        className="mt-2 inline-block px-4 py-2 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600"
                    >
                        Back to Locations
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link
                        to="/locations"
                        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to {Labels.locations}</span>
                    </Link>
                </div>
                <div className="flex items-center space-x-2">
                    <Link
                        to={`/locations/${location.id}/edit`}
                        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
                    >
                        <Edit className="w-4 h-4" />
                        <span>Edit</span>
                    </Link>
                    <button
                        onClick={handleDelete}
                        className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                    </button>
                </div>
            </div>

            {/* Location Info */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="flex items-start space-x-4">
                    <div className="text-3xl">{getLocationTypeIcon(location.type)}</div>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-gray-900">{location.name}</h1>
                        <div className="mt-2 flex items-center space-x-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getLocationTypeColor(location.type)}`}>
                                {location.type}
                            </span>
                            {(location.city || location.region) && (
                                <span className="text-sm text-gray-600">
                                    {location.city || location.region}
                                </span>
                            )}
                        </div>
                        {location.latitude && location.longitude && (
                            <div className="mt-2 text-sm text-gray-500">
                                Coordinates: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Map Preview */}
            {location.latitude && location.longitude && (
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Map Preview</h2>
                    <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                        <div className="text-center text-gray-500">
                            <MapPin className="w-8 h-8 mx-auto mb-2" />
                            <p>Map integration would go here</p>
                            <p className="text-sm">Lat: {location.latitude}, Lng: {location.longitude}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Totals for Date Range */}
            {dateRange && (
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Totals for {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
                    </h2>
                    {totals.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p>No data available for this location in the selected date range.</p>
                            <p className="text-sm mt-1">Try adjusting the date range in the dashboard.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {totals.map((total, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div>
                                        <h4 className="font-medium text-gray-900">{total.kpi_name}</h4>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-semibold text-gray-900">
                                            {total.total_value.toLocaleString()}
                                        </div>
                                        <div className="text-sm text-gray-500">{total.unit}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Recent Data Points */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Data Points</h2>
                <div className="text-center py-8 text-gray-500">
                    <p>Recent data points impacting this location would be shown here.</p>
                    <p className="text-sm mt-1">This feature will be implemented when the allocation system is ready.</p>
                </div>
            </div>
        </div>
    )
}
