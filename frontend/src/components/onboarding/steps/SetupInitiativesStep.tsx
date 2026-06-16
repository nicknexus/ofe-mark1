import React, { useState, useEffect } from 'react'
import { BarChart3, Plus, Trash2, Users, ChevronDown } from 'lucide-react'
import StepHeader from '../StepHeader'
import { OnboardingDraftApi } from '../useOnboardingDraft'
import { apiService } from '../../../services/api'
import { notify } from '../../../lib/notify'
import TagPicker from '../../MetricTags/TagPicker'
import { CreateKPIForm } from '../../../types'

interface Props {
  draftApi: OnboardingDraftApi
}

const CATEGORIES: { value: CreateKPIForm['category']; label: string; desc: string }[] = [
  { value: 'input', label: 'Input', desc: 'What you put in' },
  { value: 'output', label: 'Output', desc: 'What you deliver' },
  { value: 'impact', label: 'Impact', desc: 'The change you create' },
]

export default function SetupInitiativesStep({ draftApi }: Props) {
  const { draft, addMetric, removeMetric, addGroup, removeGroup } = draftApi
  const [activeId, setActiveId] = useState<string | null>(draft.initiatives[0]?.id ?? null)

  // Keep the active tab valid as initiatives change.
  useEffect(() => {
    if (!activeId || !draft.initiatives.some(i => i.id === activeId)) {
      setActiveId(draft.initiatives[0]?.id ?? null)
    }
  }, [draft.initiatives, activeId])

  if (draft.initiatives.length === 0) {
    return (
      <div>
        <StepHeader
          icon={BarChart3}
          title="Set up your initiatives"
          subtitle="Metrics, tags & groups"
        />
        <div className="onboarding-empty max-w-2xl">
          <span className="onboarding-empty-icon"><BarChart3 className="w-5 h-5" /></span>
          <p className="onboarding-empty-text">Head back one step and create an initiative first — then you can add metrics here.</p>
        </div>
      </div>
    )
  }

  const active = draft.initiatives.find(i => i.id === activeId) || draft.initiatives[0]

  return (
    <div>
      <StepHeader
        icon={BarChart3}
        title="Set up your initiatives"
        subtitle="Metrics, tags & beneficiary groups"
        description="Choose the metrics you want to track in each initiative, add tags to break them into sub-metrics, and optionally define who benefits. You'll add your actual numbers and evidence once setup is done."
      />

      {/* Initiative tabs */}
      {draft.initiatives.length > 1 && (
        <div className="onboarding-seg mb-6">
          {draft.initiatives.map(init => {
            const count = (draft.metricsByInitiative[init.id!] || []).length
            const selected = init.id === active.id
            return (
              <button
                key={init.id}
                type="button"
                onClick={() => setActiveId(init.id!)}
                className={`onboarding-seg-item ${selected ? 'onboarding-seg-item--active' : ''}`}
              >
                {init.title}
                <span className="onboarding-seg-count">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="max-w-5xl space-y-6">
        <MetricsSection
          key={`metrics-${active.id}`}
          initiativeId={active.id!}
          metrics={draft.metricsByInitiative[active.id!] || []}
          onAdded={(kpi) => addMetric(active.id!, kpi)}
          onRemoved={(id) => removeMetric(active.id!, id)}
        />

        <GroupsSection
          key={`groups-${active.id}`}
          initiativeId={active.id!}
          groups={draft.groupsByInitiative[active.id!] || []}
          onAdded={(g) => addGroup(active.id!, g)}
          onRemoved={(id) => removeGroup(active.id!, id)}
        />
      </div>
    </div>
  )
}

// ─── Metrics ────────────────────────────────────────────────────────────────

function MetricsSection({ initiativeId, metrics, onAdded, onRemoved }: {
  initiativeId: string
  metrics: any[]
  onAdded: (kpi: any) => void
  onRemoved: (id: string) => void
}) {
  const [form, setForm] = useState<CreateKPIForm>({
    title: '', description: '', metric_type: 'number', unit_of_measurement: '', category: 'output', initiative_id: initiativeId, tag_ids: [],
  })
  const [tagIds, setTagIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async () => {
    setError(null)
    if (!form.title.trim()) { setError('Metric title is required'); return }
    if (!form.description.trim()) { setError('Description is required'); return }
    if (!form.unit_of_measurement.trim()) { setError('Unit is required'); return }
    setSaving(true)
    try {
      const created = await apiService.createKPI({ ...form, initiative_id: initiativeId, tag_ids: tagIds })
      onAdded(created)
      notify.success('Metric created')
      setForm({ title: '', description: '', metric_type: 'number', unit_of_measurement: '', category: 'output', initiative_id: initiativeId, tag_ids: [] })
      setTagIds([])
    } catch (e) {
      notify.error((e as Error).message || 'Could not create metric')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await apiService.deleteKPI(id)
      onRemoved(id)
    } catch (e) {
      notify.error((e as Error).message || 'Could not remove metric')
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="app-card p-5 sm:p-6 space-y-4">
        <h3 className="app-card-title flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary-700" /> Add a metric</h3>
        <div>
          <label className="app-label">Title <span className="text-red-500">*</span></label>
          <input type="text" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} className="app-input" placeholder="e.g. Students Trained" />
        </div>
        <div>
          <label className="app-label">Description <span className="text-red-500">*</span></label>
          <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} className="app-input resize-none" rows={2} placeholder="What does this metric measure?" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="app-label">Type</label>
            <select value={form.metric_type} onChange={(e) => setForm(f => ({ ...f, metric_type: e.target.value as any }))} className="app-input">
              <option value="number">Number</option>
              <option value="percentage">Percentage</option>
            </select>
          </div>
          <div>
            <label className="app-label">Unit <span className="text-red-500">*</span></label>
            <input type="text" value={form.unit_of_measurement} onChange={(e) => setForm(f => ({ ...f, unit_of_measurement: e.target.value }))} className="app-input" placeholder="People, Hours…" />
          </div>
        </div>
        <div>
          <label className="app-label">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(c => (
              <label key={c.value} className={`onboarding-cat ${form.category === c.value ? 'onboarding-cat--active' : ''}`}>
                <input type="radio" name={`cat-${initiativeId}`} value={c.value} checked={form.category === c.value} onChange={() => setForm(f => ({ ...f, category: c.value }))} className="sr-only" />
                <span className="onboarding-cat-label">{c.label}</span>
                <span className="onboarding-cat-desc">{c.desc}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-200/60 pt-4">
          <TagPicker
            mode="multi"
            selectedIds={tagIds}
            onChange={setTagIds}
            label="Tags (optional)"
            helperText="Tags are reusable across your org. Use them to group impact claims under sub-metrics (e.g. Grade 1, Grade 2)."
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="button" onClick={handleAdd} disabled={saving} className="app-btn app-btn-primary w-full">
          {saving ? 'Creating…' : (<><Plus className="w-4 h-4" /> Add metric</>)}
        </button>
      </div>

      <div>
        <h3 className="onboarding-list-label">Metrics <span className="onboarding-list-label-count">{metrics.length}</span></h3>
        {metrics.length === 0 ? (
          <div className="onboarding-empty">
            <span className="onboarding-empty-icon"><BarChart3 className="w-5 h-5" /></span>
            <p className="onboarding-empty-text">No metrics yet. Use the form to add what you want to track.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {metrics.map(m => (
              <div key={m.id} className="app-card p-3.5 flex items-center gap-3 group">
                <div className="app-icon-tile-sm app-icon-tile-accent flex-shrink-0"><BarChart3 className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-secondary-900 truncate">{m.title}</p>
                  <p className="text-xs text-secondary-500 truncate capitalize">{m.category} · {m.unit_of_measurement}</p>
                </div>
                <button type="button" onClick={() => m.id && handleRemove(m.id)} className="app-btn app-btn-icon app-btn-ghost opacity-0 group-hover:opacity-100 text-secondary-400 hover:text-red-600" title="Remove">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Beneficiary groups (optional, collapsible) ──────────────────────────────

function GroupsSection({ initiativeId, groups, onAdded, onRemoved }: {
  initiativeId: string
  groups: any[]
  onAdded: (g: any) => void
  onRemoved: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [total, setTotal] = useState('')
  const [ageStart, setAgeStart] = useState('')
  const [ageEnd, setAgeEnd] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async () => {
    setError(null)
    if (!name.trim()) { setError('Group name is required'); return }
    setSaving(true)
    try {
      const created = await apiService.createBeneficiaryGroup({
        initiative_id: initiativeId,
        name: name.trim(),
        description: description.trim() || undefined,
        total_number: total === '' ? null : Number(total),
        age_range_start: ageStart === '' ? null : Number(ageStart),
        age_range_end: ageEnd === '' ? null : Number(ageEnd),
      })
      onAdded(created)
      notify.success('Beneficiary group created')
      setName(''); setTotal(''); setAgeStart(''); setAgeEnd(''); setDescription('')
    } catch (e) {
      notify.error((e as Error).message || 'Could not create group')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await apiService.deleteBeneficiaryGroup(id)
      onRemoved(id)
    } catch (e) {
      notify.error((e as Error).message || 'Could not remove group')
    }
  }

  return (
    <div className="app-card overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-2.5">
          <div className="app-icon-tile-sm app-icon-tile-accent"><Users className="w-4 h-4" /></div>
          <div>
            <p className="text-sm font-semibold text-secondary-900">Beneficiary groups</p>
            <p className="text-xs text-secondary-500">Define who your initiative serves — {groups.length} added</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-secondary-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <label className="app-label">Group name <span className="text-red-500">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="app-input" placeholder="e.g. Children 5-12" />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="app-label">Total</label>
                <input type="number" min="0" value={total} onChange={(e) => setTotal(e.target.value)} className="app-input" placeholder="150" />
              </div>
              <div>
                <label className="app-label">Min age</label>
                <input type="number" min="0" value={ageStart} onChange={(e) => setAgeStart(e.target.value)} className="app-input" placeholder="5" />
              </div>
              <div>
                <label className="app-label">Max age</label>
                <input type="number" min="0" value={ageEnd} onChange={(e) => setAgeEnd(e.target.value)} className="app-input" placeholder="12" />
              </div>
            </div>
            <div>
              <label className="app-label">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="app-input resize-none" rows={2} placeholder="Optional" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="button" onClick={handleAdd} disabled={saving} className="app-btn app-btn-secondary w-full">
              {saving ? 'Creating…' : (<><Plus className="w-4 h-4" /> Add group</>)}
            </button>
          </div>

          <div>
            {groups.length === 0 ? (
              <div className="onboarding-empty h-full">
                <span className="onboarding-empty-icon"><Users className="w-5 h-5" /></span>
                <p className="onboarding-empty-text">No groups yet — skip this if you don't need it.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {groups.map(g => (
                  <div key={g.id} className="app-card p-3.5 flex items-center gap-3 group">
                    <div className="app-icon-tile-sm app-icon-tile-accent flex-shrink-0"><Users className="w-4 h-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-secondary-900 truncate">{g.name}</p>
                      <p className="text-xs text-secondary-500 truncate">
                        {[g.total_number != null ? `${g.total_number} people` : null, g.age_range_start != null ? `age ${g.age_range_start}${g.age_range_end != null ? `–${g.age_range_end}` : '+'}` : null].filter(Boolean).join(' · ') || 'No details'}
                      </p>
                    </div>
                    <button type="button" onClick={() => g.id && handleRemove(g.id)} className="app-btn app-btn-icon app-btn-ghost opacity-0 group-hover:opacity-100 text-secondary-400 hover:text-red-600" title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
