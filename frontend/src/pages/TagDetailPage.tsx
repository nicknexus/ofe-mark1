import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Tag as TagIcon, Trash2, Edit2, Check, X, FileText, Camera, MessageSquare, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiService } from '../services/api'
import { MetricTag, Evidence } from '../types'
import { aggregateKpiUpdates } from '../utils/kpiAggregation'
import EvidencePreviewModal from '../components/EvidencePreviewModal'
import { formatDate, getEvidenceTypeInfo } from '../utils'

interface TagDetail {
    tag: MetricTag
    kpis: Array<{
        id: string
        title: string
        unit_of_measurement: string
        metric_type: 'number' | 'percentage'
        initiative_id: string
    }>
    claims: Array<{
        id: string
        kpi_id: string
        value: number
        date_represented: string
        label?: string
        location_id?: string
        created_at: string
    }>
    evidence?: Evidence[]
}

export default function TagDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [data, setData] = useState<TagDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [editName, setEditName] = useState('')
    const [previewEvidence, setPreviewEvidence] = useState<Evidence | null>(null)

    const load = async () => {
        if (!id) return
        try {
            setLoading(true)
            const res = await apiService.getMetricTagDetail(id)
            setData(res as any)
            setEditName(res.tag.name)
        } catch (e) {
            toast.error((e as Error).message || 'Failed to load tag')
            setData(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [id])

    const saveName = async () => {
        if (!id || !editName.trim()) return
        try {
            await apiService.updateMetricTag(id, { name: editName.trim() })
            setEditing(false)
            await load()
            toast.success('Tag updated')
        } catch (e) {
            toast.error((e as Error).message || 'Failed to update tag')
        }
    }

    const deleteTag = async () => {
        if (!id || !data) return
        const total = (data.kpis.length || 0) + (data.claims.length || 0)
        const msg = total > 0
            ? `Delete tag "${data.tag.name}"?\n\nIt's currently attached to ${data.kpis.length} metric(s) and ${data.claims.length} claim(s). They will become untagged but keep all their data.`
            : `Delete tag "${data.tag.name}"?`
        if (!window.confirm(msg)) return
        try {
            await apiService.deleteMetricTag(id)
            toast.success('Tag deleted')
            navigate('/')
        } catch (e) {
            toast.error((e as Error).message || 'Failed to delete tag')
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen pt-24 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="animate-pulse text-gray-400">Loading...</div>
                </div>
            </div>
        )
    }

    if (!data) {
        return (
            <div className="min-h-screen pt-24 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <p className="text-gray-500">Tag not found.</p>
                </div>
            </div>
        )
    }

    const claimsByKpi = data.claims.reduce<Record<string, TagDetail['claims']>>((acc, c) => {
        if (!acc[c.kpi_id]) acc[c.kpi_id] = []
        acc[c.kpi_id].push(c)
        return acc
    }, {})

    const evidence = Array.isArray(data.evidence) ? data.evidence : []
    const kpiTitleById = new Map(data.kpis.map(k => [k.id, k.title]))

    // Group evidence by metric. An evidence item can support multiple KPIs;
    // for display we surface it under each KPI it supports that is also tagged.
    const evidenceByKpi: Record<string, Evidence[]> = {}
    const ungroupedEvidence: Evidence[] = []
    for (const ev of evidence) {
        const kpiIds = (ev.kpi_ids || []).filter(id => kpiTitleById.has(id))
        if (kpiIds.length === 0) {
            ungroupedEvidence.push(ev)
            continue
        }
        for (const kid of kpiIds) {
            if (!evidenceByKpi[kid]) evidenceByKpi[kid] = []
            evidenceByKpi[kid].push(ev)
        }
    }

    const getTypeIcon = (type?: string) => {
        switch (type) {
            case 'visual_proof': return Camera
            case 'documentation': return FileText
            case 'testimony': return MessageSquare
            case 'financials': return DollarSign
            default: return FileText
        }
    }

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>

                <div className="bg-white rounded-2xl ring-1 ring-gray-900/[0.04] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] overflow-hidden mb-6">
                    <div className="px-6 py-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-12 h-12 rounded-xl bg-primary-50 ring-1 ring-primary-100/50 flex items-center justify-center flex-shrink-0">
                                <TagIcon className="w-6 h-6 text-primary-600" />
                            </div>
                            {editing ? (
                                <div className="flex items-center gap-2 flex-1">
                                    <input
                                        autoFocus
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setEditing(false); setEditName(data.tag.name) } }}
                                        className="px-3 py-1.5 text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                                    />
                                    <button onClick={saveName} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Save"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => { setEditing(false); setEditName(data.tag.name) }} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Cancel"><X className="w-4 h-4" /></button>
                                </div>
                            ) : (
                                <div className="min-w-0">
                                    <h1 className="text-2xl font-bold text-gray-900 truncate">{data.tag.name}</h1>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {data.kpis.length} metric{data.kpis.length !== 1 ? 's' : ''} · {data.claims.length} claim{data.claims.length !== 1 ? 's' : ''}
                                        {Array.isArray(data.evidence) && data.evidence.length > 0 && ` · ${data.evidence.length} evidence`}
                                    </p>
                                </div>
                            )}
                        </div>
                        {!editing && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button onClick={() => setEditing(true)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Rename"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={deleteTag} className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl ring-1 ring-gray-900/[0.04] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-b from-gray-50/50 to-transparent">
                        <h2 className="text-sm font-semibold text-gray-900">Metrics using this tag</h2>
                    </div>
                    {data.kpis.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-500">
                            No metrics are tagged with "{data.tag.name}" yet. Open a metric and add this tag to start tracking sub-totals here.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {data.kpis.map(kpi => {
                                const claims = claimsByKpi[kpi.id] || []
                                const tagged = aggregateKpiUpdates(claims, kpi.metric_type)
                                return (
                                    <Link
                                        key={kpi.id}
                                        to={`/initiatives/${kpi.initiative_id}/metrics/${kpi.id}`}
                                        className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{kpi.title}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {claims.length} tagged claim{claims.length !== 1 ? 's' : ''}
                                                {kpi.metric_type === 'percentage' ? ' · averaged' : ' · summed'}
                                            </p>
                                        </div>
                                        <div className="flex items-baseline gap-1.5 px-3 py-1.5 bg-primary-50 rounded-lg border border-primary-100 flex-shrink-0">
                                            <span className="text-lg font-bold text-primary-600">{tagged.toLocaleString()}</span>
                                            {kpi.unit_of_measurement && <span className="text-xs text-primary-500">{kpi.unit_of_measurement}</span>}
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>

                {evidence.length > 0 && (
                    <div className="mt-6 bg-white rounded-2xl ring-1 ring-gray-900/[0.04] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-b from-gray-50/50 to-transparent flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-gray-900">Evidence with this tag</h2>
                            <span className="text-xs text-gray-500">{evidence.length} item{evidence.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {data.kpis.map(kpi => {
                                const evs = evidenceByKpi[kpi.id] || []
                                if (evs.length === 0) return null
                                return (
                                    <div key={kpi.id} className="px-6 py-4">
                                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">{kpi.title}</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {evs.map(ev => {
                                                const TypeIcon = getTypeIcon(ev.type)
                                                const typeInfo = getEvidenceTypeInfo(ev.type)
                                                const bg = typeInfo.color.split(' ')[0]
                                                return (
                                                    <button
                                                        key={ev.id}
                                                        type="button"
                                                        onClick={() => setPreviewEvidence(ev)}
                                                        className="text-left bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition-all p-3 flex gap-3 items-start"
                                                    >
                                                        <div className={`p-2 rounded-lg ${bg} flex-shrink-0`}>
                                                            <TypeIcon className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold text-gray-900 truncate">{ev.title || 'Untitled'}</p>
                                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                                                {ev.date_range_start && ev.date_range_end
                                                                    ? `${formatDate(ev.date_range_start)} – ${formatDate(ev.date_range_end)}`
                                                                    : formatDate(ev.date_represented)}
                                                            </p>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                            {ungroupedEvidence.length > 0 && (
                                <div className="px-6 py-4">
                                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Other evidence</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {ungroupedEvidence.map(ev => {
                                            const TypeIcon = getTypeIcon(ev.type)
                                            const typeInfo = getEvidenceTypeInfo(ev.type)
                                            const bg = typeInfo.color.split(' ')[0]
                                            return (
                                                <button
                                                    key={ev.id}
                                                    type="button"
                                                    onClick={() => setPreviewEvidence(ev)}
                                                    className="text-left bg-white rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition-all p-3 flex gap-3 items-start"
                                                >
                                                    <div className={`p-2 rounded-lg ${bg} flex-shrink-0`}>
                                                        <TypeIcon className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold text-gray-900 truncate">{ev.title || 'Untitled'}</p>
                                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                                            {ev.date_range_start && ev.date_range_end
                                                                ? `${formatDate(ev.date_range_start)} – ${formatDate(ev.date_range_end)}`
                                                                : formatDate(ev.date_represented)}
                                                        </p>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {previewEvidence && (
                <EvidencePreviewModal
                    isOpen={!!previewEvidence}
                    onClose={() => setPreviewEvidence(null)}
                    evidence={previewEvidence}
                />
            )}
        </div>
    )
}
