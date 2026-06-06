import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import ModalFrame from './ModalFrame'
import { CreateKPIForm } from '../types'
import TagPicker from './MetricTags/TagPicker'

interface CreateKPIModalProps {
 isOpen: boolean
 onClose: () => void
 onSubmit: (data: CreateKPIForm) => Promise<void>
 initiativeId: string
 editData?: any // Optional prop for editing existing KPI
}

export default function CreateKPIModal({
 isOpen,
 onClose,
 onSubmit,
 initiativeId,
 editData
}: CreateKPIModalProps) {
 const [formData, setFormData] = useState<CreateKPIForm>({
 title: editData?.title || '',
 description: editData?.description || '',
 metric_type: editData?.metric_type || 'number',
 unit_of_measurement: editData?.unit_of_measurement || '',
 category: editData?.category || 'output',
 initiative_id: initiativeId,
 tag_ids: Array.isArray(editData?.tag_ids) ? editData.tag_ids : []
 })
 const [tagIds, setTagIds] = useState<string[]>(Array.isArray(editData?.tag_ids) ? editData.tag_ids : [])
 const [loading, setLoading] = useState(false)

 useEffect(() => {
 if (editData) {
 setTagIds(Array.isArray(editData?.tag_ids) ? editData.tag_ids : [])
 }
 }, [editData])

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault()
 setLoading(true)

 try {
 await onSubmit({ ...formData, tag_ids: tagIds })
 if (!editData) {
 setFormData({
 title: '',
 description: '',
 metric_type: 'number',
 unit_of_measurement: '',
 category: 'output',
 initiative_id: initiativeId,
 tag_ids: []
 })
 setTagIds([])
 }
 onClose()
 } finally {
 setLoading(false)
 }
 }

 const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
 setFormData(prev => ({
 ...prev,
 [e.target.name]: e.target.value
 }))
 }

 if (!isOpen) return null

 return (
 <ModalFrame
 zIndexClass="z-[60]"
 size="md"
 >
 <div className="overflow-y-auto max-h-[90vh]">
 {/* Header */}
 <div className="flex items-center justify-between p-5 sm:p-6 border-b border-primary-200/40 bg-gradient-to-r from-primary-50 to-primary-50/80">
 <div className="flex items-center space-x-3">
 <div className="w-10 h-10 rounded-xl bg-primary-500/15 flex items-center justify-center border border-primary-300/30">
 <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
 </svg>
 </div>
 <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
 {editData ? 'Edit Metric' : 'Create New Metric'}
 </h2>
 </div>
 <button
 onClick={onClose}
 className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-all duration-200"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
 <div>
 <label className="block text-sm font-medium text-gray-600 mb-2">
 Metric Title <span className="text-red-400">*</span>
 </label>
 <input
 type="text"
 name="title"
 value={formData.title}
 onChange={handleInputChange}
 className="app-input"
 placeholder="e.g., Students Trained, Wells Built"
 required
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-600 mb-2">
 Description <span className="text-red-400">*</span>
 </label>
 <textarea
 name="description"
 value={formData.description}
 onChange={handleInputChange}
 className="app-input resize-none"
 rows={3}
 placeholder="Describe what this metric measures..."
 required
 />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-600 mb-2">
 Metric Type <span className="text-red-400">*</span>
 </label>
 <select
 name="metric_type"
 value={formData.metric_type}
 onChange={handleInputChange}
 className="app-input"
 required
 >
 <option value="number">Number</option>
 <option value="percentage">Percentage</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-600 mb-2">
 Unit <span className="text-red-400">*</span>
 </label>
 <input
 type="text"
 name="unit_of_measurement"
 value={formData.unit_of_measurement}
 onChange={handleInputChange}
 className="app-input"
 placeholder="People, Hours, USD, etc."
 required
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-600 mb-3">
 Category <span className="text-red-400">*</span>
 </label>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 {[
 { value: 'input', label: 'Input', desc: 'Resources going in' },
 { value: 'output', label: 'Output', desc: 'Direct results' },
 { value: 'impact', label: 'Impact', desc: 'Long-term effects' }
 ].map((category) => (
 <label
 key={category.value}
 className={`relative flex flex-col p-4 border rounded-xl cursor-pointer transition-all duration-200 ${formData.category === category.value
 ? 'border-primary-400 bg-primary-100/60 shadow-card'
 : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
 }`}
 >
 <input
 type="radio"
 name="category"
 value={category.value}
 checked={formData.category === category.value}
 onChange={handleInputChange}
 className="sr-only"
 />
 <span className="text-sm font-semibold text-gray-800">
 {category.label}
 </span>
 <span className="text-xs text-gray-500 mt-1">
 {category.desc}
 </span>
 </label>
 ))}
 </div>
 </div>

 <div className="border-t border-gray-200/60 pt-5">
 <TagPicker
 mode="multi"
 selectedIds={tagIds}
 onChange={setTagIds}
 label="Metric Tags (optional)"
 helperText="Tags act as sub-metrics. Attach the ones impact claims on this metric will be grouped under (e.g. Grade 1, Grade 2)."
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
 {loading ? (editData ? 'Updating...' : 'Creating...') : (editData ? 'Update Metric' : 'Create Metric')}
 </button>
 </div>
 </form>
 </div>
 </ModalFrame>
 )
} 