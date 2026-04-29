import { supabase } from '../utils/supabase';
import { Location } from '../types';
import { InitiativeService } from './initiativeService';

export class LocationService {
    // ---------- helpers ----------

    private static async assertInitiativeAccess(initiativeId: string, userId: string, requestedOrgId?: string) {
        const initiative = await InitiativeService.getById(initiativeId, userId, requestedOrgId);
        if (!initiative) throw new Error('Initiative not found or access denied');
        return initiative;
    }

    private static async assertLocationAccess(locationId: string, userId: string, requestedOrgId?: string) {
        const location = await this.getById(locationId, userId, requestedOrgId);
        if (!location) throw new Error('Location not found or access denied');
        return location;
    }

    private static async hydrateInitiativeIds(locations: any[]): Promise<Location[]> {
        if (locations.length === 0) return [];
        const ids = locations.map(l => l.id);
        const { data: links, error } = await supabase
            .from('initiative_locations')
            .select('initiative_id, location_id')
            .in('location_id', ids);
        if (error) throw new Error(`Failed to fetch initiative links: ${error.message}`);

        const byLoc = new Map<string, string[]>();
        (links || []).forEach((row: any) => {
            const arr = byLoc.get(row.location_id) || [];
            arr.push(row.initiative_id);
            byLoc.set(row.location_id, arr);
        });

        return locations.map(l => ({ ...l, initiative_ids: byLoc.get(l.id) || [] }));
    }

    // ---------- CRUD ----------

    static async create(location: Partial<Location>, userId: string, requestedOrgId?: string): Promise<Location> {
        const organizationId = await InitiativeService.getEffectiveOrganizationId(userId, requestedOrgId);
        if (!organizationId) throw new Error('No organization context');

        // If caller wants the new location auto-linked to a specific initiative,
        // verify access to that initiative first.
        const linkInitiativeId = location.initiative_id || null;
        if (linkInitiativeId) {
            await this.assertInitiativeAccess(linkInitiativeId, userId, requestedOrgId);
        }

        // Org-wide max display_order
        let displayOrder = 0;
        const { data: existingLocations } = await supabase
            .from('locations')
            .select('display_order')
            .eq('organization_id', organizationId)
            .order('display_order', { ascending: false })
            .limit(1);
        if (existingLocations && existingLocations.length > 0) {
            displayOrder = (existingLocations[0].display_order ?? 0) + 1;
        }

        const insertPayload: any = {
            organization_id: organizationId,
            initiative_id: linkInitiativeId,
            user_id: userId,
            name: location.name,
            description: location.description,
            latitude: location.latitude,
            longitude: location.longitude,
            country: (location as any).country,
            display_order: displayOrder,
        };

        const { data, error } = await supabase
            .from('locations')
            .insert([insertPayload])
            .select()
            .single();

        if (error) throw new Error(`Failed to create location: ${error.message}`);

        // If created in the context of an initiative, also create the junction link
        if (linkInitiativeId && data?.id) {
            await supabase
                .from('initiative_locations')
                .insert([{ initiative_id: linkInitiativeId, location_id: data.id }])
                .then(() => undefined);
        }

        const [hydrated] = await this.hydrateInitiativeIds([data]);
        return hydrated;
    }

    static async getAll(userId: string, initiativeId?: string, requestedOrgId?: string): Promise<Location[]> {
        const organizationId = await InitiativeService.getEffectiveOrganizationId(userId, requestedOrgId);
        if (!organizationId) return [];

        if (initiativeId) {
            // Verify access to the initiative
            const initiative = await InitiativeService.getById(initiativeId, userId, requestedOrgId);
            if (!initiative) return [];

            // Locations linked to this initiative via initiative_locations
            const { data: links, error: linksError } = await supabase
                .from('initiative_locations')
                .select('location_id')
                .eq('initiative_id', initiativeId);
            if (linksError) throw new Error(`Failed to fetch initiative locations: ${linksError.message}`);

            const locationIds = (links || []).map((l: any) => l.location_id);
            if (locationIds.length === 0) return [];

            const { data, error } = await supabase
                .from('locations')
                .select('*')
                .in('id', locationIds)
                .eq('organization_id', organizationId)
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });
            if (error) throw new Error(`Failed to fetch locations: ${error.message}`);

            return this.hydrateInitiativeIds(data || []);
        }

        // No initiative filter: return all org locations
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .eq('organization_id', organizationId)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) throw new Error(`Failed to fetch locations: ${error.message}`);

        return this.hydrateInitiativeIds(data || []);
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
        if (!data) return null;

        // Org-scoped access: caller must belong to the location's org
        const organizationId = await InitiativeService.getEffectiveOrganizationId(userId, requestedOrgId);
        if (!organizationId || organizationId !== data.organization_id) {
            // Fall back: also accept if user belongs to that org via some other path
            // (matches how InitiativeService.getById resolves access).
            const altOrgId = await InitiativeService.getEffectiveOrganizationId(userId, data.organization_id);
            if (altOrgId !== data.organization_id) return null;
        }

        const [hydrated] = await this.hydrateInitiativeIds([data]);
        return hydrated;
    }

    static async update(id: string, location: Partial<Location>, userId: string, requestedOrgId?: string): Promise<Location> {
        await this.assertLocationAccess(id, userId, requestedOrgId);

        // Don't allow callers to mutate ownership/scope columns through update
        const { organization_id, user_id, initiative_id, initiative_ids, id: _id, created_at, ...safe } = location as any;

        const { data, error } = await supabase
            .from('locations')
            .update(safe)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(`Failed to update location: ${error.message}`);

        const [hydrated] = await this.hydrateInitiativeIds([data]);
        return hydrated;
    }

    static async delete(id: string, userId: string, requestedOrgId?: string): Promise<void> {
        await this.assertLocationAccess(id, userId, requestedOrgId);

        const { error } = await supabase
            .from('locations')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Failed to delete location: ${error.message}`);
    }

    // ---------- Initiative linking ----------

    static async linkToInitiative(locationId: string, initiativeId: string, userId: string, requestedOrgId?: string): Promise<void> {
        // Both must be accessible to caller and live in the same org
        const location = await this.assertLocationAccess(locationId, userId, requestedOrgId);
        const initiative = await this.assertInitiativeAccess(initiativeId, userId, requestedOrgId);

        if ((initiative as any).organization_id !== location.organization_id) {
            throw new Error('Cannot link location to an initiative in a different organization');
        }

        const { error } = await supabase
            .from('initiative_locations')
            .upsert(
                [{ initiative_id: initiativeId, location_id: locationId }],
                { onConflict: 'initiative_id,location_id', ignoreDuplicates: true }
            );

        if (error) throw new Error(`Failed to link location to initiative: ${error.message}`);
    }

    static async unlinkFromInitiative(locationId: string, initiativeId: string, userId: string, requestedOrgId?: string): Promise<void> {
        await this.assertLocationAccess(locationId, userId, requestedOrgId);
        await this.assertInitiativeAccess(initiativeId, userId, requestedOrgId);

        const { error } = await supabase
            .from('initiative_locations')
            .delete()
            .eq('initiative_id', initiativeId)
            .eq('location_id', locationId);

        if (error) throw new Error(`Failed to unlink location from initiative: ${error.message}`);
    }

    // ---------- Connected entities ----------

    static async getKPIUpdatesByLocation(locationId: string, userId: string, requestedOrgId?: string): Promise<any[]> {
        await this.assertLocationAccess(locationId, userId, requestedOrgId);

        const { data, error } = await supabase
            .from('kpi_updates')
            .select(`
                *,
                kpis(id, title, unit_of_measurement, metric_type, initiative_id)
            `)
            .eq('location_id', locationId)
            .order('date_represented', { ascending: false });

        if (error) throw new Error(`Failed to fetch KPI updates for location: ${error.message}`);
        return data || [];
    }

    static async getEvidenceByLocation(locationId: string, userId: string, requestedOrgId?: string): Promise<any[]> {
        await this.assertLocationAccess(locationId, userId, requestedOrgId);

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

        const evidenceItems = (junctionData || [])
            .map((item: any) => item.evidence)
            .filter(Boolean);

        evidenceItems.sort((a: any, b: any) => {
            const dateA = a.date_represented ? new Date(a.date_represented).getTime() : 0;
            const dateB = b.date_represented ? new Date(b.date_represented).getTime() : 0;
            return dateB - dateA;
        });

        return evidenceItems;
    }
}
