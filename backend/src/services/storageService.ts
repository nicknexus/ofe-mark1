import { supabase } from '../utils/supabase';

/**
 * STORAGE SERVICE - Phase 1: Tracking Only
 * 
 * This service tracks storage usage per organization.
 * NO limits are enforced in Phase 1.
 * 
 * TODO Phase 2 (after Stripe integration):
 * - Add checkStorageLimit() method
 * - Add getStorageLimit() based on plan tier
 * - Enforce limits before upload
 * - Add upgrade prompts when limits reached
 */

// Soft warning thresholds (in bytes) - for logging only, no blocking
const SOFT_WARNING_THRESHOLDS = [
    { bytes: 80 * 1024 * 1024 * 1024, label: '80 GB' },   // 80 GB
    { bytes: 150 * 1024 * 1024 * 1024, label: '150 GB' }, // 150 GB
    { bytes: 200 * 1024 * 1024 * 1024, label: '200 GB' }, // 200 GB
];

// Placeholder max for UI display (Phase 1 only)
// TODO Phase 2: Replace with actual plan limits from Stripe
export const PLACEHOLDER_MAX_STORAGE_BYTES = 250 * 1024 * 1024 * 1024; // 250 GB

export interface StorageUsage {
    storage_used_bytes: number;
    used_gb: number;
    used_percentage: number;
    // TODO Phase 2: Add these fields
    // storage_limit_bytes: number | null;
    // limit_gb: number | null;
    // plan_tier: string;
}

export class StorageService {
    /**
     * Get storage usage for an organization
     */
    static async getUsage(organizationId: string): Promise<StorageUsage> {
        const { data, error } = await supabase
            .from('organizations')
            .select('storage_used_bytes')
            .eq('id', organizationId)
            .single();

        if (error) {
            throw new Error(`Failed to get storage usage: ${error.message}`);
        }

        const usedBytes = data?.storage_used_bytes || 0;
        const usedGb = usedBytes / (1024 * 1024 * 1024);
        
        // Phase 1: Use placeholder max for percentage
        // TODO Phase 2: Use actual plan limits
        const usedPercentage = (usedBytes / PLACEHOLDER_MAX_STORAGE_BYTES) * 100;

        return {
            storage_used_bytes: usedBytes,
            used_gb: Math.round(usedGb * 100) / 100, // Round to 2 decimal places
            used_percentage: Math.round(usedPercentage * 100) / 100,
        };
    }

    /**
     * Get storage usage for a user (via their organization)
     */
    static async getUsageForUser(userId: string): Promise<StorageUsage | null> {
        // Get user's organization
        const { data: org, error } = await supabase
            .from('organizations')
            .select('id, storage_used_bytes')
            .eq('owner_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // No org found
            throw new Error(`Failed to get organization: ${error.message}`);
        }

        if (!org) return null;

        const usedBytes = org.storage_used_bytes || 0;
        const usedGb = usedBytes / (1024 * 1024 * 1024);
        const usedPercentage = (usedBytes / PLACEHOLDER_MAX_STORAGE_BYTES) * 100;

        return {
            storage_used_bytes: usedBytes,
            used_gb: Math.round(usedGb * 100) / 100,
            used_percentage: Math.round(usedPercentage * 100) / 100,
        };
    }

    /**
     * Increment storage usage after successful upload
     * 
     * Phase 1: No limit checks - just track
     * TODO Phase 2: Check limits before allowing upload
     */
    static async incrementStorage(organizationId: string, bytes: number): Promise<void> {
        // Get current usage
        const { data: org, error: fetchError } = await supabase
            .from('organizations')
            .select('storage_used_bytes, name')
            .eq('id', organizationId)
            .single();

        if (fetchError) {
            console.error('Failed to fetch org for storage increment:', fetchError);
            return; // Don't block upload on tracking failure
        }

        const currentBytes = org?.storage_used_bytes || 0;
        const newBytes = currentBytes + bytes;

        // Update storage
        const { error: updateError } = await supabase
            .from('organizations')
            .update({ storage_used_bytes: newBytes })
            .eq('id', organizationId);

        if (updateError) {
            console.error('Failed to update storage_used_bytes:', updateError);
            return; // Don't block upload on tracking failure
        }

        // Log soft warnings if thresholds crossed
        this.checkSoftWarnings(org?.name || organizationId, currentBytes, newBytes);
    }

    /**
     * Decrement storage usage after file deletion
     */
    static async decrementStorage(organizationId: string, bytes: number): Promise<void> {
        // Get current usage
        const { data: org, error: fetchError } = await supabase
            .from('organizations')
            .select('storage_used_bytes')
            .eq('id', organizationId)
            .single();

        if (fetchError) {
            console.error('Failed to fetch org for storage decrement:', fetchError);
            return;
        }

        const currentBytes = org?.storage_used_bytes || 0;
        // Clamp at zero - don't go negative
        const newBytes = Math.max(0, currentBytes - bytes);

        const { error: updateError } = await supabase
            .from('organizations')
            .update({ storage_used_bytes: newBytes })
            .eq('id', organizationId);

        if (updateError) {
            console.error('Failed to decrement storage_used_bytes:', updateError);
        }
    }

    /**
     * Get organization ID from user ID
     */
    static async getOrganizationIdForUser(userId: string): Promise<string | null> {
        const { data, error } = await supabase
            .from('organizations')
            .select('id')
            .eq('owner_id', userId)
            .single();

        if (error || !data) return null;
        return data.id;
    }

    /**
     * Get organization ID from initiative ID
     */
    static async getOrganizationIdFromInitiative(initiativeId: string): Promise<string | null> {
        const { data, error } = await supabase
            .from('initiatives')
            .select('organization_id')
            .eq('id', initiativeId)
            .single();

        if (error || !data) return null;
        return data.organization_id;
    }

    /**
     * Get organization ID from evidence ID
     */
    static async getOrganizationIdFromEvidence(evidenceId: string): Promise<string | null> {
        const { data, error } = await supabase
            .from('evidence')
            .select('initiative_id')
            .eq('id', evidenceId)
            .single();

        if (error || !data?.initiative_id) return null;
        return this.getOrganizationIdFromInitiative(data.initiative_id);
    }

    /**
     * Log soft warnings when thresholds are crossed (Phase 1 only)
     * 
     * TODO Phase 2: Convert these to actual limit checks and user notifications
     */
    private static checkSoftWarnings(orgName: string, oldBytes: number, newBytes: number): void {
        for (const threshold of SOFT_WARNING_THRESHOLDS) {
            // Check if we just crossed this threshold
            if (oldBytes < threshold.bytes && newBytes >= threshold.bytes) {
                console.log(`[STORAGE WARNING] Organization "${orgName}" has exceeded ${threshold.label} of storage (${Math.round(newBytes / (1024 * 1024 * 1024))} GB used)`);
                // TODO Phase 2: Send notification, show in-app warning, trigger upgrade prompt
            }
        }
    }

    /**
     * Recalculate storage for an organization from evidence_files
     * Useful for fixing inconsistencies
     */
    static async recalculateStorage(organizationId: string): Promise<number> {
        // Sum all file sizes for this organization
        const { data, error } = await supabase.rpc('recalculate_organization_storage', {
            org_id: organizationId
        });

        if (error) {
            throw new Error(`Failed to recalculate storage: ${error.message}`);
        }

        return data || 0;
    }
}





