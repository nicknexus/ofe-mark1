import { supabase } from '../utils/supabase';
import { Location } from '../types';
import { InitiativeService } from './initiativeService';

export class LocationService {
    static async create(location: Location, userId: string, requestedOrgId?: string): Promise<Location> {
        // Authorize: caller must have access to the initiative being written to.
        if (location.initiative_id) {
            const initiative = await InitiativeService.getById(location.initiative_id, userId, requestedOrgId)
            if (!initiative) throw new Error('Initiative not found or access denied')
        }

        // Get max display_order across the initiative (org-wide).
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

    static async getAll(userId: string, initiativeId?: string, requestedOrgId?: string): Promise<Location[]> {
        if (initiativeId) {
            // Authorize via initiative org context.
            const initiative = await InitiativeService.getById(initiativeId, userId, requestedOrgId)
            if (!initiative) return []

            const { data, error } = await supabase
                .from('locations')
                .select('*')
                .eq('initiative_id', initiativeId)
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) throw new Error(`Failed to fetch locations: ${error.message}`);
            return data || [];
        }

        // No initiative - get all for user's accessible initiatives in the active org
        const initiatives = await InitiativeService.getAll(userId, requestedOrgId);
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

    static async getById(id: string, userId: string, requestedOrgId?: string): Promise<Location | null> {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to fetch location: ${error.message}`);
        }

        // Org-scoped access: verify user can access the parent initiative
        // (covers org owners, team members, and demo orgs owned by admins).
        if (data?.initiative_id) {
            const initiative = await InitiativeService.getById(data.initiative_id, userId, requestedOrgId);
            if (!initiative) return null;
        } else if (data?.user_id !== userId) {
            // Orphan location with no initiative: only the creator can see it.
            return null;
        }

        return data;
    }

    static async update(id: string, location: Partial<Location>, userId: string, requestedOrgId?: string): Promise<Location> {
        const existing = await this.getById(id, userId, requestedOrgId);
        if (!existing) throw new Error('Location not found or access denied');

        const { data, error } = await supabase
            .from('locations')
            .update(location)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(`Failed to update location: ${error.message}`);
        return data;
    }

    static async delete(id: string, userId: string, requestedOrgId?: string): Promise<void> {
        const existing = await this.getById(id, userId, requestedOrgId);
        if (!existing) throw new Error('Location not found or access denied');

        const { error } = await supabase
            .from('locations')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Failed to delete location: ${error.message}`);
    }

    // Get KPI updates linked to a location
    static async getKPIUpdatesByLocation(locationId: string, userId: string, requestedOrgId?: string): Promise<any[]> {
        // Verify access via the location's initiative (org-scoped)
        const location = await this.getById(locationId, userId, requestedOrgId);
        if (!location) return [];

        const { data, error } = await supabase
            .from('kpi_updates')
            .select(`
                *,
                kpis(id, title, unit_of_measurement, metric_type, initiative_id)
            `)
            .eq('location_id', locationId)
            .order('date_represented', { ascending: false });

        if (error) throw new Error(`Failed to fetch KPI updates for location: ${error.message}`);

        // Restrict to KPI updates whose KPI lives in the same initiative as the location.
        const rows = (data || []).filter((row: any) =>
            row?.kpis?.initiative_id && row.kpis.initiative_id === location.initiative_id
        );
        return rows;
    }

    // Get evidence linked to a location (via evidence_locations junction table)
    static async getEvidenceByLocation(locationId: string, userId: string, requestedOrgId?: string): Promise<any[]> {
        const location = await this.getById(locationId, userId, requestedOrgId);
        if (!location) return [];

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

        // Restrict to evidence in the same initiative as the location (org-scoped access).
        const evidenceItems = (junctionData || [])
            .map((item: any) => item.evidence)
            .filter(Boolean)
            .filter((ev: any) => ev.initiative_id && ev.initiative_id === location.initiative_id);

        evidenceItems.sort((a: any, b: any) => {
            const dateA = a.date_represented ? new Date(a.date_represented).getTime() : 0;
            const dateB = b.date_represented ? new Date(b.date_represented).getTime() : 0;
            return dateB - dateA;
        });

        return evidenceItems;
    }
}

