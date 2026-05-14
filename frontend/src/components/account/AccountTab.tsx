import {
    AlertTriangle,
    Calendar,
    CreditCard,
    ExternalLink,
    Globe,
    Info,
    Lock,
    Mail,
    Plus,
    Rocket,
    Save,
    Settings,
    Sparkles,
    User as UserIcon,
    Zap,
} from 'lucide-react'
import { formatDate } from '../../utils'
import type { AccountTabProps } from './accountTypes'

export function AccountTab({
    subscriptionStatus, user, formData, setFormData, saving, handleSubmit,
    initiativesUsage, managingSubscription, handleManageSubscription, upgrading, handleUpgrade,
    isOwner, isSharedMember, hasOwnOrganization, ownedOrganization, teamLoading,
    showCreateOrg, setShowCreateOrg, newOrgName, setNewOrgName, creatingOrg, handleCreateOrganization,
    updatingPublic, handleTogglePublic,
}: AccountTabProps) {
    return (
        <div className="space-y-6">
            {/* Subscription Card */}
            {subscriptionStatus && (
                <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary-50 rounded-xl">
                                <CreditCard className="w-5 h-5 text-primary-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-800">Subscription</h2>
                        </div>
                        {subscriptionStatus.subscription.status === 'active' && subscriptionStatus.subscription.stripe_customer_id && (
                            <button onClick={handleManageSubscription} disabled={managingSubscription}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50">
                                {managingSubscription ? <><div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />Loading...</> : <><Settings className="w-4 h-4" />Manage<ExternalLink className="w-3 h-3" /></>}
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-1">
                            <div className="text-sm text-gray-500 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />Status</div>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${subscriptionStatus.subscription.status === 'trial' ? 'bg-primary-100 text-primary-700' :
                                subscriptionStatus.subscription.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                }`}>
                                {subscriptionStatus.subscription.status === 'trial' ? 'Free Trial' : subscriptionStatus.subscription.status === 'active' ? 'Active' : subscriptionStatus.subscription.status.charAt(0).toUpperCase() + subscriptionStatus.subscription.status.slice(1)}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <div className="text-sm text-gray-500">Plan</div>
                            <div className="text-base font-medium text-gray-900 capitalize">
                                {subscriptionStatus.subscription.status === 'trial' ? 'Trial (Full Access)' : subscriptionStatus.subscription.plan_tier || 'Starter'}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-sm text-gray-500 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" />Initiatives</div>
                            <div className="text-base font-medium text-gray-900">
                                {initiativesUsage ? (initiativesUsage.limit === null ? <span>{initiativesUsage.current} <span className="text-gray-500 text-sm font-normal">(unlimited)</span></span> : <span className={initiativesUsage.current >= initiativesUsage.limit ? 'text-amber-600' : ''}>{initiativesUsage.current} / {initiativesUsage.limit}</span>) : <span className="text-gray-400">Loading...</span>}
                            </div>
                        </div>

                        {subscriptionStatus.subscription.status === 'trial' && subscriptionStatus.subscription.trial_ends_at && (
                            <div className="space-y-1">
                                <div className="text-sm text-gray-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Trial Ends</div>
                                <div className="text-base font-medium text-gray-900">
                                    {formatDate(subscriptionStatus.subscription.trial_ends_at)}
                                </div>
                            </div>
                        )}
                    </div>

                    {subscriptionStatus.subscription.status === 'trial' && isOwner && (
                        <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between">
                            <div><p className="text-sm font-medium text-gray-900">Ready to subscribe?</p><p className="text-xs text-gray-500">$2/day • Billed $56 every 4 weeks</p></div>
                            <button onClick={handleUpgrade} disabled={upgrading} className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors disabled:opacity-50">
                                {upgrading ? 'Loading...' : 'Subscribe Now'}
                            </button>
                        </div>
                    )}

                    {isSharedMember && (
                        <div className="mt-6 pt-5 border-t border-gray-100">
                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                <Info className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                <p className="text-sm text-gray-600">Billing is managed by your organization owner.</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Profile Card */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-gray-100 rounded-xl"><UserIcon className="w-5 h-5 text-gray-600" /></div>
                    <h2 className="text-lg font-semibold text-gray-800">Profile</h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5"><Mail className="w-3.5 h-3.5" /><span>Email</span></label>
                        <input type="email" value={formData.email} disabled className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed" />
                    </div>
                    <div>
                        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 mb-1.5"><UserIcon className="w-3.5 h-3.5" /><span>Name</span></label>
                        <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all" placeholder="Your name" />
                    </div>
                    <div className="flex justify-end pt-3">
                        <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors flex items-center gap-2">
                            <Save className="w-4 h-4" /><span>{saving ? 'Saving...' : 'Save'}</span>
                        </button>
                    </div>
                </form>
            </div>

            {/* Public Visibility Card - Only for org owners */}
            {hasOwnOrganization && ownedOrganization && (
                <div className={`rounded-2xl shadow-bubble p-6 ${ownedOrganization.is_public ? 'bg-white border border-gray-100' : 'bg-amber-50 border-2 border-amber-200'}`}>
                    <div className="flex items-center gap-3 mb-5">
                        <div className={`relative p-2 rounded-xl ${ownedOrganization.is_public ? 'bg-green-50' : 'bg-amber-100'}`}>
                            {ownedOrganization.is_public ? <Globe className="w-5 h-5 text-green-600" /> : <Lock className="w-5 h-5 text-amber-600" />}
                            {!ownedOrganization.is_public && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">!</span>
                            )}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-semibold text-gray-800">Public Visibility</h2>
                                {!ownedOrganization.is_public && (
                                    <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-medium rounded-full">Action Required</span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">Control whether your organization appears on the public site</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl mb-4">
                        <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${ownedOrganization.is_public ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'}`}>
                                {ownedOrganization.is_public ? 'Public' : 'Private'}
                            </span>
                            <span className="text-sm text-gray-600">
                                {ownedOrganization.is_public
                                    ? 'Your organization is visible on the Explore page'
                                    : 'Your organization is hidden from the public site'}
                            </span>
                        </div>
                        <button
                            onClick={() => handleTogglePublic(!ownedOrganization.is_public)}
                            disabled={updatingPublic}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ownedOrganization.is_public ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                            {updatingPublic ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${ownedOrganization.is_public ? 'translate-x-6' : 'translate-x-1'}`} />
                            )}
                        </button>
                    </div>

                    {/* Disclaimer */}
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <p className="font-medium mb-1">Important Notice</p>
                                <p className="text-amber-700">
                                    When your organization is public, all your initiatives, impact data, stories, and uploaded media can be viewed by anyone on the internet.
                                    Content that violates our Terms of Service may be removed without notice.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Organization (for users without one) */}
            {!teamLoading && !hasOwnOrganization && (
                <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-2xl shadow-bubble border border-primary-100 p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-white rounded-xl shadow-sm"><Rocket className="w-5 h-5 text-primary-600" /></div>
                        <div><h2 className="text-lg font-semibold text-gray-800">Start Your Own Organization</h2><p className="text-xs text-gray-600">Create your own initiatives and invite your own team</p></div>
                    </div>
                    {!showCreateOrg ? (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600 max-w-md">Want to track impact for your own organization? Create one and start a 14-day free trial.</p>
                            <button onClick={() => setShowCreateOrg(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors whitespace-nowrap">
                                <Plus className="w-4 h-4" />Create Organization
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleCreateOrganization} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Name</label>
                                <input type="text" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all bg-white" placeholder="Enter your organization name" required autoFocus />
                            </div>
                            <div className="flex items-center gap-3">
                                <button type="submit" disabled={creatingOrg} className="px-5 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50">
                                    {creatingOrg ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Creating...</> : <><Rocket className="w-4 h-4" />Create & Start Trial</>}
                                </button>
                                <button type="button" onClick={() => { setShowCreateOrg(false); setNewOrgName('') }} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">Cancel</button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    )
}
