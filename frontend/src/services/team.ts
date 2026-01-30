import { supabase } from './supabase'

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
    role: 'owner' | 'member'
    canAddImpactClaims?: boolean
    logo_url?: string
}

export class TeamService {
    /**
     * Get current user's permissions
     */
    static async getPermissions(): Promise<UserPermissions> {
        const headers = await getAuthHeaders()
        
        const response = await fetch(`${API_BASE_URL}/api/team/permissions`, {
            method: 'GET',
            headers
        })
        
        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to get permissions')
        }
        
        return response.json()
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
     * Get all organizations the user can access
     */
    static async getAccessibleOrganizations(): Promise<AccessibleOrganization[]> {
        const headers = await getAuthHeaders()
        
        const response = await fetch(`${API_BASE_URL}/api/team/organizations`, {
            method: 'GET',
            headers
        })
        
        if (!response.ok) {
            return []
        }
        
        return response.json()
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
     * Get invitation details by token (public - no auth required for fetching)
     */
    static async getInviteDetails(token: string): Promise<InviteDetails> {
        console.log(`[TeamService] Fetching invite details for token: ${token.substring(0, 10)}...`)
        
        const response = await fetch(`${API_BASE_URL}/api/team/invite/${token}`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        })
        
        console.log(`[TeamService] Response status: ${response.status}`)
        
        if (!response.ok) {
            const error = await response.json()
            console.error(`[TeamService] Error fetching invite:`, error)
            throw new Error(error.error || 'Invitation not found')
        }
        
        return response.json()
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
    static async updateMemberPermissions(memberId: string, canAddImpactClaims: boolean): Promise<TeamMember> {
        const headers = await getAuthHeaders()
        
        const response = await fetch(`${API_BASE_URL}/api/team/members/${memberId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ canAddImpactClaims })
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
