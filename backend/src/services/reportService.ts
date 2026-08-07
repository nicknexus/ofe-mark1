import { supabase } from '../utils/supabase';
import { InitiativeService } from './initiativeService';
import { aggregateKpiUpdates } from '../utils/kpiAggregation';
import { MetricTagService } from './metricTagService';
import { OrgAccessService } from './orgAccessService';

export interface ReportDataFilters {
    initiativeId: string;
    userId: string;
    requestedOrgId?: string;
    dateStart?: string;
    dateEnd?: string;
    kpiIds?: string[];
    locationIds?: string[];
    beneficiaryGroupIds?: string[];
    tagIds?: string[];
    donorId?: string;
}

export interface ReportDataResponse {
    metrics: Array<{
        id: string;
        kpi_id: string;
        kpi_title: string;
        kpi_description: string;
        value: number;
        unit_of_measurement: string;
        date_represented: string;
        location_id?: string;
        location_name?: string;
    }>;
    totals: Array<{
        kpi_id: string;
        kpi_title: string;
        kpi_description: string;
        unit_of_measurement: string;
        metric_type: 'number' | 'percentage' | string;
        total_value: number;
        count: number;
        tag_ids: string[];
    }>;
    // Org metric tags referenced by the report's KPIs (lookup for chips + grouping).
    tags: Array<{
        id: string;
        name: string;
        color?: string | null;
    }>;
    locations: Array<{
        id: string;
        name: string;
        description?: string;
        latitude: number;
        longitude: number;
    }>;
    // Beneficiary groups covered by the report. Previously these could only be
    // filtered on; the one-page report needs to name them too.
    beneficiaryGroups: Array<{
        id: string;
        name: string;
        description?: string;
        total_number?: number | null;
    }>;
    // Organization branding for the report header/footer.
    branding: {
        organization_name: string;
        logo_url?: string | null;
        brand_color?: string | null;
    };
    stories: Array<{
        id: string;
        title: string;
        description?: string;
        date_represented: string;
        location_id?: string;
        location_name?: string;
        media_url?: string;
        media_type?: 'photo' | 'video' | 'recording';
    }>;
    mapPoints: Array<{
        lat: number;
        lng: number;
        name: string;
        type: 'location' | 'story';
    }>;
}

export class ReportService {
    static async getReportData(filters: ReportDataFilters): Promise<ReportDataResponse> {
        const { initiativeId, userId, requestedOrgId, dateStart, dateEnd, kpiIds, locationIds, beneficiaryGroupIds, tagIds, donorId } = filters;

        // Authorize via initiative org context (org-scoped, not user-scoped).
        const initiative = await InitiativeService.getById(initiativeId, userId, requestedOrgId);
        if (!initiative) {
            throw new Error('Initiative not found or access denied');
        }

        // Resolve the owning org so the report can carry its branding.
        const { organizationId } = await OrgAccessService.assertInitiativeAccess(
            initiativeId,
            userId,
            requestedOrgId
        );

        // Build query for metrics_with_context view
        let metricsQuery = supabase
            .from('metrics_with_context')
            .select('*')
            .eq('initiative_id', initiativeId);

        // Apply date filter
        if (dateStart) {
            metricsQuery = metricsQuery.gte('date_represented', dateStart);
        }
        if (dateEnd) {
            metricsQuery = metricsQuery.lte('date_represented', dateEnd);
        }

        // Apply KPI filter
        if (kpiIds && kpiIds.length > 0) {
            metricsQuery = metricsQuery.in('kpi_id', kpiIds);
        }

        // Apply location filter
        if (locationIds && locationIds.length > 0) {
            metricsQuery = metricsQuery.in('location_id', locationIds);
        }

        // Apply beneficiary group filter (via location)
        // Note: This filters metrics where the location has any of the selected beneficiary groups
        if (beneficiaryGroupIds && beneficiaryGroupIds.length > 0) {
            metricsQuery = metricsQuery.in('beneficiary_group_id', beneficiaryGroupIds);
        }

        const { data: metricsData, error: metricsError } = await metricsQuery;

        if (metricsError) {
            throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
        }

        // Deduplicate metrics (since a metric can appear multiple times if location has multiple beneficiary groups)
        const uniqueMetrics = new Map<string, any>();
        (metricsData || []).forEach((metric: any) => {
            if (!uniqueMetrics.has(metric.id)) {
                uniqueMetrics.set(metric.id, metric);
            }
        });
        let metrics = Array.from(uniqueMetrics.values());

        // Filter by donor credits if donorId is provided
        if (donorId) {
            // Get all credits for this donor
            const { data: donorCredits, error: creditsError } = await supabase
                .from('donor_credits')
                .select('kpi_id, kpi_update_id, credited_value')
                .eq('donor_id', donorId);

            if (creditsError) {
                throw new Error(`Failed to fetch donor credits: ${creditsError.message}`);
            }

            if (donorCredits && donorCredits.length > 0) {
                // Create a map of credits by kpi_id and kpi_update_id
                const creditsMap = new Map<string, Map<string, number>>();
                donorCredits.forEach((credit: any) => {
                    const kpiId = credit.kpi_id;
                    const updateId = credit.kpi_update_id || 'metric-level';
                    if (!creditsMap.has(kpiId)) {
                        creditsMap.set(kpiId, new Map());
                    }
                    creditsMap.get(kpiId)!.set(updateId, parseFloat(credit.credited_value || 0));
                });

                // Filter metrics to only include those with credits, and adjust values
                const filteredMetrics: any[] = [];
                metrics.forEach((metric: any) => {
                    const kpiCredits = creditsMap.get(metric.kpi_id);
                    if (kpiCredits) {
                        // Check if this specific update has a credit, or if there's a metric-level credit
                        const updateCredit = kpiCredits.get(metric.id) || kpiCredits.get('metric-level');
                        if (updateCredit !== undefined) {
                            // Use the credited value instead of the full value
                            filteredMetrics.push({
                                ...metric,
                                value: updateCredit.toString(),
                                original_value: metric.value // Keep original for reference
                            });
                        }
                    }
                });
                metrics = filteredMetrics;
            } else {
                // No credits for this donor, return empty metrics
                metrics = [];
            }
        }

        // Resolve which org metric tags each KPI carries so the report can show
        // tag chips, group by tag, and (optionally) filter to selected tags.
        const kpiIdsInPlay = Array.from(new Set(metrics.map((m: any) => m.kpi_id).filter(Boolean)));
        const kpiToTags = await MetricTagService.getTagIdsForKpis(kpiIdsInPlay as string[]);

        // Apply tag filter: keep only metrics whose KPI carries a selected tag.
        if (tagIds && tagIds.length > 0) {
            const wanted = new Set(tagIds);
            metrics = metrics.filter((m: any) =>
                (kpiToTags[m.kpi_id] || []).some((t: string) => wanted.has(t))
            );
        }

        // Calculate totals grouped by KPI. We collect raw values per KPI then
        // run the aggregation helper so percentage metrics get averaged instead
        // of summed. NOTE: report metrics are deduped by location/ben-group join
        // so the same kpi_update may appear multiple times. We dedupe by metric.id
        // (kpi_update id) before aggregating.
        type Bucket = {
            kpi_id: string;
            kpi_title: string;
            kpi_description: string;
            unit_of_measurement: string;
            metric_type: string;
            updates: Map<string, { value: number; date_represented?: string }>;
        };
        const bucketMap = new Map<string, Bucket>();

        metrics.forEach((metric: any) => {
            const key = metric.kpi_id;
            if (!bucketMap.has(key)) {
                bucketMap.set(key, {
                    kpi_id: metric.kpi_id,
                    kpi_title: metric.kpi_title,
                    kpi_description: metric.kpi_description || '',
                    unit_of_measurement: metric.unit_of_measurement,
                    metric_type: metric.metric_type || 'number',
                    updates: new Map()
                });
            }
            const bucket = bucketMap.get(key)!;
            if (!bucket.updates.has(metric.id)) {
                bucket.updates.set(metric.id, {
                    value: parseFloat(metric.value) || 0,
                    date_represented: metric.date_represented
                });
            }
        });

        const totals = Array.from(bucketMap.values()).map(b => ({
            kpi_id: b.kpi_id,
            kpi_title: b.kpi_title,
            kpi_description: b.kpi_description,
            unit_of_measurement: b.unit_of_measurement,
            metric_type: b.metric_type,
            total_value: aggregateKpiUpdates(Array.from(b.updates.values()), b.metric_type),
            count: b.updates.size,
            tag_ids: kpiToTags[b.kpi_id] || []
        }));

        // Build the tag lookup, limited to tags actually referenced by the report's
        // KPIs (after the tag filter). Names/colours come from the org tag list.
        const referencedTagIds = new Set<string>();
        totals.forEach(t => t.tag_ids.forEach((id: string) => referencedTagIds.add(id)));
        const orgTags = await MetricTagService.getAll(userId, requestedOrgId);
        const tags = orgTags
            .filter(t => t.id && referencedTagIds.has(t.id))
            .map(t => ({ id: t.id as string, name: t.name, color: t.color ?? null }));

        // Get distinct locations from filtered metrics
        const locationMap = new Map<string, { id: string; name: string; description?: string; latitude: number; longitude: number }>();
        metrics.forEach((metric: any) => {
            if (metric.location_id && metric.location_name) {
                if (!locationMap.has(metric.location_id)) {
                    locationMap.set(metric.location_id, {
                        id: metric.location_id,
                        name: metric.location_name,
                        description: metric.location_description || undefined,
                        latitude: parseFloat(metric.location_latitude) || 0,
                        longitude: parseFloat(metric.location_longitude) || 0
                    });
                }
            }
        });
        const locations = Array.from(locationMap.values());

        // Query stories_with_context view with same filters
        let storiesQuery = supabase
            .from('stories_with_context')
            .select('*')
            .eq('initiative_id', initiativeId);

        if (dateStart) {
            storiesQuery = storiesQuery.gte('date_represented', dateStart);
        }
        if (dateEnd) {
            storiesQuery = storiesQuery.lte('date_represented', dateEnd);
        }

        const { data: storiesData, error: storiesError } = await storiesQuery;

        if (storiesError) {
            throw new Error(`Failed to fetch stories: ${storiesError.message}`);
        }

        // Fetch story_locations for all stories to get multi-location data
        const allStoryIds = (storiesData || []).map((s: any) => s.id);
        let storyLocationMap = new Map<string, string[]>();
        if (allStoryIds.length > 0) {
            const { data: slData } = await supabase
                .from('story_locations')
                .select('story_id, location_id')
                .in('story_id', allStoryIds);
            (slData || []).forEach((sl: any) => {
                const existing = storyLocationMap.get(sl.story_id) || [];
                existing.push(sl.location_id);
                storyLocationMap.set(sl.story_id, existing);
            });
        }

        let stories = (storiesData || []).map((story: any) => ({
            id: story.id,
            title: story.title,
            description: story.description || undefined,
            date_represented: story.date_represented,
            location_ids: storyLocationMap.get(story.id) || (story.location_id ? [story.location_id] : []),
            location_id: story.location_id || undefined,
            location_name: story.location_name || undefined,
            media_url: story.media_url || undefined,
            media_type: story.media_type || undefined
        }));

        // Filter by locations via junction table
        if (locationIds && locationIds.length > 0) {
            stories = stories.filter(story =>
                story.location_ids.some((lid: string) => locationIds.includes(lid))
            );
        }

        // Beneficiary groups covered by this report. When the caller filtered to
        // specific groups we honour that list; otherwise we return every group on
        // the initiative so the report can name who was served.
        let bgQuery = supabase
            .from('beneficiary_groups')
            .select('id, name, description, total_number, display_order')
            .eq('initiative_id', initiativeId);
        if (beneficiaryGroupIds && beneficiaryGroupIds.length > 0) {
            bgQuery = bgQuery.in('id', beneficiaryGroupIds);
        }
        const { data: bgData, error: bgError } = await bgQuery;
        if (bgError) {
            throw new Error(`Failed to fetch beneficiary groups: ${bgError.message}`);
        }
        const beneficiaryGroups = (bgData || [])
            .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
            .map((g: any) => ({
                id: g.id,
                name: g.name,
                description: g.description || undefined,
                total_number: g.total_number ?? null
            }));

        // Organization branding for the report header/footer.
        const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('name, logo_url, brand_color')
            .eq('id', organizationId)
            .single();
        if (orgError) {
            throw new Error(`Failed to fetch organization branding: ${orgError.message}`);
        }
        const branding = {
            organization_name: orgData?.name || '',
            logo_url: orgData?.logo_url ?? null,
            brand_color: orgData?.brand_color ?? null
        };

        // Build map points from locations and stories
        const mapPoints: Array<{ lat: number; lng: number; name: string; type: 'location' | 'story' }> = [];

        locations.forEach(loc => {
            mapPoints.push({
                lat: loc.latitude,
                lng: loc.longitude,
                name: loc.name,
                type: 'location'
            });
        });

        stories.forEach(story => {
            for (const locId of story.location_ids) {
                const location = locations.find(l => l.id === locId);
                if (location) {
                    const exists = mapPoints.some(p => p.lat === location.latitude && p.lng === location.longitude);
                    if (!exists) {
                        mapPoints.push({
                            lat: location.latitude,
                            lng: location.longitude,
                            name: `${story.title} (${location.name})`,
                            type: 'story'
                        });
                    }
                }
            }
        });

        return {
            metrics: metrics.map((m: any) => ({
                id: m.id,
                kpi_id: m.kpi_id,
                kpi_title: m.kpi_title,
                kpi_description: m.kpi_description || '',
                value: parseFloat(m.value) || 0,
                unit_of_measurement: m.unit_of_measurement,
                date_represented: m.date_represented,
                location_id: m.location_id || undefined,
                location_name: m.location_name || undefined
            })),
            totals,
            tags,
            locations,
            beneficiaryGroups,
            branding,
            stories,
            mapPoints
        };
    }
}

