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
import {
 defaultTeamMemberToggles,
 fullScope,
 togglesToGrants,
 validateTeamMemberInvite,
 type MemberType,
 type TeamMemberPermissionToggles,
 type TeamMemberScope,
} from '../types/teamPermissions'
import { User } from '../types'
import ConfirmDialog from '../components/ConfirmDialog'
import { PageHeader, PageLoader } from '../components/ui'
import { notify } from '../lib/notify'
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
 const { isOwner, isSharedMember, canManageTeam, organizationName, hasOwnOrganization, ownedOrganization: realOwnedOrganization, editableOrganization, activeOrganization, loading: teamLoading, refreshPermissions } = useTeam()
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
 const [inviteMemberType, setInviteMemberType] = useState<MemberType>('admin')
 const [invitePermissionToggles, setInvitePermissionToggles] = useState<TeamMemberPermissionToggles>(defaultTeamMemberToggles)
 const [inviteScope, setInviteScope] = useState<TeamMemberScope>(fullScope)
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
 notify.error('Failed to load account information')
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
 if (canManageTeam && activeTab === 'teams') {
 loadTeamData()
 }
 }, [canManageTeam, activeTab])

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
 notify.error('Failed to load team data')
 } finally {
 setTeamLoading2(false)
 }
 }

 const handleManageSubscription = async () => {
 setManagingSubscription(true)
 try {
 const { url } = await SubscriptionService.createPortalSession()
 if (url) window.location.href = url
 else notify.error('Failed to open subscription management')
 } catch (error) {
 notify.error(error instanceof Error ? error.message : 'Failed to open subscription management')
 } finally {
 setManagingSubscription(false)
 }
 }

 const handleUpgrade = async () => {
 setUpgrading(true)
 try {
 const { url } = await SubscriptionService.createCheckoutSession()
 if (url) window.location.href = url
 else notify.error('Failed to start checkout')
 } catch (error) {
 notify.error(error instanceof Error ? error.message : 'Failed to start checkout')
 } finally {
 setUpgrading(false)
 }
 }

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault()
 setSaving(true)
 try {
 await AuthService.updateProfile({ name: formData.name })
 notify.success('Profile updated successfully')
 const updatedUser = await AuthService.getCurrentUser()
 setUser(updatedUser)
 } catch (error) {
 notify.error('Failed to update profile')
 } finally {
 setSaving(false)
 }
 }

 const handleCreateOrganization = async (e: React.FormEvent) => {
 e.preventDefault()
 if (!newOrgName.trim()) { notify.error('Organization name is required'); return }
 setCreatingOrg(true)
 try {
 await apiService.createOrganization(newOrgName.trim())
 notify.success('Organization created! You can now start a free trial.')
 setShowCreateOrg(false)
 setNewOrgName('')
 await refreshPermissions()
 window.location.reload()
 } catch (error) {
 notify.error(error instanceof Error ? error.message : 'Failed to create organization')
 } finally {
 setCreatingOrg(false)
 }
 }

 const handleDeleteAccount = async () => {
 if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
 notify.error('Please type "DELETE MY ACCOUNT" exactly to confirm')
 return
 }
 setDeleting(true)
 try {
 await AuthService.deleteAccount(deleteConfirmation)
 notify.success('Your account has been deleted')
 window.location.href = '/'
 } catch (error) {
 notify.error(error instanceof Error ? error.message : 'Failed to delete account')
 setDeleting(false)
 }
 }

 // Team handlers
 const handleSendInvite = async (e: React.FormEvent) => {
 e.preventDefault()
 if (!inviteEmail.trim()) { notify.error('Please enter an email address'); return }

 if (inviteMemberType === 'team_member') {
 const validationError = validateTeamMemberInvite(inviteMemberType, invitePermissionToggles, inviteScope)
 if (validationError) {
 notify.error(validationError)
 return
 }
 }

 setSending(true)
 try {
 const result = await TeamService.sendInvite({
 email: inviteEmail.trim(),
 memberType: inviteMemberType,
 canAddImpactClaims: invitePermissionToggles.addImpactClaims,
 permissions:
 inviteMemberType === 'team_member'
 ? togglesToGrants(invitePermissionToggles)
 : undefined,
 scope: inviteMemberType === 'team_member' ? inviteScope : undefined,
 })
 if (result.emailSent) notify.success(`Invitation sent to ${inviteEmail}`)
 else notify.success('Invitation created, but email could not be sent.')
 setInviteEmail('')
 setInviteMemberType('admin')
 setInvitePermissionToggles(defaultTeamMemberToggles)
 setInviteScope(fullScope)
 loadTeamData()
 } catch (error) {
 notify.error((error as Error).message)
 } finally {
 setSending(false)
 }
 }

 const handleRemoveMember = async (member: TeamMember) => {
 setRemovingMember(member.id)
 try {
 await TeamService.removeMember(member.id)
 notify.success('Member removed')
 loadTeamData()
 } catch (error) {
 notify.error((error as Error).message)
 } finally {
 setRemovingMember(null)
 }
 }

 const handleResendInvite = async (invitation: TeamInvitation) => {
 setResendingInvite(invitation.id)
 try {
 const result = await TeamService.resendInvite(invitation.id)
 if (result.emailSent) notify.success('Invitation resent')
 else notify.error('Failed to send email')
 loadTeamData()
 } catch (error) {
 notify.error((error as Error).message)
 } finally {
 setResendingInvite(null)
 }
 }

 const handleRevokeInvite = async (invitation: TeamInvitation) => {
 setRevokingInvite(invitation.id)
 try {
 await TeamService.revokeInvite(invitation.id)
 notify.success('Invitation revoked')
 loadTeamData()
 } catch (error) {
 notify.error((error as Error).message)
 } finally {
 setRevokingInvite(null)
 }
 }

 // Logo handlers
 const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0]
 if (!file || !ownedOrganization?.id) return
 if (!file.type.startsWith('image/')) { notify.error('Please select an image file'); return }
 if (file.size > 5 * 1024 * 1024) { notify.error('Image must be less than 5MB'); return }
 setUploadingLogo(true)
 try {
 await apiService.uploadOrganizationLogo(ownedOrganization.id, file)
 notify.success('Logo uploaded successfully')
 await refreshPermissions()
 } catch (error) {
 notify.error((error as Error).message || 'Failed to upload logo')
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
 notify.success('Logo removed')
 await refreshPermissions()
 } catch (error) {
 notify.error((error as Error).message || 'Failed to remove logo')
 } finally {
 setDeletingLogo(false)
 }
 }

 const handleBrandColorChange = async (color: string) => {
 if (!ownedOrganization?.id) return
 try {
 await apiService.updateOrganization(ownedOrganization.id, { brand_color: color })
 setBrandColor(color)
 notify.success('Brand color updated!')
 await refreshPermissions()
 } catch (error) {
 notify.error((error as Error).message || 'Failed to update brand color')
 throw error
 }
 }

 const handleTogglePublic = async (makePublic: boolean) => {
 if (!ownedOrganization?.id) return
 setUpdatingPublic(true)
 try {
 await apiService.updateOrganization(ownedOrganization.id, { is_public: makePublic })
 notify.success(makePublic ? 'Your organization is now public!' : 'Your organization is now private')
 await refreshPermissions()
 } catch (error) {
 notify.error((error as Error).message || 'Failed to update visibility')
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
 return <PageLoader />
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
 <div className="min-h-screen app-canvas pt-24 pb-6">
 <div className="max-w-6xl mx-auto px-4 sm:px-6">
 <PageHeader title="Account Settings" backTo="/" />

 <div className="flex gap-6">
 {/* Sidebar */}
 <div className="w-56 flex-shrink-0">
 <div className="app-card p-2 sticky top-28">
 <nav className="space-y-1">
 {tabs.map((tab) => {
 if (tab.id === 'teams' && !canManageTeam) return null
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

 {activeTab === 'teams' && canManageTeam && (
 <TeamsTab
 organizationName={activeOrganization?.name || organizationName}
 members={members}
 invitations={invitations}
 capacity={capacity}
 loading={teamLoading2}
 inviteEmail={inviteEmail}
 setInviteEmail={setInviteEmail}
 memberType={inviteMemberType}
 setMemberType={setInviteMemberType}
 permissionToggles={invitePermissionToggles}
 setPermissionToggles={setInvitePermissionToggles}
 inviteScope={inviteScope}
 setInviteScope={setInviteScope}
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
 onTeamDataChanged={loadTeamData}
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
