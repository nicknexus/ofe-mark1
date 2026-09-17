import React, { useState, useEffect, useMemo } from 'react'
import { BarChart3, Trash2, Search, Globe2, Plus, Check } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from './ModalFrame'
import { CreateKPIForm, MetricDefinitionWithUsage } from '../types'
import TagPicker from './MetricTags/TagPicker'
import { apiService } from '../services/api'
import { notify } from '../lib/notify'
import { useTeam } from '../context/TeamContext'
import { EmptyState, SectionLoader } from './ui'
import { getKPIColor } from './metricsDashboard/metricColorPalette'

interface CreateKPIModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateKPIForm) => Promise<void>
  initiativeId: string
  editData?: any // Optional prop for editing existing KPI
  /** Edit mode only: opens the typed-confirmation delete flow. */
  onDelete?: () => void
  /** Called after an existing org-global metric is attached to this initiative. */
  onAttached?: () => void
}

const CATEGORIES = [
  { value: 'input', label: 'Input', desc: 'Resources going in' },
  { value: 'output', label: 'Output', desc: 'Direct results' },
  { value: 'impact', label: 'Impact', desc: 'Long-term effects' },
] as const

export default function CreateKPIModal({
  isOpen,
  onClose,
  onSubmit,
  initiativeId,
  editData,
  onDelete,
  onAttached,
}: CreateKPIModalProps) {
  const { activeOrganization } = useTeam()
  const orgLogoUrl = activeOrganization?.logo_url
  // Metrics are org-global, so an initiative can either define a new one or
  // pick up one the org already tracks. Editing skips the choice entirely.
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [definitions, setDefinitions] = useState<MetricDefinitionWithUsage[]>([])
  const [definitionsLoading, setDefinitionsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [attaching, setAttaching] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [addedIds, setAddedIds] = useState<string[]>([])
  const [formData, setFormData] = useState<CreateKPIForm>({
    title: editData?.title || '',
    description: editData?.description || '',
    metric_type: editData?.metric_type || 'number',
    unit_of_measurement: editData?.unit_of_measurement || '',
    category: editData?.category || 'output',
    initiative_id: initiativeId,
    tag_ids: Array.isArray(editData?.tag_ids) ? editData.tag_ids : [],
  })
  const [tagIds, setTagIds] = useState<string[]>(Array.isArray(editData?.tag_ids) ? editData.tag_ids : [])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (editData) {
      setTagIds(Array.isArray(editData?.tag_ids) ? editData.tag_ids : [])
    }
  }, [editData])

  useEffect(() => {
    if (!isOpen) {
      setMode('new')
      setSearch('')
      setSelectedIds([])
      setAddedIds([])
      setAttaching(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || mode !== 'existing' || editData) return
    let cancelled = false
    setDefinitionsLoading(true)
    apiService.getMetricDefinitions()
      .then(defs => { if (!cancelled) setDefinitions(defs) })
      .catch(err => { if (!cancelled) notify.error((err as Error).message || 'Failed to load metrics') })
      .finally(() => { if (!cancelled) setDefinitionsLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, mode, editData])

  // Anything not already on this initiative is fair game — including metrics
  // that were archived here before, which come back with their claims intact.
  const availableDefinitions = useMemo(() => {
    const q = search.trim().toLowerCase()
    const added = new Set(addedIds)
    return definitions
      .filter(d => !added.has(d.id) && !d.initiatives.some(u => u.initiative_id === initiativeId))
      .filter(d => !q || d.title.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q))
  }, [definitions, initiativeId, search, addedIds])

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const finish = () => {
    if (addedIds.length > 0) onAttached?.()
    onClose()
  }

  const attachSelected = async () => {
    if (selectedIds.length === 0 || attaching) return
    setAttaching(true)
    const picked = definitions.filter(d => selectedIds.includes(d.id))
    const results = await Promise.allSettled(
      picked.map(definition => apiService.addMetricToInitiative(definition.id, initiativeId))
    )
    const ok = picked.filter((_, i) => results[i].status === 'fulfilled').map(d => d.id)
    const failed = results.filter(r => r.status === 'rejected').length
    if (ok.length > 0) {
      setAddedIds(prev => [...prev, ...ok])
      setSelectedIds(prev => prev.filter(id => !ok.includes(id)))
      notify.success(ok.length === 1
        ? `"${picked.find(d => d.id === ok[0])?.title || 'Metric'}" added to this program`
        : `${ok.length} metrics added to this program`)
    }
    if (failed > 0) notify.error(failed === 1 ? 'Could not add 1 metric' : `Could not add ${failed} metrics`)
    setAttaching(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'existing' && !editData) return
    setLoading(true)

    try {
      await onSubmit({ ...formData, tag_ids: tagIds })
      if (!editData) {
        setFormData({
          title: '',
          description: '',
          metric_type: 'number',
          unit_of_measurement: '',
          category: 'output',
          initiative_id: initiativeId,
          tag_ids: [],
        })
        setTagIds([])
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  if (!isOpen) return null

  return (
    <ModalFrame
      zIndexClass="z-[60]"
      size="md"
      paddingClassName="p-0 md:p-4"
      panelClassName={`bg-white w-full h-full max-h-[100dvh] overflow-hidden flex flex-col rounded-none border-0 shadow-none md:rounded-xl md:border md:border-gray-200 md:shadow-app-modal md:h-auto md:max-h-[90vh] ${
        mode === 'existing' && !editData ? 'md:max-w-4xl' : 'md:max-w-2xl'
      }`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
        <ModalHeader
          icon={BarChart3}
          title={editData ? 'Edit metric' : 'Add metric'}
          subtitle={
            editData
              ? 'Changes apply everywhere this metric is used'
              : 'Create a new metric, or reuse one your organization already tracks'
          }
          onClose={mode === 'existing' && !editData ? finish : onClose}
        />

        {!editData && (
          <div className="px-5 pt-3 flex items-center gap-1 border-b border-gray-100">
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                mode === 'new'
                  ? 'border-primary-500 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              Create new
            </button>
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                mode === 'existing'
                  ? 'border-primary-500 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              Add existing
            </button>
          </div>
        )}

        {mode === 'existing' && !editData ? (
          <>
            <ModalBody>
              <div className="relative max-w-sm mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search metrics…"
                  className="app-input h-9 !pl-10 !rounded-full"
                />
              </div>

              {definitionsLoading ? (
                <SectionLoader label="Loading metrics" />
              ) : availableDefinitions.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title={
                    definitions.length === 0
                      ? 'No other metrics yet'
                      : search.trim()
                        ? `No metrics match "${search}"`
                        : 'Every metric is already on this program'
                  }
                  description={
                    definitions.length === 0
                      ? 'Create a new one instead, or add metrics from the org library.'
                      : undefined
                  }
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableDefinitions.map((definition, index) => {
                    const color = getKPIColor(definition.category, index)
                    const isPct = definition.metric_type === 'percentage'
                    const selected = selectedIds.includes(definition.id)
                    const unused = definition.initiative_count === 0
                    return (
                      <button
                        key={definition.id}
                        type="button"
                        onClick={() => toggleSelected(definition.id)}
                        disabled={attaching}
                        className={`app-tile p-4 text-left flex flex-col group relative disabled:opacity-50 ${
                          selected ? 'border-primary-400 ring-2 ring-primary-200' : ''
                        }`}
                      >
                        <span className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-md border flex items-center justify-center ${
                          selected ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'
                        }`}>
                          <Check className="w-3 h-3" />
                        </span>
                        <div className="flex items-start gap-2 pr-10 mb-3">
                          <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: color }} />
                          <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2" title={definition.title}>
                            {definition.title}
                          </p>
                        </div>
                        <div className="flex items-baseline gap-1.5 min-w-0 mb-3">
                          <span className="text-2xl font-semibold text-gray-900 tabular-nums">
                            {isPct ? `${Math.round(definition.total_value)}%` : definition.total_value.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-400 truncate">
                            {isPct ? 'average' : definition.unit_of_measurement}
                          </span>
                          <span className="ml-auto text-[11px] text-gray-400 capitalize flex-shrink-0">
                            {definition.category}
                          </span>
                        </div>
                        <div className="mt-auto pt-2.5 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                          {unused ? (
                            <span className="inline-flex items-center rounded-full border border-dashed border-gray-200 px-2 py-0.5 text-[11px] text-gray-400">
                              Not in any program yet
                            </span>
                          ) : (
                            definition.initiatives.slice(0, 2).map(usage => (
                              <span
                                key={usage.initiative_id}
                                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 pl-1 pr-1.5 py-0.5 text-[11px] font-medium text-gray-600 max-w-full"
                              >
                                <span className="w-4 h-4 rounded bg-white ring-1 ring-gray-200/80 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                  <img
                                    src={orgLogoUrl || '/Nexuslogo.png'}
                                    alt=""
                                    className="w-full h-full object-contain"
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Nexuslogo.png' }}
                                  />
                                </span>
                                <span className="truncate max-w-[8rem]">{usage.initiative_title}</span>
                              </span>
                            ))
                          )}
                          {definition.initiatives.length > 2 && (
                            <span className="text-[11px] text-gray-400">+{definition.initiatives.length - 2}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <button type="button" onClick={finish} className="app-btn app-btn-secondary">
                {addedIds.length > 0 ? 'Done' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={attachSelected}
                disabled={selectedIds.length === 0 || attaching}
                className="app-btn app-btn-primary"
              >
                {attaching
                  ? 'Adding…'
                  : selectedIds.length === 0
                    ? 'Add metrics'
                    : `Add ${selectedIds.length} metric${selectedIds.length === 1 ? '' : 's'}`}
              </button>
            </ModalFooter>
          </>
        ) : (
        <>
        <ModalBody rail>
          <div className="flex flex-col gap-8">
          <div>
            <label htmlFor="kpi-title" className="app-label">
              Metric title <span className="text-red-500">*</span>
            </label>
            <input
              id="kpi-title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="app-input"
              placeholder="e.g. Students trained, Wells built"
              required
            />
          </div>

          <div>
            <label htmlFor="kpi-description" className="app-label">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="kpi-description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="app-input resize-none"
              rows={3}
              placeholder="Describe what this metric measures…"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="kpi-metric-type" className="app-label">
                Metric type <span className="text-red-500">*</span>
              </label>
              <select
                id="kpi-metric-type"
                name="metric_type"
                value={formData.metric_type}
                onChange={handleInputChange}
                className="app-input"
                required
              >
                <option value="number">Number</option>
                <option value="percentage">Percentage</option>
              </select>
            </div>

            <div>
              <label htmlFor="kpi-unit" className="app-label">
                Unit <span className="text-red-500">*</span>
              </label>
              <input
                id="kpi-unit"
                type="text"
                name="unit_of_measurement"
                value={formData.unit_of_measurement}
                onChange={handleInputChange}
                className="app-input"
                placeholder="People, hours, USD…"
                required
              />
            </div>
          </div>

          <div>
            <p className="app-label mb-3">
              Category <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {CATEGORIES.map((category) => {
                const active = formData.category === category.value
                return (
                  <label
                    key={category.value}
                    className={`relative flex flex-col p-4 rounded-2xl border cursor-pointer transition-colors ${
                      active
                        ? 'border-primary-500 bg-primary-50 shadow-card'
                        : 'border-gray-200/70 bg-white hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={category.value}
                      checked={active}
                      onChange={handleInputChange}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold text-gray-900">{category.label}</span>
                    <span className="text-xs text-gray-500 mt-1">{category.desc}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <TagPicker
              mode="multi"
              selectedIds={tagIds}
              onChange={setTagIds}
              label="Metric tags (optional)"
              helperText="Tags act as sub-metrics. Attach the ones impact claims on this metric will be grouped under (e.g. Grade 1, Grade 2)."
            />
          </div>
          </div>
        </ModalBody>

        <ModalFooter>
          {editData && onDelete && (
            <button type="button" onClick={onDelete} disabled={loading} className="app-btn app-btn-danger mr-auto">
              <Trash2 className="w-4 h-4" />
              Delete metric
            </button>
          )}
          <button type="button" onClick={onClose} disabled={loading} className="app-btn app-btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="app-btn app-btn-primary">
            {loading ? (editData ? 'Updating…' : 'Creating…') : (editData ? 'Update metric' : 'Add metric')}
          </button>
        </ModalFooter>
        </>
        )}
      </form>
    </ModalFrame>
  )
}
