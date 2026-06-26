import { supabase } from '../utils/supabase';

/**
 * Helpers for checking platform-admin status.
 * A user is a platform admin if their user_id exists in the platform_admins table.
 * Grant access by inserting rows manually via SQL.
 */
export type AdminRole = 'super' | 'support';

export class PlatformAdminService {
    static async isAdmin(userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('platform_admins')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('[PlatformAdminService.isAdmin] error:', error.message);
            return false;
        }
        return !!data;
    }

    /**
     * Role of a platform admin. Resilient to the `role` column not existing yet
     * (pre-migration): falls back to treating any existing admin as 'super', so
     * a deploy before the SQL runs doesn't lock anyone out.
     */
    static async getRole(userId: string): Promise<AdminRole | null> {
        const { data, error } = await supabase
            .from('platform_admins')
            .select('role')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            // role column may not exist yet — fall back to membership = super.
            const isAdmin = await this.isAdmin(userId);
            return isAdmin ? 'super' : null;
        }
        if (!data) return null;
        return ((data as any).role as AdminRole) ?? 'super';
    }

    static async isSuperAdmin(userId: string): Promise<boolean> {
        return (await this.getRole(userId)) === 'super';
    }

    /** Org ids a support agent is assigned to (super admins are unrestricted). */
    static async getAssignedOrgIds(userId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('support_org_assignments')
            .select('organization_id')
            .eq('admin_user_id', userId);
        if (error) {
            console.error('[PlatformAdminService.getAssignedOrgIds] error:', error.message);
            return [];
        }
        return (data || []).map((r: { organization_id: string }) => r.organization_id);
    }

    /**
     * Whether this admin may operate inside a given org.
     * super → any org; support → only orgs explicitly assigned to them.
     */
    static async canAccessOrg(userId: string, organizationId: string): Promise<boolean> {
        const role = await this.getRole(userId);
        if (!role) return false;
        if (role === 'super') return true;
        const { data } = await supabase
            .from('support_org_assignments')
            .select('id')
            .eq('admin_user_id', userId)
            .eq('organization_id', organizationId)
            .maybeSingle();
        return !!data;
    }
}
