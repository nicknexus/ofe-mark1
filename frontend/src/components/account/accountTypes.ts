import type { ChangeEvent, Dispatch, FormEvent, MutableRefObject, SetStateAction } from 'react'
import type { SubscriptionStatus, User } from '../../types'
import type {
    AccessibleOrganization,
    TeamMember,
    TeamInvitation,
    TeamCapacity,
} from '../../services/team'

export interface StorageUsage {
    storage_used_bytes: number
    used_gb: number
    used_percentage: number
    placeholder_max_bytes: number
    placeholder_max_gb: number
}

export type TabType =
    | 'account'
    | 'organization'
    | 'teams'
    | 'branding'
    | 'widget'
    | 'storage'
    | 'billing'
    | 'danger'

export interface ConfirmState {
    title: string
    message: string
    confirmLabel: string
    onConfirm: () => void
}

export type AccountPageOuterProps = {
    subscriptionStatus?: SubscriptionStatus | null
}

export type AccountTabProps = {
    subscriptionStatus?: SubscriptionStatus | null
    user: User | null
    formData: { name: string; email: string }
    setFormData: Dispatch<SetStateAction<{ name: string; email: string }>>
    saving: boolean
    handleSubmit: (e: FormEvent) => Promise<void>
    initiativesUsage: { current: number; limit: number | null } | null
    managingSubscription: boolean
    handleManageSubscription: () => Promise<void>
    upgrading: boolean
    handleUpgrade: () => Promise<void>
    isOwner: boolean
    isSharedMember: boolean
    hasOwnOrganization: boolean
    ownedOrganization: AccessibleOrganization | null
    teamLoading: boolean
    showCreateOrg: boolean
    setShowCreateOrg: Dispatch<SetStateAction<boolean>>
    newOrgName: string
    setNewOrgName: Dispatch<SetStateAction<string>>
    creatingOrg: boolean
    handleCreateOrganization: (e: FormEvent) => Promise<void>
    updatingPublic: boolean
    handleTogglePublic: (makePublic: boolean) => Promise<void>
}

export type OrganizationTabProps = {
    organization: AccessibleOrganization | null
    refreshPermissions: () => Promise<void>
}

export type TeamsTabProps = {
    organizationName?: string
    members: TeamMember[]
    invitations: TeamInvitation[]
    capacity: TeamCapacity | null
    loading: boolean
    inviteEmail: string
    setInviteEmail: Dispatch<SetStateAction<string>>
    sending: boolean
    handleSendInvite: (e: FormEvent) => Promise<void>
    removingMember: string | null
    resendingInvite: string | null
    revokingInvite: string | null
    handleRemoveMember: (member: TeamMember) => void
    handleResendInvite: (invitation: TeamInvitation) => Promise<void>
    handleRevokeInvite: (invitation: TeamInvitation) => void
    formatDate: (d: string | Date) => string
}

export type BrandingTabProps = {
    organizationName?: string
    organizationLogo?: string | null
    organizationId?: string
    brandColor: string
    uploadingLogo: boolean
    deletingLogo: boolean
    logoInputRef: MutableRefObject<HTMLInputElement | null>
    handleLogoUpload: (e: ChangeEvent<HTMLInputElement>) => Promise<void>
    handleDeleteLogo: () => void
    onBrandColorChange: (color: string) => Promise<void>
}

export type StorageTabProps = {
    storageUsage: StorageUsage | null
    storageLoading: boolean
    formatBytes: (bytes: number) => string
}

export type BillingTabProps = {
    subscriptionStatus?: SubscriptionStatus | null
}

export type DangerTabProps = {
    hasOwnOrganization: boolean
    showDeleteModal: boolean
    setShowDeleteModal: Dispatch<SetStateAction<boolean>>
    deleteConfirmation: string
    setDeleteConfirmation: Dispatch<SetStateAction<string>>
    deleting: boolean
    handleDeleteAccount: () => Promise<void>
}

export type WidgetTabProps = {
    orgSlug?: string
    isPublic?: boolean
}
