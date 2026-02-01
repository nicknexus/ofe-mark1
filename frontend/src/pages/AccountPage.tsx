import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    ArrowLeft, User as UserIcon, Mail, Building2, Save, HardDrive, Info, Clock, CreditCard, Calendar,
    Sparkles, ExternalLink, Settings, Zap, Users, ChevronRight, Plus, Rocket, Trash2, AlertTriangle, X,
    UserPlus, RefreshCw, Send, FileText, ToggleLeft, Camera, Upload, Palette, Globe, Lock
} from 'lucide-react'
import { AuthService } from '../services/auth'
import { apiService } from '../services/api'
import { SubscriptionService } from '../services/subscription'
import { TeamService, TeamMember, TeamInvitation, TeamCapacity } from '../services/team'
import { useTeam } from '../context/TeamContext'
import { User, SubscriptionStatus } from '../types'
import toast from 'react-hot-toast'

interface StorageUsage {
    storage_used_bytes: number
    used_gb: number
    used_percentage: number
    placeholder_max_bytes: number
    placeholder_max_gb: number
}

interface Props {
    subscriptionStatus?: SubscriptionStatus | null
}

type TabType = 'account' | 'teams' | 'branding' | 'storage' | 'danger'

export default function AccountPage({ subscriptionStatus }: Props) {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { isOwner, isSharedMember, organizationName, hasOwnOrganization, ownedOrganization, loading: teamLoading, refreshPermissions } = useTeam()

    // Get initial tab from URL or default to 'account'
    const initialTab = (searchParams.get('tab') as TabType) || 'account'
    const [activeTab, setActiveTab] = useState<TabType>(initialTab)

    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null)
    const [storageLoading, setStorageLoading] = useState(true)
    const [formData, setFormData] = useState({ name: '', email: '' })
    const [initiativesUsage, setInitiativesUsage] = useState<{ current: number; limit: number | null } | null>(null)
    const [managingSubscription, setManagingSubscription] = useState(false)
    const [upgrading, setUpgrading] = useState(false)

    // Create org state
    const [showCreateOrg, setShowCreateOrg] = useState(false)
    const [newOrgName, setNewOrgName] = useState('')
    const [creatingOrg, setCreatingOrg] = useState(false)

    // Delete account state
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteConfirmation, setDeleteConfirmation] = useState('')
    const [deleting, setDeleting] = useState(false)

    // Team state
    const [members, setMembers] = useState<TeamMember[]>([])
    const [invitations, setInvitations] = useState<TeamInvitation[]>([])
    const [capacity, setCapacity] = useState<TeamCapacity | null>(null)
    const [teamLoading2, setTeamLoading2] = useState(true)
    const [inviteEmail, setInviteEmail] = useState('')
    const [allowImpactClaims, setAllowImpactClaims] = useState(false)
    const [sending, setSending] = useState(false)
    const [updatingMember, setUpdatingMember] = useState<string | null>(null)
    const [removingMember, setRemovingMember] = useState<string | null>(null)
    const [resendingInvite, setResendingInvite] = useState<string | null>(null)
    const [revokingInvite, setRevokingInvite] = useState<string | null>(null)

    // Logo state
    const [uploadingLogo, setUploadingLogo] = useState(false)
    const [deletingLogo, setDeletingLogo] = useState(false)
    const logoInputRef = useRef<HTMLInputElement>(null)

    // Brand color state
    const [brandColor, setBrandColor] = useState<string>(ownedOrganization?.brand_color || '#c0dfa1')

    // Public visibility state
    const [updatingPublic, setUpdatingPublic] = useState(false)

    // Sync brand color when organization loads
    useEffect(() => {
        if (ownedOrganization?.brand_color) {
            setBrandColor(ownedOrganization.brand_color)
        }
    }, [ownedOrganization?.brand_color])

    // Update URL when tab changes
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab)
        setSearchParams({ tab })
    }

    useEffect(() => {
        const loadUser = async () => {
            try {
                const currentUser = await AuthService.getCurrentUser()
                setUser(currentUser)
                if (currentUser) {
                    setFormData({ name: currentUser.name || '', email: currentUser.email || '' })
                }
            } catch (error) {
                console.error('Error loading user:', error)
                toast.error('Failed to load account information')
            } finally {
                setLoading(false)
            }
        }
        loadUser()
    }, [])

    useEffect(() => {
        const loadStorageUsage = async () => {
            try {
                const usage = await apiService.getStorageUsage()
                setStorageUsage(usage)
            } catch (error) {
                console.error('Error loading storage usage:', error)
            } finally {
                setStorageLoading(false)
            }
        }
        loadStorageUsage()
    }, [])

    useEffect(() => {
        const loadInitiativesUsage = async () => {
            try {
                const usage = await SubscriptionService.getInitiativesUsage()
                setInitiativesUsage(usage)
            } catch (error) {
                console.error('Error loading initiatives usage:', error)
            }
        }
        loadInitiativesUsage()
    }, [])

    useEffect(() => {
        if (hasOwnOrganization && activeTab === 'teams') {
            loadTeamData()
        }
    }, [hasOwnOrganization, activeTab])

    const loadTeamData = async () => {
        try {
            setTeamLoading2(true)
            const [membersData, invitationsData, capacityData] = await Promise.all([
                TeamService.getMembers(),
                TeamService.getPendingInvitations(),
                TeamService.getCapacity()
            ])
            setMembers(membersData)
            setInvitations(invitationsData)
            setCapacity(capacityData)
        } catch (error) {
            toast.error('Failed to load team data')
        } finally {
            setTeamLoading2(false)
        }
    }

    const handleManageSubscription = async () => {
        setManagingSubscription(true)
        try {
            const { url } = await SubscriptionService.createPortalSession()
            if (url) window.location.href = url
            else toast.error('Failed to open subscription management')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to open subscription management')
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            await AuthService.updateProfile({ name: formData.name })
            toast.success('Profile updated successfully')
            const updatedUser = await AuthService.getCurrentUser()
            setUser(updatedUser)
        } catch (error) {
            toast.error('Failed to update profile')
        } finally {
            setSaving(false)
        }
    }

    const handleCreateOrganization = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newOrgName.trim()) { toast.error('Organization name is required'); return }
        setCreatingOrg(true)
        try {
            await apiService.createOrganization(newOrgName.trim())
            toast.success('Organization created! You can now start a free trial.')
            setShowCreateOrg(false)
            setNewOrgName('')
            await refreshPermissions()
            window.location.reload()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create organization')
        } finally {
            setCreatingOrg(false)
        }
    }

    const handleDeleteAccount = async () => {
        if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
            toast.error('Please type "DELETE MY ACCOUNT" exactly to confirm')
            return
        }
        setDeleting(true)
        try {
            await AuthService.deleteAccount(deleteConfirmation)
            toast.success('Your account has been deleted')
            window.location.href = '/'
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to delete account')
            setDeleting(false)
        }
    }

    // Team handlers
    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inviteEmail.trim()) { toast.error('Please enter an email address'); return }
        setSending(true)
        try {
            const result = await TeamService.sendInvite(inviteEmail.trim(), allowImpactClaims)
            if (result.emailSent) toast.success(`Invitation sent to ${inviteEmail}`)
            else toast.success('Invitation created, but email could not be sent.')
            setInviteEmail('')
            setAllowImpactClaims(false)
            loadTeamData()
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setSending(false)
        }
    }

    const handleToggleMemberPermission = async (member: TeamMember) => {
        setUpdatingMember(member.id)
        try {
            await TeamService.updateMemberPermissions(member.id, !member.can_add_impact_claims)
            toast.success('Permission updated')
            loadTeamData()
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setUpdatingMember(null)
        }
    }

    const handleRemoveMember = async (member: TeamMember) => {
        if (!confirm(`Remove ${member.user_email || member.user_name || 'this member'} from the team?`)) return
        setRemovingMember(member.id)
        try {
            await TeamService.removeMember(member.id)
            toast.success('Member removed')
            loadTeamData()
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setRemovingMember(null)
        }
    }

    const handleResendInvite = async (invitation: TeamInvitation) => {
        setResendingInvite(invitation.id)
        try {
            const result = await TeamService.resendInvite(invitation.id)
            if (result.emailSent) toast.success('Invitation resent')
            else toast.error('Failed to send email')
            loadTeamData()
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setResendingInvite(null)
        }
    }

    const handleRevokeInvite = async (invitation: TeamInvitation) => {
        if (!confirm(`Revoke invitation for ${invitation.email}?`)) return
        setRevokingInvite(invitation.id)
        try {
            await TeamService.revokeInvite(invitation.id)
            toast.success('Invitation revoked')
            loadTeamData()
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setRevokingInvite(null)
        }
    }

    // Logo handlers
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !ownedOrganization?.id) return
        if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
        if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return }
        setUploadingLogo(true)
        try {
            await apiService.uploadOrganizationLogo(ownedOrganization.id, file)
            toast.success('Logo uploaded successfully')
            await refreshPermissions()
        } catch (error) {
            toast.error((error as Error).message || 'Failed to upload logo')
        } finally {
            setUploadingLogo(false)
            if (logoInputRef.current) logoInputRef.current.value = ''
        }
    }

    const handleDeleteLogo = async () => {
        if (!ownedOrganization?.id || !ownedOrganization?.logo_url) return
        if (!confirm('Are you sure you want to remove the organization logo?')) return
        setDeletingLogo(true)
        try {
            await apiService.deleteOrganizationLogo(ownedOrganization.id)
            toast.success('Logo removed')
            await refreshPermissions()
        } catch (error) {
            toast.error((error as Error).message || 'Failed to remove logo')
        } finally {
            setDeletingLogo(false)
        }
    }

    const handleBrandColorChange = async (color: string) => {
        if (!ownedOrganization?.id) return
        try {
            await apiService.updateOrganization(ownedOrganization.id, { brand_color: color })
            setBrandColor(color)
            toast.success('Brand color updated!')
            await refreshPermissions()
        } catch (error) {
            toast.error((error as Error).message || 'Failed to update brand color')
            throw error
        }
    }

    const handleTogglePublic = async (makePublic: boolean) => {
        if (!ownedOrganization?.id) return
        setUpdatingPublic(true)
        try {
            await apiService.updateOrganization(ownedOrganization.id, { is_public: makePublic })
            toast.success(makePublic ? 'Your organization is now public!' : 'Your organization is now private')
            await refreshPermissions()
        } catch (error) {
            toast.error((error as Error).message || 'Failed to update visibility')
        } finally {
            setUpdatingPublic(false)
        }
    }

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    const tabs = [
        { id: 'account' as TabType, label: 'Account', icon: UserIcon },
        { id: 'teams' as TabType, label: 'Teams', icon: Users, requiresOrg: true },
        { id: 'branding' as TabType, label: 'Branding', icon: Palette, requiresOrg: true },
        { id: 'storage' as TabType, label: 'Storage', icon: HardDrive },
        { id: 'danger' as TabType, label: 'Delete Account', icon: Trash2, danger: true },
    ]

    return (
        <div className="min-h-screen bg-gray-50 pt-24 pb-6">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
                {/* Header */}
                <div className="mb-6 flex items-center gap-4">
                    <button type="button" onClick={() => navigate('/')} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back</span>
                    </button>
                    <h1 className="text-xl font-semibold text-gray-900">Account Settings</h1>
                </div>

                <div className="flex gap-6">
                    {/* Sidebar */}
                    <div className="w-56 flex-shrink-0">
                        <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-2 sticky top-28">
                            <nav className="space-y-1">
                                {tabs.map((tab) => {
                                    if (tab.requiresOrg && !hasOwnOrganization) return null
                                    const showNotPublicIndicator = tab.id === 'account' && hasOwnOrganization && !ownedOrganization?.is_public
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => handleTabChange(tab.id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === tab.id
                                                    ? tab.danger ? 'bg-red-50 text-red-700' : 'bg-primary-50 text-primary-700'
                                                    : tab.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            <tab.icon className="w-4 h-4" />
                                            {tab.label}
                                            {showNotPublicIndicator && (
                                                <span className="ml-auto w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">!</span>
                                            )}
                                        </button>
                                    )
                                })}
                            </nav>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        {activeTab === 'account' && (
                            <AccountTab
                                subscriptionStatus={subscriptionStatus}
                                user={user}
                                formData={formData}
                                setFormData={setFormData}
                                saving={saving}
                                handleSubmit={handleSubmit}
                                initiativesUsage={initiativesUsage}
                                managingSubscription={managingSubscription}
                                handleManageSubscription={handleManageSubscription}
                                upgrading={upgrading}
                                handleUpgrade={handleUpgrade}
                                isOwner={isOwner}
                                isSharedMember={isSharedMember}
                                hasOwnOrganization={hasOwnOrganization}
                                ownedOrganization={ownedOrganization}
                                teamLoading={teamLoading}
                                showCreateOrg={showCreateOrg}
                                setShowCreateOrg={setShowCreateOrg}
                                newOrgName={newOrgName}
                                setNewOrgName={setNewOrgName}
                                creatingOrg={creatingOrg}
                                handleCreateOrganization={handleCreateOrganization}
                                updatingPublic={updatingPublic}
                                handleTogglePublic={handleTogglePublic}
                            />
                        )}

                        {activeTab === 'teams' && hasOwnOrganization && (
                            <TeamsTab
                                organizationName={organizationName}
                                members={members}
                                invitations={invitations}
                                capacity={capacity}
                                loading={teamLoading2}
                                inviteEmail={inviteEmail}
                                setInviteEmail={setInviteEmail}
                                allowImpactClaims={allowImpactClaims}
                                setAllowImpactClaims={setAllowImpactClaims}
                                sending={sending}
                                handleSendInvite={handleSendInvite}
                                updatingMember={updatingMember}
                                removingMember={removingMember}
                                resendingInvite={resendingInvite}
                                revokingInvite={revokingInvite}
                                handleToggleMemberPermission={handleToggleMemberPermission}
                                handleRemoveMember={handleRemoveMember}
                                handleResendInvite={handleResendInvite}
                                handleRevokeInvite={handleRevokeInvite}
                                formatDate={formatDate}
                            />
                        )}

                        {activeTab === 'branding' && hasOwnOrganization && (
                            <BrandingTab
                                organizationName={organizationName}
                                organizationId={ownedOrganization?.id}
                                organizationLogo={ownedOrganization?.logo_url}
                                brandColor={brandColor}
                                uploadingLogo={uploadingLogo}
                                deletingLogo={deletingLogo}
                                logoInputRef={logoInputRef}
                                handleLogoUpload={handleLogoUpload}
                                handleDeleteLogo={handleDeleteLogo}
                                onBrandColorChange={handleBrandColorChange}
                            />
                        )}

                        {activeTab === 'storage' && (
                            <StorageTab
                                storageUsage={storageUsage}
                                storageLoading={storageLoading}
                                formatBytes={formatBytes}
                            />
                        )}

                        {activeTab === 'danger' && (
                            <DangerTab
                                hasOwnOrganization={hasOwnOrganization}
                                showDeleteModal={showDeleteModal}
                                setShowDeleteModal={setShowDeleteModal}
                                deleteConfirmation={deleteConfirmation}
                                setDeleteConfirmation={setDeleteConfirmation}
                                deleting={deleting}
                                handleDeleteAccount={handleDeleteAccount}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================
// Tab Components
// ============================================

function AccountTab({
    subscriptionStatus, user, formData, setFormData, saving, handleSubmit,
    initiativesUsage, managingSubscription, handleManageSubscription, upgrading, handleUpgrade,
    isOwner, isSharedMember, hasOwnOrganization, ownedOrganization, teamLoading,
    showCreateOrg, setShowCreateOrg, newOrgName, setNewOrgName, creatingOrg, handleCreateOrganization,
    updatingPublic, handleTogglePublic
}: any) {
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
                                    {new Date(subscriptionStatus.subscription.trial_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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

function TeamsTab({
    organizationName, members, invitations, capacity, loading,
    inviteEmail, setInviteEmail, allowImpactClaims, setAllowImpactClaims, sending, handleSendInvite,
    updatingMember, removingMember, resendingInvite, revokingInvite,
    handleToggleMemberPermission, handleRemoveMember, handleResendInvite, handleRevokeInvite, formatDate
}: any) {
    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading team data...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Invite Form */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-50 rounded-xl"><UserPlus className="w-5 h-5 text-primary-600" /></div>
                        <h2 className="text-lg font-semibold text-gray-800">Invite Team Member</h2>
                    </div>
                    {capacity && (
                        <div className={`text-sm px-3 py-1 rounded-full ${capacity.canAdd ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {capacity.current} / {capacity.limit} seats used
                        </div>
                    )}
                </div>

                {capacity && !capacity.canAdd ? (
                    <div className="p-4 bg-amber-50 rounded-xl text-amber-800">
                        <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-5 h-5" /><span className="font-medium">Team Limit Reached</span></div>
                        <p className="text-sm">Remove a member or revoke an invitation to add more.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSendInvite} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all" />
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-gray-500" /><span className="text-sm text-gray-700">Allow creating Impact Claims</span></div>
                            <button type="button" onClick={() => setAllowImpactClaims(!allowImpactClaims)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${allowImpactClaims ? 'bg-primary-500' : 'bg-gray-300'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${allowImpactClaims ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <button type="submit" disabled={sending || !inviteEmail.trim()} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                            {sending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</> : <><Send className="w-4 h-4" />Send Invitation</>}
                        </button>
                    </form>
                )}
            </div>

            {/* Team Members */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-50 rounded-xl"><Users className="w-5 h-5 text-green-600" /></div>
                    <h2 className="text-lg font-semibold text-gray-800">Team Members ({members.length})</h2>
                </div>
                {members.length === 0 ? (
                    <div className="text-center py-8 text-gray-500"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">No team members yet</p></div>
                ) : (
                    <div className="space-y-3">
                        {members.map((member: TeamMember) => (
                            <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                                        <span className="text-primary-700 font-medium">{(member.user_name || member.user_email || '?')[0].toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{member.user_name || member.user_email}</p>
                                        {member.user_name && member.user_email && <p className="text-xs text-gray-500">{member.user_email}</p>}
                                        <p className="text-xs text-gray-400">Joined {formatDate(member.joined_at)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Impact Claims</span>
                                        <button onClick={() => handleToggleMemberPermission(member)} disabled={updatingMember === member.id} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${member.can_add_impact_claims ? 'bg-green-500' : 'bg-gray-300'}`}>
                                            {updatingMember === member.id ? <div className="absolute inset-0 flex items-center justify-center"><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /></div> : <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${member.can_add_impact_claims ? 'translate-x-6' : 'translate-x-1'}`} />}
                                        </button>
                                    </div>
                                    <button onClick={() => handleRemoveMember(member)} disabled={removingMember === member.id} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                        {removingMember === member.id ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pending Invitations */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-amber-50 rounded-xl"><Mail className="w-5 h-5 text-amber-600" /></div>
                    <h2 className="text-lg font-semibold text-gray-800">Pending Invitations ({invitations.length})</h2>
                </div>
                {invitations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500"><Mail className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">No pending invitations</p></div>
                ) : (
                    <div className="space-y-3">
                        {invitations.map((invitation: TeamInvitation) => {
                            const isExpired = new Date(invitation.expires_at) < new Date()
                            return (
                                <div key={invitation.id} className={`flex items-center justify-between p-4 rounded-xl ${isExpired ? 'bg-red-50' : 'bg-gray-50'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isExpired ? 'bg-red-100' : 'bg-amber-100'}`}>
                                            {isExpired ? <X className="w-5 h-5 text-red-500" /> : <Clock className="w-5 h-5 text-amber-500" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{invitation.email}</p>
                                            <p className="text-xs text-gray-500">Sent {formatDate(invitation.created_at)} • <span className={isExpired ? 'text-red-500' : ''}>{isExpired ? 'Expired' : `Expires ${formatDate(invitation.expires_at)}`}</span></p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleResendInvite(invitation)} disabled={resendingInvite === invitation.id} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                                            {resendingInvite === invitation.id ? <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => handleRevokeInvite(invitation)} disabled={revokingInvite === invitation.id} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            {revokingInvite === invitation.id ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

function BrandingTab({ organizationName, organizationLogo, organizationId, brandColor, uploadingLogo, deletingLogo, logoInputRef, handleLogoUpload, handleDeleteLogo, onBrandColorChange }: any) {
    const [selectedColor, setSelectedColor] = useState(brandColor || '#c0dfa1')
    const [savingColor, setSavingColor] = useState(false)

    const presetColors = [
        { name: 'Nexus Green', value: '#c0dfa1' },
        { name: 'Ocean Blue', value: '#60a5fa' },
        { name: 'Sunset Orange', value: '#fb923c' },
        { name: 'Rose Pink', value: '#f472b6' },
        { name: 'Purple', value: '#a78bfa' },
        { name: 'Teal', value: '#2dd4bf' },
        { name: 'Amber', value: '#fbbf24' },
        { name: 'Coral', value: '#f87171' },
    ]

    const handleColorSave = async () => {
        if (!organizationId || selectedColor === brandColor) return
        setSavingColor(true)
        try {
            await onBrandColorChange(selectedColor)
        } finally {
            setSavingColor(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Logo Section */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary-50 rounded-xl"><Camera className="w-5 h-5 text-primary-600" /></div>
                    <h2 className="text-lg font-semibold text-gray-800">Organization Logo</h2>
                </div>

                <div className="flex items-start gap-8">
                    {/* Logo Upload */}
                    <div className="flex flex-col items-center">
                        <div className="relative group">
                            <div className="w-32 h-32 rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 group-hover:border-primary-400 transition-colors">
                                {organizationLogo ? (
                                    <img src={organizationLogo} alt={organizationName} className="w-full h-full object-cover" />
                                ) : (
                                    <Building2 className="w-12 h-12 text-gray-400" />
                                )}
                            </div>

                            <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                                className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                {uploadingLogo ? <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="w-8 h-8 text-white" />}
                            </button>

                            {organizationLogo && !uploadingLogo && (
                                <button onClick={handleDeleteLogo} disabled={deletingLogo}
                                    className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors">
                                    {deletingLogo ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <X className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                        <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                        <p className="text-sm text-gray-500 mt-3">{organizationLogo ? 'Click to change' : 'Upload logo'}</p>
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">{organizationName}</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Your organization logo appears on your public dashboard and when others search for your organization on the Explore page.
                        </p>
                        <div className="p-4 bg-gray-50 rounded-xl">
                            <p className="text-sm text-gray-600 font-medium mb-2">Guidelines:</p>
                            <ul className="text-sm text-gray-500 space-y-1">
                                <li>• Square image recommended (1:1 ratio)</li>
                                <li>• Minimum 200x200 pixels</li>
                                <li>• PNG or JPG format</li>
                                <li>• Max file size: 5MB</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Brand Color Section */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary-50 rounded-xl"><Palette className="w-5 h-5 text-primary-600" /></div>
                    <h2 className="text-lg font-semibold text-gray-800">Brand Color</h2>
                </div>

                <p className="text-sm text-gray-600 mb-5">
                    Choose a brand color for your public pages. This will be used as the accent color throughout your public dashboard and initiative pages.
                </p>

                {/* Color Preview */}
                <div className="mb-6 p-4 rounded-xl" style={{ background: `linear-gradient(135deg, ${selectedColor}20, ${selectedColor}10)` }}>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl shadow-lg" style={{ backgroundColor: selectedColor }} />
                        <div>
                            <p className="text-sm font-medium text-gray-900">Preview</p>
                            <p className="text-xs text-gray-500 font-mono">{selectedColor.toUpperCase()}</p>
                        </div>
                    </div>
                </div>

                {/* Preset Colors */}
                <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">Preset Colors</p>
                    <div className="flex flex-wrap gap-2">
                        {presetColors.map((color) => (
                            <button
                                key={color.value}
                                onClick={() => setSelectedColor(color.value)}
                                className={`w-10 h-10 rounded-xl border-2 transition-all hover:scale-110 ${selectedColor === color.value ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400' : 'border-white shadow-md'
                                    }`}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                            />
                        ))}
                    </div>
                </div>

                {/* Custom Color Picker */}
                <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">Custom Color</p>
                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            value={selectedColor}
                            onChange={(e) => setSelectedColor(e.target.value)}
                            className="w-12 h-12 rounded-lg cursor-pointer border-0 p-0"
                        />
                        <input
                            type="text"
                            value={selectedColor}
                            onChange={(e) => {
                                const val = e.target.value
                                if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) setSelectedColor(val)
                            }}
                            className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                            placeholder="#c0dfa1"
                        />
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                        {selectedColor !== brandColor ? 'You have unsaved changes' : 'Color is saved'}
                    </p>
                    <button
                        onClick={handleColorSave}
                        disabled={savingColor || selectedColor === brandColor}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {savingColor ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                        ) : (
                            <><Save className="w-4 h-4" />Save Color</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

function StorageTab({ storageUsage, storageLoading, formatBytes }: any) {
    return (
        <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-blue-50 rounded-xl"><HardDrive className="w-5 h-5 text-blue-600" /></div>
                <h2 className="text-lg font-semibold text-gray-800">Storage Usage</h2>
            </div>

            {storageLoading ? (
                <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                </div>
            ) : storageUsage ? (
                <div className="space-y-5">
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-gray-900">{storageUsage.used_gb.toFixed(2)}</span>
                        <span className="text-base text-gray-500">GB used</span>
                    </div>
                    <div className="space-y-2">
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500" style={{ width: `${Math.min(storageUsage.used_percentage, 100)}%` }} />
                        </div>
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>{formatBytes(storageUsage.storage_used_bytes)}</span>
                            <span>{storageUsage.placeholder_max_gb} GB limit</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-3 bg-blue-50 rounded-xl">
                        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-600">Storage limits will be tied to subscription plans once billing is enabled.</p>
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 text-gray-500">
                    <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No storage data yet</p>
                </div>
            )}
        </div>
    )
}

function DangerTab({ hasOwnOrganization, showDeleteModal, setShowDeleteModal, deleteConfirmation, setDeleteConfirmation, deleting, handleDeleteAccount }: any) {
    return (
        <>
            <div className="bg-white rounded-2xl shadow-bubble border border-red-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-50 rounded-xl"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                    <h2 className="text-lg font-semibold text-red-800">Danger Zone</h2>
                </div>
                <div className="space-y-4">
                    <div>
                        <h3 className="font-medium text-gray-900">Delete Account</h3>
                        <p className="text-sm text-gray-600 mt-1">Permanently delete your account and all associated data. This action cannot be undone.</p>
                        {hasOwnOrganization && (
                            <p className="text-sm text-red-600 mt-2"><strong>Warning:</strong> This will also delete your organization, all initiatives, metrics, evidence, stories, and team members.</p>
                        )}
                    </div>
                    <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-xl transition-colors flex items-center gap-2 border border-red-200">
                        <Trash2 className="w-4 h-4" />Delete My Account
                    </button>
                </div>
            </div>

            {/* Delete Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 rounded-xl"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
                                <h2 className="text-xl font-bold text-gray-900">Delete Account</h2>
                            </div>
                            <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmation('') }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                                <p className="text-sm text-red-800 font-medium mb-2">This action is permanent and cannot be undone.</p>
                                <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                                    <li>Your account and profile</li>
                                    {hasOwnOrganization && <><li>Your organization</li><li>All initiatives and metrics</li><li>All evidence and stories</li><li>All team members</li></>}
                                    <li>Your subscription</li>
                                </ul>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Type <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">DELETE MY ACCOUNT</span> to confirm:</label>
                                <input type="text" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder="DELETE MY ACCOUNT" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500" disabled={deleting} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmation('') }} disabled={deleting} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors">Cancel</button>
                                <button onClick={handleDeleteAccount} disabled={deleting || deleteConfirmation !== 'DELETE MY ACCOUNT'} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                    {deleting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Deleting...</> : <><Trash2 className="w-4 h-4" />Delete Forever</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
