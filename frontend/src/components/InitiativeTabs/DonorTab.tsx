import React, { useState, useEffect } from 'react'
import { Search, Plus, Mail, Building2, Edit, Trash2, User } from 'lucide-react'
import { apiService } from '../../services/api'
import { Donor, InitiativeDashboard } from '../../types'
import AddDonorModal from '../AddDonorModal'
import DonorCreditingModal from '../DonorCreditingModal'
import ConfirmDialog from '../ConfirmDialog'
import { notify } from '../../lib/notify'
import { SectionLoader, EmptyState } from '../ui'

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
 const [deleteDonor, setDeleteDonor] = useState<Donor | null>(null)

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
 notify.error('Failed to load donors')
 setDonors([])
 } finally {
 setLoading(false)
 }
 }

 const handleDeleteDonor = async (donorId: string) => {
 try {
 await apiService.deleteDonor(donorId)
 notify.success('Donor deleted successfully')
 setDeleteDonor(null)
 loadDonors()
 onRefresh?.()
 } catch (error) {
 notify.error('Failed to delete donor')
 }
 }

 const handleSaveDonor = async () => {
 apiService.clearCache('/donors')
 await loadDonors()
 onRefresh?.()
 }

 const openAddModal = () => {
 setEditingDonor(null)
 setIsAddModalOpen(true)
 }

 // Filter donors by search query
 const filteredDonors = donors.filter(donor =>
 donor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 donor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
 (donor.organization && donor.organization.toLowerCase().includes(searchQuery.toLowerCase()))
 )

 return (
 <div className="h-screen overflow-hidden">
 <div className="h-full w-full px-4 sm:px-6 py-6 overflow-y-auto mobile-content-padding">
 <div className="app-card overflow-hidden flex flex-col min-h-0">
 {/* Header with Search and Add Button */}
 <div className="p-6 border-b border-gray-100">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h2 className="text-xl font-semibold text-gray-800">Donors</h2>
 <p className="text-sm text-gray-500">Manage donors and track their contributions to your metrics</p>
 </div>
 <button
 type="button"
 onClick={openAddModal}
 className="app-btn app-btn-primary"
 >
 <Plus className="w-5 h-5" />
 <span>Add Donor</span>
 </button>
 </div>

 {/* Search Bar */}
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
 <input
 type="text"
 placeholder="Search donors by name, email, or organization..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="app-input pl-10"
 />
 </div>
 </div>

 {/* Donors List */}
 <div className="flex-1 overflow-y-auto">
 {loading ? (
 <SectionLoader className="h-64" />
 ) : filteredDonors.length === 0 ? (
 <EmptyState
 icon={User}
 title={searchQuery ? 'No donors found' : 'No donors yet'}
 description={
 searchQuery
 ? 'Try adjusting your search query'
 : 'Add your first donor to start tracking contributions'
 }
 action={
 !searchQuery ? (
 <button type="button" onClick={openAddModal} className="app-btn app-btn-primary">
 Add Donor
 </button>
 ) : undefined
 }
 className="min-h-[16rem]"
 />
 ) : (
 <div className="divide-y divide-gray-100">
 {/* Header Row */}
 <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100 grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
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
 className="px-6 py-4 hover:bg-gray-50/50 transition-colors group grid grid-cols-12 gap-4 items-center cursor-pointer"
 >
 {/* Icon — purple kept as donor categorical accent */}
 <div className="col-span-1 flex items-center justify-center">
 <div className="p-2 rounded-lg bg-purple-100">
 <User className="w-5 h-5 text-purple-600" />
 </div>
 </div>

 {/* Name */}
 <div className="col-span-3 min-w-0">
 <div className="font-medium text-gray-800 truncate">
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
 type="button"
 onClick={(e) => {
 e.stopPropagation()
 setEditingDonor(donor)
 setIsAddModalOpen(true)
 }}
 className="app-btn app-btn-icon app-btn-ghost p-1.5 opacity-0 group-hover:opacity-100 hover:text-purple-600 hover:bg-purple-50"
 title="Edit"
 >
 <Edit className="w-4 h-4" />
 </button>
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation()
 setDeleteDonor(donor)
 }}
 className="app-btn app-btn-icon app-btn-ghost p-1.5 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50"
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
 </div>
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

 {deleteDonor && (
 <ConfirmDialog
 title="Delete Donor"
 message={`Delete ${deleteDonor.name}? All credits associated with this donor will also be deleted.`}
 confirmLabel="Delete Donor"
 tone="danger"
 onConfirm={() => handleDeleteDonor(deleteDonor.id!)}
 onCancel={() => setDeleteDonor(null)}
 />
 )}
 </div>
 )
}
