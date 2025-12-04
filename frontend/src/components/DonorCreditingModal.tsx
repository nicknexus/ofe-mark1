import React, { useState, useEffect } from 'react'
import { X, AlertCircle, CheckCircle, BarChart3 } from 'lucide-react'
import { Donor, DonorCredit, KPI, InitiativeDashboard } from '../types'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'

interface DonorCreditingModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: () => Promise<void>
    donor: Donor
    initiativeId: string
    dashboard: InitiativeDashboard | null
}

export default function DonorCreditingModal({
    isOpen,
    onClose,
    onSave,
    donor,
    initiativeId,
    dashboard
}: DonorCreditingModalProps) {
    const [credits, setCredits] = useState<DonorCredit[]>([])
    const [loading, setLoading] = useState(false)
    const [newCredits, setNewCredits] = useState<Record<string, Partial<DonorCredit>>>({})
    const [editingCredits, setEditingCredits] = useState<Record<string, Partial<DonorCredit>>>({})
    const [metricTotals, setMetricTotals] = useState<Record<string, number>>({})
    const [creditsByMetric, setCreditsByMetric] = useState<Record<string, DonorCredit[]>>({})
    const [otherDonorsCredited, setOtherDonorsCredited] = useState<Record<string, number>>({})
    const [loadingTotals, setLoadingTotals] = useState(true)

    useEffect(() => {
        if (isOpen && donor.id && dashboard) {
            const initializeData = async () => {
                // Clear cache to ensure fresh data when opening modal (especially after other donors' credits change)
                apiService.clearCache('/donor-credits')
                await calculateMetricTotals()
                await loadCredits() // This will call loadOtherDonorsCredits internally
            }
            initializeData()
        } else {
            // Reset state when modal closes
            setNewCredits({})
            setEditingCredits({})
            setCredits([])
            setOtherDonorsCredited({})
            setMetricTotals({})
            setLoadingTotals(true)
        }
    }, [isOpen, donor.id, dashboard])

    const loadOtherDonorsCredits = async () => {
        if (!dashboard?.kpis || !donor.id) return
        
        const otherCredits: Record<string, number> = {}
        
        await Promise.all(dashboard.kpis.map(async (kpi) => {
            if (kpi.id) {
                try {
                    // Get ALL credits for this metric (from all donors in the initiative)
                    const allCredits = await apiService.getCreditsForMetric(kpi.id)
                    
                    // Filter to only metric-level credits (not claim-specific)
                    const metricLevelCredits = allCredits.filter(c => !c.kpi_update_id)
                    
                    // Calculate what OTHER donors have credited (exclude this donor)
                    // The API returns credits with donor info populated, so we can filter by donor_id
                    const otherDonorsTotal = metricLevelCredits
                        .filter(credit => credit.donor_id !== donor.id)
                        .reduce((sum, credit) => sum + Number(credit.credited_value || 0), 0)
                    
                    otherCredits[kpi.id] = otherDonorsTotal
                } catch (error) {
                    console.error(`Error loading credits for metric ${kpi.id}:`, error)
                    otherCredits[kpi.id] = 0
                }
            }
        }))
        
        setOtherDonorsCredited(otherCredits)
    }

    const calculateMetricTotals = async () => {
        if (!dashboard?.kpis) return
        
        setLoadingTotals(true)
        const totals: Record<string, number> = {}
        
        // Fetch updates for each metric
        await Promise.all(dashboard.kpis.map(async (kpi) => {
            if (kpi.id) {
                try {
                    // Fetch all impact claims (kpi_updates) for this metric
                    const updates = await apiService.getKPIUpdates(kpi.id)
                    // Sum all impact claims for this metric
                    totals[kpi.id] = updates.reduce((sum, update) => sum + Number(update.value || 0), 0)
                } catch (error) {
                    console.error(`Error loading updates for metric ${kpi.id}:`, error)
                    // Fallback to total_value if available
                    totals[kpi.id] = kpi.total_value || 0
                }
            }
        }))
        
        setMetricTotals(totals)
        setLoadingTotals(false)
    }

    const loadCredits = async () => {
        if (!donor.id) return
        try {
            const donorCredits = await apiService.getDonorCredits(donor.id)
            setCredits(donorCredits || [])
            
            // Group credits by metric
            const grouped: Record<string, DonorCredit[]> = {}
            donorCredits.forEach(credit => {
                if (credit.kpi_id) {
                    if (!grouped[credit.kpi_id]) {
                        grouped[credit.kpi_id] = []
                    }
                    grouped[credit.kpi_id].push(credit)
                }
            })
            setCreditsByMetric(grouped)
            
            // Always reload other donors' credits after loading this donor's credits
            // This ensures remaining amounts are always up to date
            await loadOtherDonorsCredits()
        } catch (error) {
            console.error('Error loading credits:', error)
            toast.error('Failed to load credits')
        }
    }

    const getTotalCreditedForMetric = async (kpiId: string): Promise<number> => {
        try {
            // Get all credits for this metric (from all donors)
            const allCredits = await apiService.getCreditsForMetric(kpiId)
            return allCredits.reduce((sum, credit) => sum + Number(credit.credited_value || 0), 0)
        } catch (error) {
            console.error('Error calculating total credits:', error)
            return 0
        }
    }

    const handleCreditChange = (kpiId: string, value: number) => {
        if (value < 0) {
            value = 0
        }

        // Check if this donor already has a credit for this metric
        const existingCredit = credits.find(c => c.kpi_id === kpiId && !c.kpi_update_id)
        
        if (existingCredit) {
            // Update existing credit
            setEditingCredits(prev => ({
                ...prev,
                [existingCredit.id!]: { ...prev[existingCredit.id!], credited_value: value }
            }))
        } else {
            // New credit
            setNewCredits(prev => ({
                ...prev,
                [kpiId]: {
                    donor_id: donor.id,
                    kpi_id: kpiId,
                    credited_value: value,
                    kpi_update_id: undefined // Metric-level credit
                }
            }))
        }
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

    const hasInvalidCredits = () => {
        return dashboard?.kpis.some(kpi => {
            if (!kpi.id) return false
            const total = metricTotals[kpi.id] || 0
            const otherCredited = otherDonorsCredited[kpi.id] || 0
            const existingCredits = credits.filter(c => c.kpi_id === kpi.id && !c.kpi_update_id)
            const existingDonorCredit = existingCredits.reduce((sum, c) => {
                if (editingCredits[c.id!]) {
                    return sum + Number(editingCredits[c.id!].credited_value || 0)
                }
                return sum + Number(c.credited_value || 0)
            }, 0)
            const newCredit = newCredits[kpi.id]
            const currentCredit = newCredit?.credited_value || existingDonorCredit || 0
            const remaining = total - otherCredited - currentCredit
            return remaining < 0
        }) || false
    }

    const handleSave = async () => {
        // Check for invalid credits before saving
        if (hasInvalidCredits()) {
            toast.error('Please fix all invalid credit amounts before saving')
            return
        }
        setLoading(true)
        try {
            // Save new credits
            for (const [kpiId, credit] of Object.entries(newCredits)) {
                if (credit.credited_value && credit.credited_value > 0) {
                    // Validate available value
                    const totalCredited = await getTotalCreditedForMetric(kpiId)
                    const max = metricTotals[kpiId] || 0
                    const available = max - totalCredited
                    
                    // Add any existing credits from this donor that we're not editing
                    const existingDonorCredits = credits.filter(c => c.kpi_id === kpiId && !c.kpi_update_id)
                    const existingDonorTotal = existingDonorCredits.reduce((sum, c) => {
                        if (editingCredits[c.id!]) return sum // Skip if we're editing it
                        return sum + Number(c.credited_value || 0)
                    }, 0)
                    
                    const newTotal = totalCredited - existingDonorTotal + credit.credited_value
                    
                    if (newTotal > max) {
                        toast.error(`Credited value for ${dashboard?.kpis.find(k => k.id === kpiId)?.title || 'metric'} exceeds available amount. Available: ${available.toFixed(2)}`)
                        setLoading(false)
                        return
                    }

                    await apiService.createDonorCredit(credit)
                }
            }

            // Update existing credits
            for (const [creditId, updates] of Object.entries(editingCredits)) {
                if (Object.keys(updates).length > 0 && updates.credited_value !== undefined) {
                    // Validate
                    const credit = credits.find(c => c.id === creditId)
                    if (credit) {
                        const totalCredited = await getTotalCreditedForMetric(credit.kpi_id)
                        const max = metricTotals[credit.kpi_id] || 0
                        const currentDonorCredit = Number(credit.credited_value || 0)
                        const newTotal = totalCredited - currentDonorCredit + Number(updates.credited_value || 0)
                        
                        if (newTotal > max) {
                            const metric = dashboard?.kpis.find(k => k.id === credit.kpi_id)
                            toast.error(`Credited value for ${metric?.title || 'metric'} exceeds available amount`)
                            setLoading(false)
                            return
                        }
                    }
                    
                    await apiService.updateDonorCredit(creditId, updates)
                }
            }

            toast.success('Credits saved successfully!')
            
            // Reload credits and other donors' credits to update remaining amounts
            await loadCredits()
            await loadOtherDonorsCredits()
            
            await onSave()
            onClose()
        } catch (error: any) {
            const message = error instanceof Error ? error.message : 'Failed to save credits'
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen || !dashboard) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Credit Impacts to {donor.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">{donor.email}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {dashboard.kpis.length === 0 ? (
                        <div className="text-center py-12">
                            <BarChart3 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-500">No metrics available. Create metrics first.</p>
                        </div>
                    ) : loadingTotals ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {dashboard.kpis.map(kpi => {
                                if (!kpi.id) return null
                                
                                const total = metricTotals[kpi.id] || 0
                                const existingCredits = credits.filter(c => c.kpi_id === kpi.id && !c.kpi_update_id)
                                const existingDonorCredit = existingCredits.reduce((sum, c) => {
                                    if (editingCredits[c.id!]) {
                                        return sum + Number(editingCredits[c.id!].credited_value || 0)
                                    }
                                    return sum + Number(c.credited_value || 0)
                                }, 0)
                                
                                const newCredit = newCredits[kpi.id]
                                const currentCredit = newCredit?.credited_value || existingDonorCredit || 0
                                
                                // Get what's been credited by other donors
                                const otherCredited = otherDonorsCredited[kpi.id] || 0
                                const remaining = total - otherCredited - currentCredit
                                const maxAvailable = total - otherCredited

                                return (
                                    <div key={kpi.id} className="px-3 py-2 border border-gray-200 rounded hover:bg-gray-50 transition-colors">
                                        {/* Line 1: Metric Name with Total and Others info */}
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                <div className="font-medium text-sm text-gray-900 truncate">{kpi.title}</div>
                                                <div className="text-xs text-gray-500 whitespace-nowrap">
                                                    ({total.toFixed(2)} total, <span className="text-red-600">{otherCredited.toFixed(2)} credited to others</span>)
                                                </div>
                                            </div>
                                            {existingCredits.length > 0 && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDeleteCredit(existingCredits[0].id!)
                                                    }}
                                                    className="text-red-400 hover:text-red-600 text-xs ml-2"
                                                    title="Remove Credit"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>

                                        {/* Line 2: Credit Input and Remaining */}
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={currentCredit || ''}
                                                onChange={(e) => handleCreditChange(kpi.id!, parseFloat(e.target.value) || 0)}
                                                className={`flex-1 px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-500 focus:border-transparent ${
                                                    remaining < 0 ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                                }`}
                                                placeholder="0.00"
                                            />
                                            <div className={`text-xs font-medium whitespace-nowrap ${remaining >= 0 ? 'text-primary-500' : 'text-red-600'}`}>
                                                {remaining >= 0 ? `Remaining: ${remaining.toFixed(2)}` : `Exceeds max by ${Math.abs(remaining).toFixed(2)}`}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
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
                        disabled={loading || hasInvalidCredits()}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Saving...' : 'Save Credits'}
                    </button>
                </div>
            </div>
        </div>
    )
}

