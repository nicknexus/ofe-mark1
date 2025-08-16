import React, { useState } from 'react'
import { X, Calendar, Hash, MapPin, FileText } from 'lucide-react'
import { CreateKPIUpdateForm } from '../types'

interface AddKPIUpdateModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: CreateKPIUpdateForm) => Promise<void>
    kpiTitle: string
    kpiId: string
    metricType: 'number' | 'percentage'
    unitOfMeasurement: string
}

export default function AddKPIUpdateModal({
    isOpen,
    onClose,
    onSubmit,
    kpiTitle,
    kpiId,
    metricType,
    unitOfMeasurement
}: AddKPIUpdateModalProps) {
    const [formData, setFormData] = useState<CreateKPIUpdateForm>({
        value: 0,
        date_represented: new Date().toISOString().split('T')[0],
        date_range_start: undefined,
        date_range_end: undefined,
        note: '',
        label: ''
    })
    const [isDateRange, setIsDateRange] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Prepare form data based on date mode
            const submitData = { ...formData }
            if (isDateRange) {
                // For date ranges, keep both range fields and set date_represented to start date
                submitData.date_represented = formData.date_range_start || formData.date_represented
                // Ensure both range fields are included
                if (!submitData.date_range_start || !submitData.date_range_end) {
                    throw new Error('Both start and end dates are required for date ranges')
                }
            } else {
                // For single dates, clear range fields
                submitData.date_range_start = undefined
                submitData.date_range_end = undefined
            }

            await onSubmit(submitData)
            setFormData({
                value: 0,
                date_represented: new Date().toISOString().split('T')[0],
                date_range_start: undefined,
                date_range_end: undefined,
                note: '',
                label: ''
            })
            setIsDateRange(false)
            onClose()
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: name === 'value' ? parseFloat(value) || 0 : value
        }))
    }

    const handleValueFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        // Clear the field if it contains 0
        if (formData.value === 0) {
            setFormData(prev => ({ ...prev, value: '' as any }))
        }
    }

    const handleValueBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        // If field is empty on blur, set it back to 0
        if (e.target.value === '' || isNaN(parseFloat(e.target.value))) {
            setFormData(prev => ({ ...prev, value: 0 }))
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Add Data Update</h2>
                        <p className="text-sm text-gray-600 mt-1">{kpiTitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Value Input */}
                    <div>
                        <label className="label">
                            <Hash className="w-4 h-4 inline mr-2" />
                            Value <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                name="value"
                                value={formData.value}
                                onChange={handleInputChange}
                                onFocus={handleValueFocus}
                                onBlur={handleValueBlur}
                                className="input-field pr-16"
                                placeholder="Enter the value"
                                required
                                min="0"
                                step={metricType === 'percentage' ? '0.01' : '1'}
                                max={metricType === 'percentage' ? '100' : undefined}
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <span className="text-gray-500 text-sm">
                                    {metricType === 'percentage' ? '%' : unitOfMeasurement}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Date Selection */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="label">
                                <Calendar className="w-4 h-4 inline mr-2" />
                                Date
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsDateRange(!isDateRange)
                                    // Clear date fields when switching modes
                                    if (!isDateRange) {
                                        setFormData(prev => ({
                                            ...prev,
                                            date_range_start: '',
                                            date_range_end: ''
                                        }))
                                    } else {
                                        setFormData(prev => ({
                                            ...prev,
                                            date_represented: new Date().toISOString().split('T')[0]
                                        }))
                                    }
                                }}
                                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                            >
                                {isDateRange ? 'Single Date' : 'Date Range'}
                            </button>
                        </div>

                        {!isDateRange ? (
                            <input
                                type="date"
                                name="date_represented"
                                value={formData.date_represented}
                                onChange={handleInputChange}
                                className="input-field"
                                required
                            />
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">From</label>
                                    <input
                                        type="date"
                                        name="date_range_start"
                                        value={formData.date_range_start || ''}
                                        onChange={handleInputChange}
                                        className="input-field"
                                        required={isDateRange}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">To</label>
                                    <input
                                        type="date"
                                        name="date_range_end"
                                        value={formData.date_range_end || ''}
                                        onChange={handleInputChange}
                                        className="input-field"
                                        required={isDateRange}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Label */}
                    <div>
                        <label className="label">
                            <FileText className="w-4 h-4 inline mr-2" />
                            Label or Title
                        </label>
                        <input
                            type="text"
                            name="label"
                            value={formData.label}
                            onChange={handleInputChange}
                            className="input-field"
                            placeholder="e.g., Week 2 Update, Follow-up Training Day"
                        />
                    </div>

                    {/* Note */}
                    <div>
                        <label className="label">Notes</label>
                        <textarea
                            name="note"
                            value={formData.note}
                            onChange={handleInputChange}
                            className="input-field resize-none"
                            rows={3}
                            placeholder="Any additional context or explanation for this update..."
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
                            disabled={loading || formData.value === 0}
                        >
                            {loading ? 'Adding...' : 'Add Update'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
} 