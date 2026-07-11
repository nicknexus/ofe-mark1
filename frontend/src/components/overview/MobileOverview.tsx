import React, { useEffect, useState } from 'react'
import { apiService } from '../../services/api'
import { aggregateKpiUpdates } from '../../utils/kpiAggregation'
import { SectionLoader } from '../ui'
import MetricsOverview from './MetricsOverview'

interface MobileOverviewProps {
 initiativeId: string
 /** Switch to the Timeline tab filtered to this metric (mobile has no URL tabs). */
 onOpenTimelineForMetric: (kpiId: string) => void
 onAddKPI?: () => void
}

/**
 * Self-fetching mobile wrapper for the metrics Overview: loads the dashboard
 * KPIs and all claims (same batch endpoint InitiativePage uses), computes
 * totals, and renders the same MetricsOverview the desktop tab uses.
 */
export default function MobileOverview({ initiativeId, onOpenTimelineForMetric, onAddKPI }: MobileOverviewProps) {
 const [kpis, setKpis] = useState<any[]>([])
 const [kpiTotals, setKpiTotals] = useState<Record<string, number>>({})
 const [kpiUpdates, setKpiUpdates] = useState<any[]>([])
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 let cancelled = false
 Promise.all([
 apiService.getInitiativeDashboard(initiativeId),
 apiService.getKPIUpdatesForInitiative(initiativeId),
 ]).then(([dashboard, grouped]) => {
 if (cancelled) return
 const dashboardKpis = dashboard?.kpis || []
 const totals: Record<string, number> = {}
 const allUpdates: any[] = []
 for (const kpi of dashboardKpis) {
 const updates = grouped[kpi.id!] || []
 totals[kpi.id!] = aggregateKpiUpdates(updates as any, kpi.metric_type)
 for (const update of updates) {
 allUpdates.push({ ...update, kpi_title: kpi.title, kpi_unit: kpi.unit_of_measurement })
 }
 }
 setKpis(dashboardKpis)
 setKpiTotals(totals)
 setKpiUpdates(allUpdates)
 }).catch(error => {
 console.error('Failed to load overview:', error)
 }).finally(() => {
 if (!cancelled) setLoading(false)
 })
 return () => { cancelled = true }
 }, [initiativeId])

 if (loading) {
 return <SectionLoader className="h-64" />
 }

 return (
 <MetricsOverview
 initiativeId={initiativeId}
 kpis={kpis}
 kpiTotals={kpiTotals}
 kpiUpdates={kpiUpdates}
 onAddKPI={onAddKPI}
 onOpenTimelineForMetric={onOpenTimelineForMetric}
 />
 )
}
