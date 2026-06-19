import React, { useEffect, useState } from 'react'
import { Link2, Globe, Heart, Save, Loader2, Check } from 'lucide-react'
import StepHeader from '../StepHeader'
import { apiService } from '../../../services/api'
import { notify } from '../../../lib/notify'

interface Props {
  orgId: string | null
}

/** Light normalization — prepend https:// when the user omits a scheme. */
function normalizeUrl(value: string): string {
  const v = value.trim()
  if (!v) return ''
  if (/^https?:\/\//i.test(v)) return v
  return `https://${v}`
}

/**
 * Account-setup step: website + donation links. These are the same fields shown
 * on Account → Settings; the donation URL powers the "Donate" button on your
 * public page. Optional — persists directly to the organization.
 */
export default function LinksStep({ orgId }: Props) {
  const [website, setWebsite] = useState('')
  const [donation, setDonation] = useState('')
  const [saved, setSaved] = useState<{ website: string; donation: string }>({ website: '', donation: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!orgId) return
    let active = true
    apiService.getOrganization(orgId)
      .then(org => {
        if (!active) return
        setWebsite(org.website_url || '')
        setDonation(org.donation_url || '')
        setSaved({ website: org.website_url || '', donation: org.donation_url || '' })
      })
      .catch(() => { /* non-fatal */ })
    return () => { active = false }
  }, [orgId])

  const dirty = website !== saved.website || donation !== saved.donation

  const handleSave = async () => {
    if (!orgId || !dirty) return
    setSaving(true)
    try {
      const website_url = normalizeUrl(website)
      const donation_url = normalizeUrl(donation)
      await apiService.updateOrganization(orgId, { website_url, donation_url })
      setWebsite(website_url)
      setDonation(donation_url)
      setSaved({ website: website_url, donation: donation_url })
      notify.success('Links saved')
    } catch (e) {
      notify.error((e as Error).message || 'Could not save links')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <StepHeader
        icon={Link2}
        title="Add your links"
        subtitle="Website & donations"
        pill="Optional"
        description="Link out to your website and donation page — the donation link becomes the “Donate” button on your public page. You can also manage these anytime in Account settings."
      />

      <div className="app-card p-6 space-y-5 max-w-2xl">
        <div>
          <label className="app-label flex items-center gap-1.5"><Globe className="w-4 h-4 text-primary-600" /> Website URL</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="app-input"
            placeholder="https://yourcharity.org"
            inputMode="url"
          />
        </div>

        <div>
          <label className="app-label flex items-center gap-1.5"><Heart className="w-4 h-4 text-primary-600" /> Donation URL</label>
          <input
            type="url"
            value={donation}
            onChange={(e) => setDonation(e.target.value)}
            className="app-input"
            placeholder="https://yourcharity.org/donate"
            inputMode="url"
          />
          <p className="app-help">Where supporters go when they click “Donate” on your public page.</p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">{dirty ? 'You have unsaved changes' : 'Links are saved'}</p>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="app-btn app-btn-primary flex items-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : !dirty && (saved.website || saved.donation) ? <><Check className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save links</>}
          </button>
        </div>
      </div>
    </div>
  )
}
