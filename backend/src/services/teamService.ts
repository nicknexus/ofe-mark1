import { supabase } from '../utils/supabase';
import crypto from 'crypto';

export interface TeamInvitation {
    id: string;
    organization_id: string;
    email: string;
    invited_by: string;
    token: string;
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
    expires_at: string;
    can_add_impact_claims: boolean;
    email_sent_at?: string;
    resend_count: number;
    last_email_error?: string;
    created_at: string;
}

export interface TeamMember {
    id: string;
    organization_id: string;
    user_id: string;
    can_add_impact_claims: boolean;
    invited_by?: string;
    joined_at: string;
    created_at: string;
    // Populated fields
    user_email?: string;
    user_name?: string;
}

export interface InviteDetails {
    id: string;
    organization_name: string;
    inviter_name?: string;
    inviter_email: string;
    status: string;
    expires_at: string;
    can_add_impact_claims: boolean;
    is_expired: boolean;
}

export interface UserPermissions {
    isOwner: boolean;
    isSharedMember: boolean;
    canAddImpactClaims: boolean;
    canDelete: boolean;
    organizationId?: string;
    organizationName?: string;
}

const INVITE_EXPIRY_DAYS = 7;
const MAX_TEAM_MEMBERS = 5; // Limit for both trial and paid plans

export class TeamService {
    /**
     * Generate a secure random token for invitations
     */
    static generateToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Get current team member count for an organization
     */
    static async getTeamMemberCount(organizationId: string): Promise<number> {
        const { count, error } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId);

        if (error) {
            console.error('Error counting team members:', error);
            return 0;
        }

        return count || 0;
    }

    /**
     * Get pending invitation count for an organization
     */
    static async getPendingInviteCount(organizationId: string): Promise<number> {
        const { count, error } = await supabase
            .from('team_invitations')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', organizationId)
            .eq('status', 'pending');

        if (error) {
            console.error('Error counting pending invites:', error);
            return 0;
        }

        return count || 0;
    }

    /**
     * Check if organization can add more team members
     */
    static async canAddTeamMember(organizationId: string): Promise<{ canAdd: boolean; current: number; limit: number; reason?: string }> {
        const memberCount = await this.getTeamMemberCount(organizationId);
        const pendingCount = await this.getPendingInviteCount(organizationId);
        const total = memberCount + pendingCount;

        if (total >= MAX_TEAM_MEMBERS) {
            return {
                canAdd: false,
                current: total,
                limit: MAX_TEAM_MEMBERS,
                reason: `Team member limit reached (${total}/${MAX_TEAM_MEMBERS}). Remove a member or revoke a pending invite to add more.`
            };
        }

        return {
            canAdd: true,
            current: total,
            limit: MAX_TEAM_MEMBERS
        };
    }

    /**
     * Check if user is the owner of an organization
     */
    static async isOrganizationOwner(userId: string, organizationId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('organizations')
            .select('id')
            .eq('id', organizationId)
            .eq('owner_id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error checking organization ownership:', error);
            return false;
        }

        return !!data;
    }

    /**
     * Get user's organization (where they are owner)
     */
    static async getUserOwnedOrganization(userId: string): Promise<{ id: string; name: string } | null> {
        const { data, error } = await supabase
            .from('organizations')
            .select('id, name')
            .eq('owner_id', userId)
            .maybeSingle();

        if (error || !data) return null;
        return data;
    }

    /**
     * Get user's team membership (where they are a shared member)
     */
    static async getUserTeamMembership(userId: string): Promise<TeamMember | null> {
        const { data, error } = await supabase
            .from('team_members')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error || !data) return null;
        return data;
    }

    /**
     * Get all organizations a user can access (their own + teams they're members of)
     */
    static async getUserAccessibleOrganizations(userId: string): Promise<Array<{
        id: string;
        name: string;
        role: 'owner' | 'member';
        canAddImpactClaims?: boolean;
    }>> {
        const orgs: Array<{
            id: string;
            name: string;
            role: 'owner' | 'member';
            canAddImpactClaims?: boolean;
        }> = [];

        // Get owned organization
        const ownedOrg = await this.getUserOwnedOrganization(userId);
        if (ownedOrg) {
            orgs.push({
                id: ownedOrg.id,
                name: ownedOrg.name,
                role: 'owner',
                canAddImpactClaims: true
            });
        }

        // Get team memberships
        const { data: memberships, error } = await supabase
            .from('team_members')
            .select(`
                organization_id,
                can_add_impact_claims,
                organizations(id, name)
            `)
            .eq('user_id', userId);

        if (!error && memberships) {
            for (const membership of memberships) {
                const org = (membership as any).organizations;
                if (org) {
                    orgs.push({
                        id: org.id,
                        name: org.name,
                        role: 'member',
                        canAddImpactClaims: membership.can_add_impact_claims
                    });
                }
            }
        }

        return orgs;
    }

    /**
     * Get organization owner's user ID
     */
    static async getOrganizationOwnerId(organizationId: string): Promise<string | null> {
        const { data, error } = await supabase
            .from('organizations')
            .select('owner_id')
            .eq('id', organizationId)
            .single();

        if (error || !data) return null;
        return data.owner_id;
    }

    /**
     * Get user's permissions for their active organization context
     */
    static async getUserPermissions(userId: string): Promise<UserPermissions> {
        // First check if user owns an organization
        const ownedOrg = await this.getUserOwnedOrganization(userId);
        if (ownedOrg) {
            return {
                isOwner: true,
                isSharedMember: false,
                canAddImpactClaims: true,
                canDelete: true,
                organizationId: ownedOrg.id,
                organizationName: ownedOrg.name
            };
        }

        // Check if user is a team member
        const membership = await this.getUserTeamMembership(userId);
        if (membership) {
            // Get org name
            const { data: org } = await supabase
                .from('organizations')
                .select('name')
                .eq('id', membership.organization_id)
                .single();

            return {
                isOwner: false,
                isSharedMember: true,
                canAddImpactClaims: membership.can_add_impact_claims,
                canDelete: false,
                organizationId: membership.organization_id,
                organizationName: org?.name
            };
        }

        // User has no organization context
        return {
            isOwner: false,
            isSharedMember: false,
            canAddImpactClaims: false,
            canDelete: false
        };
    }

    /**
     * Create a team invitation
     */
    static async createInvitation(
        organizationId: string,
        email: string,
        invitedBy: string,
        canAddImpactClaims: boolean = false
    ): Promise<TeamInvitation> {
        // Check team member limit
        const limitCheck = await this.canAddTeamMember(organizationId);
        if (!limitCheck.canAdd) {
            throw new Error(limitCheck.reason || 'Team member limit reached');
        }

        // Check if email is already a member
        const { data: existingMember } = await supabase
            .from('team_members')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('user_id', (
                await supabase.from('auth.users').select('id').eq('email', email).maybeSingle()
            ).data?.id || '00000000-0000-0000-0000-000000000000')
            .maybeSingle();

        if (existingMember) {
            throw new Error('This user is already a team member');
        }

        // Check if there's already a pending invitation for this email
        const { data: existingInvite } = await supabase
            .from('team_invitations')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('email', email.toLowerCase())
            .eq('status', 'pending')
            .maybeSingle();

        if (existingInvite) {
            throw new Error('An invitation is already pending for this email');
        }

        const token = this.generateToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

        const { data, error } = await supabase
            .from('team_invitations')
            .insert([{
                organization_id: organizationId,
                email: email.toLowerCase(),
                invited_by: invitedBy,
                token,
                status: 'pending',
                expires_at: expiresAt.toISOString(),
                can_add_impact_claims: canAddImpactClaims
            }])
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to create invitation: ${error.message}`);
        }

        return data;
    }

    /**
     * Get pending invitation for an email address
     */
    static async getPendingInviteForEmail(email: string): Promise<{ token: string; organization_name: string } | null> {
        const { data: invite, error } = await supabase
            .from('team_invitations')
            .select('token, organization_id, expires_at')
            .eq('email', email.toLowerCase())
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !invite) return null;

        // Check if expired
        if (new Date(invite.expires_at) < new Date()) {
            return null;
        }

        // Get organization name
        const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', invite.organization_id)
            .single();

        return {
            token: invite.token,
            organization_name: org?.name || 'Unknown Organization'
        };
    }

    /**
     * Get invitation details by token (public - no auth required)
     */
    static async getInvitationByToken(token: string): Promise<InviteDetails | null> {
        // Use service role to bypass RLS for public token lookup
        const { data: invite, error } = await supabase
            .from('team_invitations')
            .select(`
                id,
                status,
                expires_at,
                can_add_impact_claims,
                organization_id,
                invited_by
            `)
            .eq('token', token)
            .maybeSingle();

        if (error || !invite) return null;

        // Get organization name
        const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', invite.organization_id)
            .single();

        // Get inviter info
        const { data: inviter } = await supabase
            .from('auth.users')
            .select('email, raw_user_meta_data')
            .eq('id', invite.invited_by)
            .single();

        const isExpired = new Date(invite.expires_at) < new Date();

        return {
            id: invite.id,
            organization_name: org?.name || 'Unknown Organization',
            inviter_name: inviter?.raw_user_meta_data?.name,
            inviter_email: inviter?.email || '',
            status: isExpired && invite.status === 'pending' ? 'expired' : invite.status,
            expires_at: invite.expires_at,
            can_add_impact_claims: invite.can_add_impact_claims,
            is_expired: isExpired
        };
    }

    /**
     * Accept an invitation
     */
    static async acceptInvitation(token: string, userId: string, userEmail: string): Promise<TeamMember> {
        // Get invitation
        const { data: invite, error: inviteError } = await supabase
            .from('team_invitations')
            .select('*')
            .eq('token', token)
            .eq('status', 'pending')
            .maybeSingle();

        if (inviteError || !invite) {
            throw new Error('Invalid or expired invitation');
        }

        // Check if expired
        if (new Date(invite.expires_at) < new Date()) {
            // Mark as expired
            await supabase
                .from('team_invitations')
                .update({ status: 'expired' })
                .eq('id', invite.id);
            throw new Error('This invitation has expired');
        }

        // Optional: verify email matches (recommended but can be disabled)
        if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
            throw new Error('This invitation was sent to a different email address');
        }

        // Check if user is already a member
        const { data: existingMember } = await supabase
            .from('team_members')
            .select('id')
            .eq('organization_id', invite.organization_id)
            .eq('user_id', userId)
            .maybeSingle();

        if (existingMember) {
            throw new Error('You are already a member of this organization');
        }

        // Check team member limit (in case org filled up since invite was sent)
        const memberCount = await this.getTeamMemberCount(invite.organization_id);
        if (memberCount >= 5) { // MAX_TEAM_MEMBERS
            throw new Error('This organization has reached its team member limit. Contact the owner.');
        }

        // Create team member record
        const { data: member, error: memberError } = await supabase
            .from('team_members')
            .insert([{
                organization_id: invite.organization_id,
                user_id: userId,
                can_add_impact_claims: invite.can_add_impact_claims,
                invited_by: invite.invited_by
            }])
            .select()
            .single();

        if (memberError) {
            throw new Error(`Failed to create membership: ${memberError.message}`);
        }

        // Mark invitation as accepted
        await supabase
            .from('team_invitations')
            .update({ status: 'accepted' })
            .eq('id', invite.id);

        return member;
    }

    /**
     * Get all team members for an organization
     */
    static async getTeamMembers(organizationId: string): Promise<TeamMember[]> {
        const { data, error } = await supabase
            .from('team_members')
            .select('*')
            .eq('organization_id', organizationId)
            .order('joined_at', { ascending: true });

        if (error) {
            throw new Error(`Failed to fetch team members: ${error.message}`);
        }

        // Fetch user details for each member
        const membersWithDetails = await Promise.all(
            (data || []).map(async (member) => {
                const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
                return {
                    ...member,
                    user_email: userData?.user?.email,
                    user_name: userData?.user?.user_metadata?.name
                };
            })
        );

        return membersWithDetails;
    }

    /**
     * Get all pending invitations for an organization
     */
    static async getPendingInvitations(organizationId: string): Promise<TeamInvitation[]> {
        const { data, error } = await supabase
            .from('team_invitations')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch invitations: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Update team member permissions
     */
    static async updateMemberPermissions(
        memberId: string,
        canAddImpactClaims: boolean
    ): Promise<TeamMember> {
        const { data, error } = await supabase
            .from('team_members')
            .update({ can_add_impact_claims: canAddImpactClaims })
            .eq('id', memberId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update member: ${error.message}`);
        }

        return data;
    }

    /**
     * Remove a team member
     */
    static async removeMember(memberId: string): Promise<void> {
        const { error } = await supabase
            .from('team_members')
            .delete()
            .eq('id', memberId);

        if (error) {
            throw new Error(`Failed to remove member: ${error.message}`);
        }
    }

    /**
     * Revoke an invitation
     */
    static async revokeInvitation(invitationId: string): Promise<void> {
        const { error } = await supabase
            .from('team_invitations')
            .update({ status: 'revoked' })
            .eq('id', invitationId);

        if (error) {
            throw new Error(`Failed to revoke invitation: ${error.message}`);
        }
    }

    /**
     * Update invitation after email is sent
     */
    static async markInvitationEmailSent(invitationId: string, error?: string): Promise<void> {
        const update: any = {
            email_sent_at: new Date().toISOString()
        };

        if (error) {
            update.last_email_error = error;
        }

        // Increment resend count
        const { data: current } = await supabase
            .from('team_invitations')
            .select('resend_count')
            .eq('id', invitationId)
            .single();

        if (current) {
            update.resend_count = (current.resend_count || 0) + 1;
        }

        await supabase
            .from('team_invitations')
            .update(update)
            .eq('id', invitationId);
    }

    /**
     * Resend an invitation (generates new token and extends expiry)
     */
    static async resendInvitation(invitationId: string): Promise<TeamInvitation> {
        const newToken = this.generateToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

        const { data, error } = await supabase
            .from('team_invitations')
            .update({
                token: newToken,
                expires_at: expiresAt.toISOString(),
                status: 'pending'
            })
            .eq('id', invitationId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to resend invitation: ${error.message}`);
        }

        return data;
    }
}
