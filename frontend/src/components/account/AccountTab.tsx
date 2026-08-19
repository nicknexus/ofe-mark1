import { Mail, Plus, Rocket, Save, User as UserIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Spinner } from '../ui'
import type { AccountTabProps } from './accountTypes'

export function AccountTab({
  formData, setFormData, saving, handleSubmit,
  hasOwnOrganization, teamLoading,
  showCreateOrg, setShowCreateOrg, newOrgName, setNewOrgName, creatingOrg, handleCreateOrganization,
}: AccountTabProps) {
  return (
    <div className="space-y-6">
      <div className="app-card p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-1">Your account</h2>
        <p className="text-sm text-secondary-500 mb-5">This is you, not the organization. Email is locked to your login.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="app-label flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              Email
            </label>
            <input type="email" value={formData.email} disabled className="app-input bg-gray-50 text-gray-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="app-label flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5" />
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="app-input"
              placeholder="Your name"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-secondary-500">
              Organization, public page, and embed live in{' '}
              <Link to="/share/public" className="text-primary-700 hover:underline">Share</Link>.
            </p>
            <button type="submit" disabled={saving} className="app-btn app-btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      {!teamLoading && !hasOwnOrganization && (
        <div className="app-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary-50 rounded-xl">
              <Rocket className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">Start your own organization</h2>
              <p className="text-sm text-secondary-500">Create one and start a 14-day trial.</p>
            </div>
          </div>
          {!showCreateOrg ? (
            <button onClick={() => setShowCreateOrg(true)} className="app-btn app-btn-primary app-btn-sm">
              <Plus className="w-4 h-4" />
              Create organization
            </button>
          ) : (
            <form onSubmit={handleCreateOrganization} className="space-y-4">
              <div>
                <label className="app-label">Organization name</label>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="app-input"
                  placeholder="Enter your organization name"
                  required
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={creatingOrg} className="app-btn app-btn-primary">
                  {creatingOrg ? (
                    <><Spinner className="w-4 h-4 border-white border-t-white/30" />Creating...</>
                  ) : (
                    <><Rocket className="w-4 h-4" />Create & start trial</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateOrg(false); setNewOrgName('') }}
                  className="app-btn app-btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
