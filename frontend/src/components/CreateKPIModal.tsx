import React, { useState, useEffect } from 'react'
import { BarChart3, Trash2 } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from './ModalFrame'
import { CreateKPIForm } from '../types'
import TagPicker from './MetricTags/TagPicker'

interface CreateKPIModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateKPIForm) => Promise<void>
  initiativeId: string
  editData?: any // Optional prop for editing existing KPI
  /** Edit mode only: opens the typed-confirmation delete flow. */
  onDelete?: () => void
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
}: CreateKPIModalProps) {
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
          subtitle={editData ? 'Update how this metric is defined' : 'Define what you want to measure for this initiative'}
          onClose={onClose}
        />

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
      </form>
    </ModalFrame>
  )
}
