import React, { useState } from 'react'
import { X } from 'lucide-react'
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden shadow-2xl transform transition-all duration-200 ease-out animate-slide-up-fast">
                <div className="overflow-y-auto max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Initiative Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all duration-150 hover:border-gray-400"
                            placeholder="e.g., Youth Training Program 2025"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm transition-all duration-150 hover:border-gray-400"
                            rows={3}
                            placeholder="Brief description of what this initiative aims to achieve..."
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                        <input
                            type="text"
                            name="region"
                            value={formData.region}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all duration-150 hover:border-gray-400"
                            placeholder="e.g., East Africa, Southeast Asia"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <input
                            type="text"
                            name="location"
                            value={formData.location}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all duration-150 hover:border-gray-400"
                            placeholder="e.g., Nairobi, Kenya"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 order-2 sm:order-1 transition-all duration-150 hover:shadow-md"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full sm:flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 border border-transparent rounded-lg hover:from-primary-700 hover:to-primary-800 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 transition-all duration-150 hover:shadow-lg transform hover:scale-[1.02]"
                        >
                            {loading ? (editData ? 'Updating...' : 'Creating...') : (editData ? 'Update Initiative' : 'Create Initiative')}
                        </button>
                    </div>
                </form>
                </div>
            </div>
        </div>
    )
} 