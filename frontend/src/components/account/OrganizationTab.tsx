import React, { useEffect, useState } from 'react'
import {
    Building2,
    Globe,
    Heart,
    Link as LinkIcon,
    Save,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { apiService } from '../../services/api'
import type { OrganizationTabProps } from './accountTypes'

export function OrganizationTab({ organization, refreshPermissions }: OrganizationTabProps) {
    const [statement, setStatement] = useState(organization?.statement || '')
    const [websiteUrl, setWebsiteUrl] = useState(organization?.website_url || '')
    const [donationUrl, setDonationUrl] = useState(organization?.donation_url || '')
    const [saving, setSaving] = useState(false)

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
            toast.success('Organization profile updated!')
            await refreshPermissions()
        } catch (error) {
            toast.error((error as Error).message || 'Failed to update organization')
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
            {/* Organization Name (Read-only) */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
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
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all resize-none"
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
                            className="px-5 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
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
                                toast.success('URL copied to clipboard!')
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
