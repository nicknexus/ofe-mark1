import React from 'react'
import { BarChart3, Plus, Target, Upload } from 'lucide-react'
import { InitiativeDashboard } from '../../types'
import ExpandableKPICard from '../ExpandableKPICard'

interface MetricsTabProps {
    dashboard: InitiativeDashboard | null
    kpiTotals: Record<string, number>
    categoryFilter: 'all' | 'input' | 'output' | 'impact'
    setCategoryFilter: (filter: 'all' | 'input' | 'output' | 'impact') => void
    expandedKPIs: Set<string>
    setExpandedKPIs: React.Dispatch<React.SetStateAction<Set<string>>>
    allKPIUpdates: any[]
    onAddKPI: () => void
    onAddUpdate: (kpi: any) => void
    onAddEvidence: (kpi?: any) => void
    onEditKPI: (kpi: any) => void
    onDeleteKPI: (kpi: any) => void
    onToggleKPIExpansion: (kpiId: string) => void
    initiativeId?: string
    onRefresh?: () => void
}

export default function MetricsTab({
    dashboard,
    kpiTotals,
    categoryFilter,
    setCategoryFilter,
    expandedKPIs,
    setExpandedKPIs,
    allKPIUpdates,
    onAddKPI,
    onAddUpdate,
    onAddEvidence,
    onEditKPI,
    onDeleteKPI,
    onToggleKPIExpansion,
    initiativeId,
    onRefresh
}: MetricsTabProps) {
    if (!dashboard) return null

    const { initiative, kpis, stats } = dashboard

    // Filter KPIs based on category
    const filteredKpis = categoryFilter === 'all'
        ? kpis
        : kpis.filter(kpi => kpi.category === categoryFilter)

    // Check if a metric is expanded via URL - render it as full page instead of overlay
    const expandedKpiId = expandedKPIs.size > 0 ? Array.from(expandedKPIs)[0] : null
    const expandedKpi = expandedKpiId ? kpis.find(k => k.id === expandedKpiId) : null

    // If a metric is expanded, render only that metric's detail view (not overlay)
    if (expandedKpi) {
        return (
            <ExpandableKPICard
                key={expandedKpi.id}
                kpi={expandedKpi}
                kpiTotal={kpiTotals[expandedKpi.id!] || 0}
                isExpanded={true}
                renderAsPage={true}
                onToggleExpand={() => expandedKpi.id && onToggleKPIExpansion(expandedKpi.id)}
                onAddUpdate={() => onAddUpdate(expandedKpi)}
                onAddEvidence={() => onAddEvidence(expandedKpi)}
                onEdit={() => onEditKPI(expandedKpi)}
                onDelete={() => onDeleteKPI(expandedKpi)}
                kpiUpdates={allKPIUpdates.filter(update => update.kpi_id === expandedKpi.id)}
                initiativeId={initiativeId || initiative.id}
                onRefresh={onRefresh}
            />
        )
    }

    return (
        <div className="h-screen overflow-hidden">
            <div className="h-full w-full px-4 sm:px-6 py-6 space-y-6 overflow-y-auto">
                {kpis.length === 0 ? (
                    /* Empty State - Only show Add Metric button */
                    <div className="flex items-center justify-center min-h-[60vh]">
                        <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-12 text-center max-w-lg mx-auto">
                            <div className="icon-bubble mx-auto mb-4">
                                <BarChart3 className="w-6 h-6 text-primary-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Metrics Yet</h3>
                            <p className="text-gray-500 mb-6">Create your first metric to start tracking your initiative's impact</p>
                            <button
                                onClick={onAddKPI}
                                className="inline-flex items-center space-x-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl text-sm font-medium transition-all duration-200 shadow-bubble-sm"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Metric</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Metrics Section */
                    <div className="space-y-6">
                        {/* Metrics Section */}
                        <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between mb-6 space-y-3 xl:space-y-0">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-semibold text-gray-800">
                                        Performance Metrics
                                    </h2>
                                    <p className="text-gray-500 text-sm">Track and measure your initiative's impact across all metrics</p>
                                </div>

                                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                                    {/* Category Filter */}
                                    <div className="flex bg-gray-50 rounded-2xl p-1 border border-gray-100">
                                        <button
                                            onClick={() => setCategoryFilter('all')}
                                            className={`px-4 py-2 text-xs rounded-xl font-medium transition-all duration-200 ${categoryFilter === 'all'
                                                ? 'bg-white text-gray-800 shadow-bubble-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            All
                                        </button>
                                        <button
                                            onClick={() => setCategoryFilter('input')}
                                            className={`px-4 py-2 text-xs rounded-xl font-medium transition-all duration-200 ${categoryFilter === 'input'
                                                ? 'bg-white text-gray-800 shadow-bubble-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            Inputs
                                        </button>
                                        <button
                                            onClick={() => setCategoryFilter('output')}
                                            className={`px-4 py-2 text-xs rounded-xl font-medium transition-all duration-200 ${categoryFilter === 'output'
                                                ? 'bg-white text-gray-800 shadow-bubble-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            Outputs
                                        </button>
                                        <button
                                            onClick={() => setCategoryFilter('impact')}
                                            className={`px-4 py-2 text-xs rounded-xl font-medium transition-all duration-200 ${categoryFilter === 'impact'
                                                ? 'bg-white text-gray-800 shadow-bubble-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            Impacts
                                        </button>
                                    </div>

                                    <button
                                        onClick={onAddKPI}
                                        className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl text-sm font-medium transition-all duration-200 shadow-bubble-sm"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Add Metric</span>
                                    </button>
                                </div>
                            </div>

                            {/* Metrics Cards */}
                            {filteredKpis.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="icon-bubble mx-auto mb-4">
                                        <Target className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Metrics Found</h3>
                                    <p className="text-gray-500 text-sm max-w-md mx-auto">
                                        {categoryFilter === 'all'
                                            ? 'Create your first metric to start tracking your initiative\'s performance and impact.'
                                            : `No ${categoryFilter} metrics found. Try a different filter or create a new metric.`
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {filteredKpis.map((kpi) => (
                                        kpi.id && (
                                            <ExpandableKPICard
                                                key={kpi.id}
                                                kpi={kpi}
                                                kpiTotal={kpiTotals[kpi.id] || 0}
                                                isExpanded={expandedKPIs.has(kpi.id)}
                                                onToggleExpand={() => kpi.id && onToggleKPIExpansion(kpi.id)}
                                                onAddUpdate={() => onAddUpdate(kpi)}
                                                onAddEvidence={() => onAddEvidence(kpi)}
                                                onEdit={() => onEditKPI(kpi)}
                                                onDelete={() => onDeleteKPI(kpi)}
                                                kpiUpdates={allKPIUpdates.filter(update => update.kpi_id === kpi.id)}
                                                initiativeId={initiativeId || initiative.id}
                                                onRefresh={onRefresh}
                                            />
                                        )
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
