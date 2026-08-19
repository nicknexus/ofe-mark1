import type { ChangeEvent, Dispatch, FormEvent, MutableRefObject, SetStateAction } from 'react'
import type { SubscriptionStatus } from '../../types'
import type {
    AccessibleOrganization,
    TeamMember,
    TeamInvitation,
    TeamCapacity,
    MemberType,
} from '../../services/team'
import type { TeamMemberPermissionToggles, TeamMemberScope } from '../../types/teamPermissions'

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
    formData: { name: string; email: string }
    setFormData: Dispatch<SetStateAction<{ name: string; email: string }>>
    saving: boolean
    handleSubmit: (e: FormEvent) => Promise<void>
    hasOwnOrganization: boolean
    teamLoading: boolean
    showCreateOrg: boolean
    setShowCreateOrg: Dispatch<SetStateAction<boolean>>
    newOrgName: string
    setNewOrgName: Dispatch<SetStateAction<string>>
    creatingOrg: boolean
    handleCreateOrganization: (e: FormEvent) => Promise<void>
}

export type OrganizationTabProps = {
    organization: AccessibleOrganization | null
    refreshPermissions: () => Promise<void>
    section?: 'about' | 'links'
    readOnly?: boolean
}

export type TeamsTabProps = {
    organizationName?: string
    organizationLogo?: string | null
    organizationStatement?: string | null
    members: TeamMember[]
    invitations: TeamInvitation[]
    capacity: TeamCapacity | null
    loading: boolean
    inviteEmail: string
    setInviteEmail: Dispatch<SetStateAction<string>>
    memberType: MemberType
    setMemberType: Dispatch<SetStateAction<MemberType>>
    permissionToggles: TeamMemberPermissionToggles
    setPermissionToggles: Dispatch<SetStateAction<TeamMemberPermissionToggles>>
    inviteScope: TeamMemberScope
    setInviteScope: Dispatch<SetStateAction<TeamMemberScope>>
    inviteRequiresApproval: boolean
    setInviteRequiresApproval: Dispatch<SetStateAction<boolean>>
    sending: boolean
    handleSendInvite: (e: FormEvent) => Promise<void>
    removingMember: string | null
    resendingInvite: string | null
    revokingInvite: string | null
    handleRemoveMember: (member: TeamMember) => void
    handleResendInvite: (invitation: TeamInvitation) => Promise<void>
    handleRevokeInvite: (invitation: TeamInvitation) => void
    formatDate: (d: string | Date) => string
    onTeamDataChanged: () => void
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
    readOnly?: boolean
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
