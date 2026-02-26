import React, { useState, useEffect } from 'react'
import {
    Plus,
    BarChart3,
    ChevronRight,
    ChevronLeft,
    X,
    Check,
    Loader2,
    MapPin,
    TrendingUp,
    Trash2
} from 'lucide-react'
import { apiService } from '../../services/api'
import { KPI, KPIUpdate, Location, CreateKPIUpdateForm } from '../../types'
import { formatDate, getLocalDateString } from '../../utils'
import DateRangePicker from '../DateRangePicker'
import toast from 'react-hot-toast'

interface MobileMetricsTabProps {
    initiativeId: string
    autoAdd?: boolean
}

interface KPIWithTotal extends KPI {
    totalValue?: number
    claimCount?: number
}

export default function MobileMetricsTab({ initiativeId, autoAdd }: MobileMetricsTabProps) {
    const [kpis, setKpis] = useState<KPIWithTotal[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedKpi, setSelectedKpi] = useState<KPI | null>(null)

    useEffect(() => {
        loadKpis()
    }, [initiativeId])

    const loadKpis = async () => {
        try {
            setLoading(true)
            const data = await apiService.getKPIs(initiativeId)
            const kpiList = data || []

            const withTotals = await Promise.all(
                kpiList.map(async (kpi) => {
                    try {
                        const updates = await apiService.getKPIUpdates(kpi.id!)
                        const total = (updates || []).reduce((sum, u) => sum + (u.value || 0), 0)
                        return { ...kpi, totalValue: total, claimCount: (updates || []).length }
                    } catch {
                        return { ...kpi, totalValue: 0, claimCount: 0 }
                    }
                })
            )
            setKpis(withTotals)
        } catch (error) {
            console.error('Error loading metrics:', error)
            toast.error('Failed to load metrics')
        } finally {
            setLoading(false)
        }
    }

    if (selectedKpi) {
        return (
            <MobileMetricDetail
                kpi={selectedKpi}
                initiativeId={initiativeId}
                onBack={() => { setSelectedKpi(null); loadKpis() }}
                autoAdd={autoAdd}
            />
        )
    }

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Metrics</h1>
                    <p className="text-sm text-gray-500">{kpis.length} metric{kpis.length !== 1 ? 's' : ''}</p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                </div>
            ) : kpis.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                    <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <BarChart3 className="w-8 h-8 text-primary-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Metrics Yet</h3>
                    <p className="text-gray-500 text-sm px-6">
                        Create metrics on desktop to start tracking impact.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {kpis.map((kpi) => (
                        <button
                            key={kpi.id}
                            onClick={() => setSelectedKpi(kpi)}
                            className="w-full bg-white rounded-xl border border-gray-100 p-4 text-left active:scale-[0.98] transition-all"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <BarChart3 className="w-5 h-5 text-primary-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-800 truncate">{kpi.title}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                            kpi.category === 'impact' ? 'bg-purple-50 text-purple-600' :
                                            kpi.category === 'output' ? 'bg-blue-50 text-blue-600' :
                                            'bg-amber-50 text-amber-600'
                                        }`}>
                                            {kpi.category}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {kpi.claimCount} claim{kpi.claimCount !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0 mr-1">
                                    <p className="text-lg font-bold text-gray-900">
                                        {(kpi.totalValue || 0).toLocaleString()}
                                        {kpi.metric_type === 'percentage' ? '%' : ''}
                                    </p>
                                    <p className="text-xs text-gray-400">{kpi.unit_of_measurement}</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

interface MetricDetailProps {
    kpi: KPI
    initiativeId: string
    onBack: () => void
    autoAdd?: boolean
}

function MobileMetricDetail({ kpi, initiativeId, onBack, autoAdd }: MetricDetailProps) {
    const [updates, setUpdates] = useState<KPIUpdate[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddForm, setShowAddForm] = useState(false)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

    useEffect(() => {
        loadUpdates()
    }, [kpi.id])

    const loadUpdates = async () => {
        try {
            setLoading(true)
            const data = await apiService.getKPIUpdates(kpi.id!)
            setUpdates(data || [])
        } catch (error) {
            console.error('Error loading updates:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await apiService.deleteKPIUpdate(id)
            toast.success('Impact claim deleted')
            setDeleteConfirmId(null)
            loadUpdates()
        } catch (error) {
            toast.error('Failed to delete')
        }
    }

    const totalValue = updates.reduce((sum, u) => sum + (u.value || 0), 0)

    if (showAddForm) {
        return (
            <MobileAddClaimFlow
                kpi={kpi}
                initiativeId={initiativeId}
                onClose={() => setShowAddForm(false)}
                onSuccess={() => {
                    setShowAddForm(false)
                    loadUpdates()
                }}
            />
        )
    }

    return (
        <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
                <button onClick={onBack} className="p-2 -ml-2 text-gray-500 hover:text-gray-700">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-bold text-gray-900 truncate">{kpi.title}</h1>
                    <p className="text-xs text-gray-500">{kpi.unit_of_measurement} · {kpi.category}</p>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-primary-500/25 active:scale-[0.98]"
                >
                    <Plus className="w-4 h-4" />
                    Add
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total</p>
                        <p className="text-3xl font-bold text-gray-900 mt-1">
                            {totalValue.toLocaleString()}
                            {kpi.metric_type === 'percentage' ? '%' : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{kpi.unit_of_measurement}</p>
                    </div>
                    <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center">
                        <TrendingUp className="w-7 h-7 text-primary-500" />
                    </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{updates.length} impact claim{updates.length !== 1 ? 's' : ''}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        kpi.category === 'impact' ? 'bg-purple-50 text-purple-600' :
                        kpi.category === 'output' ? 'bg-blue-50 text-blue-600' :
                        'bg-amber-50 text-amber-600'
                    }`}>
                        {kpi.category}
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                </div>
            ) : updates.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
                    <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-gray-800 mb-1">No Impact Claims</h3>
                    <p className="text-sm text-gray-500 px-6 mb-4">Add your first data point for this metric.</p>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="px-5 py-2.5 bg-primary-500 text-white rounded-xl font-medium text-sm"
                    >
                        Add Impact Claim
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {updates
                        .sort((a, b) => (b.date_represented || b.date_range_start || '').localeCompare(a.date_represented || a.date_range_start || ''))
                        .map((update) => (
                        <div key={update.id} className="bg-white rounded-xl border border-gray-100 p-3.5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-bold text-gray-900">
                                            {update.value.toLocaleString()}{kpi.metric_type === 'percentage' ? '%' : ''}
                                        </span>
                                        <span className="text-xs text-gray-400">{kpi.unit_of_measurement}</span>
                                    </div>
                                    {update.label && (
                                        <p className="text-sm font-medium text-gray-700 mt-0.5">{update.label}</p>
                                    )}
                                    {update.note && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{update.note}</p>
                                    )}
                                    <span className="text-xs text-gray-400 mt-2 block">
                                        {update.date_range_start && update.date_range_end
                                            ? `${formatDate(update.date_range_start)} – ${formatDate(update.date_range_end)}`
                                            : formatDate(update.date_represented)
                                        }
                                    </span>
                                </div>
                                <button
                                    onClick={() => setDeleteConfirmId(update.id!)}
                                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {deleteConfirmId && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Delete Impact Claim</h3>
                                <p className="text-xs text-gray-500">This cannot be undone</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirmId)}
                                className="flex-1 py-3 px-4 bg-red-500 text-white rounded-xl font-medium text-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

interface AddClaimFlowProps {
    kpi: KPI
    initiativeId: string
    onClose: () => void
    onSuccess: () => void
}

function MobileAddClaimFlow({ kpi, initiativeId, onClose, onSuccess }: AddClaimFlowProps) {
    const [step, setStep] = useState(1)
    const [saving, setSaving] = useState(false)
    const [locations, setLocations] = useState<Location[]>([])

    const [formData, setFormData] = useState({
        value: '',
        label: '',
        note: '',
        locationId: '',
    })
    const [datePickerValue, setDatePickerValue] = useState<{
        singleDate?: string
        startDate?: string
        endDate?: string
    }>({})

    useEffect(() => {
        apiService.getLocations(initiativeId).then(locs => setLocations(locs || []))
    }, [initiativeId])

    const totalSteps = 3

    const canProceed = () => {
        switch (step) {
            case 1: {
                const val = parseFloat(formData.value)
                return !isNaN(val) && val > 0
            }
            case 2:
                return (!!datePickerValue.singleDate || !!datePickerValue.startDate) && !!formData.locationId
            case 3:
                return !!formData.label.trim()
            default:
                return false
        }
    }

    const handleSubmit = async () => {
        setSaving(true)
        try {
            const data: CreateKPIUpdateForm = {
                value: parseFloat(formData.value),
                date_represented: datePickerValue.singleDate || datePickerValue.startDate!,
                date_range_start: datePickerValue.startDate,
                date_range_end: datePickerValue.endDate,
                label: formData.label.trim(),
                note: formData.note.trim() || undefined,
                location_id: formData.locationId,
            }
            await apiService.createKPIUpdate(kpi.id!, data)
            toast.success('Impact claim added!')
            onSuccess()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add impact claim'
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <button onClick={onClose} className="p-2 -ml-2">
                    <X className="w-5 h-5 text-gray-500" />
                </button>
                <span className="font-semibold text-gray-800">Add Impact Claim</span>
                <span className="text-sm text-gray-500">{step}/{totalSteps}</span>
            </div>

            {/* Progress */}
            <div className="px-4 pt-3">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary-500 transition-all duration-300"
                        style={{ width: `${(step / totalSteps) * 100}%` }}
                    />
                </div>
            </div>

            {/* Metric info pill */}
            <div className="px-4 pt-3">
                <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 rounded-xl">
                    <BarChart3 className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-800 truncate">{kpi.title}</span>
                    <span className="text-xs text-gray-500 ml-auto flex-shrink-0">{kpi.unit_of_measurement}</span>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* Step 1: Value */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Enter Value</h2>
                            <p className="text-gray-500 text-sm mt-1">How much to report?</p>
                        </div>
                        <div className="max-w-xs mx-auto">
                            <div className="relative">
                                <input
                                    type="number"
                                    value={formData.value}
                                    onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                                    placeholder="0"
                                    min="0"
                                    step={kpi.metric_type === 'percentage' ? '0.01' : '1'}
                                    max={kpi.metric_type === 'percentage' ? '100' : undefined}
                                    autoFocus
                                    className="w-full text-center text-4xl font-bold py-6 border-2 border-gray-200 rounded-2xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none transition-colors"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-gray-400 font-medium">
                                    {kpi.metric_type === 'percentage' ? '%' : kpi.unit_of_measurement}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Date & Location */}
                {step === 2 && (
                    <div className="space-y-5">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Date & Location</h2>
                            <p className="text-gray-500 text-sm mt-1">When and where?</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Date <span className="text-red-500">*</span>
                            </label>
                            <DateRangePicker
                                value={datePickerValue}
                                onChange={setDatePickerValue}
                                maxDate={getLocalDateString(new Date())}
                                placeholder="Select date or range"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Location <span className="text-red-500">*</span>
                            </label>
                            {locations.length === 0 ? (
                                <div className="p-4 bg-gray-50 rounded-xl text-center">
                                    <MapPin className="w-6 h-6 text-gray-400 mx-auto mb-1.5" />
                                    <p className="text-sm text-gray-500">No locations yet.</p>
                                    <p className="text-xs text-gray-400 mt-0.5">Add one in the Locations tab first.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {locations.map((loc) => {
                                        const selected = formData.locationId === loc.id
                                        return (
                                            <button
                                                key={loc.id}
                                                onClick={() => setFormData(prev => ({ ...prev, locationId: loc.id! }))}
                                                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                                                    selected
                                                        ? 'border-primary-500 bg-primary-50'
                                                        : 'border-gray-200'
                                                }`}
                                            >
                                                <MapPin className={`w-5 h-5 flex-shrink-0 ${selected ? 'text-primary-500' : 'text-gray-400'}`} />
                                                <span className={`text-sm font-medium flex-1 ${selected ? 'text-primary-700' : 'text-gray-700'}`}>
                                                    {loc.name}
                                                </span>
                                                {selected && <Check className="w-5 h-5 text-primary-500" />}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 3: Details */}
                {step === 3 && (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Details</h2>
                            <p className="text-gray-500 text-sm mt-1">Label and any extra context</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Label <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.label}
                                onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                                placeholder="e.g., Week 2 Update, Training Day"
                                autoFocus
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Note (optional)
                            </label>
                            <textarea
                                value={formData.note}
                                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                                placeholder="Additional context or explanation..."
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none"
                            />
                        </div>

                        {/* Summary */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Summary</p>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Value</span>
                                <span className="font-semibold text-gray-900">
                                    {parseFloat(formData.value).toLocaleString()}{kpi.metric_type === 'percentage' ? '%' : ''} {kpi.unit_of_measurement}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Date</span>
                                <span className="font-medium text-gray-700">
                                    {datePickerValue.singleDate
                                        ? formatDate(datePickerValue.singleDate)
                                        : datePickerValue.startDate && datePickerValue.endDate
                                            ? `${formatDate(datePickerValue.startDate)} – ${formatDate(datePickerValue.endDate)}`
                                            : '—'
                                    }
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Location</span>
                                <span className="font-medium text-gray-700">
                                    {locations.find(l => l.id === formData.locationId)?.name || '—'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 safe-area-pb">
                <div className="flex gap-3">
                    <button
                        onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm"
                    >
                        {step > 1 ? 'Back' : 'Cancel'}
                    </button>
                    {step < totalSteps ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={!canProceed()}
                            className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={saving || !canProceed()}
                            className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    Add Claim
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
