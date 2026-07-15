import React, { useMemo, useState } from 'react'
import { Pencil, Camera, FileText, MessageSquare, DollarSign, Paperclip } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from '../ModalFrame'
import DateRangePicker from '../DateRangePicker'
import {
  BeneficiaryGroup,
  CreateEvidenceForm,
  Evidence,
  KPI,
  Location,
  MetricTag,
} from '../../types'
import { getLocalDateString } from '../../utils'

const TYPE_OPTIONS: Array<{ value: Evidence['type']; label: string; icon: typeof Camera }> = [
  { value: 'visual_proof', label: 'Visual proof', icon: Camera },
  { value: 'documentation', label: 'Documentation', icon: FileText },
  { value: 'testimony', label: 'Testimony', icon: MessageSquare },
  { value: 'financials', label: 'Financials', icon: DollarSign },
]

interface ChipOption { id: string; name: string }

/** Pill multi-select used for locations / metrics / tags / groups. */
function ChipGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: ChipOption[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  if (options.length === 0) return null
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o => {
          const active = selected.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${active
                ? 'border-primary-500 bg-primary-50 text-primary-800'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
            >
              {o.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface EditEvidenceModalProps {
  evidence: Evidence
  kpis: KPI[]
  locations: Location[]
  tags: MetricTag[]
  beneficiaryGroups: BeneficiaryGroup[]
  onClose: () => void
  /** Receives the changed fields; the caller persists and refreshes. */
  onSave: (data: Partial<CreateEvidenceForm>) => Promise<void>
}

/**
 * Modern evidence editor, styled like the other Logs modals. Edits the
 * record's details and scope (type, date, locations, metrics, tags, groups);
 * attached files are intentionally left untouched — they stay exactly as
 * uploaded.
 */
export default function EditEvidenceModal({
  evidence,
  kpis,
  locations,
  tags,
  beneficiaryGroups,
  onClose,
  onSave,
}: EditEvidenceModalProps) {
  const [title, setTitle] = useState(evidence.title || '')
  const [description, setDescription] = useState(evidence.description || '')
  const [type, setType] = useState<Evidence['type']>(evidence.type)
  const [datePickerValue, setDatePickerValue] = useState<{ singleDate?: string; startDate?: string; endDate?: string }>(() =>
    evidence.date_range_start && evidence.date_range_end
      ? { startDate: evidence.date_range_start, endDate: evidence.date_range_end }
      : evidence.date_represented
        ? { singleDate: evidence.date_represented }
        : {}
  )
  const [locationIds, setLocationIds] = useState<string[]>(
    evidence.location_ids?.length ? evidence.location_ids : evidence.location_id ? [evidence.location_id] : []
  )
  const [kpiIds, setKpiIds] = useState<string[]>(evidence.kpi_ids || [])
  const [tagIds, setTagIds] = useState<string[]>(evidence.tag_ids || [])
  const [groupIds, setGroupIds] = useState<string[]>(evidence.beneficiary_group_ids || [])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fileCount = evidence.files?.length || (evidence.file_url ? 1 : 0)

  const dates = useMemo(() => {
    if (datePickerValue.startDate) {
      return { start: datePickerValue.startDate, end: datePickerValue.endDate || datePickerValue.startDate }
    }
    return { start: datePickerValue.singleDate || '', end: datePickerValue.singleDate || '' }
  }, [datePickerValue])

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Give the evidence a short title')
      return
    }
    if (!dates.start) {
      setError('Choose the activity date')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const isRange = dates.end !== dates.start
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        type,
        date_represented: dates.start,
        date_range_start: isRange ? dates.start : undefined,
        date_range_end: isRange ? dates.end : undefined,
        location_ids: locationIds,
        kpi_ids: kpiIds,
        tag_ids: tagIds,
        beneficiary_group_ids: groupIds,
      })
      onClose()
    } catch {
      // The caller surfaces the error toast; keep the modal open to retry.
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalFrame size="sm">
      <ModalHeader
        icon={Pencil}
        title="Edit evidence"
        subtitle={evidence.title || 'Untitled Evidence'}
        onClose={onClose}
      />
      <ModalBody>
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(null) }}
              placeholder="e.g. July training photos"
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {TYPE_OPTIONS.map(opt => {
                const active = type === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border text-xs font-medium transition-colors ${active
                      ? 'border-primary-500 bg-primary-50 text-primary-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    <opt.icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this evidence show?"
              className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Activity date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Activity date</label>
            <DateRangePicker
              value={datePickerValue}
              onChange={(v) => { setDatePickerValue(v); setError(null) }}
              maxDate={getLocalDateString(new Date())}
            />
          </div>

          <ChipGroup
            label="Locations"
            options={locations.map(l => ({ id: l.id!, name: l.name }))}
            selected={locationIds}
            onChange={setLocationIds}
          />
          <ChipGroup
            label="Metrics this evidence supports"
            options={kpis.map(k => ({ id: k.id!, name: k.title }))}
            selected={kpiIds}
            onChange={setKpiIds}
          />
          <ChipGroup
            label="Tags"
            options={tags.map(t => ({ id: t.id!, name: t.name }))}
            selected={tagIds}
            onChange={setTagIds}
          />
          <ChipGroup
            label="Beneficiary groups"
            options={beneficiaryGroups.map(g => ({ id: g.id!, name: g.name }))}
            selected={groupIds}
            onChange={setGroupIds}
          />

          {fileCount > 0 && (
            <p className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <Paperclip className="w-3.5 h-3.5" />
              {fileCount} attached file{fileCount === 1 ? '' : 's'} — files aren't changed by editing details
            </p>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </ModalBody>
      <ModalFooter>
        <button onClick={onClose} className="app-btn app-btn-secondary app-btn-sm" disabled={submitting}>
          Cancel
        </button>
        <button onClick={handleSave} className="app-btn app-btn-primary app-btn-sm" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </ModalFooter>
    </ModalFrame>
  )
}
