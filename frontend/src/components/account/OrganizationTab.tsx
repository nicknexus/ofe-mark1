import React, { useEffect, useState } from 'react'
import {
  Building2,
  Globe,
  Heart,
  ExternalLink,
  Link as LinkIcon,
  Lock,
  Save,
} from 'lucide-react'
import { notify } from '../../lib/notify'
import { Spinner } from '../ui'
import { apiService } from '../../services/api'
import type { OrganizationTabProps } from './accountTypes'

export function OrganizationTab({ organization, refreshPermissions }: OrganizationTabProps) {
 const [statement, setStatement] = useState(organization?.statement || '')
 const [websiteUrl, setWebsiteUrl] = useState(organization?.website_url || '')
  const [donationUrl, setDonationUrl] = useState(organization?.donation_url || '')
  const [saving, setSaving] = useState(false)
  const [updatingPublic, setUpdatingPublic] = useState(false)

  const handleTogglePublic = async (makePublic: boolean) => {
    if (!organization?.id) return
    setUpdatingPublic(true)
    try {
      await apiService.updateOrganization(organization.id, { is_public: makePublic })
      notify.success(makePublic ? 'Your organization is now public!' : 'Your organization is now private')
      await refreshPermissions()
    } catch (error) {
      notify.error((error as Error).message || 'Failed to update visibility')
    } finally {
      setUpdatingPublic(false)
    }
  }

 // Sync state when organization changes
 useEffect(() => {
 setStatement(organization?.statement || '')
 setWebsiteUrl(organization?.website_url || '')
 setDonationUrl(organization?.donation_url || '')
 }, [organization])

 const handleSave = async () => {
 if (!organization?.id) return
 setSaving(true)
 try {
 await apiService.updateOrganization(organization.id, {
 statement: statement.trim(),
 website_url: websiteUrl.trim(),
 donation_url: donationUrl.trim()
 })
 notify.success('Organization profile updated!')
 await refreshPermissions()
 } catch (error) {
 notify.error((error as Error).message || 'Failed to update organization')
 } finally {
 setSaving(false)
 }
 }

 const isValidUrl = (url: string) => {
 if (!url.trim()) return true // Empty is valid
 try {
 new URL(url.startsWith('http') ? url : `https://${url}`)
 return true
 } catch {
 return false
 }
 }

 const hasChanges =
 statement !== (organization?.statement || '') ||
 websiteUrl !== (organization?.website_url || '') ||
 donationUrl !== (organization?.donation_url || '')

 return (
    <div className="space-y-6">
      {/* Public Visibility — top of the page so it's the first thing owners see */}
      <div className={`rounded-xl shadow-card p-6 ${organization?.is_public ? 'app-card' : 'bg-amber-50 border-2 border-amber-200'}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`relative p-2 rounded-xl ${organization?.is_public ? 'bg-impact-50' : 'bg-amber-100'}`}>
            {organization?.is_public ? <Globe className="w-5 h-5 text-impact-600" /> : <Lock className="w-5 h-5 text-amber-600" />}
            {!organization?.is_public && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">!</span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-800">Public Visibility</h2>
              {!organization?.is_public && (
                <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">Action Required</span>
              )}
            </div>
          </div>
          {organization?.is_public && organization?.slug && (
            <a
              href={`${window.location.origin}/org/${organization.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white border border-impact-200 text-impact-700 text-xs font-medium hover:bg-impact-50 transition-colors flex-shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View public page
            </a>
          )}
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${organization?.is_public ? 'bg-impact-100 text-impact-700' : 'bg-gray-200 text-gray-700'}`}>
              {organization?.is_public ? 'Public' : 'Private'}
            </span>
            <span className="text-sm text-gray-600">
              {organization?.is_public
                ? 'Your organization is visible on the Explore page'
                : 'Your organization is hidden from the public site'}
            </span>
          </div>
          <button
            onClick={() => handleTogglePublic(!organization?.is_public)}
            disabled={updatingPublic}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${organization?.is_public ? 'bg-impact-500' : 'bg-gray-300'}`}
          >
            {updatingPublic ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner className="w-3 h-3 border-white border-t-white/30" />
              </div>
            ) : (
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${organization?.is_public ? 'translate-x-6' : 'translate-x-1'}`} />
            )}
          </button>
        </div>
      </div>

      {/* Organization Name (Read-only) */}
      <div className="app-card p-6">
 <div className="flex items-center gap-3 mb-5">
 <div className="p-2 bg-primary-50 rounded-xl">
 <Building2 className="w-5 h-5 text-primary-600" />
 </div>
 <h2 className="text-lg font-semibold text-gray-800">Organization Profile</h2>
 </div>

 <div className="space-y-5">
 {/* Organization Name */}
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Name</label>
 <input
 type="text"
 value={organization?.name || ''}
 disabled
 className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed"
 />
 <p className="text-xs text-gray-400 mt-1">Contact support to change your organization name</p>
 </div>

 {/* Statement */}
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">
 Mission Statement
 <span className="text-gray-400 font-normal ml-2">({statement.length}/150)</span>
 </label>
 <textarea
 value={statement}
 onChange={(e) => setStatement(e.target.value.slice(0, 150))}
 placeholder="Brief description of your organization's mission..."
 rows={3}
 maxLength={150}
 className="app-input resize-none"
 />
 <p className="text-xs text-gray-400 mt-1">This appears on your public organization page</p>
 </div>

 {/* Website URL */}
 <div>
 <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
 <LinkIcon className="w-3.5 h-3.5" />
 Website
 </label>
 <input
 type="url"
 value={websiteUrl}
 onChange={(e) => setWebsiteUrl(e.target.value)}
 placeholder="https://yourorganization.org"
 className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-1 focus:outline-none transition-all ${!isValidUrl(websiteUrl)
 ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
 : 'border-gray-200 focus:border-primary-500 focus:ring-primary-500'
 }`}
 />
 {!isValidUrl(websiteUrl) && (
 <p className="text-xs text-red-500 mt-1">Please enter a valid URL</p>
 )}
 </div>

 {/* Donation URL */}
 <div>
 <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
 <Heart className="w-3.5 h-3.5" />
 Donation Link
 </label>
 <input
 type="url"
 value={donationUrl}
 onChange={(e) => setDonationUrl(e.target.value)}
 placeholder="https://donate.yourorganization.org"
 className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-1 focus:outline-none transition-all ${!isValidUrl(donationUrl)
 ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
 : 'border-gray-200 focus:border-primary-500 focus:ring-primary-500'
 }`}
 />
 {!isValidUrl(donationUrl) && (
 <p className="text-xs text-red-500 mt-1">Please enter a valid URL</p>
 )}
 <p className="text-xs text-gray-400 mt-1">Where visitors can donate to support your work</p>
 </div>

 {/* Save Button */}
 <div className="flex items-center justify-between pt-4 border-t border-gray-100">
 <p className="text-xs text-gray-500">
 {hasChanges ? 'You have unsaved changes' : 'All changes saved'}
 </p>
 <button
 onClick={handleSave}
 disabled={saving || !hasChanges || !isValidUrl(websiteUrl) || !isValidUrl(donationUrl)}
 className="app-btn app-btn-primary flex items-center gap-2"
 >
 {saving ? (
 <>
 <Spinner className="w-4 h-4 border-white border-t-white/30" />
 Saving...
 </>
 ) : (
 <>
 <Save className="w-4 h-4" />
 Save Changes
 </>
 )}
 </button>
 </div>
 </div>
 </div>

 {/* Public URL Info */}
 {organization?.slug && (
 <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
 <div className="flex items-center gap-3">
 <Globe className="w-5 h-5 text-gray-400" />
 <div className="flex-1 min-w-0">
 <p className="text-sm text-gray-600">Your public page URL:</p>
 <p className="text-sm font-mono text-primary-600 truncate">
 {window.location.origin}/org/{organization.slug}
 </p>
 </div>
 <button
 onClick={() => {
 navigator.clipboard.writeText(`${window.location.origin}/org/${organization.slug}`)
 notify.success('URL copied to clipboard!')
 }}
 className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg transition-colors"
 >
 Copy
 </button>
 </div>
 </div>
 )}
 </div>
 )
}
