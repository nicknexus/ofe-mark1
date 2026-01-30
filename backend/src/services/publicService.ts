import { supabase } from '../utils/supabase';
import { Organization, Initiative, KPI, Evidence, Story, Location, BeneficiaryGroup } from '../types';

// Types for public responses (stripped of sensitive fields)
export interface PublicOrganization {
    id: string;
    name: string;
    slug: string;
    description?: string;
    logo_url?: string;
    created_at?: string;
}

export interface PublicInitiative {
    id: string;
    title: string;
    description: string;
    region?: string;
    location?: string;
    slug: string;
    coordinates?: { lat: number; lng: number }[];
    created_at?: string;
    organization_id: string;
    org_slug?: string; // For navigation
    organization_name?: string; // For display
    organization_logo_url?: string; // For display
}

export interface PublicKPI {
    id: string;
    title: string;
    description: string;
    metric_type: 'number' | 'percentage';
    unit_of_measurement: string;
    category: 'input' | 'output' | 'impact';
    display_order?: number;
    initiative_id: string;
    initiative_slug?: string;
    org_slug?: string;
}

export interface SearchResult {
    organizations: PublicOrganization[];
    initiatives: (PublicInitiative & { organization_name: string })[];
    locationMatches: {
        location: Location;
        initiative: PublicInitiative;
        organization: PublicOrganization;
    }[];
}

export class PublicService {
    // ============================================
    // SEARCH
    // ============================================

    static async search(query: string): Promise<SearchResult> {
        const searchTerm = query.trim().toLowerCase();
        if (!searchTerm) {
            return { organizations: [], initiatives: [], locationMatches: [] };
        }

        // Search organizations
        const { data: orgs } = await supabase
            .from('organizations')
            .select('id, name, slug, description, logo_url, created_at')
            .eq('is_public', true)
            .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
            .order('name')
            .limit(20);

        // Search initiatives (with org info including logo)
        const { data: inits } = await supabase
            .from('initiatives')
            .select(`
                id, title, description, region, location, slug, coordinates, created_at, organization_id,
                organizations!inner(id, name, slug, logo_url, is_public)
            `)
            .eq('is_public', true)
            .eq('organizations.is_public', true)
            .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,region.ilike.%${searchTerm}%`)
            .order('title')
            .limit(20);

        // Search locations (returns initiatives that have matching locations)
        const { data: locs } = await supabase
            .from('locations')
            .select(`
                id, name, description, latitude, longitude, initiative_id,
                initiatives!inner(
                    id, title, description, region, slug, is_public, organization_id,
                    organizations!inner(id, name, slug, logo_url, is_public)
                )
            `)
            .ilike('name', `%${searchTerm}%`)
            .eq('initiatives.is_public', true)
            .eq('initiatives.organizations.is_public', true)
            .limit(20);

        // Format results
        const organizations: PublicOrganization[] = (orgs || []).map(o => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
            description: o.description,
            logo_url: o.logo_url,
            created_at: o.created_at
        }));

        const initiatives = (inits || []).map((i: any) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            region: i.region,
            location: i.location,
            slug: i.slug,
            coordinates: i.coordinates,
            created_at: i.created_at,
            organization_id: i.organization_id,
            org_slug: i.organizations?.slug,
            organization_name: i.organizations?.name,
            organization_logo_url: i.organizations?.logo_url
        }));

        const locationMatches = (locs || []).map((l: any) => ({
            location: {
                id: l.id,
                name: l.name,
                description: l.description,
                latitude: l.latitude,
                longitude: l.longitude,
                initiative_id: l.initiative_id
            },
            initiative: {
                id: l.initiatives.id,
                title: l.initiatives.title,
                description: l.initiatives.description,
                region: l.initiatives.region,
                slug: l.initiatives.slug,
                organization_id: l.initiatives.organization_id,
                org_slug: l.initiatives.organizations?.slug,
                organization_logo_url: l.initiatives.organizations?.logo_url
            },
            organization: {
                id: l.initiatives.organizations?.id,
                name: l.initiatives.organizations?.name,
                slug: l.initiatives.organizations?.slug,
                logo_url: l.initiatives.organizations?.logo_url
            }
        }));

        // Deduplicate location matches by initiative
        const seenInitiatives = new Set<string>();
        const uniqueLocationMatches = locationMatches.filter((m: any) => {
            if (seenInitiatives.has(m.initiative.id)) return false;
            seenInitiatives.add(m.initiative.id);
            return true;
        });

        return {
            organizations,
            initiatives,
            locationMatches: uniqueLocationMatches
        };
    }

    // ============================================
    // ORGANIZATIONS
    // ============================================

    static async getAllOrganizations(): Promise<PublicOrganization[]> {
        const { data, error } = await supabase
            .from('organizations')
            .select('id, name, slug, description, created_at')
            .eq('is_public', true)
            .order('name')
            .limit(100);

        if (error) throw new Error(`Failed to fetch organizations: ${error.message}`);
        return data || [];
    }

    static async getOrganizationBySlug(slug: string): Promise<{
        organization: PublicOrganization;
        stats: { initiatives: number; locations: number; stories: number; kpis: number };
    } | null> {
        const { data: org, error } = await supabase
            .from('organizations')
            .select('id, name, slug, description, created_at')
            .eq('slug', slug)
            .eq('is_public', true)
            .single();

        if (error || !org) return null;

        // Get stats
        const { data: initiatives } = await supabase
            .from('initiatives')
            .select('id')
            .eq('organization_id', org.id)
            .eq('is_public', true);

        const initiativeIds = (initiatives || []).map(i => i.id);
        let locationCount = 0;
        let storyCount = 0;
        let kpiCount = 0;

        if (initiativeIds.length > 0) {
            const { count: locCount } = await supabase
                .from('locations')
                .select('id', { count: 'exact', head: true })
                .in('initiative_id', initiativeIds);
            locationCount = locCount || 0;

            const { count: storCount } = await supabase
                .from('stories')
                .select('id', { count: 'exact', head: true })
                .in('initiative_id', initiativeIds);
            storyCount = storCount || 0;

            const { count: kCount } = await supabase
                .from('kpis')
                .select('id', { count: 'exact', head: true })
                .in('initiative_id', initiativeIds);
            kpiCount = kCount || 0;
        }

        return {
            organization: org,
            stats: {
                initiatives: initiativeIds.length,
                locations: locationCount,
                stories: storyCount,
                kpis: kpiCount
            }
        };
    }

    static async getOrganizationInitiatives(orgSlug: string): Promise<PublicInitiative[]> {
        const { data, error } = await supabase
            .from('initiatives')
            .select(`
                id, title, description, region, location, slug, coordinates, created_at, organization_id,
                organizations!inner(slug, name, logo_url, is_public)
            `)
            .eq('organizations.slug', orgSlug)
            .eq('organizations.is_public', true)
            .eq('is_public', true)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch initiatives: ${error.message}`);
        
        return (data || []).map((i: any) => ({
            id: i.id,
            title: i.title,
            description: i.description,
            region: i.region,
            location: i.location,
            slug: i.slug,
            coordinates: i.coordinates,
            created_at: i.created_at,
            organization_id: i.organization_id,
            org_slug: i.organizations?.slug,
            organization_name: i.organizations?.name,
            organization_logo_url: i.organizations?.logo_url
        }));
    }

    // ============================================
    // ORG-LEVEL AGGREGATES (for Public Dashboard)
    // ============================================

    static async getOrganizationMetrics(orgSlug: string): Promise<any[]> {
        // Get all KPIs from all public initiatives in this org, including updates for totals
        const { data, error } = await supabase
            .from('kpis')
            .select(`
                id, title, description, metric_type, unit_of_measurement, category, display_order, initiative_id,
                initiatives!inner(id, slug, title, is_public, organization_id,
                    organizations!inner(slug, is_public)
                ),
                kpi_updates(id, value, date_represented)
            `)
            .eq('initiatives.organizations.slug', orgSlug)
            .eq('initiatives.organizations.is_public', true)
            .eq('initiatives.is_public', true)
            .order('display_order');

        if (error) throw new Error(`Failed to fetch metrics: ${error.message}`);

        return (data || []).map((k: any) => {
            const updates = k.kpi_updates || [];
            const totalValue = updates.length > 0 
                ? updates.reduce((sum: number, u: any) => sum + (u.value || 0), 0)
                : undefined;

            return {
                id: k.id,
                title: k.title,
                description: k.description,
                metric_type: k.metric_type,
                unit_of_measurement: k.unit_of_measurement,
                category: k.category,
                display_order: k.display_order,
                initiative_id: k.initiative_id,
                initiative_slug: k.initiatives?.slug,
                initiative_title: k.initiatives?.title,
                org_slug: k.initiatives?.organizations?.slug,
                total_value: totalValue,
                update_count: updates.length
            };
        });
    }

    static async getOrganizationStories(orgSlug: string, limit?: number): Promise<any[]> {
        let query = supabase
            .from('stories')
            .select(`
                id, title, description, media_url, media_type, date_represented, location_id, initiative_id,
                locations(id, name),
                initiatives!inner(id, slug, title, is_public, organization_id,
                    organizations!inner(slug, is_public)
                )
            `)
            .eq('initiatives.organizations.slug', orgSlug)
            .eq('initiatives.organizations.is_public', true)
            .eq('initiatives.is_public', true)
            .order('date_represented', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) throw new Error(`Failed to fetch stories: ${error.message}`);

        return (data || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            description: s.description,
            media_url: s.media_url,
            media_type: s.media_type,
            date_represented: s.date_represented,
            location_id: s.location_id,
            location_name: s.locations?.name,
            initiative_id: s.initiative_id,
            initiative_slug: s.initiatives?.slug,
            initiative_title: s.initiatives?.title,
            org_slug: s.initiatives?.organizations?.slug
        }));
    }

    static async getOrganizationLocations(orgSlug: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('locations')
            .select(`
                id, name, description, latitude, longitude, initiative_id,
                initiatives!inner(id, slug, title, is_public, organization_id,
                    organizations!inner(slug, is_public)
                )
            `)
            .eq('initiatives.organizations.slug', orgSlug)
            .eq('initiatives.organizations.is_public', true)
            .eq('initiatives.is_public', true)
            .order('name');

        if (error) throw new Error(`Failed to fetch locations: ${error.message}`);

        return (data || []).map((l: any) => ({
            id: l.id,
            name: l.name,
            description: l.description,
            latitude: l.latitude,
            longitude: l.longitude,
            initiative_id: l.initiative_id,
            initiative_slug: l.initiatives?.slug,
            initiative_title: l.initiatives?.title,
            org_slug: l.initiatives?.organizations?.slug
        }));
    }

    static async getOrganizationEvidence(orgSlug: string, limit?: number): Promise<any[]> {
        let query = supabase
            .from('evidence')
            .select(`
                id, title, description, type, file_url, file_urls, date_represented, initiative_id,
                initiatives!inner(id, slug, title, is_public, organization_id,
                    organizations!inner(slug, is_public)
                )
            `)
            .eq('initiatives.organizations.slug', orgSlug)
            .eq('initiatives.organizations.is_public', true)
            .eq('initiatives.is_public', true)
            .order('date_represented', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) throw new Error(`Failed to fetch evidence: ${error.message}`);

        return (data || []).map((e: any) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            type: e.type,
            file_url: e.file_url,
            file_urls: e.file_urls,
            date_represented: e.date_represented,
            initiative_id: e.initiative_id,
            initiative_slug: e.initiatives?.slug,
            initiative_title: e.initiatives?.title,
            org_slug: e.initiatives?.organizations?.slug
        }));
    }

    // ============================================
    // INITIATIVE-LEVEL (for Advanced View)
    // ============================================

    static async getInitiativeBySlug(orgSlug: string, initiativeSlug: string): Promise<PublicInitiative | null> {
        const { data, error } = await supabase
            .from('initiatives')
            .select(`
                id, title, description, region, location, slug, coordinates, created_at, organization_id,
                organizations!inner(id, slug, name, logo_url, is_public)
            `)
            .eq('slug', initiativeSlug)
            .eq('organizations.slug', orgSlug)
            .eq('organizations.is_public', true)
            .eq('is_public', true)
            .single();

        if (error || !data) return null;

        return {
            id: data.id,
            title: data.title,
            description: data.description,
            region: data.region,
            location: data.location,
            slug: data.slug,
            coordinates: data.coordinates,
            created_at: data.created_at,
            organization_id: data.organization_id,
            org_slug: (data as any).organizations?.slug,
            organization_name: (data as any).organizations?.name,
            organization_logo_url: (data as any).organizations?.logo_url
        } as PublicInitiative;
    }

    static async getInitiativeDashboard(orgSlug: string, initiativeSlug: string): Promise<any> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return null;

        // Get KPIs with updates
        const { data: kpis } = await supabase
            .from('kpis')
            .select(`
                id, title, description, metric_type, unit_of_measurement, category, display_order,
                kpi_updates(id, value, date_represented, date_range_start, date_range_end, location_id, note)
            `)
            .eq('initiative_id', initiative.id)
            .order('display_order');

        // Get locations
        const { data: locations } = await supabase
            .from('locations')
            .select('id, name, description, latitude, longitude, display_order')
            .eq('initiative_id', initiative.id)
            .order('display_order');

        // Get evidence count
        const { count: evidenceCount } = await supabase
            .from('evidence')
            .select('id', { count: 'exact', head: true })
            .eq('initiative_id', initiative.id);

        // Get story count
        const { count: storyCount } = await supabase
            .from('stories')
            .select('id', { count: 'exact', head: true })
            .eq('initiative_id', initiative.id);

        return {
            initiative,
            kpis: kpis || [],
            locations: locations || [],
            stats: {
                kpis: (kpis || []).length,
                evidence: evidenceCount || 0,
                stories: storyCount || 0,
                locations: (locations || []).length
            }
        };
    }

    static async getInitiativeStories(orgSlug: string, initiativeSlug: string): Promise<any[]> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return [];

        const { data, error } = await supabase
            .from('stories')
            .select(`
                id, title, description, media_url, media_type, date_represented, location_id, created_at,
                locations(id, name, latitude, longitude),
                story_beneficiaries(beneficiary_groups(id, name))
            `)
            .eq('initiative_id', initiative.id)
            .order('date_represented', { ascending: false });

        if (error) throw new Error(`Failed to fetch stories: ${error.message}`);

        return (data || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            description: s.description,
            media_url: s.media_url,
            media_type: s.media_type,
            date_represented: s.date_represented,
            location_id: s.location_id,
            location: s.locations,
            beneficiary_groups: s.story_beneficiaries?.map((sb: any) => sb.beneficiary_groups).filter(Boolean) || [],
            created_at: s.created_at
        }));
    }

    static async getInitiativeLocations(orgSlug: string, initiativeSlug: string): Promise<Location[]> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return [];

        const { data, error } = await supabase
            .from('locations')
            .select('id, name, description, latitude, longitude, display_order, created_at, initiative_id')
            .eq('initiative_id', initiative.id)
            .order('display_order');

        if (error) throw new Error(`Failed to fetch locations: ${error.message}`);
        return data || [];
    }

    static async getInitiativeEvidence(orgSlug: string, initiativeSlug: string): Promise<any[]> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return [];

        const { data, error } = await supabase
            .from('evidence')
            .select(`
                id, title, description, type, file_url, file_urls, date_represented, date_range_start, date_range_end, created_at,
                evidence_locations(locations(id, name)),
                evidence_kpis(kpis(id, title))
            `)
            .eq('initiative_id', initiative.id)
            .order('date_represented', { ascending: false });

        if (error) throw new Error(`Failed to fetch evidence: ${error.message}`);

        return (data || []).map((e: any) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            type: e.type,
            file_url: e.file_url,
            file_urls: e.file_urls,
            date_represented: e.date_represented,
            date_range_start: e.date_range_start,
            date_range_end: e.date_range_end,
            locations: e.evidence_locations?.map((el: any) => el.locations).filter(Boolean) || [],
            kpis: e.evidence_kpis?.map((ek: any) => ek.kpis).filter(Boolean) || [],
            created_at: e.created_at
        }));
    }

    static async getInitiativeBeneficiaries(orgSlug: string, initiativeSlug: string): Promise<BeneficiaryGroup[]> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return [];

        const { data, error } = await supabase
            .from('beneficiary_groups')
            .select(`
                id, name, description, location_id, age_range_start, age_range_end, total_number, display_order, created_at,
                locations(id, name)
            `)
            .eq('initiative_id', initiative.id)
            .order('display_order');

        if (error) throw new Error(`Failed to fetch beneficiaries: ${error.message}`);

        return (data || []).map((b: any) => ({
            ...b,
            location: b.locations
        }));
    }

    static async getInitiativeKPIs(orgSlug: string, initiativeSlug: string): Promise<any[]> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return [];

        const { data, error } = await supabase
            .from('kpis')
            .select(`
                id, title, description, metric_type, unit_of_measurement, category, display_order,
                kpi_updates(
                    id, value, date_represented, date_range_start, date_range_end, location_id, note, label,
                    locations(id, name)
                )
            `)
            .eq('initiative_id', initiative.id)
            .order('display_order');

        if (error) throw new Error(`Failed to fetch KPIs: ${error.message}`);

        // Calculate totals and format
        return (data || []).map((k: any) => {
            const updates = k.kpi_updates || [];
            const totalValue = updates.reduce((sum: number, u: any) => sum + (u.value || 0), 0);
            
            return {
                id: k.id,
                title: k.title,
                description: k.description,
                metric_type: k.metric_type,
                unit_of_measurement: k.unit_of_measurement,
                category: k.category,
                display_order: k.display_order,
                updates: updates.map((u: any) => ({
                    ...u,
                    location: u.locations
                })),
                total_value: totalValue,
                update_count: updates.length
            };
        });
    }
}
