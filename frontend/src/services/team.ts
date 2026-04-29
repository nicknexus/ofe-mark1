import { supabase } from './supabase'
import { apiService } from './api'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
        throw new Error('No authenticated session')
    }

    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
    }
}

export interface UserPermissions {
    isOwner: boolean
    isSharedMember: boolean
    canAddImpactClaims: boolean
    canDelete: boolean
    organizationId?: string
    organizationName?: string
}

export interface TeamMember {
    id: string
    organization_id: string
    user_id: string
    can_add_impact_claims: boolean
    can_edit_evidence: boolean
    invited_by?: string
    joined_at: string
    created_at: string
    user_email?: string
    user_name?: string
}

export interface TeamInvitation {
    id: string
    organization_id: string
    email: string
    invited_by: string
    token: string
    status: 'pending' | 'accepted' | 'expired' | 'revoked'
    expires_at: string
    can_add_impact_claims: boolean
    email_sent_at?: string
    resend_count: number
    last_email_error?: string
    created_at: string
}

export interface InviteDetails {
    id: string
    organization_name: string
    inviter_name?: string
    inviter_email: string
    status: string
    expires_at: string
    can_add_impact_claims: boolean
    is_expired: boolean
}

export interface TeamCapacity {
    canAdd: boolean
    current: number
    limit: number
    reason?: string
}

export interface PendingInviteCheck {
    hasPendingInvite: boolean
    inviteToken?: string
    organizationName?: string
}

export interface AccessibleOrganization {
    id: string
    name: string
    slug?: string
    role: 'owner' | 'member'
    canAddImpactClaims?: boolean
    canEditEvidence?: boolean
    logo_url?: string
    brand_color?: string
    is_public?: boolean
    is_demo?: boolean
    demo_public_share?: boolean
    statement?: string
    website_url?: string
    donation_url?: string
}

export class TeamService {
    /**
     * Get current user's permissions
     */
    static async getPermissions(): Promise<UserPermissions> {
        return apiService.requestCached<UserPermissions>('/team/permissions')
    }

    /**
     * Check if current user has a pending invitation
     */
    static async checkMyPendingInvite(): Promise<PendingInviteCheck> {
        const headers = await getAuthHeaders()

        const response = await fetch(`${API_BASE_URL}/api/team/my-pending-invite`, {
            method: 'GET',
            headers
        })

        if (!response.ok) {
            return { hasPendingInvite: false }
        }

        return response.json()
    }

    /**
     * Get all organizations the user can access.
     * Routed through apiService so it benefits from cache + in-flight dedup
     * — multiple components used to fire this request in parallel on every
     * mount, generating duplicate /team/organizations calls.
     */
    static async getAccessibleOrganizations(): Promise<AccessibleOrganization[]> {
        try {
            return await apiService.requestCached<AccessibleOrganization[]>('/team/organizations')
        } catch {
            return []
        }
    }

    /**
     * Send a team invitation
     */
    static async sendInvite(email: string, canAddImpactClaims: boolean = false): Promise<{
        success: boolean
        invitation: Partial<TeamInvitation>
        emailSent: boolean
        emailError?: string
    }> {
        const headers = await getAuthHeaders()

        const response = await fetch(`${API_BASE_URL}/api/team/invite`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ email, canAddImpactClaims })
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to send invitation')
        }

        return response.json()
    }

    /**
     * Get invitation details by token — queries Supabase directly (no Vercel cold start)
     */
    static async getInviteDetails(token: string): Promise<InviteDetails> {
        console.log(`[TeamService] Fetching invite directly from Supabase for token: ${token.substring(0, 10)}...`)

        // Query invite — try with org join first, fall back to invite-only
        let invite: any = null

        const { data, error } = await supabase
            .from('team_invitations')
            .select('id, status, expires_at, can_add_impact_claims, invited_by, organization_id, organizations(name)')
            .eq('token', token)
            .maybeSingle()

        if (data) {
            invite = data
        } else {
            // Join may fail due to RLS on organizations — fetch invite without join
            console.log(`[TeamService] Join query failed (${error?.message}), trying without join...`)
            const { data: inviteOnly, error: err2 } = await supabase
                .from('team_invitations')
                .select('id, status, expires_at, can_add_impact_claims, invited_by, organization_id')
                .eq('token', token)
                .maybeSingle()

            if (err2 || !inviteOnly) {
                console.error(`[TeamService] Invite not found:`, err2?.message)
                throw new Error('Invitation not found')
            }
            invite = inviteOnly
        }

        const isExpired = new Date(invite.expires_at) < new Date()
        const orgName = (invite.organizations as any)?.name || 'an organization'

        return {
            id: invite.id,
            organization_name: orgName,
            inviter_name: undefined,
            inviter_email: '',
            status: isExpired && invite.status === 'pending' ? 'expired' : invite.status,
            expires_at: invite.expires_at,
            can_add_impact_claims: invite.can_add_impact_claims,
            is_expired: isExpired
        }
    }

    /**
     * Accept an invitation (requires auth)
     */
    static async acceptInvite(token: string): Promise<{
        success: boolean
        member: TeamMember
        permissions: UserPermissions
        message: string
    }> {
        const headers = await getAuthHeaders()

        const response = await fetch(`${API_BASE_URL}/api/team/invite/${token}/accept`, {
            method: 'POST',
            headers
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to accept invitation')
        }

        return response.json()
    }

    /**
     * Resend an invitation
     */
    static async resendInvite(invitationId: string): Promise<{
        success: boolean
        invitation: Partial<TeamInvitation>
        emailSent: boolean
        emailError?: string
    }> {
        const headers = await getAuthHeaders()

        const response = await fetch(`${API_BASE_URL}/api/team/invite/${invitationId}/resend`, {
            method: 'POST',
            headers
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to resend invitation')
        }

        return response.json()
    }

    /**
     * Revoke an invitation
     */
    static async revokeInvite(invitationId: string): Promise<void> {
        const headers = await getAuthHeaders()

        const response = await fetch(`${API_BASE_URL}/api/team/invite/${invitationId}`, {
            method: 'DELETE',
            headers
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to revoke invitation')
        }
    }

    /**
     * Get team members (owner only)
     */
    static async getMembers(): Promise<TeamMember[]> {
        const headers = await getAuthHeaders()

        const response = await fetch(`${API_BASE_URL}/api/team/members`, {
            method: 'GET',
            headers
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to get team members')
        }

        return response.json()
    }

    /**
     * Get team capacity info (owner only)
     */
    static async getCapacity(): Promise<TeamCapacity> {
        const headers = await getAuthHeaders()

        const response = await fetch(`${API_BASE_URL}/api/team/capacity`, {
            method: 'GET',
            headers
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to get team capacity')
        }

        return response.json()
    }

    /**
     * Get pending invitations (owner only)
     */
    static async getPendingInvitations(): Promise<TeamInvitation[]> {
        const headers = await getAuthHeaders()

        const response = await fetch(`${API_BASE_URL}/api/team/invitations`, {
            method: 'GET',
            headers
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to get invitations')
        }

        return response.json()
    }

    /**
     * Update member permissions
     */
    static async updateMemberPermissions(memberId: string, updates: { canAddImpactClaims?: boolean; canEditEvidence?: boolean }): Promise<TeamMember> {
        const headers = await getAuthHeaders()

        const response = await fetch(`${API_BASE_URL}/api/team/members/${memberId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updates)
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to update member')
        }

        return response.json()
    }

    /**
     * Remove a team member
     */
    static async removeMember(memberId: string): Promise<void> {
        const headers = await getAuthHeaders()

        const response = await fetch(`${API_BASE_URL}/api/team/members/${memberId}`, {
            method: 'DELETE',
            headers
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to remove member')
        }
    }
}
