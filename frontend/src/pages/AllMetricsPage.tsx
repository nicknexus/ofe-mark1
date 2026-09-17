import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Plus, Search, Layers, Edit2, X, AlertTriangle, ChevronRight } from 'lucide-react'
import { notify } from '../lib/notify'
import { apiService } from '../services/api'
import { CreateMetricDefinitionForm, Initiative, MetricDefinitionWithUsage } from '../types'
import { getKPIColor } from '../components/metricsDashboard/metricColorPalette'
import MetricDefinitionModal from '../components/MetricDefinitionModal'
import AddMetricToInitiativeModal from '../components/AddMetricToInitiativeModal'
import ConfirmDialog from '../components/ConfirmDialog'
import ModalFrame from '../components/ModalFrame'
import { SectionLoader, EmptyState, PageHeader } from '../components/ui'
import { MetricsHelp } from '../components/tracking/TrackingHelp'
import { useTeam } from '../context/TeamContext'

/**
 * The org's global metrics.
 *
 * Totals here are pooled across every initiative using a metric — the server
 * aggregates the underlying claims rather than summing subtotals, so
 * percentage metrics stay correct.
 */
function scoreMetricSearch(d: MetricDefinitionWithUsage, q: string): number {
  const title = d.title.toLowerCase()
  const desc = (d.description || '').toLowerCase()
  const inits = d.initiatives.map(i => i.initiative_title.toLowerCase())
  const tokens = q.split(/\s+/).filter(Boolean)
  const hay = `${title} ${desc} ${inits.join(' ')}`
  if (!tokens.every(t => hay.includes(t))) return 0

  if (title === q) return 100
  if (title.startsWith(q)) return 90

  const titleWords = title.split(/[^a-z0-9]+/).filter(Boolean)
  if (tokens.every(t => titleWords.some(w => w.startsWith(t)))) return 85
  if (tokens.every(t => title.includes(t))) return 70
  if (titleWords.some(w => w.startsWith(q)) || title.includes(q)) return 55

  if (inits.some(t => t === q || t.startsWith(q) || t.split(/[^a-z0-9]+/).some(w => w.startsWith(q)))) return 35
  if (desc.includes(q) || tokens.every(t => desc.includes(t))) return 20
  return 15
}

export default function AllMetricsPage() {
  const { canAddMetrics, canEditMetrics, canDelete, activeOrganization } = useTeam()
  const orgLogoUrl = activeOrganization?.logo_url

  const [definitions, setDefinitions] = useState<MetricDefinitionWithUsage[]>([])
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<MetricDefinitionWithUsage | undefined>()
  const [attachTarget, setAttachTarget] = useState<MetricDefinitionWithUsage | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<MetricDefinitionWithUsage | null>(null)
  const [detachConfirm, setDetachConfirm] = useState<{
    definition: MetricDefinitionWithUsage
    initiativeId: string
    initiativeTitle: string
    claimCount: number
    evidenceCount: number
  } | null>(null)
  const [detachConfirmText, setDetachConfirmText] = useState('')

  const load = useCallback(async () => {
    try {
      const [defs, inits] = await Promise.all([
        apiService.getMetricDefinitions(),
        apiService.getInitiatives(),
      ])
      setDefinitions(defs)
      setInitiatives(inits)
    } catch (err) {
      notify.error((err as Error).message || 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return definitions
    return definitions
      .map(d => ({ d, score: scoreMetricSearch(d, q) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.d)
  }, [definitions, search])

  const inUseCount = definitions.filter(d => d.initiative_count > 0).length

  const handleSubmit = async (data: CreateMetricDefinitionForm) => {
    if (editing) {
      await apiService.updateMetricDefinition(editing.id, data)
      notify.success('Metric updated')
    } else {
      await apiService.createMetricDefinition(data)
      notify.success('Metric created')
    }
    await load()
  }

  const attach = async (definition: MetricDefinitionWithUsage, initiativeId: string) => {
    try {
      await apiService.addMetricToInitiative(definition.id, initiativeId)
      notify.success('Metric added to program')
      setAttachTarget(null)
      await load()
    } catch (err) {
      notify.error((err as Error).message || 'Failed to add metric')
    }
  }

  // Ask the server what the removal would hide so the confirmation can be
  // specific — the whole point of archiving is that nothing is lost.
  const requestDetach = async (
    definition: MetricDefinitionWithUsage,
    initiativeId: string,
    initiativeTitle: string
  ) => {
    try {
      const impact = await apiService.getMetricDetachImpact(definition.id, initiativeId)
      setDetachConfirm({
        definition,
        initiativeId,
        initiativeTitle,
        claimCount: impact.claim_count,
        evidenceCount: impact.evidence_count,
      })
    } catch (err) {
      notify.error((err as Error).message || 'Failed to check metric usage')
    }
  }

  const detach = async () => {
    if (!detachConfirm) return
    try {
      await apiService.removeMetricFromInitiative(
        detachConfirm.definition.id,
        detachConfirm.initiativeId
      )
      notify.success(`Removed from ${detachConfirm.initiativeTitle}`)
      setDetachConfirm(null)
      setDetachConfirmText('')
      await load()
    } catch (err) {
      notify.error((err as Error).message || 'Failed to remove metric')
    }
  }

  const remove = async () => {
    if (!deleteConfirm) return
    try {
      await apiService.deleteMetricDefinition(deleteConfirm.id)
      notify.success('Metric deleted')
      setDeleteConfirm(null)
      setShowModal(false)
      setEditing(undefined)
      await load()
    } catch (err) {
      notify.error((err as Error).message || 'Failed to delete metric')
    }
  }

  const addButton = canAddMetrics ? (
    <button
      type="button"
      onClick={() => { setEditing(undefined); setShowModal(true) }}
      className="app-btn app-btn-primary app-btn-sm"
    >
      <Plus className="w-4 h-4" />
      New metric
    </button>
  ) : undefined

  return (
    <div className="min-h-screen app-canvas pt-8 pb-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="Metrics"
          subtitle={`${definitions.length} metric${definitions.length !== 1 ? 's' : ''}${definitions.length > 0 ? ` · ${inUseCount} in use` : ''}. Shared across programs. Create them here or from any program's Set up.`}
          help={<MetricsHelp />}
          actions={addButton}
        />

        <div className="relative max-w-sm mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search metrics…"
            className="app-input h-9 !pl-10 !rounded-full"
          />
        </div>

        {loading ? (
          <SectionLoader />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title={definitions.length === 0 ? 'No metrics yet' : `No metrics match "${search}"`}
            description={
              definitions.length === 0
                ? 'Metrics are shared across programs. Create one here or attach it from a program\'s Set up.'
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((definition, index) => {
              const color = getKPIColor(definition.category, index)
              const unused = definition.initiative_count === 0

              return (
                <div key={definition.id} className="app-tile p-4 flex flex-col group relative">
                  {/* Top-right: edit on hover + open indicator */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5">
                    {canEditMetrics && (
                      <button
                        type="button"
                        onClick={() => { setEditing(definition); setShowModal(true) }}
                        className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                        title="Edit metric"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-200" />
                  </div>

                  <div className="flex items-start gap-2 pr-10 mb-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: color }} />
                    <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2" title={definition.title}>
                      {definition.title}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1.5 min-w-0 mb-3">
                    <span className="text-2xl font-semibold text-gray-900 tabular-nums">
                      {definition.metric_type === 'percentage'
                        ? `${Math.round(definition.total_value)}%`
                        : definition.total_value.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400 truncate">
                      {definition.metric_type === 'percentage' ? 'average' : definition.unit_of_measurement}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-400 flex-shrink-0" title={`${definition.update_count} claims`}>
                      <Layers className="w-3 h-3" />
                      {definition.initiative_count} program{definition.initiative_count === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Programs using this metric, as chips */}
                  <div className="mt-auto pt-2.5 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                    {unused ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-200 px-2 py-0.5 text-[11px] text-gray-400">
                        Not in any program yet
                      </span>
                    ) : (
                      definition.initiatives.map(usage => (
                        <span
                          key={usage.initiative_id}
                          className="group/chip inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 pl-1 pr-1.5 py-0.5 text-[11px] font-medium text-gray-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-900 transition-colors max-w-full"
                        >
                          <Link to={`/programs/${usage.initiative_id}?tab=metrics`} className="inline-flex items-center gap-1 min-w-0" title={usage.initiative_title}>
                            <span className="w-4 h-4 rounded bg-white ring-1 ring-gray-200/80 overflow-hidden flex-shrink-0 flex items-center justify-center">
                              <img
                                src={orgLogoUrl || '/Nexuslogo.png'}
                                alt=""
                                className="w-full h-full object-contain"
                                onError={(e) => { ;(e.currentTarget as HTMLImageElement).src = '/Nexuslogo.png' }}
                              />
                            </span>
                            <span className="truncate max-w-[9rem]">{usage.initiative_title}</span>
                          </Link>
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => requestDetach(definition, usage.initiative_id, usage.initiative_title)}
                              className="p-0.5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/chip:opacity-100 focus:opacity-100 transition-all"
                              title={`Remove from ${usage.initiative_title}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))
                    )}
                    {canAddMetrics && (
                      <button
                        type="button"
                        onClick={() => setAttachTarget(definition)}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-500 hover:text-primary-800 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add to program
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {attachTarget && (
        <AddMetricToInitiativeModal
          isOpen
          onClose={() => setAttachTarget(null)}
          metricTitle={attachTarget.title}
          initiatives={initiatives}
          attachedInitiativeIds={attachTarget.initiatives.map(u => u.initiative_id)}
          onSelect={(initiativeId) => attach(attachTarget, initiativeId)}
          orgLogoUrl={orgLogoUrl}
        />
      )}

      <MetricDefinitionModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditing(undefined) }}
        onSubmit={handleSubmit}
        editData={editing}
        initiatives={initiatives}
        onDelete={editing && canDelete ? () => setDeleteConfirm(editing) : undefined}
      />

      {detachConfirm && (
        <ModalFrame
          zIndexClass="z-[70]"
          backdropClassName="bg-black/40 backdrop-blur-sm"
          panelClassName="bg-white rounded-xl max-w-md w-full p-6 shadow-card-lg border border-gray-100"
        >
          <div className="flex items-start gap-4 mb-5">
            <div className="app-icon-tile">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Remove metric</h3>
              <p className="text-sm text-gray-500">
                From "{detachConfirm.initiativeTitle}"
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            <strong className="text-gray-800">"{detachConfirm.definition.title}"</strong> will be
            unlinked from this program and disappear from its dashboard, its totals and your
            public pages.
          </p>

          {(detachConfirm.claimCount > 0 || detachConfirm.evidenceCount > 0) && (
            <ul className="text-sm text-gray-600 mb-3 space-y-1 pl-4 list-disc marker:text-gray-300">
              {detachConfirm.claimCount > 0 && (
                <li>
                  <strong className="text-gray-800 tabular-nums">{detachConfirm.claimCount}</strong>{' '}
                  impact claim{detachConfirm.claimCount === 1 ? '' : 's'} will be unlinked
                </li>
              )}
              {detachConfirm.evidenceCount > 0 && (
                <li>
                  <strong className="text-gray-800 tabular-nums">{detachConfirm.evidenceCount}</strong>{' '}
                  evidence link{detachConfirm.evidenceCount === 1 ? '' : 's'} will be unlinked
                </li>
              )}
            </ul>
          )}

          {/* Accurate, not scary-for-the-sake-of-it: this is a reversible
              archive by design, so we say so rather than claiming otherwise. */}
          <p className="text-xs text-gray-500 mb-5">
            Nothing is permanently deleted — adding the metric back to this program restores its
            claims and evidence. The metric itself stays in your other programs.
          </p>

          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">REMOVE THIS METRIC</span> to confirm:
            </label>
            <input
              type="text"
              autoFocus
              value={detachConfirmText}
              onChange={(e) => setDetachConfirmText(e.target.value)}
              placeholder="REMOVE THIS METRIC"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setDetachConfirm(null); setDetachConfirmText('') }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all duration-200"
            >
              Cancel
            </button>
            <button
              onClick={detach}
              disabled={detachConfirmText !== 'REMOVE THIS METRIC'}
              className="app-btn app-btn-danger flex-1"
            >
              Remove metric
            </button>
          </div>
        </ModalFrame>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="Delete metric everywhere?"
          message={
            `"${deleteConfirm.title}" and all of its impact claims will be permanently deleted from ` +
            `${deleteConfirm.initiative_count} program${deleteConfirm.initiative_count === 1 ? '' : 's'}. ` +
            `This cannot be undone — to remove it from a single program, use the × next to that program instead.`
          }
          confirmLabel="Delete permanently"
          tone="danger"
          onConfirm={remove}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}
