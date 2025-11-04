import { supabase } from '../utils/supabase';
import { Initiative } from '../types';
import { OrganizationService } from './organizationService';

export class InitiativeService {
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
        // Get user's organization (create if doesn't exist)
        let userOrg = await OrganizationService.getUserOrganizations(userId);
        if (!userOrg || userOrg.length === 0) {
            // User doesn't have an org - create one with default name
            // Use a timestamp-based name to ensure uniqueness
            const orgName = `Organization ${Date.now()}`;
            await OrganizationService.findOrCreate(orgName, userId);
            userOrg = await OrganizationService.getUserOrganizations(userId);
        }

        if (!userOrg || userOrg.length === 0) {
            throw new Error('Failed to get or create organization');
        }

        const organizationId = userOrg[0].id;

        // Generate slug from title
        let baseSlug = this.generateSlug(initiative.title);
        // Ensure slug is not empty
        if (!baseSlug || baseSlug.trim() === '') {
            baseSlug = 'initiative';
        }
        let slug = baseSlug;
        let attempt = 0;
        let conflict = true;

        // Check if slug already exists globally (handle unique constraint)
        while (conflict && attempt < 100) {
            const { data: check } = await supabase
                .from('initiatives')
                .select('id')
                .eq('slug', slug)
                .maybeSingle();

            if (!check) {
                conflict = false;
            } else {
                attempt++;
                // Use UUID suffix for better uniqueness instead of just incrementing
                if (attempt === 1) {
                    slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;
                } else {
                    slug = `${baseSlug}-${Date.now().toString().slice(-6)}-${attempt}`;
                }
            }
        }

        if (attempt >= 100) {
            // Fallback: use UUID suffix if we can't find a unique slug
            slug = `${baseSlug}-${Date.now().toString()}`;
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
            // If it's a duplicate slug error, try one more time with UUID suffix
            if (error.message.includes('duplicate key') && error.message.includes('slug')) {
                const fallbackSlug = `${baseSlug}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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

    static async getAll(userId: string): Promise<Initiative[]> {
        const { data, error } = await supabase
            .from('initiatives')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch initiatives: ${error.message}`);
        return data || [];
    }

    static async getById(id: string, userId: string): Promise<Initiative | null> {
        const { data, error } = await supabase
            .from('initiatives')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to fetch initiative: ${error.message}`);
        }
        return data;
    }

    static async update(id: string, updates: Partial<Initiative>, userId: string): Promise<Initiative> {
        // If title is being updated, regenerate slug
        if (updates.title) {
            let baseSlug = this.generateSlug(updates.title);
            let slug = baseSlug;
            let attempt = 0;
            let conflict = true;

            // Check if slug already exists (excluding current initiative)
            while (conflict && attempt < 100) {
                const { data: check } = await supabase
                    .from('initiatives')
                    .select('id')
                    .eq('slug', slug)
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
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update initiative: ${error.message}`);
        return data;
    }

    static async delete(id: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('initiatives')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(`Failed to delete initiative: ${error.message}`);
    }
} 