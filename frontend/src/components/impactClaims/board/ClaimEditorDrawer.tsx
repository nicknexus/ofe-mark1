import React, { useEffect, useState } from 'react'
import { X, Check, Target, Calendar, MapPin, Users, Tag as TagIcon } from 'lucide-react'
import { KPI, Location, BeneficiaryGroup, MetricTag } from '../../../types'
import { ClaimDraft } from '../types'
import { apiService } from '../../../services/api'
import { useTeam } from '../../../context/TeamContext'
import DateRangePicker from '../../DateRangePicker'

interface ClaimEditorDrawerProps {
  claim: ClaimDraft
  kpi: KPI
  locations: Location[]
  beneficiaryGroups: BeneficiaryGroup[]
  onSave: (patch: Partial<ClaimDraft>) => void
  onClose: () => void
}

export default function ClaimEditorDrawer({
  claim,
  kpi,
  locations,
  beneficiaryGroups,
  onSave,
  onClose,
}: ClaimEditorDrawerProps) {
  const { canAccessLocation } = useTeam()
  const [draft, setDraft] = useState<ClaimDraft>({ ...claim })
  const [availableTags, setAvailableTags] = useState<MetricTag[]>([])
  const kpiTagIds: string[] = (kpi as any).tag_ids ?? []

  // Reset draft when claim changes
  useEffect(() => {
    setDraft({ ...claim })
  }, [claim.id])

  useEffect(() => {
    if (kpiTagIds.length === 0) return
    let active = true
    apiService.getMetricTags()
      .then((tags) => {
        if (!active) return
        const allowed = new Set(kpiTagIds)
        setAvailableTags(tags.filter((t) => allowed.has(t.id)))
      })
      .catch(() => {})
    return () => { active = false }
  }, [kpiTagIds.join(',')])

  const visibleLocations = locations.filter((l) => !l.id || canAccessLocation(l.id))

  const dateValue = draft.date_range_start && draft.date_range_end
    ? { startDate: draft.date_range_start, endDate: draft.date_range_end }
    : draft.date_represented
    ? { singleDate: draft.date_represented }
    : {}

  function handleDateChange(v: { singleDate?: string; startDate?: string; endDate?: string }) {
    if (v.startDate && v.endDate) {
      patch({ date_range_start: v.startDate, date_range_end: v.endDate, date_represented: v.startDate })
    } else if (v.singleDate) {
      patch({ date_represented: v.singleDate, date_range_start: undefined, date_range_end: undefined })
    } else {
      patch({ date_represented: '', date_range_start: undefined, date_range_end: undefined })
    }
  }

  function patch(p: Partial<ClaimDraft>) {
    setDraft((d) => ({ ...d, ...p }))
  }

  function handleSave() {
    onSave(draft)
    onClose()
  }

  const inputCls =
    'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-colors'

  return (
    <div className="fixed inset-0 z-[95] flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-md bg-white flex flex-col h-full border-l border-gray-200 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-br from-primary-50/60 via-white to-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary-500/10 flex items-center justify-center border border-primary-200/50 flex-shrink-0">
              <Target className="w-4.5 h-4.5 text-primary-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900">Edit Claim</h3>
              <p className="text-xs text-gray-500 truncate">{kpi.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-4.5 h-4.5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Value */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Value</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={draft.value}
                min={0}
                step={kpi.metric_type === 'percentage' ? 0.01 : 1}
                placeholder="0"
                onChange={(e) => {
                  const raw = e.target.value
                  patch({ value: raw === '' ? '' : parseFloat(raw) })
                }}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-2xl font-bold text-gray-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-colors"
              />
              {kpi.unit_of_measurement && (
                <span className="text-sm text-gray-500 font-medium flex-shrink-0">
                  {kpi.unit_of_measurement}
                </span>
              )}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Label <span className="text-gray-400 font-normal">(required)</span></label>
            <input
              type="text"
              value={draft.label}
              onChange={(e) => patch({ label: e.target.value })}
              placeholder="e.g. Monthly attendance — Q2"
              className={inputCls}
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" /> Date <span className="text-gray-400 font-normal">(required)</span>
            </label>
            <DateRangePicker
              value={dateValue}
              onChange={handleDateChange}
              maxDate={new Date().toISOString().split('T')[0]}
              placeholder="Select date or range"
            />
          </div>

          {/* Location — visual single-select pills */}
          {visibleLocations.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400" /> Location <span className="text-gray-400 font-normal">(required)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {visibleLocations.map((l) => {
                  const selected = draft.location_id === l.id
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => patch({ location_id: selected ? '' : l.id! })}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selected
                          ? 'bg-primary-500 border-primary-500 text-white shadow-sm'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-700 hover:bg-primary-50'
                      }`}
                    >
                      <MapPin className={`w-3 h-3 ${selected ? 'text-white' : 'text-gray-400'}`} />
                      {l.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Beneficiary groups — visual checkboxes */}
          {beneficiaryGroups.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-gray-400" /> Beneficiary Groups
              </label>
              <div className="overflow-y-auto max-h-[104px] pr-0.5">
                <div className="flex flex-wrap gap-2">
                  {beneficiaryGroups.map((bg) => {
                    const selected = draft.beneficiary_group_ids.includes(bg.id!)
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => {
                          const ids = selected
                            ? draft.beneficiary_group_ids.filter((id) => id !== bg.id)
                            : [...draft.beneficiary_group_ids, bg.id!]
                          patch({ beneficiary_group_ids: ids })
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          selected
                            ? 'bg-primary-500 border-primary-500 text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-700 hover:bg-primary-50'
                        }`}
                      >
                        <Users className={`w-3 h-3 ${selected ? 'text-white' : 'text-gray-400'}`} />
                        {bg.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tags — visual single-select chips */}
          {availableTags.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <TagIcon className="w-3.5 h-3.5 text-gray-400" /> Tag
              </label>
              <div className="overflow-y-auto max-h-[104px] pr-0.5">
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((t) => {
                    const selected = draft.tag_id === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => patch({ tag_id: selected ? null : t.id })}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          selected
                            ? 'bg-primary-500 border-primary-500 text-white shadow-sm'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-700 hover:bg-primary-50'
                        }`}
                      >
                        <TagIcon className={`w-3 h-3 ${selected ? 'text-white' : 'text-gray-400'}`} />
                        {t.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Note <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea
              value={draft.note}
              onChange={(e) => patch({ note: e.target.value })}
              placeholder="Add any context or notes…"
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 resize-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-white flex items-center justify-end gap-2.5 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 text-sm bg-primary-500 text-white rounded-xl hover:bg-primary-600 font-semibold shadow-sm shadow-primary-500/20 transition-colors"
          >
            <Check className="w-4 h-4" /> Save
          </button>
        </div>
      </div>
    </div>
  )
}
