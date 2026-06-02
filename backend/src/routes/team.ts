import { Router } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { TeamService } from '../services/teamService';
import { sendTeamInvitationEmail } from '../utils/email';

const router = Router();

async function requireTeamManagementOrg(req: AuthenticatedRequest): Promise<{ id: string; name: string } | null> {
    const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
    const orgId = await TeamService.resolveTeamManagementOrganizationId(req.user!.id, requestedOrgId);
    if (!orgId) return null;
    return TeamService.getOrganizationSummary(orgId);
}

/**
 * GET /api/team/permissions
 * Get current user's permissions (owner vs shared member)
 */
router.get('/permissions', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const permissions = await TeamService.getUserPermissions(req.user!.id, requestedOrgId);
        res.json(permissions);
    } catch (error) {
        console.error('Error getting permissions:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/team/organizations
 * Get all organizations the user can access (own + shared)
 */
router.get('/organizations', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const organizations = await TeamService.getUserAccessibleOrganizations(req.user!.id);
        res.json(organizations);
    } catch (error) {
        console.error('Error getting organizations:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/team/my-pending-invite
 * Check if current user has a pending invitation (by their email)
 */
router.get('/my-pending-invite', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const userEmail = req.user!.email;
        if (!userEmail) {
            res.json({ hasPendingInvite: false });
            return;
        }

        const invite = await TeamService.getPendingInviteForEmail(userEmail);
        if (invite) {
            res.json({
                hasPendingInvite: true,
                inviteToken: invite.token,
                organizationName: invite.organization_name
            });
        } else {
            res.json({ hasPendingInvite: false });
        }
    } catch (error) {
        console.error('Error checking pending invite:', error);
        res.json({ hasPendingInvite: false });
    }
});

/**
 * POST /api/team/invite
 * Send a team invitation (owner only)
 */
router.post('/invite', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { email, canAddImpactClaims, memberType, permissions, scope } = req.body;

        if (!email || typeof email !== 'string') {
            res.status(400).json({ error: 'Email is required' });
            return;
        }

        if (memberType !== undefined && memberType !== 'admin' && memberType !== 'team_member') {
            res.status(400).json({ error: 'memberType must be admin or team_member' });
            return;
        }

        if (memberType === 'team_member' && permissions !== undefined && !Array.isArray(permissions)) {
            res.status(400).json({ error: 'permissions must be an array when provided' });
            return;
        }

        const org = await requireTeamManagementOrg(req);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners or admins can invite team members' });
            return;
        }

        // Create invitation (legacy body → team_member + booleans; explicit memberType optional)
        const invitation = await TeamService.createInvitation(org.id, email, req.user!.id, {
            canAddImpactClaims: canAddImpactClaims || false,
            memberType: memberType as 'admin' | 'team_member' | undefined,
            permissions: Array.isArray(permissions) ? permissions : undefined,
            scope,
        });

        // Send email
        const emailResult = await sendTeamInvitationEmail({
            to: email,
            inviterName: req.user!.email, // Could be enhanced to use user's name from metadata
            inviterEmail: req.user!.email,
            organizationName: org.name,
            inviteToken: invitation.token,
            canAddImpactClaims: canAddImpactClaims || false
        });

        // Update invitation with email status
        await TeamService.markInvitationEmailSent(
            invitation.id,
            emailResult.success ? undefined : emailResult.error
        );

        res.status(201).json({
            success: true,
            invitation: {
                id: invitation.id,
                email: invitation.email,
                status: invitation.status,
                expires_at: invitation.expires_at,
                can_add_impact_claims: invitation.can_add_impact_claims,
                member_type: invitation.member_type ?? 'team_member',
            },
            emailSent: emailResult.success,
            emailError: emailResult.error
        });
    } catch (error) {
        console.error('Error sending invitation:', error);
        res.status(400).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/team/invite/:token
 * Get invitation details by token (public - no auth required)
 */
router.get('/invite/:token', async (req, res) => {
    try {
        const token = req.params.token;
        console.log(`[Invite Lookup] Token: ${token?.substring(0, 10)}... (length: ${token?.length})`);
        
        const invite = await TeamService.getInvitationByToken(token);
        
        if (!invite) {
            console.log(`[Invite Lookup] NOT FOUND for token: ${token?.substring(0, 10)}...`);
            res.status(404).json({ error: 'Invitation not found' });
            return;
        }

        console.log(`[Invite Lookup] Found invite for org: ${invite.organization_name}`);
        res.json(invite);
    } catch (error) {
        console.error('Error fetching invitation:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/team/invite/:token/accept
 * Accept an invitation (authenticated user)
 */
router.post('/invite/:token/accept', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const member = await TeamService.acceptInvitation(
            req.params.token,
            req.user!.id,
            req.user!.email
        );

        // Get organization details for response
        const permissions = await TeamService.getUserPermissions(req.user!.id);

        res.json({
            success: true,
            member,
            permissions,
            message: 'Welcome to the team!'
        });
    } catch (error) {
        console.error('Error accepting invitation:', error);
        res.status(400).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/team/invite/:id/resend
 * Resend an invitation email (owner only)
 */
router.post('/invite/:id/resend', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const org = await requireTeamManagementOrg(req);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners or admins can resend invitations' });
            return;
        }

        // Resend (generates new token)
        const invitation = await TeamService.resendInvitation(req.params.id, org.id);

        // Send email
        const emailResult = await sendTeamInvitationEmail({
            to: invitation.email,
            inviterEmail: req.user!.email,
            organizationName: org.name,
            inviteToken: invitation.token,
            canAddImpactClaims: invitation.can_add_impact_claims
        });

        // Update invitation with email status
        await TeamService.markInvitationEmailSent(
            invitation.id,
            emailResult.success ? undefined : emailResult.error
        );

        res.json({
            success: true,
            invitation: {
                id: invitation.id,
                email: invitation.email,
                status: invitation.status,
                expires_at: invitation.expires_at
            },
            emailSent: emailResult.success,
            emailError: emailResult.error
        });
    } catch (error) {
        console.error('Error resending invitation:', error);
        res.status(400).json({ error: (error as Error).message });
    }
});

/**
 * DELETE /api/team/invite/:id
 * Revoke an invitation (owner only)
 */
router.delete('/invite/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        // Verify ownership
        const org = await TeamService.getUserOwnedOrganization(req.user!.id);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners can revoke invitations' });
            return;
        }

        await TeamService.revokeInvitation(req.params.id, org.id);
        res.status(204).send();
    } catch (error) {
        console.error('Error revoking invitation:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/team/capacity
 * Get team member capacity info (owner only)
 */
router.get('/capacity', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const org = await requireTeamManagementOrg(req);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners or admins can view team capacity' });
            return;
        }

        const capacity = await TeamService.canAddTeamMember(org.id);
        res.json(capacity);
    } catch (error) {
        console.error('Error fetching team capacity:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/team/members
 * List team members (owner only)
 */
router.get('/members', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        console.log(`[Team Members] User ID: ${req.user!.id}, Email: ${req.user!.email}`);
        
        const org = await requireTeamManagementOrg(req);
        console.log(`[Team Members] Managed org:`, org ? org.name : 'NONE');
        
        if (!org) {
            res.status(403).json({ error: 'Only organization owners or admins can view team members' });
            return;
        }

        const members = await TeamService.getTeamMembers(org.id);
        res.json(members);
    } catch (error) {
        console.error('Error fetching team members:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/team/invitations
 * List pending invitations (owner only)
 */
router.get('/invitations', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const org = await requireTeamManagementOrg(req);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners or admins can view invitations' });
            return;
        }

        const invitations = await TeamService.getPendingInvitations(org.id);
        res.json(invitations);
    } catch (error) {
        console.error('Error fetching invitations:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/team/members/:id/permissions
 */
router.get('/members/:id/permissions', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const org = await requireTeamManagementOrg(req);
        if (!org) {
            res.status(403).json({ error: 'Not allowed' });
            return;
        }
        await TeamService.assertMemberInOrganization(req.params.id, org.id);
        const { TeamMemberPermissionsService } = await import('../services/teamMemberPermissionsService');
        const blob = await TeamMemberPermissionsService.getMemberBlob(req.params.id);
        res.json({ grants: blob.grants, scope: blob.scope });
    } catch (error) {
        console.error('Error fetching member permissions:', error);
        res.status(404).json({ error: (error as Error).message });
    }
});

/**
 * PUT /api/team/members/:id
 * Update member role and permissions (owner or admin)
 */
router.put('/members/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { memberType, permissions, scope, canAddImpactClaims, canEditEvidence } = req.body;

        const org = await requireTeamManagementOrg(req);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners or admins can update members' });
            return;
        }

        let member;
        if (memberType === 'admin' || memberType === 'team_member') {
            if (memberType === 'team_member' && permissions !== undefined && !Array.isArray(permissions)) {
                res.status(400).json({ error: 'permissions must be an array' });
                return;
            }
            member = await TeamService.updateTeamMember(req.params.id, org.id, {
                memberType,
                permissions: Array.isArray(permissions) ? permissions : undefined,
                scope,
            });
        } else if (canAddImpactClaims !== undefined || canEditEvidence !== undefined) {
            member = await TeamService.updateMemberPermissions(req.params.id, org.id, {
                canAddImpactClaims,
                canEditEvidence,
            });
        } else {
            res.status(400).json({ error: 'memberType (admin | team_member) is required' });
            return;
        }

        res.json(member);
    } catch (error) {
        console.error('Error updating member:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/team/invite/:id/permissions
 */
router.get('/invite/:id/permissions', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const org = await requireTeamManagementOrg(req);
        if (!org) {
            res.status(403).json({ error: 'Not allowed' });
            return;
        }
        await TeamService.assertInvitationInOrganization(req.params.id, org.id);
        const { TeamMemberPermissionsService } = await import('../services/teamMemberPermissionsService');
        const blob = await TeamMemberPermissionsService.getInvitationBlob(req.params.id);
        res.json({ grants: blob.grants, scope: blob.scope });
    } catch (error) {
        console.error('Error fetching invitation permissions:', error);
        res.status(404).json({ error: (error as Error).message });
    }
});

/**
 * PUT /api/team/invite/:id
 * Update pending invitation role and permissions
 */
router.put('/invite/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { memberType, permissions, scope } = req.body;

        if (memberType !== 'admin' && memberType !== 'team_member') {
            res.status(400).json({ error: 'memberType must be admin or team_member' });
            return;
        }
        if (memberType === 'team_member' && permissions !== undefined && !Array.isArray(permissions)) {
            res.status(400).json({ error: 'permissions must be an array' });
            return;
        }

        const org = await requireTeamManagementOrg(req);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners or admins can update invitations' });
            return;
        }

        const invitation = await TeamService.updatePendingInvitation(req.params.id, org.id, {
            memberType,
            permissions: Array.isArray(permissions) ? permissions : undefined,
            scope,
        });
        res.json(invitation);
    } catch (error) {
        console.error('Error updating invitation:', error);
        res.status(400).json({ error: (error as Error).message });
    }
});

/**
 * DELETE /api/team/members/:id
 * Remove a team member (owner only)
 */
router.delete('/members/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const org = await requireTeamManagementOrg(req);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners or admins can remove team members' });
            return;
        }

        await TeamService.removeMember(req.params.id, org.id);
        res.status(204).send();
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
