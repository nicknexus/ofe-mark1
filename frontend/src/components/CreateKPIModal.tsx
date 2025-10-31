import React, { useState } from 'react'
import { X } from 'lucide-react'
import { CreateKPIForm } from '../types'

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
        initiative_id: initiativeId
    })
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            await onSubmit(formData)
            // Reset form only if creating (not editing)
            if (!editData) {
                setFormData({
                    title: '',
                    description: '',
                    metric_type: 'number',
                    unit_of_measurement: '',
                    category: 'output',
                    initiative_id: initiativeId
                })
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                        {editData ? 'Edit KPI' : 'Create New KPI'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            KPI Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                            placeholder="e.g., Students Trained, Wells Built"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm"
                            rows={3}
                            placeholder="Describe what this KPI measures..."
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Metric Type <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="metric_type"
                                value={formData.metric_type}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                required
                            >
                                <option value="number">Number</option>
                                <option value="percentage">Percentage</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Unit <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="unit_of_measurement"
                                value={formData.unit_of_measurement}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                placeholder="People, Hours, USD, etc."
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Category <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {[
                                { value: 'input', label: 'Input', desc: 'Resources going in' },
                                { value: 'output', label: 'Output', desc: 'Direct results' },
                                { value: 'impact', label: 'Impact', desc: 'Long-term effects' }
                            ].map((category) => (
                                <label
                                    key={category.value}
                                    className={`relative flex flex-col p-3 border rounded-lg cursor-pointer transition-colors ${formData.category === category.value
                                        ? 'border-primary-500 bg-primary-50'
                                        : 'border-gray-300 hover:border-gray-400'
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
                                    <span className="text-sm font-medium text-gray-900">
                                        {category.label}
                                    </span>
                                    <span className="text-xs text-gray-500 mt-1">
                                        {category.desc}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 order-2 sm:order-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full sm:flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2"
                        >
                            {loading ? (editData ? 'Updating...' : 'Creating...') : (editData ? 'Update KPI' : 'Create KPI')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
} 