import React, { useState } from 'react'
import { X } from 'lucide-react'
import ModalFrame from './ModalFrame'
import { CreateInitiativeForm } from '../types'

interface CreateInitiativeModalProps {
 isOpen: boolean
 onClose: () => void
 onSubmit: (data: CreateInitiativeForm) => Promise<void>
 editData?: any // Optional prop for editing existing initiative
}

export default function CreateInitiativeModal({
 isOpen,
 onClose,
 onSubmit,
 editData
}: CreateInitiativeModalProps) {
 const [formData, setFormData] = useState<CreateInitiativeForm>({
 title: editData?.title || '',
 description: editData?.description || '',
 region: editData?.region || '',
 location: editData?.location || ''
 })
 const [loading, setLoading] = useState(false)

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault()
 setLoading(true)

 try {
 await onSubmit(formData)
 // Reset form only if creating (not editing)
 if (!editData) {
 setFormData({ title: '', description: '', region: '', location: '' })
 }
 onClose()
 } catch (error) {
 // Don't close modal on error, let parent handle error display
 } finally {
 setLoading(false)
 }
 }

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
 setFormData(prev => ({
 ...prev,
 [e.target.name]: e.target.value
 }))
 }

 if (!isOpen) return null

 return (
 <ModalFrame
 zIndexClass="z-[60]"
 panelClassName="bg-white rounded-xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-hidden shadow-app-modal transform transition-all duration-200 ease-out"
 >
 <div className="overflow-y-auto max-h-[90vh]">
 {/* Header */}
 <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-evidence-50 to-evidence-50">
 <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
 {editData ? 'Edit Initiative' : 'Create New Initiative'}
 </h2>
 <button
 onClick={onClose}
 className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-150"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
 <div>
 <label className="app-label">
 Initiative Title <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 name="title"
 value={formData.title}
 onChange={handleInputChange}
 className="app-input"
 placeholder="e.g., Youth Training Program 2025"
 required
 />
 </div>

 <div>
 <label className="app-label">
 Description <span className="text-red-500">*</span>
 </label>
 <textarea
 name="description"
 value={formData.description}
 onChange={handleInputChange}
 className="app-input resize-none"
 rows={3}
 placeholder="Brief description of what this initiative aims to achieve..."
 required
 />
 </div>

 <div>
 <label className="app-label">Region</label>
 <input
 type="text"
 name="region"
 value={formData.region}
 onChange={handleInputChange}
 className="app-input"
 placeholder="e.g., East Africa, Southeast Asia"
 />
 </div>

 <div>
 <label className="app-label">Location</label>
 <input
 type="text"
 name="location"
 value={formData.location}
 onChange={handleInputChange}
 className="app-input"
 placeholder="e.g., Nairobi, Kenya"
 />
 </div>

 <div className="flex flex-col sm:flex-row gap-3 pt-4">
 <button
 type="button"
 onClick={onClose}
 className="app-btn app-btn-secondary w-full sm:w-auto order-2 sm:order-1"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={loading}
 className="app-btn app-btn-primary w-full sm:flex-1 order-1 sm:order-2"
 >
 {loading ? (editData ? 'Updating...' : 'Creating...') : (editData ? 'Update Initiative' : 'Create Initiative')}
 </button>
 </div>
 </form>
 </div>
 </ModalFrame>
 )
} 