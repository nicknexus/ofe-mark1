import React, { useState, useEffect } from 'react'
import { X, AlertCircle, CheckCircle } from 'lucide-react'
import { locationsService, Location } from '../../services/locations'
import { allocationsService } from '../../services/allocations'
import { Labels } from '../../ui/labels'

interface AllocationDialogProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (allocations: Array<{ location_id: string; allocated_value: number }>) => void
    totalValue: number
    selectedLocationIds: string[]
    datapointId?: string
}

export default function AllocationDialog({
    isOpen,
    onClose,
    onSubmit,
    totalValue,
    selectedLocationIds,
    datapointId
}: AllocationDialogProps) {
    const [locations, setLocations] = useState<Location[]>([])
    const [allocations, setAllocations] = useState<Array<{ location_id: string; allocated_value: number }>>([])
    const [mode, setMode] = useState<'even' | 'manual'>('even')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            loadLocations()
        }
    }, [isOpen, selectedLocationIds])

    useEffect(() => {
        if (locations.length > 0 && selectedLocationIds.length > 0) {
            initializeAllocations()
        }
    }, [locations, selectedLocationIds, totalValue])

    const loadLocations = async () => {
        setLoading(true)
        setError(null)

        try {
            const allLocations = await locationsService.getLocations()
            const filteredLocations = allLocations.filter(loc => selectedLocationIds.includes(loc.id))
            setLocations(filteredLocations)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load locations')
        } finally {
            setLoading(false)
        }
    }

    const initializeAllocations = () => {
        const initialAllocations = selectedLocationIds.map(locationId => ({
            location_id: locationId,
            allocated_value: 0
        }))
        setAllocations(initialAllocations)

        // Set even split by default
        setMode('even')
        distributeEvenly()
    }

    const distributeEvenly = () => {
        if (selectedLocationIds.length === 0) return

        const evenValue = totalValue / selectedLocationIds.length
        const newAllocations = selectedLocationIds.map(locationId => ({
            location_id: locationId,
            allocated_value: evenValue
        }))
        setAllocations(newAllocations)
    }

    const handleAllocationChange = (locationId: string, value: number) => {
        setAllocations(prev =>
            prev.map(alloc =>
                alloc.location_id === locationId
                    ? { ...alloc, allocated_value: value }
                    : alloc
            )
        )
    }

    const handleSubmit = () => {
        const validation = allocationsService.validateAllocations(totalValue, allocations)

        if (!validation.isValid) {
            setError(validation.error || 'Invalid allocations')
            return
        }

        onSubmit(allocations)
        onClose()
    }

    const getLocationName = (locationId: string) => {
        const location = locations.find(loc => loc.id === locationId)
        return location?.name || 'Unknown Location'
    }

    const getRemainingAmount = () => {
        const allocatedTotal = allocations.reduce((sum, alloc) => sum + alloc.allocated_value, 0)
        return totalValue - allocatedTotal
    }

    const isAllocationValid = () => {
        const validation = allocationsService.validateAllocations(totalValue, allocations)
        return validation.isValid
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Allocate Data Point Value
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Total Value Display */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Total Value to Allocate:</span>
                            <span className="text-lg font-semibold text-gray-900">
                                {totalValue.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    {/* Mode Selection */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Allocation Mode
                        </label>
                        <div className="flex space-x-4">
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="mode"
                                    value="even"
                                    checked={mode === 'even'}
                                    onChange={(e) => {
                                        setMode(e.target.value as 'even')
                                        distributeEvenly()
                                    }}
                                    className="mr-2"
                                />
                                <span className="text-sm text-gray-700">Even Split</span>
                            </label>
                            <label className="flex items-center">
                                <input
                                    type="radio"
                                    name="mode"
                                    value="manual"
                                    checked={mode === 'manual'}
                                    onChange={(e) => setMode(e.target.value as 'manual')}
                                    className="mr-2"
                                />
                                <span className="text-sm text-gray-700">Manual Entry</span>
                            </label>
                        </div>
                    </div>

                    {/* Locations and Allocations */}
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                            <AlertCircle className="w-5 h-5" />
                            <span className="text-sm">{error}</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {allocations.map((allocation, index) => (
                                <div key={allocation.location_id} className="flex items-center space-x-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {getLocationName(allocation.location_id)}
                                        </label>
                                        <input
                                            type="number"
                                            value={allocation.allocated_value}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0
                                                handleAllocationChange(allocation.location_id, value)
                                            }}
                                            disabled={mode === 'even'}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
                                            placeholder="0"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    <div className="text-sm text-gray-500 pt-6">
                                        {((allocation.allocated_value / totalValue) * 100).toFixed(1)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Validation Status */}
                    <div className="space-y-2">
                        {getRemainingAmount() !== 0 && (
                            <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                                <AlertCircle className="w-5 h-5" />
                                <span className="text-sm">
                                    Remaining amount: {getRemainingAmount().toLocaleString()}
                                </span>
                            </div>
                        )}

                        {isAllocationValid() && (
                            <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-3 rounded-lg">
                                <CheckCircle className="w-5 h-5" />
                                <span className="text-sm">Allocation is valid</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!isAllocationValid()}
                        className="px-4 py-2 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Save Allocations
                    </button>
                </div>
            </div>
        </div>
    )
}
