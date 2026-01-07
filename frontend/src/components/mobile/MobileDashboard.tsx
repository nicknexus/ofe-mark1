import React, { useState } from 'react'
import { Plus, ChevronRight, Edit, Trash2 } from 'lucide-react'
import { Initiative, CreateInitiativeForm } from '../../types'
import { apiService } from '../../services/api'
import CreateInitiativeModal from '../CreateInitiativeModal'
import toast from 'react-hot-toast'

interface MobileDashboardProps {
    initiatives: Initiative[]
    onEnterInitiative: (initiative: Initiative) => void
    onRefresh: () => void
    loading: boolean
}

export default function MobileDashboard({
    initiatives,
    onEnterInitiative,
    onRefresh,
    loading
}: MobileDashboardProps) {
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null)
    const [deleteConfirmInitiative, setDeleteConfirmInitiative] = useState<Initiative | null>(null)

    const handleCreateInitiative = async (formData: CreateInitiativeForm) => {
        try {
            const newInitiative = await apiService.createInitiative(formData)
            toast.success('Initiative created!')
            onRefresh()
            if (newInitiative?.id) {
                // Enter the newly created initiative
                onEnterInitiative(newInitiative)
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create initiative'
            toast.error(message)
            throw error
        }
    }

    const handleEditInitiative = async (formData: CreateInitiativeForm) => {
        if (!editingInitiative?.id) return
        try {
            await apiService.updateInitiative(editingInitiative.id, formData)
            toast.success('Initiative updated!')
            onRefresh()
            setShowEditModal(false)
            setEditingInitiative(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update initiative'
            toast.error(message)
            throw error
        }
    }

    const handleDeleteInitiative = async (initiative: Initiative) => {
        if (!initiative.id) return
        try {
            await apiService.deleteInitiative(initiative.id)
            toast.success('Initiative deleted!')
            onRefresh()
            setDeleteConfirmInitiative(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete initiative'
            toast.error(message)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    return (
        <div className="p-4">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Your Initiatives</h1>
                <p className="text-sm text-gray-500 mt-1">
                    {initiatives.length} initiative{initiatives.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Create Button */}
            <button
                onClick={() => setShowCreateModal(true)}
                className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl font-semibold text-base transition-colors shadow-lg shadow-primary-500/25 active:scale-[0.98]"
            >
                <Plus className="w-5 h-5" />
                {initiatives.length === 0 ? 'Create Your First Initiative' : 'New Initiative'}
            </button>

            {/* Initiatives List */}
            {initiatives.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <img src="/Nexuslogo.png" alt="Logo" className="w-8 h-8 object-contain" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Welcome to OFE</h3>
                    <p className="text-gray-500 text-sm px-6">
                        Create your first initiative to start tracking impact.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {initiatives.map((initiative) => (
                        <div
                            key={initiative.id}
                            className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden transition-all active:border-primary-300"
                        >
                            {/* Tappable area to enter initiative */}
                            <button
                                onClick={() => onEnterInitiative(initiative)}
                                className="w-full p-4 text-left active:bg-gray-50"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                                            <img src="/Nexuslogo.png" alt="" className="w-5 h-5 object-contain" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-800 truncate">
                                                {initiative.title}
                                            </h3>
                                            {initiative.description && (
                                                <p className="text-xs text-gray-500 truncate mt-0.5">
                                                    {initiative.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center ml-2">
                                        <ChevronRight className="w-4 h-4 text-gray-500" />
                                    </div>
                                </div>
                            </button>
                            
                            {/* Action buttons */}
                            <div className="flex border-t border-gray-100">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setEditingInitiative(initiative)
                                        setShowEditModal(true)
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    <Edit className="w-4 h-4" />
                                    Edit
                                </button>
                                <div className="w-px bg-gray-100" />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setDeleteConfirmInitiative(initiative)
                                    }}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <CreateInitiativeModal
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    onSubmit={handleCreateInitiative}
                />
            )}

            {/* Edit Modal */}
            {showEditModal && editingInitiative && (
                <CreateInitiativeModal
                    isOpen={showEditModal}
                    onClose={() => {
                        setShowEditModal(false)
                        setEditingInitiative(null)
                    }}
                    onSubmit={handleEditInitiative}
                    editData={editingInitiative}
                />
            )}

            {/* Delete Confirmation */}
            {deleteConfirmInitiative && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Delete Initiative</h3>
                                <p className="text-xs text-gray-500">This cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-6">
                            Delete "<strong>{deleteConfirmInitiative.title}</strong>"? This will also delete all KPIs, evidence, and stories.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirmInitiative(null)}
                                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteInitiative(deleteConfirmInitiative)}
                                className="flex-1 py-3 px-4 bg-red-500 text-white rounded-xl font-medium text-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

