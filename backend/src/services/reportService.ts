import { supabase } from '../utils/supabase';

export interface ReportDataFilters {
    initiativeId: string;
    userId: string;
    dateStart?: string;
    dateEnd?: string;
    kpiIds?: string[];
    locationIds?: string[];
    beneficiaryGroupIds?: string[];
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
        total_value: number;
        count: number;
    }>;
    locations: Array<{
        id: string;
        name: string;
        description?: string;
        latitude: number;
        longitude: number;
    }>;
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
        const { initiativeId, userId, dateStart, dateEnd, kpiIds, locationIds, beneficiaryGroupIds } = filters;

        // Build query for metrics_with_context view
        let metricsQuery = supabase
            .from('metrics_with_context')
            .select('*')
            .eq('initiative_id', initiativeId)
            .eq('user_id', userId);

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
        const metrics = Array.from(uniqueMetrics.values());

        // Calculate totals grouped by KPI
        const totalsMap = new Map<string, { kpi_id: string; kpi_title: string; kpi_description: string; unit_of_measurement: string; total_value: number; count: number }>();
        
        metrics.forEach((metric: any) => {
            const key = metric.kpi_id;
            if (!totalsMap.has(key)) {
                totalsMap.set(key, {
                    kpi_id: metric.kpi_id,
                    kpi_title: metric.kpi_title,
                    kpi_description: metric.kpi_description || '',
                    unit_of_measurement: metric.unit_of_measurement,
                    total_value: 0,
                    count: 0
                });
            }
            const total = totalsMap.get(key)!;
            total.total_value += parseFloat(metric.value) || 0;
            total.count += 1;
        });

        const totals = Array.from(totalsMap.values());

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
            .eq('initiative_id', initiativeId)
            .eq('user_id', userId);

        if (dateStart) {
            storiesQuery = storiesQuery.gte('date_represented', dateStart);
        }
        if (dateEnd) {
            storiesQuery = storiesQuery.lte('date_represented', dateEnd);
        }

        if (locationIds && locationIds.length > 0) {
            storiesQuery = storiesQuery.in('location_id', locationIds);
        }

        const { data: storiesData, error: storiesError } = await storiesQuery;

        if (storiesError) {
            throw new Error(`Failed to fetch stories: ${storiesError.message}`);
        }

        const stories = (storiesData || []).map((story: any) => ({
            id: story.id,
            title: story.title,
            description: story.description || undefined,
            date_represented: story.date_represented,
            location_id: story.location_id || undefined,
            location_name: story.location_name || undefined,
            media_url: story.media_url || undefined,
            media_type: story.media_type || undefined
        }));

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
            if (story.location_id) {
                const location = locations.find(l => l.id === story.location_id);
                if (location) {
                    // Only add if not already added as location
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
            locations,
            stories,
            mapPoints
        };
    }
}

