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
    onViewKPIDetails: (kpi: any) => void
    onToggleKPIExpansion: (kpiId: string) => void
    initiativeId?: string
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
    onViewKPIDetails,
    onToggleKPIExpansion,
    initiativeId
}: MetricsTabProps) {
    if (!dashboard) return null

    const { initiative, kpis, stats } = dashboard

    // Filter KPIs based on category
    const filteredKpis = categoryFilter === 'all'
        ? kpis
        : kpis.filter(kpi => kpi.category === categoryFilter)

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
            <div className="w-full px-2 sm:px-4 py-4 space-y-6">
                {kpis.length === 0 ? (
                    /* Empty State */
                    <div className="flex items-center justify-center min-h-[60vh]">
                        <div className="text-center max-w-lg mx-auto">
                            <div className="relative mb-8">
                                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-100/50">
                                    <BarChart3 className="w-12 h-12 text-blue-600" />
                                </div>
                                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center">
                                    <Plus className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-4">
                                Create Your First Metric
                            </h3>
                            <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                                Metrics are the specific measurements you want to track, like "Students Trained" or "Wells Built"
                            </p>
                            <button
                                onClick={onAddKPI}
                                className="inline-flex items-center space-x-3 px-8 py-4 bg-green-100 hover:bg-green-200 text-green-700 rounded-2xl text-lg font-medium transition-colors duration-200"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Add First Metric</span>
                            </button>
                            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/60">
                                <p className="text-sm text-blue-700 font-medium">
                                    💡 Example: "Number of people trained" or "Clean water access provided"
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Metrics Section */
                    <div className="space-y-6">
                        {/* Metrics Section */}
                        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 shadow-xl shadow-gray-900/5">
                            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between mb-6 space-y-3 xl:space-y-0">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
                                        Performance Metrics
                                    </h2>
                                    <p className="text-gray-500 text-sm">Track and measure your initiative's impact across all metrics</p>
                                </div>

                                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                                    {/* Category Filter */}
                                    <div className="flex bg-gray-50/80 backdrop-blur-sm rounded-xl p-0.5 border border-gray-200/60 shadow-inner">
                                        <button
                                            onClick={() => setCategoryFilter('all')}
                                            className={`px-4 py-2 text-xs rounded-lg font-semibold transition-all duration-300 ${categoryFilter === 'all'
                                                ? 'bg-white text-gray-900 shadow-md shadow-gray-900/10 border border-gray-200/60'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                                }`}
                                        >
                                            All
                                        </button>
                                        <button
                                            onClick={() => setCategoryFilter('input')}
                                            className={`px-4 py-2 text-xs rounded-lg font-semibold transition-all duration-300 ${categoryFilter === 'input'
                                                ? 'bg-white text-gray-900 shadow-md shadow-gray-900/10 border border-gray-200/60'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                                }`}
                                        >
                                            Inputs
                                        </button>
                                        <button
                                            onClick={() => setCategoryFilter('output')}
                                            className={`px-4 py-2 text-xs rounded-lg font-semibold transition-all duration-300 ${categoryFilter === 'output'
                                                ? 'bg-white text-gray-900 shadow-md shadow-gray-900/10 border border-gray-200/60'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                                }`}
                                        >
                                            Outputs
                                        </button>
                                        <button
                                            onClick={() => setCategoryFilter('impact')}
                                            className={`px-4 py-2 text-xs rounded-lg font-semibold transition-all duration-300 ${categoryFilter === 'impact'
                                                ? 'bg-white text-gray-900 shadow-md shadow-gray-900/10 border border-gray-200/60'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                                }`}
                                        >
                                            Impacts
                                        </button>
                                    </div>

                                    <button
                                        onClick={onAddKPI}
                                        className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl text-sm font-medium transition-colors duration-200"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Add Metric</span>
                                    </button>
                                </div>
                            </div>

                            {/* Metrics Cards */}
                            {filteredKpis.length === 0 ? (
                                <div className="text-center py-16">
                                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-gray-100 to-gray-200/70 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-gray-200/50">
                                        <Target className="w-12 h-12 text-gray-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">No Metrics Found</h3>
                                    <p className="text-gray-500 font-medium max-w-md mx-auto">
                                        {categoryFilter === 'all'
                                            ? 'Create your first metric to start tracking your initiative\'s performance and impact.'
                                            : `No ${categoryFilter} metrics found. Try a different filter or create a new metric.`
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-4">
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
                                                onViewDetails={() => onViewKPIDetails(kpi)}
                                                kpiUpdates={allKPIUpdates.filter(update => update.kpi_id === kpi.id)}
                                                initiativeId={initiativeId || initiative.id}
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
