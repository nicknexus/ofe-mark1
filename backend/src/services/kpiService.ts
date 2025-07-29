import { supabase } from '../utils/supabase';
import { KPI, KPIUpdate, KPIWithEvidence } from '../types';

export class KPIService {
    static async create(kpi: KPI, userId: string): Promise<KPI> {
        const { data, error } = await supabase
            .from('kpis')
            .insert([{ ...kpi, user_id: userId }])
            .select()
            .single();

        if (error) throw new Error(`Failed to create KPI: ${error.message}`);
        return data;
    }

    static async getAll(userId: string, initiativeId?: string): Promise<KPI[]> {
        let query = supabase
            .from('kpis')
            .select('*')
            .eq('user_id', userId);

        if (initiativeId) {
            query = query.eq('initiative_id', initiativeId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch KPIs: ${error.message}`);
        return data || [];
    }

    static async getWithEvidence(userId: string, initiativeId?: string): Promise<KPIWithEvidence[]> {
        let query = supabase
            .from('kpis')
            .select(`
        *,
        kpi_updates(id, date_represented, created_at),
        evidence_kpis(
            evidence(id, date_represented, date_range_start, date_range_end)
        )
      `)
            .eq('user_id', userId);

        if (initiativeId) {
            query = query.eq('initiative_id', initiativeId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch KPIs with evidence: ${error.message}`);

        return (data || []).map((kpi: any) => {
            const updates = kpi.kpi_updates || [];
            const evidenceItems = kpi.evidence_kpis?.map((ek: any) => ek.evidence).filter(Boolean) || [];

            // Calculate how many updates have matching evidence by date
            const updatesWithEvidence = updates.filter((update: any) =>
                evidenceItems.some((evidence: any) =>
                    evidence.date_represented === update.date_represented ||
                    (evidence.date_range_start && evidence.date_range_end &&
                        update.date_represented >= evidence.date_range_start &&
                        update.date_represented <= evidence.date_range_end)
                )
            );

            const evidencePercentage = updates.length > 0
                ? Math.round((updatesWithEvidence.length / updates.length) * 100)
                : 0;

            return {
                ...kpi,
                evidence_count: evidenceItems.length,
                total_updates: updates.length,
                evidence_percentage: evidencePercentage,
                latest_update: updates.length > 0 ? updates[0] : null
            };
        });
    }

    static async getById(id: string, userId: string): Promise<KPI | null> {
        const { data, error } = await supabase
            .from('kpis')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to fetch KPI: ${error.message}`);
        }
        return data;
    }

    static async update(id: string, updates: Partial<KPI>, userId: string): Promise<KPI> {
        const { data, error } = await supabase
            .from('kpis')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update KPI: ${error.message}`);
        return data;
    }

    static async delete(id: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('kpis')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(`Failed to delete KPI: ${error.message}`);
    }

    // KPI Updates
    static async addUpdate(update: KPIUpdate, userId: string): Promise<KPIUpdate> {
        const { data, error } = await supabase
            .from('kpi_updates')
            .insert([{ ...update, user_id: userId }])
            .select()
            .single();

        if (error) throw new Error(`Failed to add KPI update: ${error.message}`);
        return data;
    }

    static async getUpdates(kpiId: string, userId: string): Promise<KPIUpdate[]> {
        const { data, error } = await supabase
            .from('kpi_updates')
            .select('*')
            .eq('kpi_id', kpiId)
            .eq('user_id', userId)
            .order('date_represented', { ascending: false });

        if (error) throw new Error(`Failed to fetch KPI updates: ${error.message}`);
        return data || [];
    }

    static async updateKPIUpdate(id: string, updates: Partial<KPIUpdate>, userId: string): Promise<KPIUpdate> {
        const { data, error } = await supabase
            .from('kpi_updates')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update KPI update: ${error.message}`);
        return data;
    }

    static async deleteUpdate(id: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('kpi_updates')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(`Failed to delete KPI update: ${error.message}`);
    }
} 