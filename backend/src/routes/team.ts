import { Router } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { TeamService } from '../services/teamService';
import { sendTeamInvitationEmail } from '../utils/email';

const router = Router();

/**
 * GET /api/team/permissions
 * Get current user's permissions (owner vs shared member)
 */
router.get('/permissions', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const permissions = await TeamService.getUserPermissions(req.user!.id);
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
        const { email, canAddImpactClaims } = req.body;

        if (!email || typeof email !== 'string') {
            res.status(400).json({ error: 'Email is required' });
            return;
        }

        // Get user's organization
        const org = await TeamService.getUserOwnedOrganization(req.user!.id);
        if (!org) {
            res.status(403).json({ error: 'You must be an organization owner to invite team members' });
            return;
        }

        // Create invitation
        const invitation = await TeamService.createInvitation(
            org.id,
            email,
            req.user!.id,
            canAddImpactClaims || false
        );

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
                can_add_impact_claims: invitation.can_add_impact_claims
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
        const invite = await TeamService.getInvitationByToken(req.params.token);
        
        if (!invite) {
            res.status(404).json({ error: 'Invitation not found' });
            return;
        }

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
        // Verify ownership
        const org = await TeamService.getUserOwnedOrganization(req.user!.id);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners can resend invitations' });
            return;
        }

        // Resend (generates new token)
        const invitation = await TeamService.resendInvitation(req.params.id);

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

        await TeamService.revokeInvitation(req.params.id);
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
        const org = await TeamService.getUserOwnedOrganization(req.user!.id);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners can view team capacity' });
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
        const org = await TeamService.getUserOwnedOrganization(req.user!.id);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners can view team members' });
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
        const org = await TeamService.getUserOwnedOrganization(req.user!.id);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners can view invitations' });
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
 * PUT /api/team/members/:id
 * Update member permissions (owner only)
 */
router.put('/members/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { canAddImpactClaims } = req.body;

        if (typeof canAddImpactClaims !== 'boolean') {
            res.status(400).json({ error: 'canAddImpactClaims must be a boolean' });
            return;
        }

        // Verify ownership
        const org = await TeamService.getUserOwnedOrganization(req.user!.id);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners can update member permissions' });
            return;
        }

        const member = await TeamService.updateMemberPermissions(req.params.id, canAddImpactClaims);
        res.json(member);
    } catch (error) {
        console.error('Error updating member:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * DELETE /api/team/members/:id
 * Remove a team member (owner only)
 */
router.delete('/members/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        // Verify ownership
        const org = await TeamService.getUserOwnedOrganization(req.user!.id);
        if (!org) {
            res.status(403).json({ error: 'Only organization owners can remove team members' });
            return;
        }

        await TeamService.removeMember(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('Error removing member:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
