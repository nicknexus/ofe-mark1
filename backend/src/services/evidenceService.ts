import { supabase } from '../utils/supabase'
import { Evidence } from '../types'
import { deleteFromSupabase } from '../utils/fileUpload'
import { StorageService } from './storageService'
import { BeneficiaryService } from './beneficiaryService'
import { MetricTagService } from './metricTagService'

export class EvidenceService {
    static async create(evidence: Evidence, userId: string, requestedOrgId?: string): Promise<Evidence> {
        // Extract linkage fields and file_urls/file_sizes before inserting into evidence table
        const { kpi_ids, kpi_update_ids, file_urls, file_sizes, location_ids, beneficiary_group_ids, tag_ids, ...evidenceData } = evidence as any;

        const { data, error } = await supabase
            .from('evidence')
            .insert([{ ...evidenceData, user_id: userId }])
            .select()
            .single();

        if (error) throw new Error(`Failed to create evidence: ${error.message}`);

        // Insert multiple locations into evidence_locations junction table if provided
        if (location_ids && location_ids.length > 0) {
            const locationLinks = (location_ids as string[]).map((locationId: string) => ({
                evidence_id: data.id,
                location_id: locationId,
                user_id: userId
            }));

            const { error: locationError } = await supabase
                .from('evidence_locations')
                .insert(locationLinks);

            if (locationError) {
                console.error('Failed to insert evidence locations:', locationError);
                // Don't throw - evidence is created, location links are optional
            }
        }

        // Insert multiple files into evidence_files table if provided
        if (file_urls && file_urls.length > 0) {
            const evidenceFiles = (file_urls as string[]).map((fileUrl: string, index: number) => {
                // Extract filename from URL
                const fileName = fileUrl.split('/').pop() || `file-${index + 1}`
                // Try to determine file type from extension
                const extension = fileName.split('.').pop()?.toLowerCase() || ''
                const fileType = extension || 'unknown'
                // Get file size if provided (for storage tracking)
                const fileSize = (file_sizes as number[] | undefined)?.[index] || 0
                
                return {
                    evidence_id: data.id,
                    file_url: fileUrl,
                    file_name: fileName,
                    file_type: fileType,
                    file_size: fileSize, // Store file size for storage tracking
                    display_order: index
                }
            })

            const { error: filesError } = await supabase
                .from('evidence_files')
                .insert(evidenceFiles)

            if (filesError) {
                console.error('Failed to insert evidence files:', filesError)
                // Don't throw - evidence is created, files are optional
            }
        }

        // Legacy: Link to KPIs if provided
        if (kpi_ids && kpi_ids.length > 0) {
            const kpiLinks = (kpi_ids as string[]).map((kpiId: string) => ({
                evidence_id: data.id,
                kpi_id: kpiId
            }));

            const { error: linkError } = await supabase
                .from('evidence_kpis')
                .insert(kpiLinks);

            if (linkError) throw new Error(`Failed to link evidence to KPIs: ${linkError.message}`);
        }

        // New: Link to specific KPI updates (data points) if provided
        if (kpi_update_ids && kpi_update_ids.length > 0) {
            const updateLinks = (kpi_update_ids as string[]).map((updateId: string) => ({
                evidence_id: data.id,
                kpi_update_id: updateId,
                user_id: userId
            }));

            const { error: linkError2 } = await supabase
                .from('evidence_kpi_updates')
                .insert(updateLinks);

            if (linkError2) throw new Error(`Failed to link evidence to data points: ${linkError2.message}`);
        }

        // Auto-link to any existing matching impact claims not already linked
        await this.autoLinkToMatchingUpdates(data.id, kpi_ids || [], location_ids || [], {
            date_represented: data.date_represented,
            date_range_start: data.date_range_start,
            date_range_end: data.date_range_end
        }, kpi_update_ids || [], userId, beneficiary_group_ids || []);

        // Link to beneficiary groups if provided
        if (beneficiary_group_ids && beneficiary_group_ids.length > 0) {
            const bgLinks = beneficiary_group_ids.map((bgId: string) => ({
                evidence_id: data.id,
                beneficiary_group_id: bgId
            }));

            const { error: bgError } = await supabase
                .from('evidence_beneficiary_groups')
                .insert(bgLinks);

            if (bgError) {
                console.error('Failed to insert evidence beneficiary groups:', bgError);
            }
        }

        if (Array.isArray(tag_ids)) {
            await MetricTagService.setTagsForEvidence(data.id, tag_ids, userId, requestedOrgId)
        }

        return { ...data, tag_ids: Array.isArray(tag_ids) ? tag_ids : [] };
    }

    static async getAll(initiativeId?: string, kpiId?: string, beneficiaryGroupId?: string): Promise<Evidence[]> {
        let query;

        if (kpiId && beneficiaryGroupId) {
            query = supabase
                .from('evidence')
                .select(`
                    *,
                    evidence_kpis!inner(kpi_id),
                    evidence_kpi_updates(kpi_update_id),
                    evidence_locations(location_id),
                    evidence_beneficiary_groups!inner(beneficiary_group_id),
                    initiatives(title)
                `)
                .eq('evidence_kpis.kpi_id', kpiId)
                .eq('evidence_beneficiary_groups.beneficiary_group_id', beneficiaryGroupId);
        } else if (kpiId) {
            query = supabase
                .from('evidence')
                .select(`
                    *,
                    evidence_kpis!inner(kpi_id),
                    evidence_kpi_updates(kpi_update_id),
                    evidence_locations(location_id),
                    evidence_beneficiary_groups(beneficiary_group_id),
                    initiatives(title)
                `)
                .eq('evidence_kpis.kpi_id', kpiId);
        } else if (beneficiaryGroupId) {
            query = supabase
                .from('evidence')
                .select(`
                    *,
                    evidence_kpis(kpi_id),
                    evidence_kpi_updates(kpi_update_id),
                    evidence_locations(location_id),
                    evidence_beneficiary_groups!inner(beneficiary_group_id),
                    initiatives(title)
                `)
                .eq('evidence_beneficiary_groups.beneficiary_group_id', beneficiaryGroupId);
        } else {
            query = supabase
                .from('evidence')
                .select(`
                    *,
                    evidence_kpis(kpi_id),
                    evidence_kpi_updates(kpi_update_id),
                    evidence_locations(location_id),
                    evidence_beneficiary_groups(beneficiary_group_id),
                    initiatives(title)
                `);
        }

        if (initiativeId) {
            query = query.eq('initiative_id', initiativeId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch evidence: ${error.message}`);
        
        // Transform the data to include kpi_update_ids and location_ids as flat arrays
        const transformedData = (data || []).map((item: any) => {
            const kpi_update_ids = item.evidence_kpi_updates?.map((link: any) => link.kpi_update_id).filter(Boolean) || [];
            const location_ids = item.evidence_locations?.map((link: any) => link.location_id).filter(Boolean) || [];
            const beneficiary_group_ids = item.evidence_beneficiary_groups?.map((link: any) => link.beneficiary_group_id).filter(Boolean) || [];
            return {
                ...item,
                kpi_update_ids,
                location_ids,
                beneficiary_group_ids
            };
        });

        // Hydrate tag_ids in bulk (separate query — robust against PostgREST schema cache).
        const evidenceIds = transformedData.map((e: any) => e.id).filter(Boolean)
        const tagMap = await MetricTagService.getTagIdsForEvidences(evidenceIds)
        return transformedData.map((e: any) => ({ ...e, tag_ids: tagMap[e.id] || [] }));
    }

    static async getById(id: string): Promise<Evidence | null> {
        const { data, error } = await supabase
            .from('evidence')
            .select(`
                *,
                evidence_kpis(kpi_id),
                evidence_kpi_updates(kpi_update_id),
                evidence_locations(location_id),
                evidence_beneficiary_groups(beneficiary_group_id),
                initiatives(title)
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to fetch evidence: ${error.message}`);
        }
        
        // Transform to include kpi_ids, kpi_update_ids, and location_ids as flat arrays
        if (data) {
            const kpi_ids = data.evidence_kpis?.map((link: any) => link.kpi_id).filter(Boolean) || [];
            const kpi_update_ids = data.evidence_kpi_updates?.map((link: any) => link.kpi_update_id).filter(Boolean) || [];
            const location_ids = data.evidence_locations?.map((link: any) => link.location_id).filter(Boolean) || [];
            const beneficiary_group_ids = data.evidence_beneficiary_groups?.map((link: any) => link.beneficiary_group_id).filter(Boolean) || [];
            const tag_ids = await MetricTagService.getTagIdsForEvidence(data.id)
            return { ...data, kpi_ids, kpi_update_ids, location_ids, beneficiary_group_ids, tag_ids };
        }
        return data;
    }

    static async update(id: string, evidence: Partial<Evidence>, userId: string, requestedOrgId?: string): Promise<Evidence> {
        // Extract linkage fields for separate handling
        const { kpi_ids, kpi_update_ids, location_ids, beneficiary_group_ids, tag_ids, ...evidenceData } = evidence as any;

        // Get existing evidence to check if file_url is changing
        const { data: existingEvidence } = await supabase
            .from('evidence')
            .select('file_url')
            .eq('id', id)
            .single();

        const { data, error } = await supabase
            .from('evidence')
            .update({ ...evidenceData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(`Failed to update evidence: ${error.message}`);

        // Delete old file if file_url changed and old file exists
        if (evidenceData.file_url && existingEvidence?.file_url && 
            evidenceData.file_url !== existingEvidence.file_url) {
            await deleteFromSupabase(existingEvidence.file_url);
        }

        // Update legacy KPI links if provided
        if (kpi_ids !== undefined) {
            // Delete existing links
            await supabase
                .from('evidence_kpis')
                .delete()
                .eq('evidence_id', id);

            // Add new links
            if (kpi_ids.length > 0) {
                const kpiLinks = (kpi_ids as string[]).map((kpiId: string) => ({
                    evidence_id: id,
                    kpi_id: kpiId
                }));

                const { error: linkError } = await supabase
                    .from('evidence_kpis')
                    .insert(kpiLinks);

                if (linkError) throw new Error(`Failed to update evidence KPI links: ${linkError.message}`);
            }
        }

        // Update data point links if provided
        if (kpi_update_ids !== undefined) {
            // Delete existing links
            await supabase
                .from('evidence_kpi_updates')
                .delete()
                .eq('evidence_id', id);

            if (kpi_update_ids.length > 0) {
                const updateLinks = (kpi_update_ids as string[]).map((updateId: string) => ({
                    evidence_id: id,
                    kpi_update_id: updateId,
                    user_id: userId
                }));

                const { error: linkError2 } = await supabase
                    .from('evidence_kpi_updates')
                    .insert(updateLinks);

                if (linkError2) throw new Error(`Failed to update evidence data point links: ${linkError2.message}`);
            }
        }

        // Update location links if provided
        if (location_ids !== undefined) {
            // Delete existing location links
            await supabase
                .from('evidence_locations')
                .delete()
                .eq('evidence_id', id);

            if (location_ids.length > 0) {
                const locationLinks = (location_ids as string[]).map((locationId: string) => ({
                    evidence_id: id,
                    location_id: locationId,
                    user_id: userId
                }));

                const { error: locationError } = await supabase
                    .from('evidence_locations')
                    .insert(locationLinks);

                if (locationError) throw new Error(`Failed to update evidence location links: ${locationError.message}`);
            }
        }

        // Update beneficiary group links if provided
        if (beneficiary_group_ids !== undefined) {
            await supabase
                .from('evidence_beneficiary_groups')
                .delete()
                .eq('evidence_id', id);

            if (beneficiary_group_ids.length > 0) {
                const bgLinks = beneficiary_group_ids.map((bgId: string) => ({
                    evidence_id: id,
                    beneficiary_group_id: bgId
                }));

                const { error: bgError } = await supabase
                    .from('evidence_beneficiary_groups')
                    .insert(bgLinks);

                if (bgError) throw new Error(`Failed to update evidence beneficiary group links: ${bgError.message}`);
            }
        }

        if (Array.isArray(tag_ids)) {
            await MetricTagService.setTagsForEvidence(id, tag_ids, userId, requestedOrgId)
        }

        // Auto-link to any existing matching impact claims not already linked
        // Gather current state after all link updates
        const { data: currentKpiLinks } = await supabase
            .from('evidence_kpis')
            .select('kpi_id')
            .eq('evidence_id', id);
        const currentKpiIds = (currentKpiLinks || []).map((l: any) => l.kpi_id);

        const { data: currentLocLinks } = await supabase
            .from('evidence_locations')
            .select('location_id')
            .eq('evidence_id', id);
        const currentLocIds = (currentLocLinks || []).map((l: any) => l.location_id);

        const { data: currentUpdateLinks } = await supabase
            .from('evidence_kpi_updates')
            .select('kpi_update_id')
            .eq('evidence_id', id);
        const alreadyLinkedIds = (currentUpdateLinks || []).map((l: any) => l.kpi_update_id);

        // Prune stale links where location, date, or ben groups no longer match
        if (alreadyLinkedIds.length > 0) {
            const { data: linkedUpdates } = await supabase
                .from('kpi_updates')
                .select('id, location_id, date_represented, date_range_start, date_range_end')
                .in('id', alreadyLinkedIds)

            const evidenceDateStart = data.date_range_start || data.date_represented || ''
            const evidenceDateEnd = data.date_range_end || null

            // Get current ben group IDs for scoping
            const { data: currentBgLinks } = await supabase
                .from('evidence_beneficiary_groups')
                .select('beneficiary_group_id')
                .eq('evidence_id', id)
            const currentBgIds = (currentBgLinks || []).map((l: any) => l.beneficiary_group_id)
            const updateBenGroups = await BeneficiaryService.getBenGroupsForUpdates(alreadyLinkedIds)

            const staleIds = (linkedUpdates || [])
                .filter((u: any) => {
                    const locMatch = u.location_id && currentLocIds.includes(u.location_id)
                    const updateStart = u.date_range_start || u.date_represented
                    const updateEnd = u.date_range_end || null
                    const dateMatch = this.datesOverlap(evidenceDateStart, evidenceDateEnd, updateStart, updateEnd)
                    const bgMatch = BeneficiaryService.beneficiaryGroupsMatch(
                        updateBenGroups[u.id] || [], currentBgIds
                    )
                    return !locMatch || !dateMatch || !bgMatch
                })
                .map((u: any) => u.id)

            if (staleIds.length > 0) {
                await supabase
                    .from('evidence_kpi_updates')
                    .delete()
                    .eq('evidence_id', id)
                    .in('kpi_update_id', staleIds)
                console.log(`Pruned ${staleIds.length} stale evidence-claim link(s) for evidence ${id}`)
            }
        }

        // Get updated already-linked IDs after pruning
        const { data: freshUpdateLinks } = await supabase
            .from('evidence_kpi_updates')
            .select('kpi_update_id')
            .eq('evidence_id', id)
        const freshLinkedIds = (freshUpdateLinks || []).map((l: any) => l.kpi_update_id)

        // Get current ben group IDs for auto-link scoping
        const { data: bgLinksForAutoLink } = await supabase
            .from('evidence_beneficiary_groups')
            .select('beneficiary_group_id')
            .eq('evidence_id', id)
        const bgIdsForAutoLink = (bgLinksForAutoLink || []).map((l: any) => l.beneficiary_group_id)

        await this.autoLinkToMatchingUpdates(id, currentKpiIds, currentLocIds, {
            date_represented: data.date_represented,
            date_range_start: data.date_range_start,
            date_range_end: data.date_range_end
        }, freshLinkedIds, userId, bgIdsForAutoLink);

        return data;
    }

    static async delete(id: string, userId: string): Promise<void> {
        // Get evidence record first to delete associated file and track storage
        // Note: We don't filter by user_id here because the route middleware (requireOwnerPermission)
        // already verifies the user is an org owner who can delete any evidence in their org
        const { data: evidence, error: fetchError } = await supabase
            .from('evidence')
            .select('file_url, initiative_id')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                throw new Error('Evidence not found');
            }
            throw new Error(`Failed to fetch evidence: ${fetchError.message}`);
        }

        // Get all files associated with this evidence (for storage tracking)
        const { data: evidenceFiles } = await supabase
            .from('evidence_files')
            .select('file_size')
            .eq('evidence_id', id);

        // Calculate total file size for storage decrement
        const totalFileSize = (evidenceFiles || []).reduce(
            (sum, file) => sum + (file.file_size || 0), 
            0
        );

        // Delete links first (both legacy and new)
        const { error: linkError } = await supabase
            .from('evidence_kpis')
            .delete()
            .eq('evidence_id', id);

        if (linkError) throw new Error(`Failed to delete evidence KPI links: ${linkError.message}`);

        const { error: linkError2 } = await supabase
            .from('evidence_kpi_updates')
            .delete()
            .eq('evidence_id', id);

        if (linkError2) throw new Error(`Failed to delete evidence data point links: ${linkError2.message}`);

        // Delete evidence_locations records
        await supabase
            .from('evidence_locations')
            .delete()
            .eq('evidence_id', id);

        // Delete evidence_files records (cascade should handle this but be explicit)
        await supabase
            .from('evidence_files')
            .delete()
            .eq('evidence_id', id);

        // Delete evidence record
        // Note: We don't filter by user_id - authorization is handled by route middleware
        const { error } = await supabase
            .from('evidence')
            .delete()
            .eq('id', id);

        if (error) throw new Error(`Failed to delete evidence: ${error.message}`);

        // Delete file from Supabase Storage if it exists
        if (evidence?.file_url) {
            await deleteFromSupabase(evidence.file_url);
        }

        // Decrement storage usage (Phase 1: tracking only)
        if (totalFileSize > 0 && evidence?.initiative_id) {
            const organizationId = await StorageService.getOrganizationIdFromInitiative(evidence.initiative_id);
            if (organizationId) {
                await StorageService.decrementStorage(organizationId, totalFileSize);
            }
        }

        return;
    }

    static async getEvidenceStats(initiativeId?: string): Promise<Record<string, number>> {
        let query = supabase
            .from('evidence')
            .select('type');

        if (initiativeId) {
            query = query.eq('initiative_id', initiativeId);
        }

        const { data, error } = await query;

        if (error) throw new Error(`Failed to fetch evidence stats: ${error.message}`);

        const stats: Record<string, number> = {};
        data?.forEach(evidence => {
            const type = evidence.type as string;
            stats[type] = (stats[type] || 0) + 1;
        });

        return stats;
    }

    static async getEvidenceForUpdate(updateId: string): Promise<Evidence[]> {
        const { data, error } = await supabase
            .from('evidence_kpi_updates')
            .select(`
                evidence(
                    id, title, description, type, file_url, file_type,
                    date_represented, date_range_start, date_range_end,
                    created_at, updated_at, user_id
                )
            `)
            .eq('kpi_update_id', updateId);

        if (error) throw new Error(`Failed to fetch evidence for update: ${error.message}`);

        const evidence = (data || [])
            .map((item: any) => item.evidence)
            .filter(Boolean);

        // Read-time ben group scoping filter
        const evidenceIds = evidence.map((e: any) => e.id).filter(Boolean)
        if (evidenceIds.length === 0) return evidence

        const updateBenGroups = await BeneficiaryService.getBenGroupsForUpdates([updateId])
        const updateGroupIds = updateBenGroups[updateId] || []
        const evidenceBenGroups = await BeneficiaryService.getBenGroupsForEvidence(evidenceIds)
        const anyEvidenceScoped = Object.values(evidenceBenGroups).some(ids => ids.length > 0)

        // Skip filtering if neither side uses ben groups
        if (updateGroupIds.length === 0 && !anyEvidenceScoped) return evidence

        return evidence.filter((e: any) => {
            const evGroupIds = evidenceBenGroups[e.id] || []
            return BeneficiaryService.beneficiaryGroupsMatch(updateGroupIds, evGroupIds)
        });
    }

    static async getFilesForEvidence(evidenceId: string): Promise<any[]> {
        const { data: evidence, error: evidenceError } = await supabase
            .from('evidence')
            .select('id, file_url, file_type')
            .eq('id', evidenceId)
            .single();

        if (evidenceError || !evidence) {
            return [];
        }

        // Try to get files from evidence_files table
        const { data: files, error: filesError } = await supabase
            .from('evidence_files')
            .select('id, file_url, file_name, file_type, file_size, display_order')
            .eq('evidence_id', evidenceId)
            .order('display_order', { ascending: true });

        if (filesError) {
            console.error('Error fetching evidence files:', filesError);
            // Fall back to the single file_url from evidence table
            if (evidence.file_url) {
                return [{
                    id: evidenceId,
                    file_url: evidence.file_url,
                    file_name: evidence.file_url.split('/').pop() || 'file',
                    file_type: evidence.file_type || 'unknown',
                    display_order: 0
                }];
            }
            return [];
        }

        // If no files in evidence_files table, fall back to evidence.file_url
        if (!files || files.length === 0) {
            if (evidence.file_url) {
                return [{
                    id: evidenceId,
                    file_url: evidence.file_url,
                    file_name: evidence.file_url.split('/').pop() || 'file',
                    file_type: evidence.file_type || 'unknown',
                    display_order: 0
                }];
            }
            return [];
        }

        return files;
    }

    static async getDataPointsForEvidence(evidenceId: string): Promise<any[]> {
        const { data, error } = await supabase
            .from('evidence_kpi_updates')
            .select(`
                kpi_update_id,
                kpi_updates(
                    id, value, date_represented, date_range_start, date_range_end,
                    label, note, created_at, user_id, location_id,
                    kpis(id, title, unit_of_measurement)
                )
            `)
            .eq('evidence_id', evidenceId);

        if (error) throw new Error(`Failed to fetch data points for evidence: ${error.message}`);

        const dataPoints = (data || [])
            .map((item: any) => item.kpi_updates)
            .filter(Boolean)
            .map((dp: any) => ({
                ...dp,
                kpi: dp.kpis
            }));

        // Read-time ben group scoping: filter out claims that don't match this evidence's groups
        if (dataPoints.length === 0) return dataPoints
        const updateIds = dataPoints.map((dp: any) => dp.id).filter(Boolean)
        const [evidenceBenGroups, updateBenGroups] = await Promise.all([
            BeneficiaryService.getBenGroupsForEvidence([evidenceId]),
            BeneficiaryService.getBenGroupsForUpdates(updateIds)
        ])
        const evGroupIds = evidenceBenGroups[evidenceId] || []
        const anyScoped = evGroupIds.length > 0 || Object.values(updateBenGroups).some(ids => ids.length > 0)
        if (!anyScoped) return dataPoints

        return dataPoints.filter((dp: any) => {
            const claimGroupIds = updateBenGroups[dp.id] || []
            return BeneficiaryService.beneficiaryGroupsMatch(claimGroupIds, evGroupIds)
        });
    }

    private static datesOverlap(
        start1: string, end1: string | null,
        start2: string, end2: string | null
    ): boolean {
        const e1 = end1 || start1
        const e2 = end2 || start2
        return start1 <= e2 && start2 <= e1
    }

    static async autoLinkToMatchingUpdates(
        evidenceId: string,
        kpiIds: string[],
        locationIds: string[],
        dates: { date_represented?: string; date_range_start?: string; date_range_end?: string },
        alreadyLinkedUpdateIds: string[],
        userId: string,
        evidenceBenGroupIds: string[] = []
    ): Promise<void> {
        try {
            if (kpiIds.length === 0 || locationIds.length === 0) return

            const { data: kpiUpdates } = await supabase
                .from('kpi_updates')
                .select('id, date_represented, date_range_start, date_range_end, location_id')
                .in('kpi_id', kpiIds)

            if (!kpiUpdates || kpiUpdates.length === 0) return

            const alreadyLinked = new Set(alreadyLinkedUpdateIds)
            const evidenceDateStart = dates.date_range_start || dates.date_represented || ''
            const evidenceDateEnd = dates.date_range_end || null

            // Candidate updates that pass date + location checks
            const candidateUpdateIds: string[] = []

            for (const update of kpiUpdates) {
                if (alreadyLinked.has(update.id)) continue
                if (!update.location_id || !locationIds.includes(update.location_id)) continue

                const updateDateStart = update.date_range_start || update.date_represented
                const updateDateEnd = update.date_range_end || null

                if (!this.datesOverlap(evidenceDateStart, evidenceDateEnd, updateDateStart, updateDateEnd)) continue

                candidateUpdateIds.push(update.id)
            }

            if (candidateUpdateIds.length === 0) return

            // Ben group scoping: filter by beneficiary group compatibility
            const updateBenGroups = await BeneficiaryService.getBenGroupsForUpdates(candidateUpdateIds)
            const filteredUpdateIds = candidateUpdateIds.filter(updateId => {
                const updateGroupIds = updateBenGroups[updateId] || []
                return BeneficiaryService.beneficiaryGroupsMatch(updateGroupIds, evidenceBenGroupIds)
            })

            if (filteredUpdateIds.length === 0) return

            const newLinks = filteredUpdateIds.map(updateId => ({
                evidence_id: evidenceId,
                kpi_update_id: updateId,
                user_id: userId
            }))

            const { error } = await supabase
                .from('evidence_kpi_updates')
                .insert(newLinks)

            if (error) {
                console.error('Failed to auto-link evidence to existing impact claims:', error)
            } else {
                console.log(`Auto-linked evidence ${evidenceId} to ${newLinks.length} existing impact claim(s)`)
            }
        } catch (error) {
            console.error('Error in autoLinkToMatchingUpdates:', error)
        }
    }
} 