import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { apiService } from '../../services/api'
import { InitiativeDashboard, LoadingState } from '../../types'
import MetricsDashboard from '../../components/MetricsDashboard'
import InitiativeHeader from '../../components/InitiativeHeader'
import toast from 'react-hot-toast'

export default function InitiativeHomePage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [dashboard, setDashboard] = useState<InitiativeDashboard | null>(null)
    const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)
    const [kpiTotals, setKpiTotals] = useState<Record<string, number>>({})
    const [allKPIUpdates, setAllKPIUpdates] = useState<any[]>([])

    useEffect(() => {
        if (id) {
            loadDashboard()
        }
    }, [id])

    const loadKPITotals = async (kpis: any[]) => {
        const totals: Record<string, number> = {}
        const allUpdates: any[] = []

        // Load updates for each KPI and calculate totals
        await Promise.all(kpis.map(async (kpi) => {
            try {
                const updates = await apiService.getKPIUpdates(kpi.id)
                totals[kpi.id] = updates.reduce((sum: number, update: any) => sum + (update.value || 0), 0)

                // Add KPI info to each update for context
                updates.forEach((update: any) => {
                    allUpdates.push({
                        ...update,
                        kpi_title: kpi.title,
                        kpi_unit: kpi.unit_of_measurement
                    })
                })
            } catch (error) {
                console.warn(`Failed to load updates for KPI ${kpi.id}:`, error)
                totals[kpi.id] = 0
            }
        }))

        setKpiTotals(totals)
        setAllKPIUpdates(allUpdates)
    }

    const loadDashboard = async () => {
        if (!id || isLoadingDashboard) return

        try {
            setIsLoadingDashboard(true)
            setLoadingState({ isLoading: true })
            const data = await apiService.getInitiativeDashboard(id)
            setDashboard(data)

            // Load KPI totals after dashboard loads
            if (data?.kpis) {
                await loadKPITotals(data.kpis)
            }

            setLoadingState({ isLoading: false })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load dashboard'
            setLoadingState({ isLoading: false, error: message })
            toast.error(message)
        } finally {
            setIsLoadingDashboard(false)
        }
    }

    if (loadingState.isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (loadingState.error || !dashboard) {
        return (
            <div className="text-center py-12">
                <div className="text-red-600 mb-4">{loadingState.error || 'Initiative not found'}</div>
                <div className="space-x-4">
                    <Link to="/" className="btn-secondary">
                        Back to Dashboard
                    </Link>
                    <button onClick={loadDashboard} className="btn-primary" disabled={isLoadingDashboard}>
                        {isLoadingDashboard ? 'Loading...' : 'Try Again'}
                    </button>
                </div>
            </div>
        )
    }

    const { initiative, kpis, stats } = dashboard

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
            <InitiativeHeader
                initiative={initiative}
                kpisCount={kpis.length}
                onAddKPIClick={() => navigate(`/initiatives/${id}/kpis`)}
                addKPIButtonText={kpis.length === 0 ? 'Add First KPI' : 'Manage KPIs'}
            />

            <div className="w-full px-2 sm:px-4 py-4 space-y-6">
                {kpis.length === 0 ? (
                    /* Empty State - Modern Design */
                    <div className="flex items-center justify-center min-h-[60vh]">
                        <div className="text-center max-w-lg mx-auto">
                            <div className="relative mb-8">
                                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-100/50">
                                    <Plus className="w-12 h-12 text-blue-600" />
                                </div>
                                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center">
                                    <Plus className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-4">
                                Create Your First KPI
                            </h3>
                            <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                                KPIs are the specific metrics you want to track, like "Students Trained" or "Wells Built"
                            </p>
                            <Link
                                to={`/initiatives/${id}/kpis`}
                                className="inline-flex items-center space-x-3 px-8 py-4 bg-green-100 hover:bg-green-200 text-green-700 rounded-2xl text-lg font-medium transition-colors duration-200"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Add First KPI</span>
                            </Link>
                            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/60">
                                <p className="text-sm text-blue-700 font-medium">
                                    💡 Example: "Number of people trained" or "Clean water access provided"
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Metrics Dashboard - Full Width */
                    <div className="space-y-6">
                        <MetricsDashboard
                            kpis={kpis}
                            kpiTotals={kpiTotals}
                            stats={stats}
                            kpiUpdates={allKPIUpdates}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
