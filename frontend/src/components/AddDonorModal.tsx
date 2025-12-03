import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Donor } from '../types'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'

interface AddDonorModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: () => Promise<void>
    initiativeId: string
    editData?: Donor | null
}

export default function AddDonorModal({
    isOpen,
    onClose,
    onSubmit,
    initiativeId,
    editData
}: AddDonorModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        organization: '',
        notes: ''
    })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (editData) {
            setFormData({
                name: editData.name || '',
                email: editData.email || '',
                organization: editData.organization || '',
                notes: editData.notes || ''
            })
        } else {
            setFormData({
                name: '',
                email: '',
                organization: '',
                notes: ''
            })
        }
    }, [editData, isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim()) {
            toast.error('Please enter a donor name')
            return
        }
        if (!formData.email.trim()) {
            toast.error('Please enter an email address')
            return
        }
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(formData.email)) {
            toast.error('Please enter a valid email address')
            return
        }

        setLoading(true)
        try {
            const submitData = {
                ...formData,
                initiative_id: initiativeId,
                name: formData.name.trim(),
                email: formData.email.trim().toLowerCase(),
                organization: formData.organization.trim() || undefined,
                notes: formData.notes.trim() || undefined
            }

            if (editData?.id) {
                await apiService.updateDonor(editData.id, submitData)
                toast.success('Donor updated successfully!')
            } else {
                await apiService.createDonor(submitData)
                toast.success('Donor created successfully!')
            }
            await onSubmit()
            onClose()
        } catch (error: any) {
            const message = error instanceof Error ? error.message : 'Failed to save donor'
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {editData ? 'Edit Donor' : 'Add Donor'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Enter donor name"
                            required
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="donor@example.com"
                            required
                        />
                    </div>

                    {/* Organization */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Organization (Optional)
                        </label>
                        <input
                            type="text"
                            value={formData.organization}
                            onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            placeholder="Enter organization name"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes (Optional)
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            rows={4}
                            placeholder="Add any additional notes about this donor..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : editData ? 'Update Donor' : 'Create Donor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}


