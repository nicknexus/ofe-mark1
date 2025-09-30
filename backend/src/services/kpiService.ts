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
        kpi_updates(id, value, date_represented, created_at),
        evidence_kpis(
            evidence(id, type, date_represented, date_range_start, date_range_end)
        )
      `)
            .eq('user_id', userId);

        if (initiativeId) {
            query = query.eq('initiative_id', initiativeId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch KPIs with evidence: ${error.message}`);

        // Use the same per-data-point completion logic from getEvidenceByDates
        const kpisWithEvidence = await Promise.all((data || []).map(async (kpi: any) => {
            try {
                // Get detailed evidence data for this KPI using our improved method
                const evidenceByDates = await this.getEvidenceByDates(kpi.id, userId);

                // Calculate overall evidence percentage from all data points
                const allDataPoints = evidenceByDates.flatMap(group => group.dataPoints);
                const evidencePercentage = allDataPoints.length > 0
                    ? Math.round(
                        allDataPoints.reduce((sum: number, dp: any) => sum + (dp.completionPercentage || 0), 0) / allDataPoints.length
                    )
                    : 0;

                const evidenceItems = kpi.evidence_kpis?.map((ek: any) => ek.evidence).filter(Boolean) || [];
                const updates = kpi.kpi_updates || [];

                // Calculate total value from all updates
                const total_value = updates.reduce((sum: number, update: any) => sum + (update.value || 0), 0);

                // Calculate evidence type breakdown
                const evidenceTypeStats = evidenceItems.reduce((acc: any, item: any) => {
                    acc[item.type] = (acc[item.type] || 0) + 1;
                    return acc;
                }, {});

                const totalEvidence = evidenceItems.length;
                const evidenceTypes = Object.entries(evidenceTypeStats).map(([type, count]: [string, any]) => ({
                    type,
                    count,
                    percentage: totalEvidence > 0 ? Math.round((count / totalEvidence) * 100) : 0,
                    label: type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                }));

                return {
                    ...kpi,
                    evidence_count: evidenceItems.length,
                    total_updates: updates.length,
                    total_value: total_value,
                    evidence_percentage: evidencePercentage,
                    evidence_types: evidenceTypes,
                    latest_update: updates.length > 0 ? updates[0] : null
                };
            } catch (error) {
                // Fallback to simple calculation if getEvidenceByDates fails
                console.warn(`Failed to get detailed evidence for KPI ${kpi.id}, using fallback:`, error);

                const updates = kpi.kpi_updates || [];
                const evidenceItems = kpi.evidence_kpis?.map((ek: any) => ek.evidence).filter(Boolean) || [];

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

                // Calculate total value from all updates
                const total_value = updates.reduce((sum: number, update: any) => sum + (update.value || 0), 0);

                // Calculate evidence type breakdown (fallback)
                const evidenceTypeStats = evidenceItems.reduce((acc: any, item: any) => {
                    acc[item.type] = (acc[item.type] || 0) + 1;
                    return acc;
                }, {});

                const totalEvidence = evidenceItems.length;
                const evidenceTypes = Object.entries(evidenceTypeStats).map(([type, count]: [string, any]) => ({
                    type,
                    count,
                    percentage: totalEvidence > 0 ? Math.round((count / totalEvidence) * 100) : 0,
                    label: type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                }));

                return {
                    ...kpi,
                    evidence_count: evidenceItems.length,
                    total_updates: updates.length,
                    total_value: total_value,
                    evidence_percentage: evidencePercentage,
                    evidence_types: evidenceTypes,
                    latest_update: updates.length > 0 ? updates[0] : null
                };
            }
        }));

        return kpisWithEvidence;
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
        // Support optional beneficiary_group_ids on creation
        const { beneficiary_group_ids, ...insertData } = (update as any)

        const { data, error } = await supabase
            .from('kpi_updates')
            .insert([{ ...insertData, user_id: userId }])
            .select()
            .single();

        if (error) throw new Error(`Failed to add KPI update: ${error.message}`);

        // Link to beneficiary groups if provided
        if (Array.isArray(beneficiary_group_ids) && beneficiary_group_ids.length > 0) {
            const links = beneficiary_group_ids.map((groupId: string) => ({
                kpi_update_id: data.id,
                beneficiary_group_id: groupId,
                user_id: userId
            }))

            const { error: linkError } = await supabase
                .from('kpi_update_beneficiary_groups')
                .insert(links)

            if (linkError) throw new Error(`Failed to link data point to beneficiary groups: ${linkError.message}`)
        }

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
        const { beneficiary_group_ids, ...updateData } = (updates as any)

        const { data, error } = await supabase
            .from('kpi_updates')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update KPI update: ${error.message}`);

        // Replace beneficiary links if provided
        if (beneficiary_group_ids !== undefined) {
            await supabase
                .from('kpi_update_beneficiary_groups')
                .delete()
                .eq('kpi_update_id', id)

            if (Array.isArray(beneficiary_group_ids) && beneficiary_group_ids.length > 0) {
                const links = beneficiary_group_ids.map((groupId: string) => ({
                    kpi_update_id: id,
                    beneficiary_group_id: groupId,
                    user_id: userId
                }))

                const { error: linkError } = await supabase
                    .from('kpi_update_beneficiary_groups')
                    .insert(links)

                if (linkError) throw new Error(`Failed to update beneficiary links for data point: ${linkError.message}`)
            }
        }
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

    // Get evidence grouped by dates for a specific KPI
    static async getEvidenceByDates(kpiId: string, userId: string) {
        // Get KPI updates for this KPI
        const { data: updates, error: updatesError } = await supabase
            .from('kpi_updates')
            .select('*')
            .eq('kpi_id', kpiId)
            .eq('user_id', userId)
            .order('date_represented', { ascending: false });

        if (updatesError) throw new Error(`Failed to fetch KPI updates: ${updatesError.message}`);

        // Get evidence linked to this KPI (legacy) and the more precise links to updates
        const { data: evidenceData, error: evidenceError } = await supabase
            .from('evidence_kpis')
            .select(`
                evidence(
                    id, title, description, type, file_url, file_type,
                    date_represented, date_range_start, date_range_end,
                    created_at, updated_at
                )
            `)
            .eq('kpi_id', kpiId);

        if (evidenceError) throw new Error(`Failed to fetch evidence: ${evidenceError.message}`);

        const rawEvidence = (evidenceData || []).map((item: any) => item.evidence).filter(Boolean)
        // Some PostgREST joins can yield arrays; normalize to a flat array of evidence objects
        const evidence: any[] = []
        for (const ev of rawEvidence) {
            if (Array.isArray(ev)) evidence.push(...ev)
            else evidence.push(ev)
        }

        // Additionally fetch precise evidence-to-update links to attribute evidence per data point
        const { data: evidenceUpdateLinks } = await supabase
            .from('evidence_kpi_updates')
            .select('evidence_id, kpi_update_id');

        // Calculate completion percentage for each individual data point
        const updatesWithCompletion = (updates || []).map(update => {
            // First, collect explicitly linked evidence via evidence_kpi_updates
            const explicitEvidenceIds = new Set(
                (evidenceUpdateLinks || [])
                    .filter((l: any) => l.kpi_update_id === update.id)
                    .map((l: any) => l.evidence_id)
            )

            const explicitEvidence = evidence.filter((e: any) => explicitEvidenceIds.has(e.id))

            // Only use explicitly linked evidence - no more implicit date matching
            // This ensures evidence only counts toward data points it's actually linked to
            const relevantEvidence = explicitEvidence

            // Calculate completion percentage for this data point
            let completionPercentage = 0;
            let isFullyProven = false;

            if (update.date_range_start && update.date_range_end) {
                // For date range updates, calculate based on days covered
                const startDate = new Date(update.date_range_start);
                const endDate = new Date(update.date_range_end);
                const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                const coveredDays = new Set();
                relevantEvidence.forEach((evidence: any) => {
                    if (evidence.date_range_start && evidence.date_range_end) {
                        const evidenceStart = new Date(evidence.date_range_start);
                        const evidenceEnd = new Date(evidence.date_range_end);
                        for (let d = new Date(evidenceStart); d <= evidenceEnd; d.setDate(d.getDate() + 1)) {
                            if (d >= startDate && d <= endDate) {
                                coveredDays.add(d.toISOString().split('T')[0]);
                            }
                        }
                    } else {
                        const evidenceDate = new Date(evidence.date_represented);
                        if (evidenceDate >= startDate && evidenceDate <= endDate) {
                            coveredDays.add(evidence.date_represented);
                        }
                    }
                });

                completionPercentage = Math.round((coveredDays.size / totalDays) * 100);
                isFullyProven = coveredDays.size === totalDays;
            } else {
                // For single date updates, it's either 100% or 0%
                completionPercentage = relevantEvidence.length > 0 ? 100 : 0;
                isFullyProven = relevantEvidence.length > 0;
            }

            return {
                ...update,
                completionPercentage,
                isFullyProven,
                evidenceItems: relevantEvidence
            };
        });

        // Group by dates for display, but keep individual data point percentages
        const dateGroups = new Map();

        updatesWithCompletion.forEach(update => {
            const dateKey = update.date_range_start && update.date_range_end
                ? `${update.date_range_start}_${update.date_range_end}`
                : update.date_represented;

            if (!dateGroups.has(dateKey)) {
                dateGroups.set(dateKey, {
                    date: update.date_represented,
                    dateRange: update.date_range_start && update.date_range_end ? {
                        start: update.date_range_start,
                        end: update.date_range_end
                    } : null,
                    totalMetricImpact: 0,
                    dataPoints: [],
                    evidenceItems: [],
                    completionPercentage: 0,
                    isFullyProven: false
                });
            }

            const group = dateGroups.get(dateKey);
            group.totalMetricImpact += update.value;
            group.dataPoints.push(update);

            // Collect all evidence items for this group
            update.evidenceItems.forEach((evidence: any) => {
                if (!group.evidenceItems.find((existing: any) => existing.id === evidence.id)) {
                    group.evidenceItems.push(evidence);
                }
            });
        });

        // Calculate group-level completion as average of data points
        dateGroups.forEach(group => {
            if (group.dataPoints.length > 0) {
                group.completionPercentage = Math.round(
                    group.dataPoints.reduce((sum: number, dp: any) => sum + dp.completionPercentage, 0) / group.dataPoints.length
                );
                group.isFullyProven = group.dataPoints.every((dp: any) => dp.isFullyProven);
            }
        });

        return Array.from(dateGroups.values()).sort((a, b) => {
            const dateA = a.dateRange ? a.dateRange.start : a.date;
            const dateB = b.dateRange ? b.dateRange.start : b.date;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
    }
} 