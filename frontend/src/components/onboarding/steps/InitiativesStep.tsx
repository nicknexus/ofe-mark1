import React, { useState } from 'react'
import { Target, Plus, Trash2 } from 'lucide-react'
import StepHeader from '../StepHeader'
import { OnboardingDraftApi } from '../useOnboardingDraft'
import { apiService } from '../../../services/api'
import { notify } from '../../../lib/notify'

interface Props {
  draftApi: OnboardingDraftApi
}

export default function InitiativesStep({ draftApi }: Props) {
  const { draft, addInitiative, removeInitiative } = draftApi
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [region, setRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = async () => {
    setError(null)
    if (!title.trim()) { setError('Title is required'); return }
    if (!description.trim()) { setError('Description is required'); return }
    setSaving(true)
    try {
      const created = await apiService.createInitiative({
        title: title.trim(),
        description: description.trim(),
        region: region.trim() || undefined,
      })
      addInitiative(created)
      notify.success('Initiative created')
      setTitle(''); setDescription(''); setRegion('')
    } catch (e: any) {
      // Surface plan-limit errors clearly (createInitiative can 4xx with a usage payload).
      notify.error(e?.message || 'Could not create initiative')
      setError(e?.message || 'Could not create initiative')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await apiService.deleteInitiative(id)
      removeInitiative(id)
    } catch (e) {
      notify.error((e as Error).message || 'Could not remove initiative')
    }
  }

  return (
    <div>
      <StepHeader
        icon={Target}
        title="Create your initiatives"
        subtitle="Your projects & programs"
        description="Initiatives are how you organize your work — each one holds its own metrics, evidence, and reports. Create your first one here, then you'll add metrics in the next step. Create as many as you need."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
        <div className="app-card p-5 sm:p-6 space-y-4">
          <div>
            <label className="app-label">Initiative title <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="app-input" placeholder="e.g. Youth Training Program 2025" />
          </div>
          <div>
            <label className="app-label">Description <span className="text-red-500">*</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="app-input resize-none" rows={3} placeholder="What does this initiative aim to achieve?" />
          </div>
          <div>
            <label className="app-label">Region</label>
            <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} className="app-input" placeholder="e.g. East Africa" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="button" onClick={handleAdd} disabled={saving} className="app-btn app-btn-primary w-full">
            {saving ? 'Creating…' : (<><Plus className="w-4 h-4" /> Create initiative</>)}
          </button>
        </div>

        <div>
          <h3 className="onboarding-list-label">Your initiatives <span className="onboarding-list-label-count">{draft.initiatives.length}</span></h3>
          {draft.initiatives.length === 0 ? (
            <div className="onboarding-empty">
              <span className="onboarding-empty-icon"><Target className="w-5 h-5" /></span>
              <p className="onboarding-empty-text">No initiatives yet. Fill in the form to create your first one.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {draft.initiatives.map(init => (
                <div key={init.id} className="app-card p-4 group">
                  <div className="flex items-start gap-3">
                    <div className="app-icon-tile-sm app-icon-tile-accent flex-shrink-0"><Target className="w-4 h-4" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-secondary-900 truncate">{init.title}</p>
                      <p className="text-xs text-secondary-500 line-clamp-2 mt-0.5">{init.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => init.id && handleRemove(init.id)}
                      className="app-btn app-btn-icon app-btn-ghost opacity-0 group-hover:opacity-100 text-secondary-400 hover:text-red-600"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
