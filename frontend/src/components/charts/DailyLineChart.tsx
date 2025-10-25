import React, { useState, useEffect } from 'react'
import { useFilterStore } from '../../state/filters/filterStore'
import { analyticsService, KpiTimeseriesData } from '../../services/analytics'
import { apiService } from '../../services/api'
import { KPI } from '../../types'
import { Labels } from '../../ui/labels'

export default function DailyLineChart() {
    const { dateRange, selectedLocationIds, selectedKpiIds } = useFilterStore()
    const [data, setData] = useState<KpiTimeseriesData[]>([])
    const [kpis, setKpis] = useState<KPI[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (dateRange) {
            loadData()
        }
    }, [dateRange, selectedLocationIds, selectedKpiIds])

    const loadData = async () => {
        if (!dateRange) return

        setLoading(true)
        setError(null)

        try {
            // Try to use analytics service first (RPC)
            let timeseriesData: KpiTimeseriesData[] = []

            try {
                timeseriesData = await analyticsService.getKpiTimeseries(
                    dateRange.start,
                    dateRange.end,
                    selectedKpiIds || undefined,
                    selectedLocationIds || undefined
                )
            } catch (rpcError) {
                console.warn('RPC not available, falling back to existing API')
                // Fallback to existing API
                const allKpis = await apiService.getKPIs()
                const filteredKpis = selectedKpiIds
                    ? allKpis.filter(kpi => selectedKpiIds.includes(kpi.id))
                    : allKpis

                setKpis(filteredKpis)

                // For now, return empty data since we don't have the full implementation
                // In a real implementation, you'd aggregate the existing datapoints
                timeseriesData = []
            }

            setData(timeseriesData)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    if (!dateRange) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <p>Select a date range to view trends</p>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64 text-red-500">
                <div className="text-center">
                    <p>Error loading data: {error}</p>
                    <button
                        onClick={loadData}
                        className="mt-2 px-4 py-2 text-sm bg-primary-500 text-white rounded-md hover:bg-primary-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <p>No data available for the selected filters</p>
                </div>
            </div>
        )
    }

    // Group data by KPI for the chart
    const groupedData = data.reduce((acc, item) => {
        if (!acc[item.kpi_id]) {
            acc[item.kpi_id] = {
                name: item.kpi_name,
                unit: item.unit,
                data: []
            }
        }
        acc[item.kpi_id].data.push({
            date: item.date,
            value: item.value
        })
        return acc
    }, {} as Record<string, { name: string; unit: string; data: Array<{ date: string; value: number }> }>)

    return (
        <div className="h-64">
            <div className="text-sm text-gray-600 mb-4">
                Showing {Object.keys(groupedData).length} {Labels.kpiPlural.toLowerCase()} over time
            </div>

            {/* Simple chart representation - in a real app you'd use a proper charting library */}
            <div className="space-y-4">
                {Object.entries(groupedData).map(([kpiId, kpiData]) => (
                    <div key={kpiId} className="border-l-4 border-primary-500 pl-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-900">{kpiData.name}</h4>
                            <span className="text-sm text-gray-500">{kpiData.unit}</span>
                        </div>
                        <div className="text-sm text-gray-600">
                            {kpiData.data.length} data points
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
