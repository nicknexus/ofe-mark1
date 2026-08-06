import React, { useState, useEffect, useMemo } from 'react'
import { BarChart3, Trash2, Search, Globe2, Plus } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from './ModalFrame'
import { CreateKPIForm, MetricDefinitionWithUsage } from '../types'
import TagPicker from './MetricTags/TagPicker'
import { apiService } from '../services/api'
import { notify } from '../lib/notify'

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
  // Metrics are org-global, so an initiative can either define a new one or
  // pick up one the org already tracks. Editing skips the choice entirely.
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [definitions, setDefinitions] = useState<MetricDefinitionWithUsage[]>([])
  const [definitionsLoading, setDefinitionsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [attaching, setAttaching] = useState<string | null>(null)
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
    return definitions
      .filter(d => !d.initiatives.some(u => u.initiative_id === initiativeId))
      .filter(d => !q || d.title.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q))
  }, [definitions, initiativeId, search])

  const attachExisting = async (definition: MetricDefinitionWithUsage) => {
    setAttaching(definition.id)
    try {
      await apiService.addMetricToInitiative(definition.id, initiativeId)
      notify.success(`"${definition.title}" added to this initiative`)
      onAttached?.()
      onClose()
    } catch (err) {
      notify.error((err as Error).message || 'Failed to add metric')
    } finally {
      setAttaching(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
    <ModalFrame zIndexClass="z-[60]" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
        <ModalHeader
          icon={BarChart3}
          title={editData ? 'Edit metric' : 'Add metric'}
          subtitle={
            editData
              ? 'Changes apply everywhere this metric is used'
              : 'Create a new metric, or reuse one your organization already tracks'
          }
          onClose={onClose}
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
            <ModalBody rail>
              <div className="relative mb-3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your organization's metrics…"
                  className="w-full h-9 pl-10 pr-3 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {definitionsLoading ? (
                <p className="text-sm text-gray-400 py-8 text-center">Loading metrics…</p>
              ) : availableDefinitions.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">
                  {definitions.length === 0
                    ? 'Your organization has no other metrics yet.'
                    : search.trim()
                      ? `No metrics match "${search}".`
                      : 'Every metric your organization tracks is already on this initiative.'}
                </p>
              ) : (
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                  {availableDefinitions.map(definition => (
                    <button
                      key={definition.id}
                      type="button"
                      onClick={() => attachExisting(definition)}
                      disabled={attaching !== null}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-primary-50/50 transition-colors disabled:opacity-50"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">
                          {definition.title}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {definition.metric_type === 'percentage' ? 'Percentage' : definition.unit_of_measurement}
                          {definition.initiative_count > 0 && (
                            <> · in {definition.initiative_count} initiative{definition.initiative_count === 1 ? '' : 's'}</>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-primary-600 flex-shrink-0">
                        {attaching === definition.id ? 'Adding…' : 'Add'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <button type="button" onClick={onClose} className="app-btn app-btn-ghost">
                Cancel
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
