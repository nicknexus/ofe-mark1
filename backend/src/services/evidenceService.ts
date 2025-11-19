import { supabase } from '../utils/supabase'
import { Evidence } from '../types'
import { deleteFromSupabase } from '../utils/fileUpload'

export class EvidenceService {
    static async create(evidence: Evidence, userId: string): Promise<Evidence> {
        // Extract linkage fields before inserting into evidence table
        const { kpi_ids, kpi_update_ids, ...evidenceData } = evidence;

        const { data, error } = await supabase
            .from('evidence')
            .insert([{ ...evidenceData, user_id: userId }])
            .select()
            .single();

        if (error) throw new Error(`Failed to create evidence: ${error.message}`);

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
                    initiatives(title)
                `);
        }

        if (initiativeId) {
            query = query.eq('initiative_id', initiativeId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch evidence: ${error.message}`);
        
        // Transform the data to include kpi_update_ids as a flat array
        const transformedData = (data || []).map((item: any) => {
            const kpi_update_ids = item.evidence_kpi_updates?.map((link: any) => link.kpi_update_id).filter(Boolean) || [];
            return {
                ...item,
                kpi_update_ids
            };
        });
        
        return transformedData;
    }

    static async getById(id: string): Promise<Evidence | null> {
        // Include linked data points for new model
        const { data, error } = await supabase
            .from('evidence')
            .select(`
                *,
                evidence_kpis(kpi_id),
                evidence_kpi_updates(kpi_update_id),
                initiatives(title)
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to fetch evidence: ${error.message}`);
        }
        return data;
    }

    static async update(id: string, evidence: Partial<Evidence>, userId: string): Promise<Evidence> {
        // Extract linkage fields for separate handling
        const { kpi_ids, kpi_update_ids, ...evidenceData } = evidence;

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

        return data;
    }

    static async delete(id: string, userId: string): Promise<void> {
        // Get evidence record first to delete associated file
        const { data: evidence, error: fetchError } = await supabase
            .from('evidence')
            .select('file_url')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                throw new Error('Evidence not found');
            }
            throw new Error(`Failed to fetch evidence: ${fetchError.message}`);
        }

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