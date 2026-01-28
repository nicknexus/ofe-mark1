import { supabase } from '../utils/supabase';
import { Location } from '../types';
import { InitiativeService } from './initiativeService';

export class LocationService {
    static async create(location: Location, userId: string): Promise<Location> {
        // Get max display_order for this initiative to set the new item at the end
        let maxOrder = 0
        if (location.initiative_id) {
            const { data: existingLocations } = await supabase
                .from('locations')
                .select('display_order')
                .eq('initiative_id', location.initiative_id)
                .order('display_order', { ascending: false })
                .limit(1)
            
            if (existingLocations && existingLocations.length > 0) {
                maxOrder = (existingLocations[0].display_order ?? 0) + 1
            }
        }
        
        const { data, error } = await supabase
            .from('locations')
            .insert([{ ...location, user_id: userId, display_order: maxOrder }])
            .select()
            .single();

        if (error) throw new Error(`Failed to create location: ${error.message}`);
        return data;
    }

    static async getAll(userId: string, initiativeId?: string): Promise<Location[]> {
        // If initiative_id provided, fetch directly (access controlled at route level)
        if (initiativeId) {
            const { data, error } = await supabase
                .from('locations')
                .select('*')
                .eq('initiative_id', initiativeId)
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) throw new Error(`Failed to fetch locations: ${error.message}`);
            return data || [];
        }

        // No initiative - get all for user's accessible initiatives
        const initiatives = await InitiativeService.getAll(userId);
        if (initiatives.length === 0) {
            return [];
        }

        const initiativeIds = initiatives.map(i => i.id);
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .in('initiative_id', initiativeIds)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

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

    // Get evidence linked to a location (via evidence_locations junction table)
    static async getEvidenceByLocation(locationId: string, userId: string): Promise<any[]> {
        // Query through the junction table to find all evidence linked to this location
        const { data: junctionData, error: junctionError } = await supabase
            .from('evidence_locations')
            .select(`
                evidence_id,
                evidence(
                    id, title, description, type, file_url, file_type,
                    date_represented, date_range_start, date_range_end,
                    created_at, updated_at, user_id, initiative_id
                )
            `)
            .eq('location_id', locationId);

        if (junctionError) throw new Error(`Failed to fetch evidence for location: ${junctionError.message}`);

        // Extract evidence items, filter by user_id, and deduplicate
        const evidenceItems = (junctionData || [])
            .map((item: any) => item.evidence)
            .filter(Boolean)
            .filter((ev: any) => ev.user_id === userId);

        // Sort by date_represented descending
        evidenceItems.sort((a: any, b: any) => {
            const dateA = a.date_represented ? new Date(a.date_represented).getTime() : 0;
            const dateB = b.date_represented ? new Date(b.date_represented).getTime() : 0;
            return dateB - dateA;
        });

        return evidenceItems;
    }
}

