import { supabase } from './supabase';

/**
 * Append an entry to admin_audit_log. Best-effort: never throws into the caller
 * (an audit failure must not block the action it's recording).
 */
export async function recordAdminAction(entry: {
    adminUserId: string;
    adminEmail?: string | null;
    organizationId?: string | null;
    action: string;
    detail?: Record<string, unknown> | null;
}): Promise<void> {
    try {
        await supabase.from('admin_audit_log').insert({
            admin_user_id: entry.adminUserId,
            admin_email: entry.adminEmail ?? null,
            organization_id: entry.organizationId ?? null,
            action: entry.action,
            detail: entry.detail ?? null,
        });
    } catch (e) {
        console.error('[audit] failed to record action:', (e as Error).message);
    }
}
