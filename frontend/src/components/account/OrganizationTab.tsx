import React, { useEffect, useState } from 'react'
import { Heart, Link as LinkIcon, Save } from 'lucide-react'
import { notify } from '../../lib/notify'
import { Spinner } from '../ui'
import { apiService } from '../../services/api'
import type { OrganizationTabProps } from './accountTypes'

export function OrganizationTab({
  organization,
  refreshPermissions,
  section = 'about',
  readOnly = false,
}: OrganizationTabProps) {
  const [statement, setStatement] = useState(organization?.statement || '')
  const [websiteUrl, setWebsiteUrl] = useState(organization?.website_url || '')
  const [donationUrl, setDonationUrl] = useState(organization?.donation_url || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStatement(organization?.statement || '')
    setWebsiteUrl(organization?.website_url || '')
    setDonationUrl(organization?.donation_url || '')
  }, [organization])

  const isValidUrl = (url: string) => {
    if (!url.trim()) return true
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`)
      return true
    } catch {
      return false
    }
  }

  const aboutChanged = statement !== (organization?.statement || '')
  const linksChanged =
    websiteUrl !== (organization?.website_url || '') ||
    donationUrl !== (organization?.donation_url || '')
  const hasChanges = aboutChanged || linksChanged

  const handleSave = async () => {
    if (readOnly || !organization?.id) return
    setSaving(true)
    try {
      await apiService.updateOrganization(organization.id, {
        statement: statement.trim(),
        website_url: websiteUrl.trim(),
        donation_url: donationUrl.trim(),
      })
      notify.success(section === 'about' ? 'About updated' : 'Links updated')
      await refreshPermissions()
    } catch (error) {
      notify.error((error as Error).message || 'Failed to update organization')
    } finally {
      setSaving(false)
    }
  }

  const saveDisabled = saving || !hasChanges || !isValidUrl(websiteUrl) || !isValidUrl(donationUrl)

  return (
    <div className="app-card p-6">
      {section === 'about' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-800">About</h2>
            <p className="text-sm text-secondary-500 mt-0.5">What visitors read first on the public page.</p>
          </div>
          <div>
            <label className="app-label">Organization name</label>
            <input
              type="text"
              value={organization?.name || ''}
              disabled
              className="app-input bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="app-help">Contact support to change the name.</p>
          </div>
          <div>
            <label className="app-label">
              Mission statement
              <span className="text-secondary-400 font-normal ml-2">({statement.length}/150)</span>
            </label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value.slice(0, 150))}
              placeholder="Brief description of your organization's mission..."
              rows={3}
              maxLength={150}
              disabled={readOnly}
              className={`app-input resize-none ${readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
            />
            <p className="app-help">Shows on your public organization page.</p>
          </div>
        </div>
      )}

      {section === 'links' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Links</h2>
            <p className="text-sm text-secondary-500 mt-0.5">Website and where people can support the work.</p>
          </div>
          <div>
            <label className="app-label flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5" />
              Website
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://yourorganization.org"
              disabled={readOnly}
              className={`app-input ${readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''} ${!isValidUrl(websiteUrl) ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : ''}`}
            />
            {!isValidUrl(websiteUrl) && <p className="text-xs text-red-500 mt-1">Enter a valid URL</p>}
          </div>
          <div>
            <label className="app-label flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5" />
              Support link
            </label>
            <input
              type="url"
              value={donationUrl}
              onChange={(e) => setDonationUrl(e.target.value)}
              placeholder="https://yourorganization.org/support"
              disabled={readOnly}
              className={`app-input ${readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''} ${!isValidUrl(donationUrl) ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : ''}`}
            />
            {!isValidUrl(donationUrl) && <p className="text-xs text-red-500 mt-1">Enter a valid URL</p>}
            <p className="app-help">The page where donors can best support you — a donation form, campaign, or your website. Powers the Support button on your public page.</p>
          </div>
        </div>
      )}

      {!readOnly && (
      <div className="flex items-center justify-between pt-5 mt-5 border-t border-gray-100">
        <p className="text-xs text-secondary-500">
          {hasChanges ? 'Unsaved changes' : 'All changes saved'}
        </p>
        <button onClick={handleSave} disabled={saveDisabled} className="app-btn app-btn-primary">
          {saving ? <><Spinner className="w-4 h-4 border-white border-t-white/30" />Saving...</> : <><Save className="w-4 h-4" />Save</>}
        </button>
      </div>
      )}
    </div>
  )
}
