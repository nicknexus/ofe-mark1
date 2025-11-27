import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react'
import { Donor, DonorCredit, KPI, KPIUpdate } from '../types'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'

interface MetricCreditingModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: () => Promise<void>
    kpi: KPI
    kpiUpdates: KPIUpdate[]
    initiativeId: string
}

export default function MetricCreditingModal({
    isOpen,
    onClose,
    onSave,
    kpi,
    kpiUpdates,
    initiativeId
}: MetricCreditingModalProps) {
    const [donors, setDonors] = useState<Donor[]>([])
    const [credits, setCredits] = useState<DonorCredit[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null) // null = metric level
    const [newCredits, setNewCredits] = useState<Partial<DonorCredit>[]>([])
    const [editingCredits, setEditingCredits] = useState<Record<string, Partial<DonorCredit>>>({})

    useEffect(() => {
        if (isOpen) {
            loadDonors()
            loadCredits()
        } else {
            // Reset state when modal closes
            setNewCredits([])
            setEditingCredits({})
            setSelectedClaimId(null)
        }
    }, [isOpen, kpi.id])

    const loadDonors = async () => {
        try {
            const data = await apiService.getDonors(initiativeId)
            setDonors(data || [])
        } catch (error) {
            console.error('Error loading donors:', error)
            toast.error('Failed to load donors')
        }
    }

    const loadCredits = async () => {
        if (!kpi.id) return
        try {
            const data = await apiService.getCreditsForMetric(kpi.id)
            setCredits(data || [])
        } catch (error) {
            console.error('Error loading credits:', error)
            toast.error('Failed to load credits')
        }
    }

    const getAvailableValue = async (claimId?: string | null): Promise<number> => {
        if (!kpi.id) return 0
        
        try {
            const totalCredited = await apiService.getTotalCreditedForMetric(kpi.id, claimId || undefined)
            
            if (claimId) {
                const claim = kpiUpdates.find(u => u.id === claimId)
                return Number(claim?.value || 0) - totalCredited
            } else {
                // For metric-level, sum all claims
                const totalValue = kpiUpdates.reduce((sum, update) => sum + Number(update.value || 0), 0)
                return totalValue - totalCredited
            }
        } catch (error) {
            console.error('Error calculating available value:', error)
            return 0
        }
    }

    const handleAddCredit = () => {
        setNewCredits(prev => [...prev, {
            donor_id: '',
            kpi_id: kpi.id,
            kpi_update_id: selectedClaimId || undefined,
            credited_value: 0,
            credited_percentage: undefined,
            notes: ''
        }])
    }

    const handleUpdateNewCredit = (index: number, field: keyof DonorCredit, value: any) => {
        setNewCredits(prev => {
            const updated = [...prev]
            updated[index] = { ...updated[index], [field]: value }
            return updated
        })
    }

    const handleUpdateExistingCredit = (creditId: string, field: keyof DonorCredit, value: any) => {
        setEditingCredits(prev => ({
            ...prev,
            [creditId]: { ...prev[creditId], [field]: value }
        }))
    }

    const handleDeleteCredit = async (creditId: string) => {
        if (!confirm('Are you sure you want to delete this credit?')) return
        try {
            await apiService.deleteDonorCredit(creditId)
            toast.success('Credit deleted')
            await loadCredits()
            await onSave()
        } catch (error) {
            toast.error('Failed to delete credit')
        }
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            // Save new credits
            for (const credit of newCredits) {
                if (!credit.donor_id || !credit.credited_value || credit.credited_value <= 0) {
                    toast.error('Please fill in all required fields for new credits')
                    return
                }
                
                // Validate available value
                const available = await getAvailableValue(credit.kpi_update_id || null)
                if (credit.credited_value > available) {
                    toast.error(`Credited value exceeds available amount. Available: ${available}`)
                    return
                }

                await apiService.createDonorCredit(credit)
            }

            // Update existing credits
            for (const [creditId, updates] of Object.entries(editingCredits)) {
                if (Object.keys(updates).length > 0) {
                    await apiService.updateDonorCredit(creditId, updates)
                }
            }

            toast.success('Credits saved successfully!')
            await onSave()
            onClose()
        } catch (error: any) {
            const message = error instanceof Error ? error.message : 'Failed to save credits'
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    const filteredCredits = selectedClaimId
        ? credits.filter(c => c.kpi_update_id === selectedClaimId)
        : credits.filter(c => !c.kpi_update_id)

    const selectedClaim = selectedClaimId ? kpiUpdates.find(u => u.id === selectedClaimId) : null
    const [availableValue, setAvailableValue] = useState<number>(0)

    useEffect(() => {
        if (isOpen && kpi.id) {
            getAvailableValue(selectedClaimId).then(setAvailableValue)
        }
    }, [isOpen, selectedClaimId, kpi.id, credits])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Credit Metric to Donors</h2>
                        <p className="text-sm text-gray-500 mt-1">{kpi.title}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Scope Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Credit Scope
                        </label>
                        <div className="space-y-2">
                            <button
                                onClick={() => setSelectedClaimId(null)}
                                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                                    selectedClaimId === null
                                        ? 'border-purple-500 bg-purple-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="font-medium text-gray-900">Entire Metric</div>
                                <div className="text-sm text-gray-500">
                                    Credit across all impact claims ({kpiUpdates.length} claims)
                                </div>
                            </button>
                            {kpiUpdates.map(claim => (
                                <button
                                    key={claim.id}
                                    onClick={() => setSelectedClaimId(claim.id || null)}
                                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                                        selectedClaimId === claim.id
                                            ? 'border-purple-500 bg-purple-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="font-medium text-gray-900">
                                        {claim.date_range_start && claim.date_range_end
                                            ? `${claim.date_range_start} to ${claim.date_range_end}`
                                            : claim.date_represented || 'Single Date'}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        Value: {claim.value} {kpi.unit_of_measurement}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Available Value Display */}
                    {selectedClaimId ? (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-blue-900">Available to Credit</div>
                                    <div className="text-2xl font-bold text-blue-600">
                                        {availableValue.toFixed(2)} {kpi.unit_of_measurement}
                                    </div>
                                </div>
                                <div className="text-sm text-blue-700">
                                    {selectedClaim && (
                                        <>
                                            Total: {selectedClaim.value} {kpi.unit_of_measurement}
                                            <br />
                                            Credited: {(Number(selectedClaim.value || 0) - availableValue).toFixed(2)} {kpi.unit_of_measurement}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-sm font-medium text-blue-900">Available to Credit (Metric Level)</div>
                                    <div className="text-2xl font-bold text-blue-600">
                                        {availableValue.toFixed(2)} {kpi.unit_of_measurement}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Existing Credits */}
                    {filteredCredits.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Existing Credits</h3>
                            <div className="space-y-3">
                                {filteredCredits.map(credit => {
                                    const donor = donors.find(d => d.id === credit.donor_id)
                                    const editData = editingCredits[credit.id!] || {}
                                    return (
                                        <div key={credit.id} className="p-4 border border-gray-200 rounded-lg">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <div className="font-medium text-gray-900">{donor?.name || 'Unknown Donor'}</div>
                                                    <div className="text-sm text-gray-500">{donor?.email}</div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteCredit(credit.id!)}
                                                    className="p-1 text-red-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Credited Value
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={editData.credited_value !== undefined ? editData.credited_value : credit.credited_value}
                                                        onChange={(e) => handleUpdateExistingCredit(credit.id!, 'credited_value', parseFloat(e.target.value) || 0)}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Percentage (%)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={editData.credited_percentage !== undefined ? editData.credited_percentage : credit.credited_percentage || ''}
                                                        onChange={(e) => handleUpdateExistingCredit(credit.id!, 'credited_percentage', parseFloat(e.target.value) || undefined)}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* New Credits */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-700">New Credits</h3>
                            <button
                                onClick={handleAddCredit}
                                className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Credit</span>
                            </button>
                        </div>
                        {newCredits.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">No new credits added yet</p>
                        ) : (
                            <div className="space-y-3">
                                {newCredits.map((credit, index) => (
                                    <div key={index} className="p-4 border-2 border-purple-200 rounded-lg bg-purple-50">
                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Donor <span className="text-red-500">*</span>
                                                </label>
                                                <select
                                                    value={credit.donor_id || ''}
                                                    onChange={(e) => handleUpdateNewCredit(index, 'donor_id', e.target.value)}
                                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                >
                                                    <option value="">Select donor...</option>
                                                    {donors.map(donor => (
                                                        <option key={donor.id} value={donor.id}>
                                                            {donor.name} {donor.organization ? `(${donor.organization})` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Credited Value <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={credit.credited_value || ''}
                                                    onChange={(e) => handleUpdateNewCredit(index, 'credited_value', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Percentage (%)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={credit.credited_percentage || ''}
                                                    onChange={(e) => handleUpdateNewCredit(index, 'credited_percentage', parseFloat(e.target.value) || undefined)}
                                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Notes
                                                </label>
                                                <input
                                                    type="text"
                                                    value={credit.notes || ''}
                                                    onChange={(e) => handleUpdateNewCredit(index, 'notes', e.target.value)}
                                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                                    placeholder="Optional notes..."
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setNewCredits(prev => prev.filter((_, i) => i !== index))}
                                            className="mt-2 text-xs text-red-600 hover:text-red-800"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Saving...' : 'Save Credits'}
                    </button>
                </div>
            </div>
        </div>
    )
}

