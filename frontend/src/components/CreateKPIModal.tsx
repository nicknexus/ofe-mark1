import React, { useState } from 'react'
import { X } from 'lucide-react'
import { CreateKPIForm } from '../types'

interface CreateKPIModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: CreateKPIForm) => Promise<void>
    initiativeId: string
}

export default function CreateKPIModal({
    isOpen,
    onClose,
    onSubmit,
    initiativeId
}: CreateKPIModalProps) {
    const [formData, setFormData] = useState<CreateKPIForm>({
        title: '',
        description: '',
        metric_type: 'number',
        unit_of_measurement: '',
        category: 'output',
        initiative_id: initiativeId
    })
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await onSubmit({
                ...formData,
                initiative_id: initiativeId
            })
            setFormData({
                title: '',
                description: '',
                metric_type: 'number',
                unit_of_measurement: '',
                category: 'output',
                initiative_id: initiativeId
            })
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Create New KPI</h2>
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
                            KPI Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            className="input-field"
                            placeholder="e.g., Number of students trained"
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
                            placeholder="What does this KPI measure and why is it important?"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">
                                Metric Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="metric_type"
                                value={formData.metric_type}
                                onChange={handleInputChange}
                                className="input-field"
                                required
                            >
                                <option value="number">Number</option>
                                <option value="percentage">Percentage</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">
                                Unit <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="unit_of_measurement"
                                value={formData.unit_of_measurement}
                                onChange={handleInputChange}
                                className="input-field"
                                placeholder="students, hours, USD"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label">
                            Category <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="category"
                            value={formData.category}
                            onChange={handleInputChange}
                            className="input-field"
                            required
                        >
                            <option value="input">Input (Resources used)</option>
                            <option value="output">Output (Direct results)</option>
                            <option value="impact">Impact (Long-term outcomes)</option>
                        </select>
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
                            disabled={loading || !formData.title || !formData.description || !formData.unit_of_measurement}
                        >
                            {loading ? 'Creating...' : 'Create KPI'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
} 