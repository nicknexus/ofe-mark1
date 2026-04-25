import { supabase } from '../utils/supabase';

/**
 * Helpers for checking platform-admin status.
 * A user is a platform admin if their user_id exists in the platform_admins table.
 * Grant access by inserting rows manually via SQL.
 */
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
}
