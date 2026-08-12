import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Plus, Search, Layers, Edit2 } from 'lucide-react'
import { notify } from '../../lib/notify'
import { apiService } from '../../services/api'
import { CreateMetricDefinitionForm, Initiative, MetricDefinitionWithUsage } from '../../types'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'
import MetricDefinitionModal from '../MetricDefinitionModal'
import AddMetricToInitiativeModal from '../AddMetricToInitiativeModal'
import { EmptyState, SectionLoader } from '../ui'
import { useTeam } from '../../context/TeamContext'
import { fadeUp, staggerContainer, tapScaleSoft } from './motion'

interface MobileOrgMetricsTabProps {
  /** Jump into an initiative that uses this metric (mobile has no /initiatives/:id route). */
  onEnterInitiative?: (initiative: Initiative) => void
}

/**
 * Org-global metrics for the PWA — same data as the desktop dashboard strip /
 * All Metrics page: pooled totals, create metric, attach to initiatives.
 */
export default function MobileOrgMetricsTab({ onEnterInitiative }: MobileOrgMetricsTabProps) {
  const { canAddMetrics, canEditMetrics, activeOrganization } = useTeam()
  const orgLogoUrl = activeOrganization?.logo_url

  const [definitions, setDefinitions] = useState<MetricDefinitionWithUsage[]>([])
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<MetricDefinitionWithUsage | undefined>()
  const [attachTarget, setAttachTarget] = useState<MetricDefinitionWithUsage | null>(null)

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
      setDefinitions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load, activeOrganization?.id])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = !q
      ? definitions
      : definitions.filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            (d.description || '').toLowerCase().includes(q) ||
            d.initiatives.some((i) => i.initiative_title.toLowerCase().includes(q)),
        )
    return [...list].sort((a, b) => {
      if (a.update_count > 0 !== b.update_count > 0) return a.update_count > 0 ? -1 : 1
      return b.total_value - a.total_value
    })
  }, [definitions, search])

  const inUseCount = definitions.filter((d) => d.initiative_count > 0).length

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
      notify.success('Metric added to initiative')
      setAttachTarget(null)
      await load()
    } catch (err) {
      notify.error((err as Error).message || 'Failed to add metric')
    }
  }

  const openInitiative = (initiativeId: string) => {
    const init = initiatives.find((i) => i.id === initiativeId)
    if (init && onEnterInitiative) onEnterInitiative(init)
  }

  return (
    <div className="px-4 pt-5 pb-2">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Metrics</h1>
          <p className="text-sm text-gray-500 mt-1">
            {definitions.length} metric{definitions.length !== 1 ? 's' : ''}
            {definitions.length > 0 && ` · ${inUseCount} in use`}
            {' · org-wide'}
          </p>
        </div>
        {canAddMetrics && (
          <motion.button
            type="button"
            whileTap={tapScaleSoft}
            onClick={() => {
              setEditing(undefined)
              setShowModal(true)
            }}
            className="app-btn app-btn-primary app-btn-sm shadow-card flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            New
          </motion.button>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search metrics…"
          className="w-full h-9 pl-10 pr-3 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <SectionLoader className="h-64" />
      ) : filtered.length === 0 ? (
        <EmptyState
          className="rounded-2xl border border-gray-200/70 bg-white shadow-card"
          icon={BarChart3}
          title={definitions.length === 0 ? 'No metrics yet' : `No metrics match "${search}"`}
          description={
            definitions.length === 0
              ? 'Create a metric here — it’s shared across every initiative in your organization.'
              : undefined
          }
          action={
            definitions.length === 0 && canAddMetrics ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(undefined)
                  setShowModal(true)
                }}
                className="app-btn app-btn-primary"
              >
                <Plus className="w-4 h-4" />
                New metric
              </button>
            ) : undefined
          }
        />
      ) : (
        <motion.div
          className="space-y-2.5"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {filtered.map((definition, index) => {
            const color = getKPIColor(definition.category, index)
            return (
              <motion.div
                key={definition.id}
                variants={fadeUp}
                className="rounded-2xl border border-gray-200/70 bg-white shadow-card p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <h3 className="text-sm font-semibold text-gray-900 truncate" title={definition.title}>
                      {definition.title}
                    </h3>
                  </div>
                  {canEditMetrics && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(definition)
                        setShowModal(true)
                      }}
                      className="p-1.5 -m-1 rounded-lg text-gray-300 active:bg-gray-50 active:text-gray-600"
                      aria-label="Edit metric"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-baseline gap-1.5 mb-3">
                  <span className="text-2xl font-semibold tabular-nums" style={{ color }}>
                    {definition.total_value.toLocaleString()}
                    {definition.metric_type === 'percentage' ? '%' : ''}
                  </span>
                  <span className="text-xs text-gray-400 truncate">
                    {definition.metric_type === 'percentage'
                      ? 'average'
                      : definition.unit_of_measurement}
                  </span>
                </div>

                {definition.initiative_count === 0 ? (
                  <p className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Not in any initiative yet
                  </p>
                ) : (
                  <div className="mb-3 space-y-1.5">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      In {definition.initiative_count} initiative
                      {definition.initiative_count === 1 ? '' : 's'}
                    </p>
                    {definition.initiatives.map((usage) => (
                      <button
                        key={usage.initiative_id}
                        type="button"
                        onClick={() => openInitiative(usage.initiative_id)}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-gray-200/70 bg-white text-left active:border-primary-300/70"
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white ring-1 ring-gray-100 overflow-hidden">
                          <img
                            src={orgLogoUrl || '/Nexuslogo.png'}
                            alt=""
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              ;(e.currentTarget as HTMLImageElement).src = '/Nexuslogo.png'
                            }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-900 truncate">
                          {usage.initiative_title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {canAddMetrics && (
                  <button
                    type="button"
                    onClick={() => setAttachTarget(definition)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 active:text-primary-800"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Add to initiative
                  </button>
                )}
              </motion.div>
            )
          })}

          {canAddMetrics && (
            <motion.button
              type="button"
              variants={fadeUp}
              whileTap={tapScaleSoft}
              onClick={() => {
                setEditing(undefined)
                setShowModal(true)
              }}
              className="w-full min-h-[72px] rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 active:border-primary-300 active:text-primary-700 active:bg-primary-50/40 flex flex-col items-center justify-center gap-1 text-xs font-medium"
            >
              <Plus className="w-4 h-4" />
              New metric
            </motion.button>
          )}
        </motion.div>
      )}

      {attachTarget && (
        <AddMetricToInitiativeModal
          isOpen
          onClose={() => setAttachTarget(null)}
          metricTitle={attachTarget.title}
          initiatives={initiatives}
          attachedInitiativeIds={attachTarget.initiatives.map((u) => u.initiative_id)}
          onSelect={(initiativeId) => attach(attachTarget, initiativeId)}
          orgLogoUrl={orgLogoUrl}
        />
      )}

      <MetricDefinitionModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditing(undefined)
        }}
        onSubmit={handleSubmit}
        editData={editing}
        initiatives={initiatives}
      />
    </div>
  )
}
