import React, { useState, useEffect, useRef } from 'react'
import { MapPin, Plus, Edit, Trash2, AlertCircle, GripVertical } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Location } from '../../types'
import { apiService } from '../../services/api'
import LocationMap from '../LocationMap'
import LocationModal from '../LocationModal'
import LocationDetailsModal from '../LocationDetailsModal'
import toast from 'react-hot-toast'
import { useTutorial } from '../../context/TutorialContext'
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
            className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 relative group ${
                selectedLocationId === location.id
                    ? 'border-primary-300 bg-primary-50 shadow-bubble-sm'
                    : 'border-gray-100 hover:border-gray-200 bg-white shadow-bubble-sm hover:shadow-bubble'
            }`}
        >
            {/* Drag Handle - Top Right Corner */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-1 right-1 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ opacity: isDragging ? 1 : undefined }}
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical className="w-3 h-3 text-gray-400" />
            </div>
            <div className="flex items-start justify-between mb-1.5">
                <h3 className="font-medium text-gray-800 text-sm pr-8">{location.name}</h3>
                <div className="flex items-center space-x-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onEditClick(location, e)
                        }}
                        className="p-1 text-gray-400 hover:text-primary-500 transition-colors rounded"
                    >
                        <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onDeleteClick(e)
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            {location.description && (
                <p className="text-xs text-gray-500 mb-1.5 line-clamp-2">
                    {location.description}
                </p>
            )}
            <div className="text-xs text-gray-400">
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
    const { isActive: isTutorialActive, currentStep, advanceStep } = useTutorial()
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
            const newLocation = await apiService.createLocation(locationData)
            toast.success('Location created successfully!')
            await loadLocations()
            setIsModalOpen(false)
            setSelectedLocation(null)
            setMapClickCoordinates(null)

            // Advance tutorial if on create-location step (goes to location-created celebration)
            if (isTutorialActive && currentStep === 'create-location') {
                advanceStep({ locationId: newLocation?.id })
            }
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
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (!initiativeId) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Invalid initiative ID</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen overflow-hidden">
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="bg-white border-b border-gray-100 shadow-bubble-sm p-4 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="icon-bubble">
                                <MapPin className="w-5 h-5 text-primary-500" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold text-gray-800">Locations</h1>
                                <p className="text-sm text-gray-500">Manage geographic locations for your initiative</p>
                            </div>
                        </div>
                        <button
                            onClick={handleAddClick}
                            data-tutorial="add-location"
                            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl text-sm font-medium transition-all duration-200 shadow-bubble-sm"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Location</span>
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden min-h-0">
                    {/* Map - 2/3 width */}
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-bubble border border-gray-100 p-3 overflow-hidden flex flex-col min-h-0 h-full">
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
                    <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-4 overflow-hidden flex flex-col min-h-0 h-full">
                        <div className="mb-3 flex-shrink-0">
                            <h2 className="text-base font-semibold text-gray-800 mb-0.5">
                                All Locations ({orderedLocations.length})
                            </h2>
                            <p className="text-xs text-gray-400">Click a location to view details • Edit button opens editor</p>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                            {orderedLocations.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="icon-bubble mx-auto mb-3">
                                        <MapPin className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 text-sm mb-3">No locations yet</p>
                                    <button
                                        onClick={handleAddClick}
                                        className="text-sm text-primary-500 hover:text-primary-600 font-medium"
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
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-bubble-lg border border-gray-100">
                        <div className="flex items-start space-x-4 mb-6">
                            <div className="icon-bubble">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-800 mb-1">Delete Location</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-gray-600 mb-2 text-sm">
                            Are you sure you want to delete{' '}
                            <strong className="text-gray-800">
                                "{locations.find((l) => l.id === deleteConfirmId)?.name}"
                            </strong>
                            ?
                        </p>
                        <p className="text-xs text-gray-500 mb-6">
                            Impact claims linked to this location will remain but won't be associated with a
                            location anymore.
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteLocation(deleteConfirmId)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-2xl transition-all duration-200 shadow-bubble-sm"
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
