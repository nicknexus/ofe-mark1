import React, { useEffect, useState } from 'react'
import { BarChart3, Trash2, Globe2, Check } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from './ModalFrame'
import TagPicker from './MetricTags/TagPicker'
import { CreateMetricDefinitionForm, Initiative, MetricDefinitionWithUsage } from '../types'
import { useTeam } from '../context/TeamContext'

interface MetricDefinitionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateMetricDefinitionForm) => Promise<void>
  /** Present when editing an existing org-global metric. */
  editData?: MetricDefinitionWithUsage
  /** Offered as optional starting initiatives on create. */
  initiatives?: Initiative[]
  /** Edit mode only: opens the permanent org-wide delete flow. */
  onDelete?: () => void
}

const CATEGORIES = [
  { value: 'input', label: 'Input', desc: 'Resources going in' },
  { value: 'output', label: 'Output', desc: 'Direct results' },
  { value: 'impact', label: 'Impact', desc: 'Long-term effects' },
] as const

/**
 * Create / edit an org-global metric.
 *
 * Everything here is shared: renaming or re-describing applies to every
 * initiative using the metric, which the banner makes explicit whenever it's
 * used in more than one.
 */
export default function MetricDefinitionModal({
  isOpen,
  onClose,
  onSubmit,
  editData,
  initiatives = [],
  onDelete,
}: MetricDefinitionModalProps) {
  const { activeOrganization } = useTeam()
  const orgLogoUrl = activeOrganization?.logo_url
  const [formData, setFormData] = useState<CreateMetricDefinitionForm>({
    title: '',
    description: '',
    metric_type: 'number',
    unit_of_measurement: '',
    category: 'output',
    tag_ids: [],
    initiative_ids: [],
  })
  const [tagIds, setTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setFormData({
      title: editData?.title || '',
      description: editData?.description || '',
      metric_type: editData?.metric_type || 'number',
      unit_of_measurement: editData?.unit_of_measurement || '',
      category: editData?.category || 'output',
      tag_ids: editData?.tag_ids || [],
      initiative_ids: [],
    })
    setTagIds(editData?.tag_ids || [])
  }, [isOpen, editData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await onSubmit({ ...formData, tag_ids: tagIds })
      onClose()
    } catch (err) {
      setError((err as Error).message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const toggleInitiative = (id: string) => {
    setFormData(prev => {
      const current = prev.initiative_ids || []
      return {
        ...prev,
        initiative_ids: current.includes(id)
          ? current.filter(i => i !== id)
          : [...current, id],
      }
    })
  }

  if (!isOpen) return null

  const sharedCount = editData?.initiative_count ?? 0

  return (
    <ModalFrame
      zIndexClass="z-[60]"
      size="md"
      paddingClassName="p-0 md:p-4"
      panelClassName="bg-white w-full h-full max-h-[100dvh] overflow-hidden flex flex-col rounded-none border-0 shadow-none md:rounded-xl md:border md:border-gray-200 md:shadow-app-modal md:h-auto md:max-h-[90vh] md:max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
        <ModalHeader
          icon={BarChart3}
          title={editData ? 'Edit metric' : 'New metric'}
          subtitle={
            editData
              ? 'Changes apply everywhere this metric is used'
              : 'Available to every initiative in your organization'
          }
          onClose={onClose}
        />

        <ModalBody rail>
          {/* The one genuinely surprising consequence of global metrics —
              say it plainly rather than letting someone discover it. */}
          {editData && sharedCount > 1 && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 mb-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <Globe2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                Used in <strong>{sharedCount} initiatives</strong>. Renaming or editing this metric
                updates all of them, including on your public pages.
              </span>
            </div>
          )}

          {error && (
            <div className="px-3.5 py-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="app-label">Title</label>
              <input
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                required
                autoFocus
                placeholder="e.g. Meals Provided"
                className="app-input"
              />
            </div>

            <div>
              <label className="app-label">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={2}
                placeholder="What this metric measures"
                className="app-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="app-label">Type</label>
                <select
                  name="metric_type"
                  value={formData.metric_type}
                  onChange={handleInputChange}
                  className="app-input"
                >
                  <option value="number">Number</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
              <div>
                <label className="app-label">Unit</label>
                <input
                  name="unit_of_measurement"
                  value={formData.unit_of_measurement}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g. meals"
                  className="app-input"
                />
              </div>
            </div>

            <div>
              <label className="app-label">Category</label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, category: c.value }))}
                    className={`px-3 py-2.5 rounded-xl border text-left transition-colors ${
                      formData.category === c.value
                        ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-800">{c.label}</div>
                    <div className="text-[11px] text-gray-500 leading-tight">{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <TagPicker
                mode="multi"
                selectedIds={tagIds}
                onChange={setTagIds}
                label="Tags (optional)"
                helperText="Tags act as sub-metrics and follow the metric into every initiative that uses it."
              />
            </div>

            {/* Create only. Attaching later is a one-click action on the card. */}
            {!editData && initiatives.length > 0 && (
              <div>
                <label className="app-label">Add to initiatives (optional)</label>
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
                  {initiatives.map(init => {
                    const selected = (formData.initiative_ids || []).includes(init.id!)
                    return (
                      <button
                        key={init.id}
                        type="button"
                        onClick={() => toggleInitiative(init.id!)}
                        className={`group w-full flex items-center gap-2.5 p-2 rounded-xl border shadow-card transition-all text-left ${
                          selected
                            ? 'bg-primary-50/60 border-primary-300/70 ring-1 ring-primary-100'
                            : 'bg-white border-gray-200/70 hover:border-primary-300/70 hover:shadow-card-hover'
                        }`}
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
                        <span className="text-xs font-semibold text-gray-900 leading-snug line-clamp-1 min-w-0 flex-1">
                          {init.title}
                        </span>
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                            selected
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-transparent group-hover:bg-gray-200'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  You can leave this empty and add it to initiatives later.
                </p>
              </div>
            )}
          </div>
        </ModalBody>

        <ModalFooter>
          {editData && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="app-btn app-btn-ghost text-red-600 hover:bg-red-50 mr-auto"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <button type="button" onClick={onClose} className="app-btn app-btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !formData.title.trim()}
            className="app-btn app-btn-primary"
          >
            {loading ? 'Saving…' : editData ? 'Save changes' : 'Create metric'}
          </button>
        </ModalFooter>
      </form>
    </ModalFrame>
  )
}
