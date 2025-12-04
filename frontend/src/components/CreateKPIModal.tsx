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
        <div className="fixed inset-0 bg-black/10 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div className="bg-white/70 backdrop-blur-2xl rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] border border-white/60 transform transition-all duration-200 ease-out animate-slide-up-fast">
                <div className="overflow-y-auto max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-5 sm:p-6 border-b border-primary-200/40 bg-gradient-to-r from-primary-100/50 to-primary-50/30 backdrop-blur-xl">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-500/15 backdrop-blur-sm flex items-center justify-center border border-primary-300/30">
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
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-white/60 transition-all duration-200"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 bg-white/20 backdrop-blur-sm">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">
                            Metric Title <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm transition-all duration-200 hover:bg-white/70 placeholder-gray-400"
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
                            className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none text-sm transition-all duration-200 hover:bg-white/70 placeholder-gray-400"
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
                                className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm transition-all duration-200 hover:bg-white/70"
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
                                className="w-full px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-xl focus:ring-2 focus:ring-primary-400 focus:border-transparent text-sm transition-all duration-200 hover:bg-white/70 placeholder-gray-400"
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
                                    className={`relative flex flex-col p-4 border rounded-xl cursor-pointer transition-all duration-200 backdrop-blur-sm ${formData.category === category.value
                                        ? 'border-primary-400 bg-primary-100/60 shadow-lg shadow-primary-500/10'
                                        : 'border-gray-200/60 bg-white/40 hover:bg-white/60 hover:border-gray-300/80'
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

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full sm:w-auto px-5 py-3 text-sm font-medium text-gray-600 bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-xl hover:bg-white/70 focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 order-2 sm:order-1 transition-all duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full sm:flex-1 px-5 py-3 text-sm font-semibold text-white bg-primary-500 border border-transparent rounded-xl hover:bg-primary-600 focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed order-1 sm:order-2 transition-all duration-200 shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40"
                        >
                            {loading ? (editData ? 'Updating...' : 'Creating...') : (editData ? 'Update Metric' : 'Create Metric')}
                        </button>
                    </div>
                </form>
                </div>
            </div>
        </div>
    )
} 