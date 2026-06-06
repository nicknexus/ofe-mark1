import React, { useState, useEffect, useRef } from 'react'
import { MapPin, Plus, Edit, Trash2, AlertCircle, GripVertical, Link2Off } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { Location } from '../../types'
import { apiService } from '../../services/api'
import LocationMap from '../LocationMap'
import LocationModal from '../LocationModal'
import LocationDetailsModal from '../LocationDetailsModal'
import AddLocationPickerModal from '../AddLocationPickerModal'
import { useTeam } from '../../context/TeamContext'
import { notify } from '../../lib/notify'
import ConfirmDialog from '../ConfirmDialog'
import { PageLoader } from '../ui'
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
 onUnlinkClick,
 onDeleteClick,
 locationCardRefs,
 country,
 canEdit,
 canDelete,
}: {
 location: Location
 selectedLocationId: string | null
 onListItemClick: (location: Location) => void
 onEditClick: (location: Location, e: React.MouseEvent) => void
 onUnlinkClick: (e: React.MouseEvent) => void
 onDeleteClick: (e: React.MouseEvent) => void
 locationCardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>
 country?: string | null
 canEdit: boolean
 canDelete: boolean
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
 className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 relative group ${selectedLocationId === location.id
 ? 'border-primary-300 bg-primary-50 '
 : 'border-gray-100 hover:border-gray-200 bg-white hover:shadow-card'
 }`}
 >
 {/* Drag Handle - Top Right Corner */}
 <div
 {...attributes}
 {...listeners}
 className={`absolute top-1 right-1 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity ${canEdit ? '' : 'hidden'}`}
 style={{ opacity: isDragging ? 1 : undefined }}
 onClick={(e) => e.stopPropagation()}
 >
 <GripVertical className="w-3 h-3 text-gray-400" />
 </div>
 <div className="flex items-start justify-between mb-1.5">
 <div className="flex-1 pr-8">
 <h3 className="font-medium text-gray-800 text-sm">{location.name}</h3>
 {country && (
 <p className="text-xs text-gray-500 mt-0.5">{country}</p>
 )}
 </div>
 <div className="flex items-center space-x-1">
 {canEdit && (
 <button
 onClick={(e) => {
 e.stopPropagation()
 onEditClick(location, e)
 }}
 title="Edit"
 className="p-1 text-gray-400 hover:text-primary-500 transition-colors rounded"
 >
 <Edit className="w-3.5 h-3.5" />
 </button>
 )}
 {canEdit && (
 <button
 onClick={(e) => {
 e.stopPropagation()
 onUnlinkClick(e)
 }}
 title="Remove from this initiative"
 className="p-1 text-gray-400 transition-colors rounded hover:text-[#d97706]"
 >
 <Link2Off className="w-3.5 h-3.5" />
 </button>
 )}
 {canDelete && (
 <button
 onClick={(e) => {
 e.stopPropagation()
 onDeleteClick(e)
 }}
 title="Delete (org-wide)"
 className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 )}
 </div>
 </div>
 {location.description && (
 <p className="text-xs text-gray-500 line-clamp-2">
 {location.description}
 </p>
 )}
 </div>
 )
}

interface LocationTabProps {
 onStoryClick?: (storyId: string) => void
 onMetricClick?: (kpiId: string) => void
}

export default function LocationTab({ onStoryClick, onMetricClick }: LocationTabProps) {
 const { id: initiativeId } = useParams<{ id: string }>()
 const { canEditLocations, canDelete } = useTeam()
 const [locations, setLocations] = useState<Location[]>([])
 const [orderedLocations, setOrderedLocations] = useState<Location[]>([])
 const [loading, setLoading] = useState(true)
 const [isModalOpen, setIsModalOpen] = useState(false)
 const [isPickerOpen, setIsPickerOpen] = useState(false)
 const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
 const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
 const [detailsLocation, setDetailsLocation] = useState<Location | null>(null)
 const [mapClickCoordinates, setMapClickCoordinates] = useState<[number, number] | null>(null)
 const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
 const [unlinkConfirmId, setUnlinkConfirmId] = useState<string | null>(null)
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
 notify.error('Failed to save order')
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
 notify.error('Failed to load locations')
 console.error(error)
 } finally {
 setLoading(false)
 }
 }

 const handleCreateLocation = async (locationData: Partial<Location>) => {
 try {
 const newLocation = await apiService.createLocation(locationData)
 notify.success('Location created successfully!')
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
 notify.success('Location updated successfully!')
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
 notify.success('Location deleted successfully!')
 await loadLocations()
 setDeleteConfirmId(null)
 } catch (error) {
 notify.error('Failed to delete location')
 console.error(error)
 }
 }

 const handleUnlinkLocation = async (id: string) => {
 if (!initiativeId) return
 try {
 await apiService.unlinkLocationFromInitiative(id, initiativeId)
 notify.success('Removed from this initiative')
 await loadLocations()
 setUnlinkConfirmId(null)
 } catch (error) {
 notify.error('Failed to remove location')
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
 setIsPickerOpen(true)
 }

 const handleCreateNewFromPicker = () => {
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
 return <PageLoader />
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
 <div className="h-screen overflow-hidden mobile-content-padding">
 <div className="h-full flex flex-col">
 {/* Header */}
 <div className="bg-white border-b border-gray-100 p-4 flex-shrink-0">
 <div className="flex items-center justify-between">
 <div className="flex items-center space-x-3">
 <div className="app-icon-tile hidden sm:flex">
 <MapPin className="w-5 h-5 text-primary-500" />
 </div>
 <div>
 <h1 className="text-lg sm:text-xl font-semibold text-gray-800">Locations</h1>
 <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Manage geographic locations for your initiative</p>
 </div>
 </div>
 {canEditLocations && (
 <button
 onClick={handleAddClick}
 className="app-btn app-btn-primary app-btn-sm"
 >
 <Plus className="w-4 h-4" />
 <span className="hidden sm:inline">Add Location</span>
 <span className="sm:hidden">Add</span>
 </button>
 )}
 </div>
 </div>

 {/* Main Content */}
 <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden min-h-0">
 {/* Map - 2/3 width - hidden on mobile */}
 <div className="lg:col-span-2 app-card p-3 overflow-hidden flex-col min-h-0 h-full hidden md:flex">
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

 {/* Location List - 1/3 width on desktop, full width on mobile */}
 <div className="col-span-1 lg:col-span-1 app-card p-4 overflow-hidden flex flex-col min-h-0 h-full">
 <div className="mb-3 flex-shrink-0">
 <h2 className="text-base font-semibold text-gray-800 mb-0.5">
 All Locations ({orderedLocations.length})
 </h2>
 <p className="text-xs text-gray-400 hidden sm:block">Click a location to view details • Edit button opens editor</p>
 <p className="text-xs text-gray-400 sm:hidden">Tap a location for details</p>
 </div>

 <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
 {orderedLocations.length === 0 ? (
 <div className="text-center py-8">
 <div className="app-icon-tile mx-auto mb-3">
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
 onUnlinkClick={(e) => {
 e.stopPropagation()
 setUnlinkConfirmId(location.id!)
 }}
 onDeleteClick={(e) => {
 e.stopPropagation()
 setDeleteConfirmId(location.id!)
 }}
 locationCardRefs={locationCardRefs}
 country={location.country}
 canEdit={canEditLocations}
 canDelete={canDelete}
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

 {/* Add Location Picker (existing global OR create new) */}
 <AddLocationPickerModal
 isOpen={isPickerOpen}
 onClose={() => setIsPickerOpen(false)}
 initiativeId={initiativeId}
 excludeIds={locations.map(l => l.id!).filter(Boolean)}
 onCreateNew={handleCreateNewFromPicker}
 onLinked={() => {
 loadLocations()
 }}
 />

 {unlinkConfirmId && (
 <ConfirmDialog
 title="Remove from initiative"
 message={`Remove "${locations.find((l) => l.id === unlinkConfirmId)?.name}" from this initiative? The location stays in your organization. Existing claims, evidence, and stories stay linked — they won't be filtered via the locations tab.`}
 confirmLabel="Remove"
 tone="default"
 onConfirm={() => {
 handleUnlinkLocation(unlinkConfirmId)
 setUnlinkConfirmId(null)
 }}
 onCancel={() => setUnlinkConfirmId(null)}
 />
 )}

 {deleteConfirmId && (
 <ConfirmDialog
 title="Delete location"
 message={`Permanently delete "${locations.find((l) => l.id === deleteConfirmId)?.name}" from your organization? This removes it from every initiative. Existing claims, evidence, and stories keep their data but lose the location reference.`}
 confirmLabel="Delete location"
 tone="danger"
 onConfirm={() => {
 handleDeleteLocation(deleteConfirmId)
 setDeleteConfirmId(null)
 }}
 onCancel={() => setDeleteConfirmId(null)}
 />
 )}
 </div>
 )
}
