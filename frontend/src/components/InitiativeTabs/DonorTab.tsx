import React, { useState, useEffect } from 'react'
import { Search, Plus, Mail, Building2, Edit, Trash2, X, User, Heart } from 'lucide-react'
import { apiService } from '../../services/api'
import { Donor, InitiativeDashboard } from '../../types'
import AddDonorModal from '../AddDonorModal'
import DonorCreditingModal from '../DonorCreditingModal'
import toast from 'react-hot-toast'

interface DonorTabProps {
    initiativeId: string
    dashboard: InitiativeDashboard | null
    onRefresh?: () => void
}

export default function DonorTab({ initiativeId, dashboard, onRefresh }: DonorTabProps) {
    const [donors, setDonors] = useState<Donor[]>([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [editingDonor, setEditingDonor] = useState<Donor | null>(null)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [creditingDonor, setCreditingDonor] = useState<Donor | null>(null)
    const [isCreditingModalOpen, setIsCreditingModalOpen] = useState(false)

    useEffect(() => {
        loadDonors()
    }, [initiativeId])

    const loadDonors = async () => {
        if (!initiativeId) return
        try {
            setLoading(true)
            const data = await apiService.getDonors(initiativeId)
            setDonors(data || [])
        } catch (error) {
            console.error('Error loading donors:', error)
            toast.error('Failed to load donors')
            setDonors([])
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteDonor = async (donorId: string) => {
        if (!confirm('Are you sure you want to delete this donor? All credits associated with this donor will also be deleted.')) return
        try {
            await apiService.deleteDonor(donorId)
            toast.success('Donor deleted successfully')
            loadDonors()
            onRefresh?.()
        } catch (error) {
            toast.error('Failed to delete donor')
        }
    }

    const handleSaveDonor = async () => {
        apiService.clearCache('/donors')
        await loadDonors()
        onRefresh?.()
    }

    // Filter donors by search query
    const filteredDonors = donors.filter(donor =>
        donor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        donor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (donor.organization && donor.organization.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    return (
        <div className="h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 overflow-hidden flex flex-col">
            {/* Header with Search and Add Button */}
            <div className="p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Donors</h2>
                        <p className="text-sm text-gray-500">Manage donors and track their contributions to your metrics</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingDonor(null)
                            setIsAddModalOpen(true)
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Add Donor</span>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search donors by name, email, or organization..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Donors List */}
            <div className="flex-1 overflow-y-auto bg-white">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                ) : filteredDonors.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <User className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">
                            {searchQuery ? 'No donors found' : 'No donors yet'}
                        </p>
                        <p className="text-sm mb-4">
                            {searchQuery
                                ? 'Try adjusting your search query'
                                : 'Add your first donor to start tracking contributions'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => {
                                    setEditingDonor(null)
                                    setIsAddModalOpen(true)
                                }}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Add Donor
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {/* Header Row */}
                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            <div className="col-span-1"></div>
                            <div className="col-span-3">Name</div>
                            <div className="col-span-3">Email</div>
                            <div className="col-span-2">Organization</div>
                            <div className="col-span-2">Created</div>
                            <div className="col-span-1"></div>
                        </div>

                        {/* Donor Items */}
                        {filteredDonors.map((donor) => (
                            <div
                                key={donor.id}
                                onClick={() => {
                                    setCreditingDonor(donor)
                                    setIsCreditingModalOpen(true)
                                }}
                                className="px-6 py-4 hover:bg-gray-50 transition-colors group grid grid-cols-12 gap-4 items-center cursor-pointer"
                            >
                                {/* Icon */}
                                <div className="col-span-1 flex items-center justify-center">
                                    <div className="p-2 rounded-lg bg-purple-100">
                                        <User className="w-5 h-5 text-purple-600" />
                                    </div>
                                </div>

                                {/* Name */}
                                <div className="col-span-3 min-w-0">
                                    <div className="font-medium text-gray-900 truncate">
                                        {donor.name}
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="col-span-3 min-w-0">
                                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                                        <Mail className="w-4 h-4 flex-shrink-0" />
                                        <span className="truncate">{donor.email}</span>
                                    </div>
                                </div>

                                {/* Organization */}
                                <div className="col-span-2 text-sm text-gray-600">
                                    {donor.organization ? (
                                        <div className="flex items-center space-x-2">
                                            <Building2 className="w-4 h-4 flex-shrink-0" />
                                            <span className="truncate">{donor.organization}</span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-400">—</span>
                                    )}
                                </div>

                                {/* Created Date */}
                                <div className="col-span-2 text-sm text-gray-600">
                                    {donor.created_at ? new Date(donor.created_at).toLocaleDateString() : '—'}
                                </div>

                                {/* Actions */}
                                <div className="col-span-1 flex items-center justify-end space-x-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingDonor(donor)
                                            setIsAddModalOpen(true)
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Edit"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteDonor(donor.id!)
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add/Edit Donor Modal */}
            {isAddModalOpen && (
                <AddDonorModal
                    isOpen={isAddModalOpen}
                    onClose={() => {
                        setIsAddModalOpen(false)
                        setEditingDonor(null)
                    }}
                    onSubmit={handleSaveDonor}
                    initiativeId={initiativeId}
                    editData={editingDonor}
                />
            )}

            {/* Credit Impacts Modal */}
            {isCreditingModalOpen && creditingDonor && (
                <DonorCreditingModal
                    isOpen={isCreditingModalOpen}
                    onClose={() => {
                        setIsCreditingModalOpen(false)
                        setCreditingDonor(null)
                    }}
                    onSave={handleSaveDonor}
                    donor={creditingDonor}
                    initiativeId={initiativeId}
                    dashboard={dashboard}
                />
            )}
        </div>
    )
}

