import React, { useState, useEffect, useRef } from 'react'
import { MapPin, Plus, Edit, Trash2, AlertCircle, GripVertical } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Location } from '../../types'
import { apiService } from '../../services/api'
import LocationMap from '../LocationMap'
import LocationModal from '../LocationModal'
import LocationDetailsModal from '../LocationDetailsModal'
import toast from 'react-hot-toast'
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
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Sortable Location Card Component
function SortableLocationCard({ 
    location, 
    selectedLocationId, 
    onListItemClick, 
    onEditClick, 
    onDeleteClick,
    locationCardRefs 
}: {
    location: Location
    selectedLocationId: string | null
    onListItemClick: (location: Location) => void
    onEditClick: (location: Location, e: React.MouseEvent) => void
    onDeleteClick: (e: React.MouseEvent) => void
    locationCardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: location.id! })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    }

    return (
        <div
            ref={(el) => {
                setNodeRef(el)
                if (location.id) {
                    locationCardRefs.current[location.id] = el
                }
            }}
            style={style}
            onClick={() => onListItemClick(location)}
            className={`p-3 rounded-lg border cursor-pointer transition-all relative group ${
                selectedLocationId === location.id
                    ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                    : 'border-gray-200 hover:border-gray-300 bg-gray-50'
            }`}
        >
            {/* Drag Handle - Top Right Corner */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-1 right-1 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ opacity: isDragging ? 1 : undefined }}
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical className="w-3 h-3 text-gray-400" />
            </div>
            <div className="flex items-start justify-between mb-1.5">
                <h3 className="font-semibold text-gray-900 text-sm pr-8">{location.name}</h3>
                <div className="flex items-center space-x-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onEditClick(location, e)
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                        <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onDeleteClick(e)
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            {location.description && (
                <p className="text-xs text-gray-600 mb-1.5 line-clamp-2">
                    {location.description}
                </p>
            )}
            <div className="text-xs text-gray-500">
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </div>
        </div>
    )
}

interface LocationTabProps {
    onStoryClick?: (storyId: string) => void
    onMetricClick?: (kpiId: string) => void
}

export default function LocationTab({ onStoryClick, onMetricClick }: LocationTabProps) {
    const { id: initiativeId } = useParams<{ id: string }>()
    const [locations, setLocations] = useState<Location[]>([])
    const [orderedLocations, setOrderedLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
    const [detailsLocation, setDetailsLocation] = useState<Location | null>(null)
    const [mapClickCoordinates, setMapClickCoordinates] = useState<[number, number] | null>(null)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
    const locationCardRefs = useRef<Record<string, HTMLDivElement | null>>({})

    // Initialize ordered locations from state, sorted by display_order
    useEffect(() => {
        const sorted = [...locations].sort((a, b) => {
            const orderA = a.display_order ?? 0
            const orderB = b.display_order ?? 0
            return orderA - orderB
        })
        setOrderedLocations(sorted)
    }, [locations])

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

        const oldIndex = orderedLocations.findIndex((loc) => loc.id === active.id)
        const newIndex = orderedLocations.findIndex((loc) => loc.id === over.id)

        if (oldIndex === -1 || newIndex === -1) return

        const newOrderedLocations = arrayMove(orderedLocations, oldIndex, newIndex)
        setOrderedLocations(newOrderedLocations)

        // Update display_order in backend
        if (initiativeId) {
            try {
                const order = newOrderedLocations.map((loc, index) => ({
                    id: loc.id!,
                    display_order: index,
                }))
                await apiService.updateLocationOrder(order)
            } catch (error) {
                console.error('Failed to update location order:', error)
                toast.error('Failed to save order')
                // Revert on error
                setOrderedLocations(orderedLocations)
            }
        }
    }

    useEffect(() => {
        if (initiativeId) {
            loadLocations()
        }
    }, [initiativeId])

    // Auto-scroll to selected location in sidebar
    useEffect(() => {
        if (selectedLocation?.id) {
            const cardRef = locationCardRefs.current[selectedLocation.id]
            if (cardRef) {
                cardRef.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }
    }, [selectedLocation])

    const loadLocations = async () => {
        if (!initiativeId) return
        try {
            setLoading(true)
            const data = await apiService.getLocations(initiativeId)
            setLocations(data)
        } catch (error) {
            toast.error('Failed to load locations')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateLocation = async (locationData: Partial<Location>) => {
        try {
            await apiService.createLocation(locationData)
            toast.success('Location created successfully!')
            await loadLocations()
            setIsModalOpen(false)
            setSelectedLocation(null)
            setMapClickCoordinates(null)
        } catch (error) {
            throw error
        }
    }

    const handleUpdateLocation = async (locationData: Partial<Location>) => {
        if (!selectedLocation?.id) return
        try {
            await apiService.updateLocation(selectedLocation.id, locationData)
            toast.success('Location updated successfully!')
            await loadLocations()
            setIsModalOpen(false)
            setSelectedLocation(null)
        } catch (error) {
            throw error
        }
    }

    const handleDeleteLocation = async (id: string) => {
        try {
            await apiService.deleteLocation(id)
            toast.success('Location deleted successfully!')
            await loadLocations()
            setDeleteConfirmId(null)
        } catch (error) {
            toast.error('Failed to delete location')
            console.error(error)
        }
    }

    const handleMapClick = (coordinates: [number, number]) => {
        setMapClickCoordinates(coordinates)
        setSelectedLocation(null)
        setIsModalOpen(true)
    }

    const handleLocationClick = (location: Location) => {
        // Just select the location to highlight it - don't open editor
        setSelectedLocation(location)
        setMapClickCoordinates(null)
    }

    const handleAddClick = () => {
        setSelectedLocation(null)
        setMapClickCoordinates(null)
        setIsModalOpen(true)
    }

    const handleEditClick = (location: Location, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedLocation(location)
        setMapClickCoordinates(null)
        setIsDetailsModalOpen(false)
        setIsModalOpen(true)
    }

    const handleListItemClick = (location: Location) => {
        setDetailsLocation(location)
        setSelectedLocation(location)
        setMapClickCoordinates(null)
        setIsDetailsModalOpen(true)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (!initiativeId) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Invalid initiative ID</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-[calc(100vh-64px)] bg-gradient-to-br from-slate-50 via-white to-blue-50/30 overflow-hidden">
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 p-3 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <MapPin className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Locations</h1>
                                <p className="text-sm text-gray-600">Manage geographic locations for your initiative</p>
                            </div>
                        </div>
                        <button
                            onClick={handleAddClick}
                            className="inline-flex items-center space-x-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Location</span>
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-2 p-2 overflow-hidden min-h-0">
                    {/* Map - 2/3 width */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-2 overflow-hidden flex flex-col min-h-0 h-full">
                        <LocationMap
                            locations={orderedLocations}
                            onLocationClick={handleLocationClick}
                            onMapClick={handleMapClick}
                            selectedLocationId={selectedLocation?.id || null}
                            initiativeId={initiativeId}
                            onEditClick={(location) => {
                                setSelectedLocation(location)
                                setMapClickCoordinates(null)
                                setIsDetailsModalOpen(false)
                                setIsModalOpen(true)
                            }}
                            onStoryClick={onStoryClick}
                            onMetricClick={onMetricClick}
                        />
                    </div>

                    {/* Location List - 1/3 width */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2 overflow-hidden flex flex-col min-h-0 h-full">
                        <div className="mb-2 flex-shrink-0">
                            <h2 className="text-base font-semibold text-gray-900 mb-0.5">
                                All Locations ({orderedLocations.length})
                            </h2>
                            <p className="text-xs text-gray-500">Click a location to view details • Edit button opens editor</p>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
                            {orderedLocations.length === 0 ? (
                                <div className="text-center py-8">
                                    <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm mb-3">No locations yet</p>
                                    <button
                                        onClick={handleAddClick}
                                        className="text-sm text-green-600 hover:text-green-700 font-medium"
                                    >
                                        Add your first location
                                    </button>
                                </div>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext
                                        items={orderedLocations.map(loc => loc.id!)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        {orderedLocations.map((location) => (
                                            <SortableLocationCard
                                                key={location.id}
                                                location={location}
                                                selectedLocationId={selectedLocation?.id || null}
                                                onListItemClick={handleListItemClick}
                                                onEditClick={handleEditClick}
                                                onDeleteClick={(e) => {
                                                    e.stopPropagation()
                                                    setDeleteConfirmId(location.id!)
                                                }}
                                                locationCardRefs={locationCardRefs}
                                            />
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Location Details Modal */}
            <LocationDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => {
                    setIsDetailsModalOpen(false)
                    setDetailsLocation(null)
                }}
                location={detailsLocation}
                onEditClick={(location) => {
                    setSelectedLocation(location)
                    setMapClickCoordinates(null)
                    setIsDetailsModalOpen(false)
                    setIsModalOpen(true)
                }}
                onStoryClick={onStoryClick}
                onMetricClick={onMetricClick}
                initiativeId={initiativeId}
            />

            {/* Location Modal */}
            <LocationModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    setSelectedLocation(null)
                    setMapClickCoordinates(null)
                }}
                onSubmit={selectedLocation ? handleUpdateLocation : handleCreateLocation}
                initialLocation={selectedLocation}
                initiativeId={initiativeId}
                initialCoordinates={mapClickCoordinates}
            />

            {/* Delete Confirmation */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-red-100 to-pink-100 rounded-2xl flex items-center justify-center">
                                <Trash2 className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Location</h3>
                            <p className="text-gray-500">This action cannot be undone</p>
                        </div>

                        <div className="bg-gradient-to-r from-red-50/50 to-pink-50/50 border border-red-100/60 rounded-xl p-4 mb-6">
                            <p className="text-gray-700 text-center">
                                Are you sure you want to delete{' '}
                                <strong className="text-gray-900">
                                    "{locations.find((l) => l.id === deleteConfirmId)?.name}"
                                </strong>
                                ?
                            </p>
                            <p className="text-sm text-gray-600 text-center mt-2">
                                Impact claims linked to this location will remain but won't be associated with a
                                location anymore.
                            </p>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 px-6 py-3 bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 hover:text-gray-900 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteLocation(deleteConfirmId)}
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold shadow-lg shadow-red-600/25 hover:shadow-xl hover:shadow-red-600/30 transition-all duration-200 hover:scale-[1.02]"
                            >
                                Delete Location
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
