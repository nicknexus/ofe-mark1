import React, { useState } from 'react'
import { Plus, ChevronRight, Edit, Trash2, X, Zap, ArrowRight, Users } from 'lucide-react'
import { Initiative, CreateInitiativeForm } from '../../types'
import { apiService } from '../../services/api'
import { useTeam } from '../../context/TeamContext'
import CreateInitiativeModal from '../CreateInitiativeModal'
import toast from 'react-hot-toast'

interface MobileDashboardProps {
    initiatives: Initiative[]
    onEnterInitiative: (initiative: Initiative) => void
    onRefresh: () => void
    loading: boolean
    onNavigateToAccount?: () => void
}

export default function MobileDashboard({
    initiatives,
    onEnterInitiative,
    onRefresh,
    loading,
    onNavigateToAccount
}: MobileDashboardProps) {
    const { isOwner, isSharedMember, organizationName } = useTeam()
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null)
    const [deleteConfirmInitiative, setDeleteConfirmInitiative] = useState<Initiative | null>(null)
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [upgradeUsage, setUpgradeUsage] = useState<{ current: number; limit: number } | null>(null)

    const handleCreateInitiative = async (formData: CreateInitiativeForm) => {
        try {
            const newInitiative = await apiService.createInitiative(formData)
            toast.success('Initiative created!')
            onRefresh()
            if (newInitiative?.id) {
                // Enter the newly created initiative
                onEnterInitiative(newInitiative)
            }
        } catch (error: any) {
            // Check if it's an initiative limit error
            if (error?.code === 'INITIATIVE_LIMIT_REACHED' || error?.message?.includes('Initiative limit reached')) {
                setUpgradeUsage(error.usage || { current: initiatives.length, limit: 2 })
                setShowUpgradeModal(true)
                setShowCreateModal(false)
                return
            }
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
        if (deleteConfirmText !== 'DELETE MY INITIATIVE') {
            toast.error('Please type "DELETE MY INITIATIVE" exactly to confirm')
            return
        }
        try {
            await apiService.deleteInitiative(initiative.id)
            toast.success('Initiative deleted!')
            onRefresh()
            setDeleteConfirmInitiative(null)
            setDeleteConfirmText('')
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
            {/* Team Member Banner */}
            {isSharedMember && (
                <div className="mb-4 p-3 bg-purple-50 border border-purple-100 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-purple-800 truncate">
                            Viewing {organizationName}'s initiatives
                        </p>
                        <p className="text-xs text-purple-600">Team member</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                    {isSharedMember ? 'Initiatives' : 'Your Initiatives'}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    {initiatives.length} initiative{initiatives.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Create Button - Only for owners */}
            {isOwner && (
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="w-full mb-6 flex items-center justify-center gap-2 px-4 py-4 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl font-semibold text-base transition-colors shadow-lg shadow-primary-500/25 active:scale-[0.98]"
                >
                    <Plus className="w-5 h-5" />
                    {initiatives.length === 0 ? 'Create Your First Initiative' : 'New Initiative'}
                </button>
            )}

            {/* Initiatives List */}
            {initiatives.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <img src="/Nexuslogo.png" alt="Logo" className="w-8 h-8 object-contain" />
                    </div>
                    {isSharedMember ? (
                        <>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Initiatives Yet</h3>
                            <p className="text-gray-500 text-sm px-6">
                                Contact the organization owner to create initiatives.
                            </p>
                        </>
                    ) : (
                        <>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Welcome to Nexus</h3>
                            <p className="text-gray-500 text-sm px-6">
                                Create your first initiative to start tracking impact.
                            </p>
                        </>
                    )}
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
                            
                            {/* Action buttons - Only show for owners */}
                            {isOwner && (
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
                            )}
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
                        <p className="text-sm text-gray-600 mb-4">
                            Delete "<strong>{deleteConfirmInitiative.title}</strong>"? This will also delete all KPIs, evidence, and stories.
                        </p>
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-gray-700 mb-2">
                                Type <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">DELETE MY INITIATIVE</span> to confirm:
                            </label>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="DELETE MY INITIATIVE"
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setDeleteConfirmInitiative(null); setDeleteConfirmText('') }}
                                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteInitiative(deleteConfirmInitiative)}
                                disabled={deleteConfirmText !== 'DELETE MY INITIATIVE'}
                                className="flex-1 py-3 px-4 bg-red-500 text-white rounded-xl font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upgrade Modal - Initiative Limit Reached */}
            {showUpgradeModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden">
                        {/* Header */}
                        <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-center border-b border-amber-100">
                            <button
                                onClick={() => setShowUpgradeModal(false)}
                                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Zap className="w-7 h-7 text-amber-600" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 mb-1">Initiative Limit Reached</h2>
                            <p className="text-gray-600 text-sm">
                                {upgradeUsage?.current || initiatives.length}/{upgradeUsage?.limit || 2} initiatives used
                            </p>
                        </div>

                        {/* Body */}
                        <div className="p-5">
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 mb-5 border border-amber-100">
                                <h3 className="font-semibold text-gray-900 mb-2 text-sm">
                                    ⚡ Initiative Limit Reached
                                </h3>
                                <div className="space-y-1.5 text-xs text-gray-700">
                                    <p>• You've used all {upgradeUsage?.limit || 2} initiatives</p>
                                    <p>• <strong>+$1/day</strong> per additional (coming soon)</p>
                                    <p>• Delete an initiative to create a new one</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => {
                                        setShowUpgradeModal(false)
                                        onNavigateToAccount?.()
                                    }}
                                    className="w-full bg-emerald-500 text-white py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 text-sm"
                                >
                                    Manage Subscription
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setShowUpgradeModal(false)}
                                    className="w-full py-2.5 px-4 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
                                >
                                    Maybe Later
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

