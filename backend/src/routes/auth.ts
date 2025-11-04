import { Router } from 'express';
import { supabase } from '../utils/supabase';
import { OrganizationService } from '../services/organizationService';

const router = Router();

// Signup endpoint - creates user and organization
router.post('/signup', async (req, res) => {
    try {
        const { email, password, name, organizationName } = req.body;

        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }

        if (!organizationName) {
            res.status(400).json({ error: 'Organization name is required' });
            return;
        }

        // Create user in Supabase Auth (email confirmation is disabled in settings)
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name || '',
                    organization: organizationName
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

        // Create organization - fail signup if this fails
        let organization = null;
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
            organization,
            session: signInData.session,
            message: 'Account created successfully!'
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;

