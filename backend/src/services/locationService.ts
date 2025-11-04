import { supabase } from '../utils/supabase';
import { Location } from '../types';

export class LocationService {
    static async create(location: Location, userId: string): Promise<Location> {
        const { data, error } = await supabase
            .from('locations')
            .insert([{ ...location, user_id: userId }])
            .select()
            .single();

        if (error) throw new Error(`Failed to create location: ${error.message}`);
        return data;
    }

    static async getAll(userId: string, initiativeId?: string): Promise<Location[]> {
        let query = supabase
            .from('locations')
            .select('*')
            .eq('user_id', userId);

        if (initiativeId) {
            query = query.eq('initiative_id', initiativeId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch locations: ${error.message}`);
        return data || [];
    }

    static async getById(id: string, userId: string): Promise<Location | null> {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw new Error(`Failed to fetch location: ${error.message}`);
        }
        return data;
    }

    static async update(id: string, location: Partial<Location>, userId: string): Promise<Location> {
        const { data, error } = await supabase
            .from('locations')
            .update(location)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update location: ${error.message}`);
        return data;
    }

    static async delete(id: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('locations')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(`Failed to delete location: ${error.message}`);
    }

    // Get KPI updates linked to a location
    static async getKPIUpdatesByLocation(locationId: string, userId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('kpi_updates')
            .select(`
                *,
                kpis(id, title, unit_of_measurement, metric_type)
            `)
            .eq('location_id', locationId)
            .eq('user_id', userId)
            .order('date_represented', { ascending: false });

        if (error) throw new Error(`Failed to fetch KPI updates for location: ${error.message}`);
        return data || [];
    }

    // Get evidence linked to a location
    static async getEvidenceByLocation(locationId: string, userId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('evidence')
            .select('*')
            .eq('location_id', locationId)
            .eq('user_id', userId)
            .order('date_represented', { ascending: false });

        if (error) throw new Error(`Failed to fetch evidence for location: ${error.message}`);
        return data || [];
    }
}

