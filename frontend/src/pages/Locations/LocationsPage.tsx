import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, MapPin, Edit, Trash2 } from 'lucide-react'
import { locationsService, Location } from '../../services/locations'
import { Labels } from '../../ui/labels'
import toast from 'react-hot-toast'

export default function LocationsPage() {
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadLocations()
    }, [])

    const loadLocations = async () => {
        setLoading(true)
        setError(null)

        try {
            const locationList = await locationsService.getLocations()
            setLocations(locationList)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load locations')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) {
            return
        }

        try {
            await locationsService.deleteLocation(id)
            setLocations(locations.filter(loc => loc.id !== id))
            toast.success('Location deleted successfully')
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

    if (error) {
        return (
            <div className="flex items-center justify-center h-64 text-red-500">
                <div className="text-center">
                    <p>Error loading locations: {error}</p>
                    <button
                        onClick={loadLocations}
                        className="mt-2 px-4 py-2 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{Labels.locations}</h1>
                    <p className="text-gray-600">Manage your locations and sites</p>
                </div>
                <Link
                    to="/locations/new"
                    className="flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Location</span>
                </Link>
            </div>

            {/* Locations List */}
            {locations.length === 0 ? (
                <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <MapPin className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No locations found</h3>
                    <p className="text-gray-600 mb-4">
                        Get started by adding your first location.
                    </p>
                    <Link
                        to="/locations/new"
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Location</span>
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Type
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Location
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Data Points
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {locations.map((location) => (
                                    <tr key={location.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center space-x-3">
                                                <span className="text-lg">{getLocationTypeIcon(location.type)}</span>
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {location.name}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getLocationTypeColor(location.type)}`}>
                                                {location.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {location.city || location.region || '—'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {/* TODO: Show actual data point count */}
                                            —
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end space-x-2">
                                                <Link
                                                    to={`/locations/${location.id}`}
                                                    className="text-primary-600 hover:text-primary-900"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(location.id, location.name)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
