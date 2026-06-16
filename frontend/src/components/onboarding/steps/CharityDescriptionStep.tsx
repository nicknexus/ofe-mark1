import React, { useState } from 'react'
import { Building2, Check } from 'lucide-react'
import StepHeader from '../StepHeader'
import { OnboardingDraftApi } from '../useOnboardingDraft'
import { apiService } from '../../../services/api'
import { notify } from '../../../lib/notify'

interface Props {
  orgId: string | null
  draftApi: OnboardingDraftApi
}

const STATEMENT_MAX = 150

/**
 * First (optional) step — capture a short description + mission statement for
 * the organization. Persists via updateOrganization the moment the user saves;
 * fully skippable.
 */
export default function CharityDescriptionStep({ orgId, draftApi }: Props) {
  const { draft, setOrgText } = draftApi
  const [description, setDescription] = useState(draft.description)
  const [statement, setStatement] = useState(draft.statement)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const dirty = description !== draft.description || statement !== draft.statement
  const hasContent = description.trim().length > 0 || statement.trim().length > 0

  const handleSave = async () => {
    if (!orgId || !hasContent) return
    setSaving(true)
    try {
      await apiService.updateOrganization(orgId, {
        description: description.trim() || undefined,
        statement: statement.trim() || undefined,
      })
      setOrgText({ description, statement })
      setSaved(true)
      notify.success('Saved')
    } catch (e) {
      notify.error((e as Error).message || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <StepHeader
        icon={Building2}
        title="Tell us about your organization"
        subtitle="Your identity"
        pill="Optional"
        description="Tell visitors who you are and what you stand for. This powers your public page and AI reports — skip for now if you prefer, and fill it in later under Account settings."
      />

      <div className="app-card p-5 sm:p-6 space-y-5 max-w-2xl">
        <div>
          <label className="app-label">Mission statement</label>
          <input
            type="text"
            value={statement}
            maxLength={STATEMENT_MAX}
            onChange={(e) => { setStatement(e.target.value); setSaved(false) }}
            className="app-input"
            placeholder="e.g. Clean water for every rural community by 2030"
          />
          <p className="app-help text-right">{statement.length}/{STATEMENT_MAX}</p>
        </div>

        <div>
          <label className="app-label">Description</label>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); setSaved(false) }}
            className="app-input resize-none"
            rows={4}
            placeholder="What does your organization do, who do you serve, and where?"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasContent || (!dirty && saved)}
            className="app-btn app-btn-primary app-btn-sm"
          >
            {saving ? 'Saving…' : saved && !dirty ? (<><Check className="w-4 h-4" /> Saved</>) : 'Save'}
          </button>
          {saved && !dirty && (
            <span className="text-sm text-secondary-500">Looks good — continue when you're ready.</span>
          )}
        </div>
      </div>
    </div>
  )
}
