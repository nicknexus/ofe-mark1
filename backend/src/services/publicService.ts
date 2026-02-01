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
    organization_brand_color?: string; // For branding
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
            .select('id, name, slug, description, logo_url, brand_color, created_at')
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
            .select('id, name, slug, description, logo_url, brand_color, created_at')
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
                id, title, description, type, file_url, date_represented, initiative_id,
                initiatives!inner(id, slug, title, is_public, organization_id,
                    organizations!inner(slug, is_public)
                ),
                evidence_files(id, file_url, file_name, file_type, display_order)
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
            files: e.evidence_files || [],
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
                organizations!inner(id, slug, name, logo_url, brand_color, is_public)
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
            organization_logo_url: (data as any).organizations?.logo_url,
            organization_brand_color: (data as any).organizations?.brand_color
        } as PublicInitiative;
    }

    static async getInitiativeDashboard(orgSlug: string, initiativeSlug: string): Promise<any> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return null;

        // Get KPIs with updates
        const { data: kpis, error: kpisError } = await supabase
            .from('kpis')
            .select(`
                id, title, description, metric_type, unit_of_measurement, category, display_order,
                kpi_updates(id, value, date_represented, date_range_start, date_range_end, location_id, note)
            `)
            .eq('initiative_id', initiative.id)
            .order('display_order');
        
        if (kpisError) {
            console.error('[Dashboard] KPIs query error:', kpisError);
        }
        console.log('[Dashboard] KPIs fetched:', kpis?.length || 0, 'for initiative:', initiative.id);

        // Get evidence counts per KPI separately (to avoid RLS issues)
        const kpiIds = (kpis || []).map(k => k.id);
        let evidenceCounts: Record<string, number> = {};
        
        if (kpiIds.length > 0) {
            const { data: evidenceLinks, error: evidenceError } = await supabase
                .from('evidence_kpis')
                .select('kpi_id')
                .in('kpi_id', kpiIds);
            
            if (evidenceError) {
                console.log('[Dashboard] Evidence links query error (may be RLS):', evidenceError.message);
            } else {
                // Count evidence per KPI
                (evidenceLinks || []).forEach((link: any) => {
                    evidenceCounts[link.kpi_id] = (evidenceCounts[link.kpi_id] || 0) + 1;
                });
            }
        }

        // Process KPIs with computed values AND include updates for charts
        const processedKpis = (kpis || []).map(kpi => {
            const updates = kpi.kpi_updates || [];
            const totalValue = updates.reduce((sum: number, u: any) => sum + (parseFloat(u.value) || 0), 0);
            const updateCount = updates.length;
            const evidenceCount = evidenceCounts[kpi.id] || 0;
            // Simple coverage: if there's evidence linked, estimate coverage based on evidence vs updates
            const evidencePercentage = updateCount > 0 && evidenceCount > 0 
                ? Math.min(100, Math.round((evidenceCount / updateCount) * 100))
                : 0;

            return {
                id: kpi.id,
                title: kpi.title,
                description: kpi.description,
                metric_type: kpi.metric_type,
                unit_of_measurement: kpi.unit_of_measurement,
                category: kpi.category,
                display_order: kpi.display_order,
                total_value: totalValue,
                update_count: updateCount,
                evidence_count: evidenceCount,
                evidence_percentage: evidencePercentage,
                // Include updates array for charts
                updates: updates.map((u: any) => ({
                    id: u.id,
                    value: parseFloat(u.value) || 0,
                    date_represented: u.date_represented,
                    date_range_start: u.date_range_start,
                    date_range_end: u.date_range_end,
                    location_id: u.location_id,
                    note: u.note
                }))
            };
        });
        
        console.log('[Dashboard] Processed KPIs:', processedKpis.length);

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
            kpis: processedKpis,
            locations: locations || [],
            stats: {
                kpis: processedKpis.length,
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
                id, title, description, type, file_url, date_represented, date_range_start, date_range_end, created_at,
                evidence_files(id, file_url, file_name, file_type, display_order),
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
            files: e.evidence_files || [],
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

    // ============================================
    // METRIC DETAILS (for Metric Detail Page)
    // ============================================

    /**
     * Generate a URL-friendly slug from a metric title
     */
    static generateMetricSlug(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }

    /**
     * Get a single metric by its slug within an initiative
     */
    static async getMetricBySlug(orgSlug: string, initiativeSlug: string, metricSlug: string): Promise<any | null> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return null;

        // Get all KPIs for this initiative and find matching slug
        const { data: kpis, error: kpisError } = await supabase
            .from('kpis')
            .select(`
                id, title, description, metric_type, unit_of_measurement, category, display_order,
                kpi_updates(id, value, date_represented, date_range_start, date_range_end, location_id, note, locations(id, name))
            `)
            .eq('initiative_id', initiative.id)
            .order('display_order');

        if (kpisError) {
            console.error('[getMetricBySlug] Error:', kpisError);
            return null;
        }

        // Find the KPI that matches the slug
        const kpi = (kpis || []).find(k => this.generateMetricSlug(k.title) === metricSlug);
        if (!kpi) return null;

        // Get evidence linked to this KPI
        const { data: evidenceLinks } = await supabase
            .from('evidence_kpis')
            .select('evidence_id')
            .eq('kpi_id', kpi.id);

        const evidenceIds = (evidenceLinks || []).map((e: any) => e.evidence_id);

        let evidence: any[] = [];
        if (evidenceIds.length > 0) {
            const { data: evidenceData } = await supabase
                .from('evidence')
                .select(`
                    id, title, description, type, file_url, date_represented, date_range_start, date_range_end, created_at,
                    evidence_files(id, file_url, file_name, file_type, display_order)
                `)
                .in('id', evidenceIds)
                .order('date_represented', { ascending: false });

            evidence = (evidenceData || []).map((e: any) => ({
                id: e.id,
                title: e.title,
                description: e.description,
                type: e.type,
                file_url: e.file_url,
                files: e.evidence_files || [],
                date_represented: e.date_represented,
                date_range_start: e.date_range_start,
                date_range_end: e.date_range_end,
                created_at: e.created_at
            }));
        }

        const updates = kpi.kpi_updates || [];
        const totalValue = updates.reduce((sum: number, u: any) => sum + (parseFloat(u.value) || 0), 0);

        return {
            id: kpi.id,
            title: kpi.title,
            slug: this.generateMetricSlug(kpi.title),
            description: kpi.description,
            metric_type: kpi.metric_type,
            unit_of_measurement: kpi.unit_of_measurement,
            category: kpi.category,
            display_order: kpi.display_order,
            total_value: totalValue,
            update_count: updates.length,
            updates: updates.map((u: any) => ({
                id: u.id,
                value: u.value,
                date_represented: u.date_represented,
                date_range_start: u.date_range_start,
                date_range_end: u.date_range_end,
                note: u.note,
                location: u.locations
            })),
            evidence,
            evidence_count: evidence.length,
            initiative: {
                id: initiative.id,
                title: initiative.title,
                slug: initiative.slug,
                org_slug: initiative.org_slug,
                org_name: initiative.organization_name,
                brand_color: initiative.organization_brand_color
            }
        };
    }

    /**
     * Get a single story by ID
     */
    static async getStoryById(orgSlug: string, initiativeSlug: string, storyId: string): Promise<any | null> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return null;

        // Fetch story with location
        const { data: story, error } = await supabase
            .from('stories')
            .select(`
                id, title, description, media_url, media_type, date_represented, created_at,
                locations(id, name, description, latitude, longitude)
            `)
            .eq('id', storyId)
            .eq('initiative_id', initiative.id)
            .single();

        if (error || !story) {
            console.error('[getStoryById] Error:', error);
            return null;
        }

        // Fetch beneficiary groups separately to avoid GROUP BY issue
        const { data: storyBeneficiaries } = await supabase
            .from('story_beneficiaries')
            .select('beneficiary_group_id')
            .eq('story_id', storyId);

        let beneficiaryGroups: any[] = [];
        if (storyBeneficiaries && storyBeneficiaries.length > 0) {
            const groupIds = storyBeneficiaries.map((sb: any) => sb.beneficiary_group_id);
            const { data: groups } = await supabase
                .from('beneficiary_groups')
                .select('id, name, description, total_number')
                .in('id', groupIds);
            beneficiaryGroups = groups || [];
        }

        return {
            id: story.id,
            title: story.title,
            description: story.description,
            media_url: story.media_url,
            media_type: story.media_type,
            date_represented: story.date_represented,
            created_at: story.created_at,
            location: story.locations,
            beneficiary_groups: beneficiaryGroups,
            initiative: {
                id: initiative.id,
                title: initiative.title,
                slug: initiative.slug,
                org_slug: initiative.org_slug,
                org_name: initiative.organization_name,
                brand_color: initiative.organization_brand_color
            }
        };
    }

    /**
     * Get a single evidence item by ID with linked KPIs
     */
    static async getEvidenceById(orgSlug: string, initiativeSlug: string, evidenceId: string): Promise<any | null> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return null;

        const { data: evidence, error } = await supabase
            .from('evidence')
            .select(`
                id, title, description, type, file_url, date_represented, date_range_start, date_range_end, created_at,
                evidence_files(id, file_url, file_name, file_type, display_order),
                evidence_kpis(kpi_id, kpis(id, title, description, unit_of_measurement, category))
            `)
            .eq('id', evidenceId)
            .eq('initiative_id', initiative.id)
            .single();

        if (error || !evidence) {
            console.error('[getEvidenceById] Error:', error);
            return null;
        }

        // Get the linked KPIs (impact claims)
        const linkedKpis = (evidence.evidence_kpis || [])
            .map((ek: any) => ek.kpis)
            .filter(Boolean)
            .map((kpi: any) => ({
                id: kpi.id,
                title: kpi.title,
                description: kpi.description,
                unit_of_measurement: kpi.unit_of_measurement,
                category: kpi.category
            }));

        return {
            id: evidence.id,
            title: evidence.title,
            description: evidence.description,
            type: evidence.type,
            file_url: evidence.file_url,
            files: (evidence.evidence_files || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)),
            date_represented: evidence.date_represented,
            date_range_start: evidence.date_range_start,
            date_range_end: evidence.date_range_end,
            created_at: evidence.created_at,
            linked_kpis: linkedKpis,
            initiative: {
                id: initiative.id,
                title: initiative.title,
                slug: initiative.slug,
                org_slug: initiative.org_slug,
                org_name: initiative.organization_name,
                brand_color: initiative.organization_brand_color
            }
        };
    }
}
