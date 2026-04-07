import React, { useState, useEffect } from 'react'
import {
    User as UserIcon,
    Mail,
    Building2,
    LogOut,
    CreditCard,
    Save,
    HardDrive,
    Info,
    ExternalLink,
    Users,
    ChevronRight,
    Palette,
    Trash2,
    Eye,
    EyeOff,
    Send,
    AlertTriangle,
    Copy
} from 'lucide-react'
import { AuthService } from '../../services/auth'
import { formatDate } from '../../utils'
import { apiService } from '../../services/api'
import { SubscriptionService } from '../../services/subscription'
import { TeamService, TeamMember, TeamInvitation } from '../../services/team'
import { useTeam } from '../../context/TeamContext'
import { User, SubscriptionStatus, Organization } from '../../types'
import toast from 'react-hot-toast'

interface MobileAccountTabProps {
    user: User
    subscriptionStatus: SubscriptionStatus | null
}

interface StorageUsage {
    storage_used_bytes: number
    used_gb: number
    used_percentage: number
    placeholder_max_bytes: number
    placeholder_max_gb: number
}

type SettingsView = 'menu' | 'profile' | 'subscription' | 'organization' | 'teams' | 'branding' | 'storage' | 'danger'

export default function MobileAccountTab({ user, subscriptionStatus }: MobileAccountTabProps) {
    const { isOwner, isSharedMember, organizationName, hasOwnOrganization } = useTeam()
    const [activeView, setActiveView] = useState<SettingsView>('menu')
    const [name, setName] = useState(user.name || '')
    const [saving, setSaving] = useState(false)
    const [organization, setOrganization] = useState<Organization | null>(null)
    const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null)
    const [storageLoading, setStorageLoading] = useState(true)
    const [initiativesUsage, setInitiativesUsage] = useState<{ current: number; limit: number | null } | null>(null)
    const [managingSubscription, setManagingSubscription] = useState(false)
    const [upgrading, setUpgrading] = useState(false)

    // Team state
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [pendingInvites, setPendingInvites] = useState<TeamInvitation[]>([])
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteAllowClaims, setInviteAllowClaims] = useState(false)
    const [sendingInvite, setSendingInvite] = useState(false)
    const [loadingTeam, setLoadingTeam] = useState(false)

    // Org state
    const [orgMission, setOrgMission] = useState('')
    const [orgWebsite, setOrgWebsite] = useState('')
    const [orgDonationLink, setOrgDonationLink] = useState('')
    const [savingOrg, setSavingOrg] = useState(false)
    const [isPublic, setIsPublic] = useState(false)
    const [togglingPublic, setTogglingPublic] = useState(false)

    // Branding
    const [brandColor, setBrandColor] = useState('')
    const [savingColor, setSavingColor] = useState(false)
    const [logoUploading, setLogoUploading] = useState(false)

    // Delete
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [deleting, setDeleting] = useState(false)

    useEffect(() => {
        apiService.getOrganizations().then(orgs => {
            if (orgs && orgs.length > 0) {
                setOrganization(orgs[0])
                setOrgMission(orgs[0].statement || '')
                setOrgWebsite(orgs[0].website || '')
                setOrgDonationLink(orgs[0].donation_link || '')
                setIsPublic(orgs[0].is_public || false)
                setBrandColor(orgs[0].brand_color || '#c0dfa1')
            }
        })
        apiService.getStorageUsage().then(usage => setStorageUsage(usage)).finally(() => setStorageLoading(false))
        SubscriptionService.getInitiativesUsage().then(usage => setInitiativesUsage(usage)).catch(() => {})
    }, [])

    const loadTeamData = async () => {
        setLoadingTeam(true)
        try {
            const [members, invites] = await Promise.all([
                TeamService.getMembers(),
                TeamService.getPendingInvitations(),
            ])
            setTeamMembers(members)
            setPendingInvites(invites)
        } catch {
            toast.error('Failed to load team data')
        } finally {
            setLoadingTeam(false)
        }
    }

    const handleManageSubscription = async () => {
        setManagingSubscription(true)
        try {
            const { url } = await SubscriptionService.createPortalSession()
            if (url) window.location.href = url
            else toast.error('Failed to open billing portal')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to open billing portal')
        } finally {
            setManagingSubscription(false)
        }
    }

    const handleUpgrade = async () => {
        setUpgrading(true)
        try {
            const { url } = await SubscriptionService.createCheckoutSession()
            if (url) window.location.href = url
            else toast.error('Failed to start checkout')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to start checkout')
        } finally {
            setUpgrading(false)
        }
    }

    const handleSaveProfile = async () => {
        setSaving(true)
        try {
            await AuthService.updateProfile({ name })
            toast.success('Profile updated')
        } catch {
            toast.error('Failed to update profile')
        } finally {
            setSaving(false)
        }
    }

    const handleSaveOrg = async () => {
        if (!organization?.id) return
        setSavingOrg(true)
        try {
            await apiService.updateOrganization(organization.id, {
                statement: orgMission,
                website: orgWebsite,
                donation_link: orgDonationLink,
            })
            toast.success('Organization updated')
        } catch {
            toast.error('Failed to update organization')
        } finally {
            setSavingOrg(false)
        }
    }

    const handleTogglePublic = async () => {
        if (!organization?.id) return
        setTogglingPublic(true)
        try {
            await apiService.updateOrganization(organization.id, { is_public: !isPublic })
            setIsPublic(!isPublic)
            toast.success(isPublic ? 'Organization is now private' : 'Organization is now public')
        } catch {
            toast.error('Failed to update visibility')
        } finally {
            setTogglingPublic(false)
        }
    }

    const handleSendInvite = async () => {
        if (!inviteEmail.trim()) return
        setSendingInvite(true)
        try {
            await TeamService.sendInvite(inviteEmail.trim(), inviteAllowClaims)
            toast.success('Invitation sent')
            setInviteEmail('')
            setInviteAllowClaims(false)
            loadTeamData()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to send invitation')
        } finally {
            setSendingInvite(false)
        }
    }

    const handleRemoveMember = async (memberId: string) => {
        try {
            await TeamService.removeMember(memberId)
            toast.success('Member removed')
            loadTeamData()
        } catch {
            toast.error('Failed to remove member')
        }
    }

    const handleRevokeInvite = async (inviteId: string) => {
        try {
            await TeamService.revokeInvite(inviteId)
            toast.success('Invitation revoked')
            loadTeamData()
        } catch {
            toast.error('Failed to revoke invitation')
        }
    }

    const handleSaveBrandColor = async () => {
        if (!organization?.id) return
        setSavingColor(true)
        try {
            await apiService.updateOrganization(organization.id, { brand_color: brandColor })
            toast.success('Brand color saved')
        } catch {
            toast.error('Failed to save brand color')
        } finally {
            setSavingColor(false)
        }
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !organization?.id) return
        setLogoUploading(true)
        try {
            await apiService.uploadOrganizationLogo(organization.id, file)
            const orgs = await apiService.getOrganizations()
            if (orgs?.[0]) setOrganization(orgs[0])
            toast.success('Logo uploaded')
        } catch {
            toast.error('Failed to upload logo')
        } finally {
            setLogoUploading(false)
        }
    }

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE MY ACCOUNT') return
        setDeleting(true)
        try {
            await AuthService.deleteAccount(deleteConfirmText)
            toast.success('Account deleted')
        } catch {
            toast.error('Failed to delete account')
        } finally {
            setDeleting(false)
        }
    }

    const handleSignOut = async () => {
        try {
            await AuthService.signOut()
            toast.success('Signed out')
        } catch {
            toast.error('Failed to sign out')
        }
    }

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const ViewHeader = ({ title, onBack }: { title: string; onBack: () => void }) => (
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
            <button onClick={onBack} className="p-1 -ml-1 text-gray-500">
                <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
    )

    const MenuItem = ({ icon: Icon, label, subtitle, onClick, badge, danger, iconBg, iconColor }: {
        icon: any; label: string; subtitle?: string; onClick: () => void; badge?: string; danger?: boolean
        iconBg?: string; iconColor?: string
    }) => (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3.5 px-4 py-3.5 active:bg-gray-50 transition-colors"
        >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg || (danger ? 'bg-red-50' : 'bg-gray-100')}`}>
                <Icon className={`w-[18px] h-[18px] ${iconColor || (danger ? 'text-red-500' : 'text-gray-600')}`} />
            </div>
            <div className="flex-1 text-left min-w-0">
                <div className={`text-[15px] font-medium ${danger ? 'text-red-600' : 'text-gray-900'}`}>{label}</div>
                {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
            </div>
            {badge && (
                <span className="text-xs font-medium bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">{badge}</span>
            )}
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
        </button>
    )

    // ── Sub-views ──

    if (activeView === 'profile') {
        return (
            <div className="min-h-full bg-gray-50">
                <ViewHeader title="Profile" onBack={() => setActiveView('menu')} />
                <div className="p-4 space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">Email</label>
                            <input type="email" value={user.email} disabled className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-300 focus:ring-1 focus:ring-primary-200 outline-none" />
                        </div>
                        {organization && (
                            <div>
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">Organization</label>
                                <input type="text" value={organization.name} disabled className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500" />
                            </div>
                        )}
                        <button onClick={handleSaveProfile} disabled={saving} className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:bg-primary-600">
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (activeView === 'subscription') {
        return (
            <div className="min-h-full bg-gray-50">
                <ViewHeader title="Subscription & Billing" onBack={() => setActiveView('menu')} />
                <div className="p-4 space-y-4">
                    {subscriptionStatus && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Status</span>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                                    subscriptionStatus.subscription.status === 'trial' ? 'bg-primary-100 text-primary-700'
                                    : subscriptionStatus.subscription.status === 'active' ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                    {subscriptionStatus.subscription.status === 'trial' ? 'Free Trial' : subscriptionStatus.subscription.status === 'active' ? 'Active' : subscriptionStatus.subscription.status}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">Plan</span>
                                <span className="text-sm font-medium text-gray-900 capitalize">{subscriptionStatus.subscription.status === 'trial' ? 'Trial' : subscriptionStatus.subscription.plan_tier || 'Starter'}</span>
                            </div>
                            {initiativesUsage && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Initiatives</span>
                                    <span className="text-sm font-medium text-gray-900">{initiativesUsage.limit === null ? `${initiativesUsage.current} (unlimited)` : `${initiativesUsage.current}/${initiativesUsage.limit}`}</span>
                                </div>
                            )}
                            {subscriptionStatus.subscription.status === 'trial' && subscriptionStatus.subscription.trial_ends_at && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Trial Ends</span>
                                    <span className="text-sm font-medium text-gray-900">{formatDate(subscriptionStatus.subscription.trial_ends_at)}</span>
                                </div>
                            )}
                            {subscriptionStatus.subscription.status === 'trial' && subscriptionStatus.remainingTrialDays !== null && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Time Left</span>
                                    <span className={`text-sm font-medium ${subscriptionStatus.remainingTrialDays <= 3 ? 'text-red-600' : subscriptionStatus.remainingTrialDays <= 7 ? 'text-amber-600' : 'text-gray-900'}`}>
                                        {subscriptionStatus.remainingTrialDays === 0 ? 'Ends today' : `${subscriptionStatus.remainingTrialDays} days`}
                                    </span>
                                </div>
                            )}
                            {subscriptionStatus.subscription.status === 'active' && subscriptionStatus.subscription.current_period_end && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">Next Billing</span>
                                    <span className="text-sm font-medium text-gray-900">{formatDate(subscriptionStatus.subscription.current_period_end)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {subscriptionStatus?.subscription.status === 'active' && subscriptionStatus.subscription.stripe_customer_id && (
                        <button onClick={handleManageSubscription} disabled={managingSubscription} className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:bg-gray-50">
                            {managingSubscription ? <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <><ExternalLink className="w-4 h-4" />Open Billing Portal</>}
                        </button>
                    )}

                    {subscriptionStatus?.subscription.status === 'trial' && isOwner && (
                        <button onClick={handleUpgrade} disabled={upgrading} className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:bg-primary-600">
                            {upgrading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Subscribe Now — $2/day'}
                        </button>
                    )}

                    {isSharedMember && (
                        <div className="flex items-center gap-2.5 p-3.5 bg-gray-50 rounded-xl">
                            <Info className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <p className="text-xs text-gray-600">Billing is managed by the organization owner.</p>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (activeView === 'organization') {
        return (
            <div className="min-h-full bg-gray-50">
                <ViewHeader title="Organization" onBack={() => setActiveView('menu')} />
                <div className="p-4 space-y-4">
                    {/* Public Visibility */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                                    {isPublic ? <Eye className="w-[18px] h-[18px] text-blue-600" /> : <EyeOff className="w-[18px] h-[18px] text-gray-400" />}
                                </div>
                                <div>
                                    <div className="text-[15px] font-medium text-gray-900">Public Profile</div>
                                    <div className="text-xs text-gray-400">{isPublic ? 'Visible to everyone' : 'Only you can see this'}</div>
                                </div>
                            </div>
                            <button onClick={handleTogglePublic} disabled={togglingPublic} className={`relative w-12 h-7 rounded-full transition-colors ${isPublic ? 'bg-primary-500' : 'bg-gray-300'}`}>
                                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                        {isPublic && organization?.slug && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/org/${organization.slug}`); toast.success('URL copied') }} className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 active:bg-gray-100">
                                    <Copy className="w-3.5 h-3.5" />
                                    <span className="truncate">{window.location.origin}/org/{organization.slug}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Org Details */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">Mission Statement</label>
                            <textarea value={orgMission} onChange={e => setOrgMission(e.target.value.slice(0, 150))} placeholder="What does your organization do?" rows={3} className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:border-primary-300 focus:ring-1 focus:ring-primary-200 outline-none" />
                            <p className="text-xs text-gray-400 text-right mt-1">{orgMission.length}/150</p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">Website</label>
                            <input type="url" value={orgWebsite} onChange={e => setOrgWebsite(e.target.value)} placeholder="https://yourorg.com" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-300 focus:ring-1 focus:ring-primary-200 outline-none" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5 block">Donation Link</label>
                            <input type="url" value={orgDonationLink} onChange={e => setOrgDonationLink(e.target.value)} placeholder="https://donate.yourorg.com" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-300 focus:ring-1 focus:ring-primary-200 outline-none" />
                        </div>
                        <button onClick={handleSaveOrg} disabled={savingOrg} className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:bg-primary-600">
                            <Save className="w-4 h-4" />
                            {savingOrg ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (activeView === 'teams') {
        if (loadingTeam && teamMembers.length === 0) {
            loadTeamData()
        }
        return (
            <div className="min-h-full bg-gray-50">
                <ViewHeader title="Team" onBack={() => setActiveView('menu')} />
                <div className="p-4 space-y-4">
                    {/* Invite */}
                    {isOwner && (
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                            <h3 className="text-sm font-semibold text-gray-800">Invite Team Member</h3>
                            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="team@example.com" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-300 focus:ring-1 focus:ring-primary-200 outline-none" />
                            <label className="flex items-center gap-2.5 py-1">
                                <input type="checkbox" checked={inviteAllowClaims} onChange={e => setInviteAllowClaims(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-400" />
                                <span className="text-sm text-gray-600">Allow creating Impact Claims</span>
                            </label>
                            <button onClick={handleSendInvite} disabled={sendingInvite || !inviteEmail.trim()} className="w-full py-2.5 bg-primary-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:bg-primary-600">
                                <Send className="w-4 h-4" />
                                {sendingInvite ? 'Sending...' : 'Send Invitation'}
                            </button>
                        </div>
                    )}

                    {/* Members */}
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-800">Members</h3>
                        </div>
                        {loadingTeam ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : teamMembers.length === 0 ? (
                            <div className="px-4 py-8 text-center">
                                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">No team members yet</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {teamMembers.map(member => (
                                    <div key={member.id} className="px-4 py-3 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                            <UserIcon className="w-4 h-4 text-purple-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-900 truncate">{member.user_name || member.user_email || 'Team Member'}</div>
                                            <div className="text-xs text-gray-400 truncate">{member.user_email}</div>
                                        </div>
                                        {isOwner && (
                                            <button onClick={() => handleRemoveMember(member.id)} className="text-xs text-red-500 font-medium px-2 py-1 rounded-lg active:bg-red-50">Remove</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pending Invites */}
                    {pendingInvites.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100">
                                <h3 className="text-sm font-semibold text-gray-800">Pending Invitations</h3>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {pendingInvites.map(invite => (
                                    <div key={invite.id} className="px-4 py-3 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                            <Mail className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-gray-900 truncate">{invite.email}</div>
                                            <div className="text-xs text-gray-400">Pending</div>
                                        </div>
                                        {isOwner && (
                                            <button onClick={() => handleRevokeInvite(invite.id)} className="text-xs text-red-500 font-medium px-2 py-1 rounded-lg active:bg-red-50">Revoke</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    if (activeView === 'branding') {
        const presetColors = ['#c0dfa1', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#ef4444', '#6366f1']
        return (
            <div className="min-h-full bg-gray-50">
                <ViewHeader title="Branding" onBack={() => setActiveView('menu')} />
                <div className="p-4 space-y-4">
                    {/* Logo */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                        <h3 className="text-sm font-semibold text-gray-800 mb-3">Logo</h3>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {organization?.logo_url ? (
                                    <img src={organization.logo_url} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <Building2 className="w-6 h-6 text-gray-400" />
                                )}
                            </div>
                            <label className="flex-1">
                                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                                <div className="py-2.5 px-4 bg-gray-100 rounded-xl text-sm font-medium text-gray-700 text-center active:bg-gray-200 cursor-pointer">
                                    {logoUploading ? 'Uploading...' : organization?.logo_url ? 'Change Logo' : 'Upload Logo'}
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Brand Color */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-gray-800">Brand Color</h3>
                        <div className="flex flex-wrap gap-2.5">
                            {presetColors.map(color => (
                                <button key={color} onClick={() => setBrandColor(color)} className={`w-9 h-9 rounded-xl transition-all ${brandColor === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`} style={{ backgroundColor: color }} />
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="color" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="w-9 h-9 rounded-lg cursor-pointer border-0" />
                            <input type="text" value={brandColor} onChange={e => setBrandColor(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono" />
                        </div>
                        <button onClick={handleSaveBrandColor} disabled={savingColor} className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:bg-primary-600">
                            <Save className="w-4 h-4" />
                            {savingColor ? 'Saving...' : 'Save Color'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (activeView === 'storage') {
        return (
            <div className="min-h-full bg-gray-50">
                <ViewHeader title="Storage" onBack={() => setActiveView('menu')} />
                <div className="p-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-4">
                        {storageLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : storageUsage ? (
                            <div className="space-y-4">
                                <div className="text-center py-2">
                                    <span className="text-3xl font-bold text-gray-900">{storageUsage.used_gb.toFixed(2)}</span>
                                    <span className="text-sm text-gray-500 ml-1">GB used</span>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(storageUsage.used_percentage, 100)}%` }} />
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>{formatBytes(storageUsage.storage_used_bytes)}</span>
                                        <span>{storageUsage.placeholder_max_gb} GB limit</span>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-xl">
                                    <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-blue-600">Storage limits are tied to your subscription plan.</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-6">No storage data available</p>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    if (activeView === 'danger') {
        return (
            <div className="min-h-full bg-gray-50">
                <ViewHeader title="Delete Account" onBack={() => setActiveView('menu')} />
                <div className="p-4 space-y-4">
                    <div className="bg-red-50 rounded-2xl border border-red-200 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <h3 className="text-sm font-semibold text-red-800">Danger Zone</h3>
                        </div>
                        <p className="text-sm text-red-700">This will permanently delete your account and all associated data. This action cannot be undone.</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider block">
                            Type <span className="font-bold text-red-600">DELETE MY ACCOUNT</span> to confirm
                        </label>
                        <input type="text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="DELETE MY ACCOUNT" className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-red-300 focus:ring-1 focus:ring-red-200 outline-none" />
                        <button onClick={handleDeleteAccount} disabled={deleteConfirmText !== 'DELETE MY ACCOUNT' || deleting} className="w-full py-3 bg-red-600 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:bg-red-700">
                            <Trash2 className="w-4 h-4" />
                            {deleting ? 'Deleting...' : 'Delete My Account Forever'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── Main Menu ──

    const subStatus = subscriptionStatus?.subscription.status
    const subBadge = subStatus === 'trial' ? 'Trial' : subStatus === 'active' ? 'Active' : undefined

    return (
        <div className="min-h-full" style={{ backgroundColor: '#F9FAFB' }}>
            {/* Profile Header */}
            <div className="bg-white px-4 pt-6 pb-5 border-b border-gray-100">
                <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
                        <span className="text-xl font-bold text-white">
                            {(user.name || user.email).charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold text-gray-900 truncate">{user.name || 'User'}</h1>
                        <p className="text-sm text-gray-500 truncate">{user.email}</p>
                        {organizationName && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">{organizationName}</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Menu Sections */}
            <div className="py-3 space-y-2">
                {/* General */}
                <div className="bg-white border-y border-gray-100">
                    <MenuItem icon={UserIcon} label="Profile" subtitle="Name, email, organization" onClick={() => setActiveView('profile')} iconBg="bg-gray-100" iconColor="text-gray-600" />
                    <div className="h-px bg-gray-100 mx-4" />
                    <MenuItem icon={CreditCard} label="Subscription & Billing" subtitle={subBadge ? `Plan: ${subBadge}` : 'Manage your plan'} onClick={() => setActiveView('subscription')} badge={subBadge} iconBg="bg-green-50" iconColor="text-green-600" />
                </div>

                {/* Organization (owners only) */}
                {hasOwnOrganization && (
                    <div className="bg-white border-y border-gray-100">
                        <MenuItem icon={Building2} label="Organization" subtitle="Mission, website, visibility" onClick={() => setActiveView('organization')} iconBg="bg-blue-50" iconColor="text-blue-600" />
                        <div className="h-px bg-gray-100 mx-4" />
                        <MenuItem icon={Users} label="Team" subtitle="Invite and manage members" onClick={() => { setActiveView('teams'); loadTeamData() }} iconBg="bg-purple-50" iconColor="text-purple-600" />
                        <div className="h-px bg-gray-100 mx-4" />
                        <MenuItem icon={Palette} label="Branding" subtitle="Logo and brand color" onClick={() => setActiveView('branding')} iconBg="bg-pink-50" iconColor="text-pink-600" />
                    </div>
                )}

                {/* Data */}
                <div className="bg-white border-y border-gray-100">
                    <MenuItem icon={HardDrive} label="Storage" subtitle={storageUsage ? `${storageUsage.used_gb.toFixed(2)} GB of ${storageUsage.placeholder_max_gb} GB` : 'View usage'} onClick={() => setActiveView('storage')} iconBg="bg-sky-50" iconColor="text-sky-600" />
                </div>

                {/* Danger */}
                <div className="bg-white border-y border-gray-100">
                    <MenuItem icon={Trash2} label="Delete Account" onClick={() => setActiveView('danger')} danger />
                </div>

                {/* Sign Out */}
                <div className="px-4 pt-2">
                    <button onClick={handleSignOut} className="w-full py-3.5 bg-white border border-gray-200 text-gray-700 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 active:bg-gray-50 shadow-sm">
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </div>
        </div>
    )
}
