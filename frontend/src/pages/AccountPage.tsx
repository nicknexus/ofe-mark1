import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
    ArrowLeft,
    User as UserIcon,
    Building2,
    HardDrive,
    CreditCard,
    Users,
    Trash2,
    Palette,
    Code2,
} from 'lucide-react'
import { AuthService } from '../services/auth'
import { formatDate } from '../utils'
import { apiService } from '../services/api'
import { SubscriptionService } from '../services/subscription'
import { TeamService, TeamMember, TeamInvitation, TeamCapacity } from '../services/team'
import { useTeam } from '../context/TeamContext'
import { User } from '../types'
import ConfirmDialog from '../components/ConfirmDialog'
import toast from 'react-hot-toast'
import type { AccountPageOuterProps, ConfirmState, StorageUsage, TabType } from '../components/account/accountTypes'
import { AccountTab } from '../components/account/AccountTab'
import { BillingTab } from '../components/account/BillingTab'
import { BrandingTab } from '../components/account/BrandingTab'
import { DangerTab } from '../components/account/DangerTab'
import { OrganizationTab } from '../components/account/OrganizationTab'
import { StorageTab } from '../components/account/StorageTab'
import { TeamsTab } from '../components/account/TeamsTab'
import { WidgetTab } from '../components/account/WidgetTab'

export default function AccountPage({ subscriptionStatus }: AccountPageOuterProps) {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { isOwner, isSharedMember, organizationName, hasOwnOrganization, ownedOrganization: realOwnedOrganization, editableOrganization, loading: teamLoading, refreshPermissions } = useTeam()
    // `ownedOrganization` throughout this page refers to whichever org the user
    // is currently editing — their real org, or a demo if they're inside one.
    const ownedOrganization = editableOrganization || realOwnedOrganization

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
    const [sending, setSending] = useState(false)
    const [removingMember, setRemovingMember] = useState<string | null>(null)
    const [resendingInvite, setResendingInvite] = useState<string | null>(null)
    const [revokingInvite, setRevokingInvite] = useState<string | null>(null)
    const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null)

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
            const result = await TeamService.sendInvite(inviteEmail.trim())
            if (result.emailSent) toast.success(`Invitation sent to ${inviteEmail}`)
            else toast.success('Invitation created, but email could not be sent.')
            setInviteEmail('')
            loadTeamData()
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setSending(false)
        }
    }

    const handleRemoveMember = async (member: TeamMember) => {
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


    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    const tabs = [
        { id: 'account' as TabType, label: 'Account', icon: UserIcon },
        { id: 'organization' as TabType, label: 'Organization', icon: Building2, requiresOrg: true },
        { id: 'teams' as TabType, label: 'Teams', icon: Users, requiresOrg: true },
        { id: 'branding' as TabType, label: 'Branding', icon: Palette, requiresOrg: true },
        { id: 'widget' as TabType, label: 'Embed Widget', icon: Code2, requiresOrg: true },
        { id: 'storage' as TabType, label: 'Storage', icon: HardDrive },
        { id: 'billing' as TabType, label: 'Billing', icon: CreditCard },
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

                        {activeTab === 'organization' && hasOwnOrganization && (
                            <OrganizationTab
                                organization={ownedOrganization}
                                refreshPermissions={refreshPermissions}
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
                                sending={sending}
                                handleSendInvite={handleSendInvite}
                                removingMember={removingMember}
                                resendingInvite={resendingInvite}
                                revokingInvite={revokingInvite}
                                handleRemoveMember={(member: TeamMember) => setConfirmDialog({
                                    title: 'Remove team member',
                                    message: `Remove ${member.user_email || member.user_name || 'this member'} from the team?`,
                                    confirmLabel: 'Remove member',
                                    onConfirm: () => handleRemoveMember(member),
                                })}
                                handleResendInvite={handleResendInvite}
                                handleRevokeInvite={(invitation: TeamInvitation) => setConfirmDialog({
                                    title: 'Revoke invitation',
                                    message: `Revoke invitation for ${invitation.email}?`,
                                    confirmLabel: 'Revoke invitation',
                                    onConfirm: () => handleRevokeInvite(invitation),
                                })}
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
                                handleDeleteLogo={() => setConfirmDialog({
                                    title: 'Remove logo',
                                    message: 'Remove the organization logo?',
                                    confirmLabel: 'Remove logo',
                                    onConfirm: handleDeleteLogo,
                                })}
                                onBrandColorChange={handleBrandColorChange}
                            />
                        )}

                        {activeTab === 'widget' && hasOwnOrganization && (
                            <WidgetTab
                                orgSlug={ownedOrganization?.slug}
                                isPublic={ownedOrganization?.is_public}
                            />
                        )}

                        {activeTab === 'storage' && (
                            <StorageTab
                                storageUsage={storageUsage}
                                storageLoading={storageLoading}
                                formatBytes={formatBytes}
                            />
                        )}

                        {activeTab === 'billing' && (
                            <BillingTab subscriptionStatus={subscriptionStatus} />
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
            {confirmDialog && (
                <ConfirmDialog
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    confirmLabel={confirmDialog.confirmLabel}
                    tone="danger"
                    onConfirm={() => {
                        const action = confirmDialog.onConfirm
                        setConfirmDialog(null)
                        action()
                    }}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}
        </div>
    )
}
