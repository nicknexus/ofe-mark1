import { supabase } from '../utils/supabase'
import { Evidence } from '../types'
import { deleteFromSupabase } from '../utils/fileUpload'
import { StorageService } from './storageService'

export class EvidenceService {
    static async create(evidence: Evidence, userId: string): Promise<Evidence> {
        // Extract linkage fields and file_urls/file_sizes before inserting into evidence table
        const { kpi_ids, kpi_update_ids, file_urls, file_sizes, location_ids, ...evidenceData } = evidence;

        const { data, error } = await supabase
            .from('evidence')
            .insert([{ ...evidenceData, user_id: userId }])
            .select()
            .single();

        if (error) throw new Error(`Failed to create evidence: ${error.message}`);

        // Insert multiple locations into evidence_locations junction table if provided
        if (location_ids && location_ids.length > 0) {
            const locationLinks = location_ids.map(locationId => ({
                evidence_id: data.id,
                location_id: locationId,
                user_id: userId
            }));

            const { error: locationError } = await supabase
                .from('evidence_locations')
                .insert(locationLinks);

            if (locationError) {
                console.error('Failed to insert evidence locations:', locationError);
                // Don't throw - evidence is created, location links are optional
            }
        }

        // Insert multiple files into evidence_files table if provided
        if (file_urls && file_urls.length > 0) {
            const evidenceFiles = file_urls.map((fileUrl, index) => {
                // Extract filename from URL
                const fileName = fileUrl.split('/').pop() || `file-${index + 1}`
                // Try to determine file type from extension
                const extension = fileName.split('.').pop()?.toLowerCase() || ''
                const fileType = extension || 'unknown'
                // Get file size if provided (for storage tracking)
                const fileSize = file_sizes?.[index] || 0
                
                return {
                    evidence_id: data.id,
                    file_url: fileUrl,
                    file_name: fileName,
                    file_type: fileType,
                    file_size: fileSize, // Store file size for storage tracking
                    display_order: index
                }
            })

            const { error: filesError } = await supabase
                .from('evidence_files')
                .insert(evidenceFiles)

            if (filesError) {
                console.error('Failed to insert evidence files:', filesError)
                // Don't throw - evidence is created, files are optional
            }
        }

        // Legacy: Link to KPIs if provided
        if (kpi_ids && kpi_ids.length > 0) {
            const kpiLinks = kpi_ids.map(kpiId => ({
                evidence_id: data.id,
                kpi_id: kpiId
            }));

            const { error: linkError } = await supabase
                .from('evidence_kpis')
                .insert(kpiLinks);

            if (linkError) throw new Error(`Failed to link evidence to KPIs: ${linkError.message}`);
        }

        // New: Link to specific KPI updates (data points) if provided
        if (kpi_update_ids && kpi_update_ids.length > 0) {
            const updateLinks = kpi_update_ids.map(updateId => ({
                evidence_id: data.id,
                kpi_update_id: updateId,
                user_id: userId
            }));

            const { error: linkError2 } = await supabase
                .from('evidence_kpi_updates')
                .insert(updateLinks);

            if (linkError2) throw new Error(`Failed to link evidence to data points: ${linkError2.message}`);
        }

        return data;
    }

    static async getAll(initiativeId?: string, kpiId?: string): Promise<Evidence[]> {
        let query;

        if (kpiId) {
            // When filtering by KPI, we need to join with evidence_kpis table
            query = supabase
                .from('evidence')
                .select(`
                    *,
                    evidence_kpis!inner(kpi_id),
                    evidence_kpi_updates(kpi_update_id),
                    evidence_locations(location_id),
                    initiatives(title)
                `)
                .eq('evidence_kpis.kpi_id', kpiId);
        } else {
            // Regular query without KPI filtering
            query = supabase
                .from('evidence')
                .select(`
                    *,
                    evidence_kpis(kpi_id),
                    evidence_kpi_updates(kpi_update_id),
                    evidence_locations(location_id),
                    initiatives(title)
                `);
        }

        if (initiativeId) {
            query = query.eq('initiative_id', initiativeId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch evidence: ${error.message}`);
        
        // Transform the data to include kpi_update_ids and location_ids as flat arrays
        const transformedData = (data || []).map((item: any) => {
            const kpi_update_ids = item.evidence_kpi_updates?.map((link: any) => link.kpi_update_id).filter(Boolean) || [];
            const location_ids = item.evidence_locations?.map((link: any) => link.location_id).filter(Boolean) || [];
            return {
                ...item,
                kpi_update_ids,
                location_ids
            };
        });
        
        return transformedData;
    }

    static async getById(id: string): Promise<Evidence | null> {
        // Include linked data points and locations for new model
        const { data, error } = await supabase
            .from('evidence')
            .select(`
                *,
                evidence_kpis(kpi_id),
                evidence_kpi_updates(kpi_update_id),
                evidence_locations(location_id),
                initiatives(title)
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to fetch evidence: ${error.message}`);
        }
        
        // Transform to include kpi_ids, kpi_update_ids, and location_ids as flat arrays
        if (data) {
            const kpi_ids = data.evidence_kpis?.map((link: any) => link.kpi_id).filter(Boolean) || [];
            const kpi_update_ids = data.evidence_kpi_updates?.map((link: any) => link.kpi_update_id).filter(Boolean) || [];
            const location_ids = data.evidence_locations?.map((link: any) => link.location_id).filter(Boolean) || [];
            return { ...data, kpi_ids, kpi_update_ids, location_ids };
        }
        return data;
    }

    static async update(id: string, evidence: Partial<Evidence>, userId: string): Promise<Evidence> {
        // Extract linkage fields for separate handling
        const { kpi_ids, kpi_update_ids, location_ids, ...evidenceData } = evidence;

        // Get existing evidence to check if file_url is changing
        const { data: existingEvidence } = await supabase
            .from('evidence')
            .select('file_url')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        const { data, error } = await supabase
            .from('evidence')
            .update({ ...evidenceData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update evidence: ${error.message}`);

        // Delete old file if file_url changed and old file exists
        if (evidenceData.file_url && existingEvidence?.file_url && 
            evidenceData.file_url !== existingEvidence.file_url) {
            await deleteFromSupabase(existingEvidence.file_url);
        }

        // Update legacy KPI links if provided
        if (kpi_ids !== undefined) {
            // Delete existing links
            await supabase
                .from('evidence_kpis')
                .delete()
                .eq('evidence_id', id);

            // Add new links
            if (kpi_ids.length > 0) {
                const kpiLinks = kpi_ids.map(kpiId => ({
                    evidence_id: id,
                    kpi_id: kpiId
                }));

                const { error: linkError } = await supabase
                    .from('evidence_kpis')
                    .insert(kpiLinks);

                if (linkError) throw new Error(`Failed to update evidence KPI links: ${linkError.message}`);
            }
        }

        // Update data point links if provided
        if (kpi_update_ids !== undefined) {
            // Delete existing links
            await supabase
                .from('evidence_kpi_updates')
                .delete()
                .eq('evidence_id', id);

            if (kpi_update_ids.length > 0) {
                const updateLinks = kpi_update_ids.map(updateId => ({
                    evidence_id: id,
                    kpi_update_id: updateId,
                    user_id: userId
                }));

                const { error: linkError2 } = await supabase
                    .from('evidence_kpi_updates')
                    .insert(updateLinks);

                if (linkError2) throw new Error(`Failed to update evidence data point links: ${linkError2.message}`);
            }
        }

        // Update location links if provided
        if (location_ids !== undefined) {
            // Delete existing location links
            await supabase
                .from('evidence_locations')
                .delete()
                .eq('evidence_id', id);

            if (location_ids.length > 0) {
                const locationLinks = location_ids.map(locationId => ({
                    evidence_id: id,
                    location_id: locationId,
                    user_id: userId
                }));

                const { error: locationError } = await supabase
                    .from('evidence_locations')
                    .insert(locationLinks);

                if (locationError) throw new Error(`Failed to update evidence location links: ${locationError.message}`);
            }
        }

        return data;
    }

    static async delete(id: string, userId: string): Promise<void> {
        // Get evidence record first to delete associated file and track storage
        const { data: evidence, error: fetchError } = await supabase
            .from('evidence')
            .select('file_url, initiative_id')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                throw new Error('Evidence not found');
            }
            throw new Error(`Failed to fetch evidence: ${fetchError.message}`);
        }

        // Get all files associated with this evidence (for storage tracking)
        const { data: evidenceFiles } = await supabase
            .from('evidence_files')
            .select('file_size')
            .eq('evidence_id', id);

        // Calculate total file size for storage decrement
        const totalFileSize = (evidenceFiles || []).reduce(
            (sum, file) => sum + (file.file_size || 0), 
            0
        );

        // Delete links first (both legacy and new)
        const { error: linkError } = await supabase
            .from('evidence_kpis')
            .delete()
            .eq('evidence_id', id);

        if (linkError) throw new Error(`Failed to delete evidence KPI links: ${linkError.message}`);

        const { error: linkError2 } = await supabase
            .from('evidence_kpi_updates')
            .delete()
            .eq('evidence_id', id);

        if (linkError2) throw new Error(`Failed to delete evidence data point links: ${linkError2.message}`);

        // Delete evidence_locations records
        await supabase
            .from('evidence_locations')
            .delete()
            .eq('evidence_id', id);

        // Delete evidence_files records (cascade should handle this but be explicit)
        await supabase
            .from('evidence_files')
            .delete()
            .eq('evidence_id', id);

        // Delete evidence record
        const { error } = await supabase
            .from('evidence')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(`Failed to delete evidence: ${error.message}`);

        // Delete file from Supabase Storage if it exists
        if (evidence?.file_url) {
            await deleteFromSupabase(evidence.file_url);
        }

        // Decrement storage usage (Phase 1: tracking only)
        if (totalFileSize > 0 && evidence?.initiative_id) {
            const organizationId = await StorageService.getOrganizationIdFromInitiative(evidence.initiative_id);
            if (organizationId) {
                await StorageService.decrementStorage(organizationId, totalFileSize);
            }
        }

        return;
    }

    static async getEvidenceStats(initiativeId?: string): Promise<Record<string, number>> {
        let query = supabase
            .from('evidence')
            .select('type');

        if (initiativeId) {
            query = query.eq('initiative_id', initiativeId);
        }

        const { data, error } = await query;

        if (error) throw new Error(`Failed to fetch evidence stats: ${error.message}`);

        const stats: Record<string, number> = {};
        data?.forEach(evidence => {
            const type = evidence.type as string;
            stats[type] = (stats[type] || 0) + 1;
        });

        return stats;
    }

    static async getEvidenceForUpdate(updateId: string, userId: string): Promise<Evidence[]> {
        const { data, error } = await supabase
            .from('evidence_kpi_updates')
            .select(`
                evidence(
                    id, title, description, type, file_url, file_type,
                    date_represented, date_range_start, date_range_end,
                    created_at, updated_at, user_id
                )
            `)
            .eq('kpi_update_id', updateId);

        if (error) throw new Error(`Failed to fetch evidence for update: ${error.message}`);

        // Extract and filter evidence items
        const evidence = (data || [])
            .map((item: any) => item.evidence)
            .filter(Boolean)
            .filter((e: any) => e.user_id === userId);

        return evidence;
    }

    static async getFilesForEvidence(evidenceId: string, userId: string): Promise<any[]> {
        // First verify the user owns this evidence
        const { data: evidence, error: evidenceError } = await supabase
            .from('evidence')
            .select('id, file_url, file_type')
            .eq('id', evidenceId)
            .eq('user_id', userId)
            .single();

        if (evidenceError || !evidence) {
            return [];
        }

        // Try to get files from evidence_files table
        const { data: files, error: filesError } = await supabase
            .from('evidence_files')
            .select('id, file_url, file_name, file_type, file_size, display_order')
            .eq('evidence_id', evidenceId)
            .order('display_order', { ascending: true });

        if (filesError) {
            console.error('Error fetching evidence files:', filesError);
            // Fall back to the single file_url from evidence table
            if (evidence.file_url) {
                return [{
                    id: evidenceId,
                    file_url: evidence.file_url,
                    file_name: evidence.file_url.split('/').pop() || 'file',
                    file_type: evidence.file_type || 'unknown',
                    display_order: 0
                }];
            }
            return [];
        }

        // If no files in evidence_files table, fall back to evidence.file_url
        if (!files || files.length === 0) {
            if (evidence.file_url) {
                return [{
                    id: evidenceId,
                    file_url: evidence.file_url,
                    file_name: evidence.file_url.split('/').pop() || 'file',
                    file_type: evidence.file_type || 'unknown',
                    display_order: 0
                }];
            }
            return [];
        }

        return files;
    }

    static async getDataPointsForEvidence(evidenceId: string, userId: string): Promise<any[]> {
        // First get all evidence_kpi_updates for this evidence
        const { data, error } = await supabase
            .from('evidence_kpi_updates')
            .select(`
                kpi_update_id,
                kpi_updates(
                    id, value, date_represented, date_range_start, date_range_end,
                    label, note, created_at, user_id, location_id,
                    kpis(id, title, unit_of_measurement)
                )
            `)
            .eq('evidence_id', evidenceId);

        if (error) throw new Error(`Failed to fetch data points for evidence: ${error.message}`);

        // Extract and filter data points by user_id
        const dataPoints = (data || [])
            .map((item: any) => item.kpi_updates)
            .filter(Boolean)
            .filter((dp: any) => dp.user_id === userId)
            .map((dp: any) => ({
                ...dp,
                kpi: dp.kpis
            }));

        return dataPoints;
    }
} 