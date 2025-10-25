import React, { useState, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useFilterStore } from '../../state/filters/filterStore'
import { apiService } from '../../services/api'
import { KPI } from '../../types'
import { Labels } from '../../ui/labels'

interface MetricMultiSelectProps {
    className?: string
}

export default function MetricMultiSelect({ className = '' }: MetricMultiSelectProps) {
    const { selectedKpiIds, setSelectedKpiIds } = useFilterStore()
    const [isOpen, setIsOpen] = useState(false)
    const [kpis, setKpis] = useState<KPI[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        loadKpis()
    }, [])

    const loadKpis = async () => {
        setLoading(true)
        try {
            const kpiList = await apiService.getKPIs()
            setKpis(kpiList)
        } catch (error) {
            console.error('Failed to load KPIs:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleKpi = (kpiId: string) => {
        const currentIds = selectedKpiIds || []
        const newIds = currentIds.includes(kpiId)
            ? currentIds.filter(id => id !== kpiId)
            : [...currentIds, kpiId]

        setSelectedKpiIds(newIds.length === 0 ? null : newIds)
    }

    const handleClearAll = () => {
        setSelectedKpiIds(null)
    }

    const getSelectedKpis = () => {
        if (!selectedKpiIds) return []
        return kpis.filter(kpi => selectedKpiIds.includes(kpi.id))
    }

    const formatSelection = () => {
        const selected = getSelectedKpis()
        if (selected.length === 0) return `Select ${Labels.kpiPlural.toLowerCase()}`
        if (selected.length === 1) return selected[0].name
        return `${selected.length} ${Labels.kpiPlural.toLowerCase()} selected`
    }

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
                <span className="text-sm text-gray-700 truncate">{formatSelection()}</span>
                <div className="flex items-center space-x-1">
                    {selectedKpiIds && selectedKpiIds.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleClearAll()
                            }}
                            className="p-1 hover:bg-gray-200 rounded"
                        >
                            <X className="w-3 h-3 text-gray-500" />
                        </button>
                    )}
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                </div>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 w-full min-w-64 bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
                        {loading ? (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                Loading {Labels.kpiPlural.toLowerCase()}...
                            </div>
                        ) : (
                            <div className="py-1">
                                {kpis.map((kpi) => {
                                    const isSelected = selectedKpiIds?.includes(kpi.id) || false
                                    return (
                                        <label
                                            key={kpi.id}
                                            className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleKpi(kpi.id)}
                                                className="mr-3 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-gray-900 truncate">
                                                    {kpi.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {kpi.unit}
                                                </div>
                                            </div>
                                        </label>
                                    )
                                })}
                                {kpis.length === 0 && (
                                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                        No {Labels.kpiPlural.toLowerCase()} found
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
