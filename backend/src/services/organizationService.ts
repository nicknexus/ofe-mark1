import { supabase } from '../utils/supabase';
import { Organization } from '../types';

export class OrganizationService {
    // Generate slug from organization name
    static generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .trim()
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    }

    // Create organization for user (each user gets their own org)
    static async findOrCreate(name: string, userId: string): Promise<Organization> {
        // Check if user already has an organization
        const { data: existingOrg, error: findError } = await supabase
            .from('organizations')
            .select('*')
            .eq('owner_id', userId)
            .maybeSingle(); // Use maybeSingle() instead of single() to avoid error when no org exists

        if (existingOrg && !findError) {
            // User already has an org, return it
            return existingOrg;
        }

        // User doesn't have an org - create one
        // Generate slug and handle conflicts
        let baseSlug = this.generateSlug(name);
        let slug = baseSlug;
        let attempt = 0;
        let conflict = true;

        // Check if slug already exists (for any user)
        while (conflict && attempt < 100) {
            const { data: check } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', slug)
                .maybeSingle();

            if (!check) {
                conflict = false;
            } else {
                attempt++;
                slug = `${baseSlug}-${attempt}`;
            }
        }

        // Create new organization with owner_id
        console.log('Attempting to create organization:', { name, slug, userId, owner_id: userId });
        
        const { data: newOrg, error: createError } = await supabase
            .from('organizations')
            .insert([{
                name,
                slug,
                is_public: false,
                owner_id: userId
            }])
            .select()
            .single();

        if (createError) {
            console.error('Organization creation error:', {
                error: createError,
                message: createError.message,
                code: createError.code,
                details: createError.details,
                hint: createError.hint,
                userId,
                name,
                slug,
                // Check if service role is being used
                serviceRoleKeySet: !!process.env.SUPABASE_SERVICE_ROLE_KEY
            });
            throw new Error(`Failed to create organization: ${createError.message} (code: ${createError.code})`);
        }
        
        console.log('Organization created successfully:', newOrg?.id);

        if (!newOrg) {
            throw new Error('Organization creation returned no data');
        }

        // Still add user to user_organizations for compatibility
        await this.addUserToOrganization(userId, newOrg.id!, 'owner');
        return newOrg;
    }

    // Add user to organization
    static async addUserToOrganization(userId: string, organizationId: string, role: 'owner' | 'admin' | 'member' = 'member'): Promise<void> {
        const { error } = await supabase
            .from('user_organizations')
            .upsert({
                user_id: userId,
                organization_id: organizationId,
                role
            }, {
                onConflict: 'user_id,organization_id'
            });

        if (error) throw new Error(`Failed to link user to organization: ${error.message}`);
    }

    // Get organization by slug (public)
    static async getBySlug(slug: string): Promise<Organization | null> {
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('slug', slug)
            .eq('is_public', true)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to fetch organization: ${error.message}`);
        }
        return data;
    }

    // Get organization by ID (authenticated - must be owner)
    static async getById(id: string, userId: string): Promise<Organization | null> {
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', id)
            .eq('owner_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to fetch organization: ${error.message}`);
        }
        return data;
    }

    // Get user's organization (each user has one)
    static async getUserOrganizations(userId: string): Promise<Organization[]> {
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('owner_id', userId);

        if (error) throw new Error(`Failed to fetch user organization: ${error.message}`);
        
        return data || [];
    }

    // Update organization (must be owner)
    static async update(id: string, updates: Partial<Organization>, userId: string): Promise<Organization> {
        // Check if user is the owner
        const { data: existingOrg } = await supabase
            .from('organizations')
            .select('owner_id')
            .eq('id', id)
            .single();

        if (!existingOrg || existingOrg.owner_id !== userId) {
            throw new Error('Permission denied - must be owner');
        }

        // Generate slug if name is being updated, with collision detection
        if (updates.name) {
            let baseSlug = this.generateSlug(updates.name);
            let slug = baseSlug;
            let attempt = 0;
            let conflict = true;

            // Check if slug already exists (excluding current org)
            while (conflict && attempt < 100) {
                const { data: check } = await supabase
                    .from('organizations')
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

        // Note: Ownership is verified in route handlers before calling this function
        // Using service role key bypasses RLS, so we just filter by id
        const { data, error } = await supabase
            .from('organizations')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(`Failed to update organization: ${error.message}`);
        return data;
    }

    // Search public organizations
    static async searchPublic(query: string): Promise<Organization[]> {
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('is_public', true)
            .or(`name.ilike.%${query}%,description.ilike.%${query}%,slug.ilike.%${query}%`)
            .order('name', { ascending: true })
            .limit(50);

        if (error) throw new Error(`Failed to search organizations: ${error.message}`);
        return data || [];
    }
}

