import { Router } from 'express';
import { supabase } from '../utils/supabase';
import { OrganizationService } from '../services/organizationService';
import { SubscriptionService } from '../services/subscriptionService';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { stripe } from '../utils/stripe';

const router = Router();

// Signup endpoint - creates user and optionally an organization
// Organization is optional for users signing up from invite links
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name, organizationName } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        // Create user in Supabase Auth (email confirmation is disabled in settings)
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name || '',
                    organization: organizationName || '' // May be empty for invited users
                }
            }
        });

        if (authError) {
            res.status(400).json({ error: authError.message });
            return;
        }

        if (!authData.user) {
            res.status(400).json({ error: 'Failed to create user' });
            return;
        }

        // Only create organization if organizationName was provided
        let organization = null;
        if (organizationName && organizationName.trim() !== '') {
            try {
                organization = await OrganizationService.findOrCreate(organizationName, authData.user.id);
                if (!organization) {
                    throw new Error('Failed to create organization');
                }
            } catch (orgError) {
                console.error('Failed to create organization:', orgError);
                // Delete the user if organization creation fails
                try {
                    await supabase.auth.admin.deleteUser(authData.user.id);
                } catch (deleteError) {
                    console.error('Failed to cleanup user after org creation failure:', deleteError);
                }
                res.status(500).json({ 
                    error: `Failed to create organization: ${orgError instanceof Error ? orgError.message : 'Unknown error'}` 
                });
                return;
            }

            // Create subscription record only if we created an organization
            try {
                await SubscriptionService.getOrCreate(authData.user.id, organization.id);
            } catch (subError) {
                console.error('Failed to create subscription record:', subError);
                // Non-fatal - subscription can be created later when user accesses the app
            }
        }
        // Note: Users without an organization will get access through team_members when they accept invite

        // Sign the user in immediately (email confirmation is disabled, so this should work)
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (signInError) {
            console.error('Failed to sign in after signup:', signInError);
            // Still return success - user can sign in manually
            res.status(201).json({
                user: authData.user,
                organization,
                session: null,
                message: 'Account created successfully. Please sign in.'
            });
            return;
        }

        res.status(201).json({
            user: signInData.user,
            organization, // May be null for invited users
            session: signInData.session,
            message: 'Account created successfully!'
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * DELETE /api/auth/account
 * Delete the current user's account and all associated data
 * Requires authentication and confirmation phrase
 */
router.delete('/account', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const userId = req.user!.id;
        const { confirmation } = req.body;

        // Require confirmation phrase
        if (confirmation !== 'DELETE MY ACCOUNT') {
            res.status(400).json({ 
                error: 'Please type "DELETE MY ACCOUNT" to confirm deletion' 
            });
            return;
        }

        console.log(`[Account Delete] Starting deletion for user: ${userId}`);

        // Get user's owned organization (if any)
        const { data: ownedOrg } = await supabase
            .from('organizations')
            .select('id')
            .eq('owner_id', userId)
            .maybeSingle();

        if (ownedOrg) {
            console.log(`[Account Delete] User owns organization: ${ownedOrg.id}`);
            
            // Get all initiatives for this organization
            const { data: initiatives } = await supabase
                .from('initiatives')
                .select('id')
                .eq('organization_id', ownedOrg.id);

            if (initiatives && initiatives.length > 0) {
                const initiativeIds = initiatives.map(i => i.id);
                console.log(`[Account Delete] Deleting ${initiativeIds.length} initiatives`);

                // Delete KPIs and their related data
                const { data: kpis } = await supabase
                    .from('kpis')
                    .select('id')
                    .in('initiative_id', initiativeIds);

                if (kpis && kpis.length > 0) {
                    const kpiIds = kpis.map(k => k.id);
                    
                    // Delete KPI updates
                    await supabase.from('kpi_updates').delete().in('kpi_id', kpiIds);
                    
                    // Delete KPIs
                    await supabase.from('kpis').delete().in('id', kpiIds);
                }

                // Delete evidence and evidence_kpis links
                const { data: evidence } = await supabase
                    .from('evidence')
                    .select('id')
                    .in('initiative_id', initiativeIds);

                if (evidence && evidence.length > 0) {
                    const evidenceIds = evidence.map(e => e.id);
                    await supabase.from('evidence_kpis').delete().in('evidence_id', evidenceIds);
                    await supabase.from('evidence').delete().in('id', evidenceIds);
                }

                // Delete stories and story_beneficiaries links
                const { data: stories } = await supabase
                    .from('stories')
                    .select('id')
                    .in('initiative_id', initiativeIds);

                if (stories && stories.length > 0) {
                    const storyIds = stories.map(s => s.id);
                    await supabase.from('story_beneficiaries').delete().in('story_id', storyIds);
                    await supabase.from('stories').delete().in('id', storyIds);
                }

                // Delete locations
                await supabase.from('locations').delete().in('initiative_id', initiativeIds);

                // Delete beneficiary groups
                await supabase.from('beneficiary_groups').delete().in('initiative_id', initiativeIds);

                // Delete donors
                await supabase.from('donors').delete().in('initiative_id', initiativeIds);

                // Delete initiatives
                await supabase.from('initiatives').delete().in('id', initiativeIds);
            }

            // Delete team members of this organization
            await supabase.from('team_members').delete().eq('organization_id', ownedOrg.id);

            // Delete team invitations of this organization
            await supabase.from('team_invitations').delete().eq('organization_id', ownedOrg.id);

            // Delete the organization
            await supabase.from('organizations').delete().eq('id', ownedOrg.id);
        }

        // Delete user's team memberships (where they are a member, not owner)
        await supabase.from('team_members').delete().eq('user_id', userId);

        // Cancel Stripe subscription if exists, then delete from database
        const subscription = await SubscriptionService.getByUserId(userId);
        if (subscription?.stripe_subscription_id && stripe) {
            try {
                await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
                console.log(`[Account Delete] Cancelled Stripe subscription: ${subscription.stripe_subscription_id}`);
            } catch (stripeError) {
                console.error('[Account Delete] Error cancelling Stripe subscription:', stripeError);
                // Continue with deletion even if Stripe cancel fails
            }
        }
        await supabase.from('subscriptions').delete().eq('user_id', userId);

        // Finally, delete the user from auth
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

        if (deleteError) {
            console.error('[Account Delete] Error deleting auth user:', deleteError);
            throw new Error('Failed to delete account. Please try again.');
        }

        console.log(`[Account Delete] Successfully deleted user: ${userId}`);

        res.json({ 
            success: true, 
            message: 'Your account and all associated data have been permanently deleted.' 
        });
    } catch (error) {
        console.error('[Account Delete] Error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;

