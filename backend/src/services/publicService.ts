import { supabase } from '../utils/supabase';
import { Organization, Initiative, KPI, Evidence, Story, Location, BeneficiaryGroup } from '../types';
import { BeneficiaryService } from './beneficiaryService';
import { MetricTagService } from './metricTagService';
import { aggregateKpiUpdates } from '../utils/kpiAggregation';

// Types for public responses (stripped of sensitive fields)
export interface PublicOrganization {
    id: string;
    name: string;
    slug: string;
    description?: string;
    logo_url?: string;
    created_at?: string;
    is_demo?: boolean; // Frontend uses this to render a DEMO banner on shared demo pages
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

    /**
     * Filter impact_claims on evidence by beneficiary group compatibility.
     * Mirrors the private-side logic in EvidenceService.getDataPointsForEvidence.
     */
    private static async filterClaimsByBenGroups(
        evidenceItems: any[]
    ): Promise<any[]> {
        if (evidenceItems.length === 0) return evidenceItems;

        const evidenceIds = evidenceItems.map(e => e.id);
        const allClaimIds = evidenceItems.flatMap(e =>
            (e.impact_claims || []).map((c: any) => c.id).filter(Boolean)
        );

        if (allClaimIds.length === 0) return evidenceItems;

        const [evidenceBenGroups, updateBenGroups] = await Promise.all([
            BeneficiaryService.getBenGroupsForEvidence(evidenceIds),
            BeneficiaryService.getBenGroupsForUpdates(allClaimIds)
        ]);

        return evidenceItems.map(e => {
            const evGroupIds = evidenceBenGroups[e.id] || [];
            const claims: any[] = e.impact_claims || [];

            const anyScoped = evGroupIds.length > 0 ||
                claims.some((c: any) => (updateBenGroups[c.id] || []).length > 0);
            if (!anyScoped) return e;

            return {
                ...e,
                impact_claims: claims.filter((c: any) => {
                    const claimGroupIds = updateBenGroups[c.id] || [];
                    return BeneficiaryService.beneficiaryGroupsMatch(claimGroupIds, evGroupIds);
                })
            };
        });
    }

    // ============================================
    // SEARCH
    // ============================================

    static async search(query: string): Promise<SearchResult> {
        const searchTerm = query.trim().toLowerCase();
        if (!searchTerm) {
            return { organizations: [], initiatives: [], locationMatches: [] };
        }

        // Search organizations (exclude demo / sandbox orgs from listing)
        const { data: orgs } = await supabase
            .from('organizations')
            .select('id, name, slug, description, logo_url, created_at')
            .eq('is_public', true)
            .eq('is_demo', false)
            .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
            .order('name')
            .limit(20);

        // Search initiatives (with org info including logo)
        // If org is public, all its initiatives are visible
        const { data: inits } = await supabase
            .from('initiatives')
            .select(`
                id, title, description, region, location, slug, coordinates, created_at, organization_id,
                organizations!inner(id, name, slug, logo_url, is_public, is_demo)
            `)
            .eq('organizations.is_public', true)
            .eq('organizations.is_demo', false)
            .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,region.ilike.%${searchTerm}%`)
            .order('title')
            .limit(20);

        // Search locations (returns initiatives that have matching locations).
        // Locations are org-global now; we join through initiative_locations to
        // surface the initiatives each matching location is linked to.
        const { data: locs } = await supabase
            .from('locations')
            .select(`
                id, name, description, latitude, longitude,
                initiative_locations(
                    initiatives(
                        id, title, description, region, slug, is_public, organization_id,
                        organizations!inner(id, name, slug, logo_url, is_public, is_demo)
                    )
                )
            `)
            .ilike('name', `%${searchTerm}%`)
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

        // A location can now be linked to multiple initiatives. Flatten so each
        // (location, initiative) pair shows once, only for public non-demo orgs.
        const locationMatches: any[] = [];
        for (const l of (locs || [])) {
            const links: any[] = (l as any).initiative_locations || [];
            for (const link of links) {
                const i = link?.initiatives;
                const o = i?.organizations;
                if (!i || !o || !o.is_public || o.is_demo) continue;
                locationMatches.push({
                    location: {
                        id: l.id,
                        name: l.name,
                        description: l.description,
                        latitude: l.latitude,
                        longitude: l.longitude,
                        initiative_id: i.id,
                    },
                    initiative: {
                        id: i.id,
                        title: i.title,
                        description: i.description,
                        region: i.region,
                        slug: i.slug,
                        organization_id: i.organization_id,
                        org_slug: o.slug,
                        organization_logo_url: o.logo_url,
                    },
                    organization: {
                        id: o.id,
                        name: o.name,
                        slug: o.slug,
                        logo_url: o.logo_url,
                    },
                });
            }
        }

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
        // Exclude demo / sandbox orgs from the /explore listing — they are
        // reachable only by direct share link.
        const { data, error } = await supabase
            .from('organizations')
            .select('id, name, slug, description, logo_url, brand_color, created_at')
            .eq('is_public', true)
            .eq('is_demo', false)
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
            .select('id, name, slug, description, statement, logo_url, brand_color, created_at, is_demo')
            .eq('slug', slug)
            .eq('is_public', true)
            .single();

        if (error || !org) return null;

        // Get stats - if org is public, all its initiatives count
        const { data: initiatives } = await supabase
            .from('initiatives')
            .select('id')
            .eq('organization_id', org.id);

        const initiativeIds = (initiatives || []).map(i => i.id);
        let locationCount = 0;
        let storyCount = 0;
        let kpiCount = 0;

        if (initiativeIds.length > 0) {
            // Locations are org-global now; count by organization_id directly.
            const { count: locCount } = await supabase
                .from('locations')
                .select('id', { count: 'exact', head: true })
                .eq('organization_id', org.id);
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
        // If org is public, all its initiatives are visible
        const { data, error } = await supabase
            .from('initiatives')
            .select(`
                id, title, description, region, location, slug, coordinates, created_at, organization_id,
                organizations!inner(slug, name, logo_url, is_public)
            `)
            .eq('organizations.slug', orgSlug)
            .eq('organizations.is_public', true)
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
        // Get all KPIs from all initiatives in this public org, including updates for totals
        const { data, error } = await supabase
            .from('kpis')
            .select(`
                id, title, description, metric_type, unit_of_measurement, category, display_order, initiative_id,
                initiatives!inner(id, slug, title, organization_id,
                    organizations!inner(slug, is_public)
                ),
                kpi_updates(id, value, date_represented)
            `)
            .eq('initiatives.organizations.slug', orgSlug)
            .eq('initiatives.organizations.is_public', true)
            .order('display_order');

        if (error) throw new Error(`Failed to fetch metrics: ${error.message}`);

        const rows = data || [];
        const kpiIds = rows.map((k: any) => k.id);
        const allUpdateIds = rows.flatMap((k: any) => (k.kpi_updates || []).map((u: any) => u.id));

        // Batch-hydrate tag ids for KPIs and their updates so the public
        // payload mirrors the private one without N+1 queries.
        const [tagsByKpi, tagByUpdate] = await Promise.all([
            MetricTagService.getTagIdsForKpis(kpiIds),
            MetricTagService.getTagIdsForUpdates(allUpdateIds),
        ]);

        return rows.map((k: any) => {
            const updates = k.kpi_updates || [];
            const totalValue = updates.length > 0
                ? aggregateKpiUpdates(updates, k.metric_type)
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
                update_count: updates.length,
                tag_ids: tagsByKpi[k.id] || [],
                updates: updates.map((u: any) => ({
                    id: u.id,
                    value: u.value,
                    date_represented: u.date_represented,
                    tag_id: tagByUpdate[u.id] || null,
                }))
            };
        });
    }

    static async getOrganizationStories(orgSlug: string, limit?: number): Promise<any[]> {
        let query = supabase
            .from('stories')
            .select(`
                id, title, description, media_url, media_type, date_represented, location_id, initiative_id,
                story_locations(location_id, locations(id, name)),
                initiatives!inner(id, slug, title, organization_id,
                    organizations!inner(slug, is_public)
                )
            `)
            .eq('initiatives.organizations.slug', orgSlug)
            .eq('initiatives.organizations.is_public', true)
            .order('date_represented', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) throw new Error(`Failed to fetch stories: ${error.message}`);

        const rows = data || [];
        const tagsByStory = await MetricTagService.getTagIdsForStories(rows.map((s: any) => s.id));

        return rows.map((s: any) => {
            const locations = (s.story_locations || []).map((sl: any) => sl.locations).filter(Boolean);
            return {
                id: s.id,
                title: s.title,
                description: s.description,
                media_url: s.media_url,
                media_type: s.media_type,
                date_represented: s.date_represented,
                location_ids: locations.map((l: any) => l.id),
                locations,
                location_name: locations[0]?.name,
                initiative_id: s.initiative_id,
                initiative_slug: s.initiatives?.slug,
                initiative_title: s.initiatives?.title,
                org_slug: s.initiatives?.organizations?.slug,
                tag_ids: tagsByStory[s.id] || [],
            };
        });
    }

    static async getOrganizationLocations(orgSlug: string): Promise<any[]> {
        // Resolve org by slug (must be public)
        const { data: org } = await supabase
            .from('organizations')
            .select('id, slug, is_public')
            .eq('slug', orgSlug)
            .eq('is_public', true)
            .single();
        if (!org) return [];

        const { data, error } = await supabase
            .from('locations')
            .select(`
                id, name, description, latitude, longitude, country, display_order, initiative_id,
                initiative_locations(
                    initiatives(id, slug, title)
                )
            `)
            .eq('organization_id', org.id)
            .order('display_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw new Error(`Failed to fetch locations: ${error.message}`);

        return (data || []).map((l: any) => {
            const links: any[] = l.initiative_locations || [];
            const initiatives = links.map(link => link?.initiatives).filter(Boolean);
            const initiativeIds = initiatives.map((i: any) => i.id);
            // Keep legacy fields populated with the first linked initiative for
            // older client code paths that still read singular initiative_id.
            const first = initiatives[0];
            return {
                id: l.id,
                name: l.name,
                description: l.description,
                latitude: l.latitude,
                longitude: l.longitude,
                country: l.country,
                display_order: l.display_order,
                initiative_id: first?.id || l.initiative_id || null,
                initiative_ids: initiativeIds,
                initiative_slug: first?.slug,
                initiative_title: first?.title,
                org_slug: org.slug,
            };
        });
    }

    static async getOrganizationEvidence(orgSlug: string, limit?: number): Promise<any[]> {
        let query = supabase
            .from('evidence')
            .select(`
                id, title, description, type, file_url, date_represented, initiative_id,
                initiatives!inner(id, slug, title, organization_id,
                    organizations!inner(slug, is_public)
                ),
                evidence_files(id, file_url, file_name, file_type, display_order)
            `)
            .eq('initiatives.organizations.slug', orgSlug)
            .eq('initiatives.organizations.is_public', true)
            .order('date_represented', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) throw new Error(`Failed to fetch evidence: ${error.message}`);

        const rows = data || [];
        const tagsByEv = await MetricTagService.getTagIdsForEvidences(rows.map((e: any) => e.id));

        return rows.map((e: any) => ({
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
            org_slug: e.initiatives?.organizations?.slug,
            tag_ids: tagsByEv[e.id] || [],
        }));
    }

    // ============================================
    // INITIATIVE-LEVEL (for Advanced View)
    // ============================================

    static async getInitiativeBySlug(orgSlug: string, initiativeSlug: string): Promise<PublicInitiative | null> {
        // If org is public, all its initiatives are visible
        const { data, error } = await supabase
            .from('initiatives')
            .select(`
                id, title, description, region, location, slug, coordinates, created_at, organization_id,
                organizations!inner(id, slug, name, logo_url, brand_color, is_public)
            `)
            .eq('slug', initiativeSlug)
            .eq('organizations.slug', orgSlug)
            .eq('organizations.is_public', true)
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

        // Batch-hydrate tag ids for KPIs and updates so chart bodies and
        // breakdown UI on the public side don't have to poll per-row.
        const allUpdateIds = (kpis || []).flatMap((k: any) => (k.kpi_updates || []).map((u: any) => u.id));
        const [tagsByKpi, tagByUpdate] = await Promise.all([
            MetricTagService.getTagIdsForKpis(kpiIds),
            MetricTagService.getTagIdsForUpdates(allUpdateIds),
        ]);

        // Process KPIs with computed values AND include updates for charts
        const processedKpis = (kpis || []).map(kpi => {
            const updates = kpi.kpi_updates || [];
            const totalValue = aggregateKpiUpdates(updates, kpi.metric_type);
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
                tag_ids: tagsByKpi[kpi.id] || [],
                // Include updates array for charts
                updates: updates.map((u: any) => ({
                    id: u.id,
                    value: parseFloat(u.value) || 0,
                    date_represented: u.date_represented,
                    date_range_start: u.date_range_start,
                    date_range_end: u.date_range_end,
                    location_id: u.location_id,
                    note: u.note,
                    tag_id: tagByUpdate[u.id] || null,
                }))
            };
        });

        console.log('[Dashboard] Processed KPIs:', processedKpis.length);

        // Get locations linked to this initiative via initiative_locations
        const { data: locLinks } = await supabase
            .from('initiative_locations')
            .select('location_id')
            .eq('initiative_id', initiative.id);
        const locIds = (locLinks || []).map((r: any) => r.location_id);
        let locations: any[] = [];
        if (locIds.length > 0) {
            const { data: locs } = await supabase
                .from('locations')
                .select('id, name, description, latitude, longitude, display_order')
                .in('id', locIds)
                .order('display_order');
            locations = locs || [];
        }

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
                id, title, description, media_url, media_type, date_represented, created_at,
                story_locations(location_id, locations(id, name, latitude, longitude)),
                story_beneficiaries(beneficiary_groups(id, name))
            `)
            .eq('initiative_id', initiative.id)
            .order('date_represented', { ascending: false });

        if (error) throw new Error(`Failed to fetch stories: ${error.message}`);

        const rows = data || [];
        const tagsByStory = await MetricTagService.getTagIdsForStories(rows.map((s: any) => s.id));

        return rows.map((s: any) => {
            const locations = (s.story_locations || []).map((sl: any) => sl.locations).filter(Boolean);
            return {
                id: s.id,
                title: s.title,
                description: s.description,
                media_url: s.media_url,
                media_type: s.media_type,
                date_represented: s.date_represented,
                location_ids: locations.map((l: any) => l.id),
                locations,
                location: locations[0] || undefined,
                beneficiary_groups: s.story_beneficiaries?.map((sb: any) => sb.beneficiary_groups).filter(Boolean) || [],
                created_at: s.created_at,
                tag_ids: tagsByStory[s.id] || [],
            };
        });
    }

    static async getInitiativeLocations(orgSlug: string, initiativeSlug: string): Promise<Location[]> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return [];

        const { data: links } = await supabase
            .from('initiative_locations')
            .select('location_id')
            .eq('initiative_id', initiative.id);
        const ids = (links || []).map((r: any) => r.location_id);
        if (ids.length === 0) return [];

        const { data, error } = await supabase
            .from('locations')
            .select('id, name, description, latitude, longitude, display_order, created_at, initiative_id')
            .in('id', ids)
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
                evidence_kpis(kpis(id, title, category, unit_of_measurement)),
                evidence_kpi_updates(kpi_updates(id, value, date_represented, date_range_start, date_range_end, kpi_id, kpis(id, title, unit_of_measurement)))
            `)
            .eq('initiative_id', initiative.id)
            .order('date_represented', { ascending: false });

        if (error) throw new Error(`Failed to fetch evidence: ${error.message}`);

        const rows = data || [];
        const evidenceIds = rows.map((e: any) => e.id);
        const allClaimIds = rows.flatMap((e: any) =>
            (e.evidence_kpi_updates || []).map((eu: any) => eu.kpi_updates?.id).filter(Boolean)
        );

        const [tagsByEv, tagByClaim] = await Promise.all([
            MetricTagService.getTagIdsForEvidences(evidenceIds),
            MetricTagService.getTagIdsForUpdates(allClaimIds),
        ]);

        const rawEvidence = rows.map((e: any) => ({
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
            impact_claims: (e.evidence_kpi_updates || [])
                .map((eu: any) => eu.kpi_updates)
                .filter(Boolean)
                .map((c: any) => ({ ...c, tag_id: tagByClaim[c.id] || null })),
            created_at: e.created_at,
            tag_ids: tagsByEv[e.id] || [],
        }));

        return this.filterClaimsByBenGroups(rawEvidence);
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

    static async getBeneficiaryGroupDetail(orgSlug: string, initiativeSlug: string, groupId: string): Promise<any | null> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return null;

        // Fetch the beneficiary group
        const { data: group, error: groupError } = await supabase
            .from('beneficiary_groups')
            .select(`
                id, name, description, location_id, age_range_start, age_range_end, total_number, display_order, created_at,
                locations(id, name, description, latitude, longitude)
            `)
            .eq('id', groupId)
            .eq('initiative_id', initiative.id)
            .single();

        if (groupError || !group) return null;

        // Fetch impact claims scoped to this group via kpi_update_beneficiary_groups
        const { data: claimLinks } = await supabase
            .from('kpi_update_beneficiary_groups')
            .select(`
                kpi_updates(
                    id, value, date_represented, date_range_start, date_range_end,
                    label, note, created_at, location_id,
                    kpis(id, title, unit_of_measurement, category),
                    locations(id, name, latitude, longitude)
                )
            `)
            .eq('beneficiary_group_id', groupId);

        const claims = (claimLinks || [])
            .map((cl: any) => cl.kpi_updates)
            .filter(Boolean)
            .filter((u: any) => u.kpis?.id); // only claims whose KPI belongs to this initiative check below

        // Fetch evidence scoped to this group via evidence_beneficiary_groups
        const { data: evidenceLinks } = await supabase
            .from('evidence_beneficiary_groups')
            .select('evidence_id')
            .eq('beneficiary_group_id', groupId);

        const evidenceIds = (evidenceLinks || []).map((el: any) => el.evidence_id);

        let evidence: any[] = [];
        if (evidenceIds.length > 0) {
            const { data: evidenceData } = await supabase
                .from('evidence')
                .select(`
                    id, title, description, type, file_url, date_represented, date_range_start, date_range_end, created_at,
                    evidence_files(id, file_url, file_name, file_type, display_order),
                    evidence_locations(locations(id, name, latitude, longitude))
                `)
                .eq('initiative_id', initiative.id)
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
                locations: e.evidence_locations?.map((el: any) => el.locations).filter(Boolean) || [],
                created_at: e.created_at
            }));
        }

        // Fetch stories scoped to this group via story_beneficiaries
        const { data: storyLinks } = await supabase
            .from('story_beneficiaries')
            .select('story_id')
            .eq('beneficiary_group_id', groupId);

        const storyIds = (storyLinks || []).map((sl: any) => sl.story_id);

        let stories: any[] = [];
        if (storyIds.length > 0) {
            const { data: storiesData } = await supabase
                .from('stories')
                .select(`
                    id, title, description, media_url, media_type, date_represented, created_at,
                    story_locations(locations(id, name))
                `)
                .eq('initiative_id', initiative.id)
                .in('id', storyIds)
                .order('date_represented', { ascending: false });

            stories = (storiesData || []).map((s: any) => ({
                id: s.id,
                title: s.title,
                description: s.description,
                media_url: s.media_url,
                media_type: s.media_type,
                date_represented: s.date_represented,
                locations: s.story_locations?.map((sl: any) => sl.locations).filter(Boolean) || [],
                created_at: s.created_at
            }));
        }

        // Derive locations from claims + evidence
        const locationMap = new Map<string, any>();
        claims.forEach((c: any) => {
            if (c.locations?.id) locationMap.set(c.locations.id, c.locations);
        });
        evidence.forEach((e: any) => {
            (e.locations || []).forEach((loc: any) => {
                if (loc?.id) locationMap.set(loc.id, loc);
            });
        });
        // Fallback to group's own location
        if (locationMap.size === 0 && (group as any).locations) {
            const loc = (group as any).locations;
            if (loc.id) locationMap.set(loc.id, loc);
        }

        // Hydrate tag ids on claims, evidence, and stories so the
        // beneficiary detail page can show + filter by tag without extra calls.
        const [tagByClaim, tagsByEv, tagsByStory] = await Promise.all([
            MetricTagService.getTagIdsForUpdates(claims.map((c: any) => c.id)),
            MetricTagService.getTagIdsForEvidences(evidence.map((e: any) => e.id)),
            MetricTagService.getTagIdsForStories(stories.map((s: any) => s.id)),
        ]);
        const evidenceWithTags = evidence.map((e: any) => ({ ...e, tag_ids: tagsByEv[e.id] || [] }));
        const storiesWithTags = stories.map((s: any) => ({ ...s, tag_ids: tagsByStory[s.id] || [] }));

        return {
            id: group.id,
            name: (group as any).name,
            description: (group as any).description,
            total_number: (group as any).total_number,
            age_range_start: (group as any).age_range_start,
            age_range_end: (group as any).age_range_end,
            location: (group as any).locations || null,
            claims: claims.map((c: any) => ({
                id: c.id,
                value: c.value,
                date_represented: c.date_represented,
                date_range_start: c.date_range_start,
                date_range_end: c.date_range_end,
                label: c.label,
                note: c.note,
                tag_id: tagByClaim[c.id] || null,
                kpi: c.kpis ? { id: c.kpis.id, title: c.kpis.title, unit_of_measurement: c.kpis.unit_of_measurement, category: c.kpis.category } : null
            })),
            evidence: evidenceWithTags,
            stories: storiesWithTags,
            locations: Array.from(locationMap.values()),
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

        const rows = data || [];
        const kpiIds = rows.map((k: any) => k.id);
        const allUpdateIds = rows.flatMap((k: any) => (k.kpi_updates || []).map((u: any) => u.id));
        const [tagsByKpi, tagByUpdate] = await Promise.all([
            MetricTagService.getTagIdsForKpis(kpiIds),
            MetricTagService.getTagIdsForUpdates(allUpdateIds),
        ]);

        // Calculate totals and format
        return rows.map((k: any) => {
            const updates = k.kpi_updates || [];
            const totalValue = aggregateKpiUpdates(updates, k.metric_type);

            return {
                id: k.id,
                title: k.title,
                description: k.description,
                metric_type: k.metric_type,
                unit_of_measurement: k.unit_of_measurement,
                category: k.category,
                display_order: k.display_order,
                tag_ids: tagsByKpi[k.id] || [],
                updates: updates.map((u: any) => ({
                    ...u,
                    location: u.locations,
                    tag_id: tagByUpdate[u.id] || null,
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
                kpi_updates(id, value, date_represented, date_range_start, date_range_end, location_id, note, locations(id, name), kpi_update_beneficiary_groups(beneficiary_groups(id, name)))
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
                    evidence_files(id, file_url, file_name, file_type, display_order),
                    evidence_locations(locations(id, name)),
                    evidence_beneficiary_groups(beneficiary_groups(id, name)),
                    evidence_kpis(kpis(id, title, category, unit_of_measurement)),
                evidence_kpi_updates(kpi_updates(id, value, date_represented, date_range_start, date_range_end, kpi_id, kpis(id, title, unit_of_measurement)))
                `)
                .in('id', evidenceIds)
                .order('date_represented', { ascending: false });

            const evIds = (evidenceData || []).map((e: any) => e.id);
            const allClaimIds = (evidenceData || []).flatMap((e: any) =>
                (e.evidence_kpi_updates || []).map((eu: any) => eu.kpi_updates?.id).filter(Boolean)
            );
            const [tagsByEv, tagByEvClaim] = await Promise.all([
                MetricTagService.getTagIdsForEvidences(evIds),
                MetricTagService.getTagIdsForUpdates(allClaimIds),
            ]);

            const rawEvidence = (evidenceData || []).map((e: any) => ({
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
                beneficiary_groups: (e.evidence_beneficiary_groups || [])
                    .map((b: any) => b.beneficiary_groups)
                    .filter(Boolean),
                kpis: e.evidence_kpis?.map((ek: any) => ek.kpis).filter(Boolean) || [],
                impact_claims: (e.evidence_kpi_updates || [])
                    .map((eu: any) => eu.kpi_updates)
                    .filter(Boolean)
                    .map((c: any) => ({ ...c, tag_id: tagByEvClaim[c.id] || null })),
                created_at: e.created_at,
                tag_ids: tagsByEv[e.id] || [],
            }));
            evidence = await this.filterClaimsByBenGroups(rawEvidence);
        }

        const updates = kpi.kpi_updates || [];
        const totalValue = aggregateKpiUpdates(updates, kpi.metric_type);

        // Tags for the metric itself + per-claim tag ids.
        const [kpiTagIds, tagByUpdate] = await Promise.all([
            MetricTagService.getTagIdsForKpi(kpi.id),
            MetricTagService.getTagIdsForUpdates(updates.map((u: any) => u.id)),
        ]);

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
            tag_ids: kpiTagIds,
            updates: updates.map((u: any) => ({
                id: u.id,
                value: u.value,
                date_represented: u.date_represented,
                date_range_start: u.date_range_start,
                date_range_end: u.date_range_end,
                note: u.note,
                location: u.locations,
                location_id: u.location_id,
                beneficiary_groups: (u.kpi_update_beneficiary_groups || [])
                    .map((b: any) => b.beneficiary_groups)
                    .filter(Boolean),
                tag_id: tagByUpdate[u.id] || null,
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
     * Get a single impact claim (kpi_update) by ID
     */
    static async getImpactClaimById(orgSlug: string, initiativeSlug: string, claimId: string): Promise<any | null> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return null;

        // Fetch the kpi_update with its parent KPI and location
        const { data: update, error } = await supabase
            .from('kpi_updates')
            .select(`
                id, value, date_represented, date_range_start, date_range_end, note, label, location_id,
                locations(id, name, description, latitude, longitude),
                kpis!inner(id, title, description, unit_of_measurement, category, initiative_id)
            `)
            .eq('id', claimId)
            .single();

        if (error || !update) {
            console.error('[getImpactClaimById] Error:', error);
            return null;
        }

        // Verify this update belongs to the correct initiative
        const kpi = (update as any).kpis;
        if (!kpi || kpi.initiative_id !== initiative.id) return null;

        // Get evidence linked to this specific update via evidence_kpi_updates
        const { data: evidenceLinks } = await supabase
            .from('evidence_kpi_updates')
            .select('evidence_id')
            .eq('kpi_update_id', claimId);

        const evidenceIds = (evidenceLinks || []).map((e: any) => e.evidence_id);

        let evidence: any[] = [];
        if (evidenceIds.length > 0) {
            const { data: evidenceData } = await supabase
                .from('evidence')
                .select(`
                    id, title, description, type, file_url, date_represented, date_range_start, date_range_end, created_at,
                    evidence_files(id, file_url, file_name, file_type, display_order),
                    evidence_locations(locations(id, name)),
                    evidence_kpis(kpis(id, title, category, unit_of_measurement)),
                evidence_kpi_updates(kpi_updates(id, value, date_represented, date_range_start, date_range_end, kpi_id, kpis(id, title, unit_of_measurement)))
                `)
                .in('id', evidenceIds)
                .order('date_represented', { ascending: false });

            const evIds = (evidenceData || []).map((e: any) => e.id);
            const allClaimIds = (evidenceData || []).flatMap((e: any) =>
                (e.evidence_kpi_updates || []).map((eu: any) => eu.kpi_updates?.id).filter(Boolean)
            );
            const [tagsByEv, tagByEvClaim] = await Promise.all([
                MetricTagService.getTagIdsForEvidences(evIds),
                MetricTagService.getTagIdsForUpdates(allClaimIds),
            ]);

            const rawEvidence = (evidenceData || []).map((e: any) => ({
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
                impact_claims: (e.evidence_kpi_updates || [])
                    .map((eu: any) => eu.kpi_updates)
                    .filter(Boolean)
                    .map((c: any) => ({ ...c, tag_id: tagByEvClaim[c.id] || null })),
                created_at: e.created_at,
                tag_ids: tagsByEv[e.id] || [],
            }));

            // Filter: only keep evidence whose ben groups are compatible with this claim
            const claimBenGroups = await BeneficiaryService.getBenGroupsForUpdates([claimId]);
            const claimGroupIds = claimBenGroups[claimId] || [];
            const evidenceBenGroups = await BeneficiaryService.getBenGroupsForEvidence(rawEvidence.map(e => e.id));

            const anyScoped = claimGroupIds.length > 0 ||
                Object.values(evidenceBenGroups).some(ids => ids.length > 0);

            if (anyScoped) {
                evidence = rawEvidence.filter(e => {
                    const evGroupIds = evidenceBenGroups[e.id] || [];
                    return BeneficiaryService.beneficiaryGroupsMatch(claimGroupIds, evGroupIds);
                });
            } else {
                evidence = rawEvidence;
            }

            // Also filter impact_claims within each evidence item
            evidence = await this.filterClaimsByBenGroups(evidence);
        }

        // Tags for this claim + parent metric.
        const [claimTagId, kpiTagIds] = await Promise.all([
            MetricTagService.getTagIdForUpdate(claimId),
            MetricTagService.getTagIdsForKpi(kpi.id),
        ]);

        return {
            id: update.id,
            value: (update as any).value,
            date_represented: (update as any).date_represented,
            date_range_start: (update as any).date_range_start,
            date_range_end: (update as any).date_range_end,
            note: (update as any).note,
            label: (update as any).label,
            location: (update as any).locations || null,
            tag_id: claimTagId,
            metric: {
                id: kpi.id,
                title: kpi.title,
                description: kpi.description,
                unit_of_measurement: kpi.unit_of_measurement,
                category: kpi.category,
                slug: this.generateMetricSlug(kpi.title),
                tag_ids: kpiTagIds,
            },
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

        const { data: story, error } = await supabase
            .from('stories')
            .select(`
                id, title, description, media_url, media_type, date_represented, created_at,
                story_locations(location_id, locations(id, name, description, latitude, longitude))
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

        const storyLocations = (story.story_locations || []).map((sl: any) => sl.locations).filter(Boolean);
        const storyTagIds = await MetricTagService.getTagIdsForStory(storyId);

        return {
            id: story.id,
            title: story.title,
            description: story.description,
            media_url: story.media_url,
            media_type: story.media_type,
            date_represented: story.date_represented,
            created_at: story.created_at,
            locations: storyLocations,
            location: storyLocations[0] || undefined,
            beneficiary_groups: beneficiaryGroups,
            tag_ids: storyTagIds,
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
                evidence_kpis(kpi_id, kpis(id, title, description, unit_of_measurement, category)),
                evidence_kpi_updates(kpi_updates(id, value, date_represented, date_range_start, date_range_end, kpi_id, kpis(id, title, unit_of_measurement)))
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

        const linkedClaims = (evidence.evidence_kpi_updates || [])
            .map((eu: any) => eu.kpi_updates)
            .filter(Boolean);

        const [evTagIds, tagByEvClaim] = await Promise.all([
            MetricTagService.getTagIdsForEvidence(evidenceId),
            MetricTagService.getTagIdsForUpdates(linkedClaims.map((c: any) => c.id)),
        ]);

        const rawResult = {
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
            tag_ids: evTagIds,
            linked_kpis: linkedKpis,
            impact_claims: linkedClaims.map((c: any) => ({ ...c, tag_id: tagByEvClaim[c.id] || null })),
            initiative: {
                id: initiative.id,
                title: initiative.title,
                slug: initiative.slug,
                org_slug: initiative.org_slug,
                org_name: initiative.organization_name,
                brand_color: initiative.organization_brand_color
            }
        };

        const [filtered] = await this.filterClaimsByBenGroups([rawResult]);
        return filtered;
    }

    /**
     * Get everything linked to a specific location within an initiative
     */
    static async getLocationDetail(orgSlug: string, initiativeSlug: string, locationId: string): Promise<any | null> {
        const initiative = await this.getInitiativeBySlug(orgSlug, initiativeSlug);
        if (!initiative) return null;

        // Fetch the location, ensuring it's actually linked to this initiative
        // (initiative_locations is the source of truth post-migration).
        const { data: link } = await supabase
            .from('initiative_locations')
            .select('location_id')
            .eq('initiative_id', initiative.id)
            .eq('location_id', locationId)
            .single();
        if (!link) return null;

        const { data: location, error: locError } = await supabase
            .from('locations')
            .select('id, name, description, latitude, longitude')
            .eq('id', locationId)
            .single();

        if (locError || !location) return null;

        // Stories at this location via story_locations junction table
        const { data: storyLinks } = await supabase
            .from('story_locations')
            .select('story_id')
            .eq('location_id', locationId);

        const storyIds = (storyLinks || []).map((sl: any) => sl.story_id);

        let stories: any[] = [];
        if (storyIds.length > 0) {
            const { data: storiesData } = await supabase
                .from('stories')
                .select('id, title, description, media_url, media_type, date_represented, created_at')
                .eq('initiative_id', initiative.id)
                .in('id', storyIds)
                .order('date_represented', { ascending: false });
            stories = storiesData || [];
        }

        // Evidence at this location via evidence_locations
        const { data: evidenceLinks } = await supabase
            .from('evidence_locations')
            .select('evidence_id')
            .eq('location_id', locationId);

        const evidenceIds = (evidenceLinks || []).map((el: any) => el.evidence_id);

        let evidence: any[] = [];
        if (evidenceIds.length > 0) {
            const { data: evidenceData } = await supabase
                .from('evidence')
                .select(`
                    id, title, description, type, file_url, date_represented, created_at,
                    evidence_files(id, file_url, file_name, file_type, display_order),
                    evidence_kpis(kpis(id, title, category, unit_of_measurement)),
                evidence_kpi_updates(kpi_updates(id, value, date_represented, date_range_start, date_range_end, kpi_id, kpis(id, title, unit_of_measurement)))
                `)
                .eq('initiative_id', initiative.id)
                .in('id', evidenceIds)
                .order('date_represented', { ascending: false });

            const evIds = (evidenceData || []).map((e: any) => e.id);
            const allEvClaimIds = (evidenceData || []).flatMap((e: any) =>
                (e.evidence_kpi_updates || []).map((eu: any) => eu.kpi_updates?.id).filter(Boolean)
            );
            const [tagsByEv, tagByEvClaim] = await Promise.all([
                MetricTagService.getTagIdsForEvidences(evIds),
                MetricTagService.getTagIdsForUpdates(allEvClaimIds),
            ]);

            const rawEvidence = (evidenceData || []).map((e: any) => ({
                id: e.id,
                title: e.title,
                description: e.description,
                type: e.type,
                file_url: e.file_url,
                files: e.evidence_files || [],
                date_represented: e.date_represented,
                kpis: e.evidence_kpis?.map((ek: any) => ek.kpis).filter(Boolean) || [],
                impact_claims: (e.evidence_kpi_updates || [])
                    .map((eu: any) => eu.kpi_updates)
                    .filter(Boolean)
                    .map((c: any) => ({ ...c, tag_id: tagByEvClaim[c.id] || null })),
                created_at: e.created_at,
                tag_ids: tagsByEv[e.id] || [],
            }));
            evidence = await this.filterClaimsByBenGroups(rawEvidence);
        }

        // KPI updates (impact claims) at this location
        const { data: kpiUpdates } = await supabase
            .from('kpi_updates')
            .select(`
                id, value, date_represented, date_range_start, date_range_end, note, label,
                kpis!inner(id, title, description, metric_type, unit_of_measurement, category, initiative_id)
            `)
            .eq('location_id', locationId);

        // Filter to only this initiative's KPIs and hydrate tag ids on each claim
        const claimsRaw = (kpiUpdates || []).filter((u: any) => u.kpis?.initiative_id === initiative.id);
        const tagByClaim = await MetricTagService.getTagIdsForUpdates(claimsRaw.map((u: any) => u.id));
        const claims = claimsRaw.map((u: any) => ({
            id: u.id,
            value: u.value,
            date_represented: u.date_represented,
            date_range_start: u.date_range_start,
            date_range_end: u.date_range_end,
            note: u.note,
            label: u.label,
            tag_id: tagByClaim[u.id] || null,
            metric_title: u.kpis.title,
            metric_slug: this.generateMetricSlug(u.kpis.title),
            metric_unit: u.kpis.unit_of_measurement,
            metric_category: u.kpis.category
        }));

        // Tag ids for stories at this location.
        const storyTags = await MetricTagService.getTagIdsForStories((stories || []).map((s: any) => s.id));
        const storiesWithTags = (stories || []).map((s: any) => ({ ...s, tag_ids: storyTags[s.id] || [] }));

        // Unique metrics that have claims at this location.
        // Group updates per kpi first so we can apply the right aggregation strategy.
        const metricUpdates = new Map<string, { kpi: any; updates: any[] }>();
        (kpiUpdates || [])
            .filter((u: any) => u.kpis?.initiative_id === initiative.id)
            .forEach((u: any) => {
                const id = u.kpis.id;
                if (!metricUpdates.has(id)) metricUpdates.set(id, { kpi: u.kpis, updates: [] });
                metricUpdates.get(id)!.updates.push(u);
            });
        const metricsMap = new Map<string, any>();
        metricUpdates.forEach(({ kpi, updates }, id) => {
            metricsMap.set(id, {
                id,
                title: kpi.title,
                slug: this.generateMetricSlug(kpi.title),
                unit_of_measurement: kpi.unit_of_measurement,
                category: kpi.category,
                metric_type: kpi.metric_type,
                total_value: aggregateKpiUpdates(updates, kpi.metric_type),
                claim_count: updates.length
            });
        });

        return {
            location,
            stories: storiesWithTags,
            evidence,
            claims,
            metrics: Array.from(metricsMap.values()),
            initiative: {
                id: initiative.id,
                title: initiative.title,
                slug: initiative.slug,
                org_slug: initiative.org_slug
            }
        };
    }

    // ============================================
    // METRIC TAGS (public read-only)
    // ============================================

    /**
     * Org-global tag list for a public org. Returns id/name/color/display_order
     * sorted by the same org-wide order users set on the private side.
     * No public/private gating on individual tags in v1 — all org tags are
     * visible whenever the org itself is public.
     */
    static async getOrganizationTags(orgSlug: string): Promise<any[]> {
        const { data: org } = await supabase
            .from('organizations')
            .select('id, slug, is_public')
            .eq('slug', orgSlug)
            .eq('is_public', true)
            .single();
        if (!org) return [];

        const { data, error } = await supabase
            .from('metric_tags')
            .select('id, name, color, display_order')
            .eq('organization_id', org.id)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) throw new Error(`Failed to fetch metric tags: ${error.message}`);
        return data || [];
    }
}
