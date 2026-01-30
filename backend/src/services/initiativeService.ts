import { supabase } from '../utils/supabase';
import { Initiative } from '../types';
import { OrganizationService } from './organizationService';
import { TeamService } from './teamService';

export class InitiativeService {
    /**
     * Get the organization ID for a user, with optional override
     * @param userId - The user's ID
     * @param requestedOrgId - Optional: specific org ID requested by the user
     */
    static async getEffectiveOrganizationId(userId: string, requestedOrgId?: string): Promise<string | null> {
        // If a specific org is requested, verify user has access to it
        if (requestedOrgId) {
            // Check if user owns this org
            const ownedOrg = await TeamService.getUserOwnedOrganization(userId);
            if (ownedOrg && ownedOrg.id === requestedOrgId) {
                return requestedOrgId;
            }

            // Check if user is a team member of this org
            const membership = await TeamService.getUserTeamMembership(userId);
            if (membership && membership.organization_id === requestedOrgId) {
                return requestedOrgId;
            }

            // User doesn't have access to requested org - fall through to default
        }

        // Default behavior: check team membership first
        const membership = await TeamService.getUserTeamMembership(userId);
        if (membership) {
            return membership.organization_id;
        }

        // If not a team member, check if user owns an organization
        const ownedOrg = await TeamService.getUserOwnedOrganization(userId);
        if (ownedOrg) {
            return ownedOrg.id;
        }

        // User has no organization context
        return null;
    }

    /**
     * Check if user is a shared member (part of a team they don't own)
     */
    static async isSharedMember(userId: string): Promise<boolean> {
        const membership = await TeamService.getUserTeamMembership(userId);
        return !!membership;
    }
    // Generate slug from initiative title
    static generateSlug(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .trim()
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    }

    static async create(initiative: Initiative, userId: string): Promise<Initiative> {
        // Check if user is a shared member - they cannot create new initiatives
        const isShared = await this.isSharedMember(userId);
        if (isShared) {
            throw new Error('Team members cannot create new initiatives. Contact your organization owner.');
        }

        // Get the effective organization ID (owned org or team membership)
        let organizationId: string | null = await this.getEffectiveOrganizationId(userId);
        
        if (!organizationId) {
            // User doesn't have an org - create one with default name
            // Use a timestamp-based name to ensure uniqueness
            const orgName = `Organization ${Date.now()}`;
            await OrganizationService.findOrCreate(orgName, userId);
            const userOrg = await OrganizationService.getUserOrganizations(userId);
            
            if (!userOrg || userOrg.length === 0 || !userOrg[0].id) {
                throw new Error('Failed to get or create organization');
            }
            organizationId = userOrg[0].id;
        }

        // Generate slug from title
        let baseSlug = this.generateSlug(initiative.title);
        // Ensure slug is not empty
        if (!baseSlug || baseSlug.trim() === '') {
            baseSlug = 'initiative';
        }
        let slug = baseSlug;
        let attempt = 0;
        let conflict = true;

        // Check if slug already exists within this organization (not globally)
        while (conflict && attempt < 100) {
            const { data: check } = await supabase
                .from('initiatives')
                .select('id')
                .eq('slug', slug)
                .eq('organization_id', organizationId)
                .maybeSingle();

            if (!check) {
                conflict = false;
            } else {
                attempt++;
                // Use incrementing suffix for uniqueness within org
                slug = `${baseSlug}-${attempt}`;
            }
        }

        if (attempt >= 100) {
            // Fallback: use timestamp suffix
            slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;
        }

        const { data, error } = await supabase
            .from('initiatives')
            .insert([{ 
                ...initiative, 
                user_id: userId, 
                organization_id: organizationId,
                slug: slug,
                is_public: initiative.is_public || false
            }])
            .select()
            .single();

        if (error) {
            // If it's a duplicate slug error (race condition), try one more time with unique suffix
            if (error.message.includes('duplicate key') && error.message.includes('slug')) {
                const fallbackSlug = `${baseSlug}-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
                const { data: retryData, error: retryError } = await supabase
                    .from('initiatives')
                    .insert([{ 
                        ...initiative, 
                        user_id: userId, 
                        organization_id: organizationId,
                        slug: fallbackSlug,
                        is_public: initiative.is_public || false
                    }])
                    .select()
                    .single();
                
                if (retryError) throw new Error(`Failed to create initiative: ${retryError.message}`);
                return retryData;
            }
            throw new Error(`Failed to create initiative: ${error.message}`);
        }
        return data;
    }

    static async getAll(userId: string, requestedOrgId?: string): Promise<Initiative[]> {
        // Get the effective organization ID (owned org or team membership)
        const organizationId = await this.getEffectiveOrganizationId(userId, requestedOrgId);
        
        if (!organizationId) {
            // User has no organization context - return empty
            return [];
        }

        // Fetch all initiatives for the organization
        const { data, error } = await supabase
            .from('initiatives')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch initiatives: ${error.message}`);
        return data || [];
    }

    static async getById(id: string, userId: string): Promise<Initiative | null> {
        // Get the effective organization ID (owned org or team membership)
        const organizationId = await this.getEffectiveOrganizationId(userId);
        
        if (!organizationId) {
            return null;
        }

        const { data, error } = await supabase
            .from('initiatives')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to fetch initiative: ${error.message}`);
        }
        return data;
    }

    static async update(id: string, updates: Partial<Initiative>, userId: string): Promise<Initiative> {
        // Get the effective organization ID
        const organizationId = await this.getEffectiveOrganizationId(userId);
        if (!organizationId) {
            throw new Error('No organization context');
        }

        // If title is being updated, regenerate slug
        if (updates.title) {
            let baseSlug = this.generateSlug(updates.title);
            let slug = baseSlug;
            let attempt = 0;
            let conflict = true;

            // Check if slug already exists within this org (excluding current initiative)
            while (conflict && attempt < 100) {
                const { data: check } = await supabase
                    .from('initiatives')
                    .select('id')
                    .eq('slug', slug)
                    .eq('organization_id', organizationId)
                    .neq('id', id)
                    .maybeSingle();

                if (!check) {
                    conflict = false;
                } else {
                    attempt++;
                    slug = `${baseSlug}-${attempt}`;
                }
            }

            updates.slug = slug;
        }

        const { data, error } = await supabase
            .from('initiatives')
            .update(updates)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update initiative: ${error.message}`);
        return data;
    }

    static async delete(id: string, userId: string): Promise<void> {
        // Check if user is a shared member (not allowed to delete)
        const isShared = await this.isSharedMember(userId);
        if (isShared) {
            throw new Error('Shared members cannot delete initiatives. Contact your organization owner.');
        }

        // Get the effective organization ID
        const organizationId = await this.getEffectiveOrganizationId(userId);
        if (!organizationId) {
            throw new Error('No organization context');
        }

        const { error } = await supabase
            .from('initiatives')
            .delete()
            .eq('id', id)
            .eq('organization_id', organizationId);

        if (error) throw new Error(`Failed to delete initiative: ${error.message}`);
    }
} 