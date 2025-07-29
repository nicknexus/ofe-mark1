import React, { useState } from 'react'
import { X } from 'lucide-react'
import { CreateInitiativeForm } from '../types'

interface CreateInitiativeModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: CreateInitiativeForm) => Promise<void>
}

export default function CreateInitiativeModal({
    isOpen,
    onClose,
    onSubmit
}: CreateInitiativeModalProps) {
    const [formData, setFormData] = useState<CreateInitiativeForm>({
        title: '',
        description: '',
        region: '',
        location: ''
    })
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await onSubmit(formData)
            setFormData({ title: '', description: '', region: '', location: '' })
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Create New Initiative</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="label">
                            Initiative Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            className="input-field"
                            placeholder="e.g., Youth Training Program 2025"
                            required
                        />
                    </div>

                    <div>
                        <label className="label">
                            Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            className="input-field resize-none"
                            rows={3}
                            placeholder="Brief description of what this initiative aims to achieve..."
                            required
                        />
                    </div>

                    <div>
                        <label className="label">Region</label>
                        <input
                            type="text"
                            name="region"
                            value={formData.region}
                            onChange={handleInputChange}
                            className="input-field"
                            placeholder="e.g., East Africa, Southeast Asia"
                        />
                    </div>

                    <div>
                        <label className="label">Location</label>
                        <input
                            type="text"
                            name="location"
                            value={formData.location}
                            onChange={handleInputChange}
                            className="input-field"
                            placeholder="e.g., Nairobi, Kenya"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary flex-1"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary flex-1"
                            disabled={loading || !formData.title || !formData.description}
                        >
                            {loading ? 'Creating...' : 'Create Initiative'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
} 