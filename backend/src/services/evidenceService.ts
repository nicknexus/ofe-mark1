import { supabase } from '../utils/supabase'
import { Evidence } from '../types'
import { deleteFromSupabase } from '../utils/fileUpload'
import { StorageService } from './storageService'
import { BeneficiaryService } from './beneficiaryService'
import { MetricTagService } from './metricTagService'
import { InitiativeService } from './initiativeService'
import { OrgAccessService } from './orgAccessService'

export class EvidenceService {
    /**
     * Best-effort cleanup of a half-written evidence row + its junction inserts.
     * Used when a downstream link insert fails inside `create()` so we don't
     * leave orphan rows that the auto-linker / read paths would silently
     * surface as "evidence with no files" or "evidence with no locations".
     */
    private static async cleanupPartialEvidence(evidenceId: string): Promise<void> {
        try {
            await Promise.allSettled([
                supabase.from('evidence_files').delete().eq('evidence_id', evidenceId),
                supabase.from('evidence_locations').delete().eq('evidence_id', evidenceId),
                supabase.from('evidence_kpis').delete().eq('evidence_id', evidenceId),
                supabase.from('evidence_kpi_updates').delete().eq('evidence_id', evidenceId),
                supabase.from('evidence_beneficiary_groups').delete().eq('evidence_id', evidenceId),
            ])
            await supabase.from('evidence').delete().eq('id', evidenceId)
        } catch (err) {
            console.error(`[cleanupPartialEvidence] failed to clean up evidence ${evidenceId}:`, err)
        }
    }

    static async create(evidence: Evidence, userId: string, requestedOrgId?: string): Promise<Evidence> {
        // Extract linkage fields and file_urls/file_sizes before inserting into evidence table
        const { kpi_ids, kpi_update_ids, file_urls, file_sizes, location_ids, beneficiary_group_ids, tag_ids, ...evidenceData } = evidence as any;

        if (!evidenceData.initiative_id) {
            throw new Error('initiative_id is required');
        }

        await OrgAccessService.assertEvidenceLinkageConsistency(
            evidenceData.initiative_id,
            userId,
            requestedOrgId,
            {
                kpi_ids: kpi_ids as string[] | undefined,
                kpi_update_ids: kpi_update_ids as string[] | undefined,
                location_ids: location_ids as string[] | undefined,
                beneficiary_group_ids: beneficiary_group_ids as string[] | undefined,
            }
        );

        const { PermissionService } = await import('./permissionService');
        await PermissionService.assert(userId, requestedOrgId, 'evidence', 'create', {
            initiativeId: evidenceData.initiative_id,
        });

        const { data, error } = await supabase
            .from('evidence')
            .insert([{ ...evidenceData, user_id: userId }])
            .select()
            .single();

        if (error) throw new Error(`Failed to create evidence: ${error.message}`);

        // Insert multiple locations into evidence_locations junction table if provided.
        // Locations are load-bearing for auto-link (autoLinkToMatchingUpdates short-circuits
        // on empty location_ids), so a silent drop here would produce an evidence row that
        // can never auto-link to claims. Treat failures as fatal and roll back.
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
                await this.cleanupPartialEvidence(data.id)
                throw new Error(`Failed to link evidence to locations: ${locationError.message}`)
            }
        }

        // Insert multiple files into evidence_files table if provided.
        // For grouped uploads this is the single source of truth for the file set —
        // silently dropping the inserts would leave a titled evidence row with zero
        // files visible in the UI. Roll back on failure so the caller can retry.
        if (file_urls && file_urls.length > 0) {
            const evidenceFiles = (file_urls as string[]).map((fileUrl: string, index: number) => {
                const fileName = fileUrl.split('/').pop() || `file-${index + 1}`
                const extension = fileName.split('.').pop()?.toLowerCase() || ''
                const fileType = extension || 'unknown'
                const fileSize = (file_sizes as number[] | undefined)?.[index] || 0

                return {
                    evidence_id: data.id,
                    file_url: fileUrl,
                    file_name: fileName,
                    file_type: fileType,
                    file_size: fileSize,
                    display_order: index
                }
            })

            const { error: filesError } = await supabase
                .from('evidence_files')
                .insert(evidenceFiles)

            if (filesError) {
                console.error('Failed to insert evidence files:', filesError)
                await this.cleanupPartialEvidence(data.id)
                throw new Error(`Failed to attach files to evidence: ${filesError.message}`)
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

        // Auto-link to any existing matching impact claims not already linked.
        // Pass tag_ids alongside ben groups so the auto-link respects the tag gate.
        await this.autoLinkToMatchingUpdates(data.id, kpi_ids || [], location_ids || [], {
            date_represented: data.date_represented,
            date_range_start: data.date_range_start,
            date_range_end: data.date_range_end
        }, kpi_update_ids || [], userId, beneficiary_group_ids || [], tag_ids || []);

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

    static async getAll(
        userId: string,
        requestedOrgId: string | undefined,
        initiativeId?: string,
        kpiId?: string,
        beneficiaryGroupId?: string
    ): Promise<Evidence[]> {
        if (kpiId) {
            await OrgAccessService.assertKpiAccess(kpiId, userId, requestedOrgId);
        }
        if (beneficiaryGroupId) {
            const { data: group } = await supabase
                .from('beneficiary_groups')
                .select('initiative_id')
                .eq('id', beneficiaryGroupId)
                .maybeSingle();
            if (!group?.initiative_id) return [];
            await OrgAccessService.assertInitiativeAccess(group.initiative_id, userId, requestedOrgId);
        }

        const accessibleInitiativeIds = await OrgAccessService.getAccessibleInitiativeIds(userId, requestedOrgId);
        if (accessibleInitiativeIds.length === 0) return [];

        if (initiativeId) {
            await OrgAccessService.assertInitiativeAccess(initiativeId, userId, requestedOrgId);
        }

        let query;

        // Always pull `evidence_files` alongside the row so the dashboard
        // (and any consumer of `getAll`) can render gallery previews. The
        // legacy `file_url` column is empty for multi-file uploads, so
        // omitting this join made photo-only evidence look like blank
        // "documentation" tiles in the owner UI.
        const evidenceFilesSelect =
            'evidence_files(id, file_url, file_name, file_type, display_order)';

        if (kpiId && beneficiaryGroupId) {
            query = supabase
                .from('evidence')
                .select(`
                    *,
                    ${evidenceFilesSelect},
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
                    ${evidenceFilesSelect},
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
                    ${evidenceFilesSelect},
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
                    ${evidenceFilesSelect},
                    evidence_kpis(kpi_id),
                    evidence_kpi_updates(kpi_update_id),
                    evidence_locations(location_id),
                    evidence_beneficiary_groups(beneficiary_group_id),
                    initiatives(title)
                `);
        }

        if (initiativeId) {
            query = query.eq('initiative_id', initiativeId);
        } else {
            query = query.in('initiative_id', accessibleInitiativeIds);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch evidence: ${error.message}`);
        
        // Transform the data to include kpi_update_ids and location_ids as flat arrays
        const transformedData = (data || []).map((item: any) => {
            const kpi_update_ids = item.evidence_kpi_updates?.map((link: any) => link.kpi_update_id).filter(Boolean) || [];
            const location_ids = item.evidence_locations?.map((link: any) => link.location_id).filter(Boolean) || [];
            const beneficiary_group_ids = item.evidence_beneficiary_groups?.map((link: any) => link.beneficiary_group_id).filter(Boolean) || [];
            // Surface gallery files under `files` (matches the public-side
            // shape) so the dashboard can render previews without an extra
            // `/files` round-trip per row. Sort by display_order to keep the
            // owner UI consistent with the public gallery.
            const files = (item.evidence_files || [])
                .slice()
                .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
            return {
                ...item,
                kpi_update_ids,
                location_ids,
                beneficiary_group_ids,
                files,
            };
        });

        // Hydrate tag_ids in bulk (separate query — robust against PostgREST schema cache).
        const evidenceIds = transformedData.map((e: any) => e.id).filter(Boolean)
        const tagMap = await MetricTagService.getTagIdsForEvidences(evidenceIds)
        return transformedData.map((e: any) => ({ ...e, tag_ids: tagMap[e.id] || [] }));
    }

    static async getById(id: string, userId: string, requestedOrgId?: string): Promise<Evidence | null> {
        try {
            await OrgAccessService.assertEvidenceAccess(id, userId, requestedOrgId);
        } catch (e) {
            if ((e as any).status === 404) return null;
            throw e;
        }

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
        const { initiativeId } = await OrgAccessService.assertEvidenceAccess(id, userId, requestedOrgId);

        // Extract linkage fields for separate handling
        const { kpi_ids, kpi_update_ids, location_ids, beneficiary_group_ids, tag_ids, ...evidenceData } = evidence as any;

        const targetInitiativeId = evidenceData.initiative_id ?? initiativeId;
        if (evidenceData.initiative_id && evidenceData.initiative_id !== initiativeId) {
            await OrgAccessService.assertInitiativeAccess(evidenceData.initiative_id, userId, requestedOrgId);
        }

        await OrgAccessService.assertEvidenceLinkageConsistency(
            targetInitiativeId,
            userId,
            requestedOrgId,
            {
                kpi_ids: kpi_ids as string[] | undefined,
                kpi_update_ids: kpi_update_ids as string[] | undefined,
                location_ids: location_ids as string[] | undefined,
                beneficiary_group_ids: beneficiary_group_ids as string[] | undefined,
            }
        );

        const { PermissionService } = await import('./permissionService');
        await PermissionService.assert(userId, requestedOrgId, 'evidence', 'edit', {
            resourceId: id,
            initiativeId: targetInitiativeId,
        });

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

        // Prune stale links where location, date, ben groups, OR tag no longer match
        if (alreadyLinkedIds.length > 0) {
            const { data: linkedUpdates } = await supabase
                .from('kpi_updates')
                .select('id, location_id, date_represented, date_range_start, date_range_end')
                .in('id', alreadyLinkedIds)

            const evidenceDateStart = data.date_range_start || data.date_represented || ''
            const evidenceDateEnd = data.date_range_end || null

            // Get current ben group IDs + current tag set for scoping.
            // Tags live in junction tables, so fetch them via the service.
            const [{ data: currentBgLinks }, currentEvidenceTagIds, updateBenGroups, updateTagMap] = await Promise.all([
                supabase
                    .from('evidence_beneficiary_groups')
                    .select('beneficiary_group_id')
                    .eq('evidence_id', id),
                MetricTagService.getTagIdsForEvidence(id),
                BeneficiaryService.getBenGroupsForUpdates(alreadyLinkedIds),
                MetricTagService.getTagIdsForUpdates(alreadyLinkedIds),
            ])
            const currentBgIds = (currentBgLinks || []).map((l: any) => l.beneficiary_group_id)

            // Prune only when a constraint EXISTS and isn't met. If the claim
            // has no location_id (legacy or partial data), treat it as "no
            // location constraint" and leave the link alone — same lenience as
            // ben groups and tags. Otherwise a single null field would nuke
            // every historical link the moment any evidence is edited.
            const staleIds = (linkedUpdates || [])
                .filter((u: any) => {
                    const updateStart = u.date_range_start || u.date_represented
                    const updateEnd = u.date_range_end || null
                    if (!this.datesOverlap(evidenceDateStart, evidenceDateEnd, updateStart, updateEnd)) return true
                    if (u.location_id && currentLocIds.length > 0 && !currentLocIds.includes(u.location_id)) return true
                    if (!BeneficiaryService.beneficiaryGroupsMatch(updateBenGroups[u.id] || [], currentBgIds)) return true
                    if (!MetricTagService.evidenceMatchesClaimTag(updateTagMap[u.id] ?? null, currentEvidenceTagIds)) return true
                    return false
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

        // Get current ben group IDs + tag IDs for auto-link scoping
        const [{ data: bgLinksForAutoLink }, tagIdsForAutoLink] = await Promise.all([
            supabase
                .from('evidence_beneficiary_groups')
                .select('beneficiary_group_id')
                .eq('evidence_id', id),
            MetricTagService.getTagIdsForEvidence(id),
        ])
        const bgIdsForAutoLink = (bgLinksForAutoLink || []).map((l: any) => l.beneficiary_group_id)

        await this.autoLinkToMatchingUpdates(id, currentKpiIds, currentLocIds, {
            date_represented: data.date_represented,
            date_range_start: data.date_range_start,
            date_range_end: data.date_range_end
        }, freshLinkedIds, userId, bgIdsForAutoLink, tagIdsForAutoLink);

        return data;
    }

    static async delete(id: string, userId: string, requestedOrgId?: string): Promise<void> {
        const { initiativeId } = await OrgAccessService.assertEvidenceAccess(id, userId, requestedOrgId);

        const { PermissionService } = await import('./permissionService');
        await PermissionService.assert(userId, requestedOrgId, 'evidence', 'delete', {
            resourceId: id,
            initiativeId,
        });

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

    static async getEvidenceStats(
        userId: string,
        requestedOrgId: string | undefined,
        initiativeId: string
    ): Promise<Record<string, number>> {
        await OrgAccessService.assertInitiativeAccess(initiativeId, userId, requestedOrgId);

        let query = supabase
            .from('evidence')
            .select('type')
            .eq('initiative_id', initiativeId);

        const { data, error } = await query;

        if (error) throw new Error(`Failed to fetch evidence stats: ${error.message}`);

        const stats: Record<string, number> = {};
        data?.forEach(evidence => {
            const type = evidence.type as string;
            stats[type] = (stats[type] || 0) + 1;
        });

        return stats;
    }

    static async getEvidenceForUpdate(
        updateId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<Evidence[]> {
        await OrgAccessService.assertKpiUpdateAccess(updateId, userId, requestedOrgId);

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

        // Read-time scoping filter: ben groups + tags. Both must pass.
        const evidenceIds = evidence.map((e: any) => e.id).filter(Boolean)
        if (evidenceIds.length === 0) return evidence

        const [updateBenGroups, evidenceBenGroups, updateTagId, evidenceTagsByEv] = await Promise.all([
            BeneficiaryService.getBenGroupsForUpdates([updateId]),
            BeneficiaryService.getBenGroupsForEvidence(evidenceIds),
            MetricTagService.getTagIdForUpdate(updateId),
            MetricTagService.getTagIdsForEvidences(evidenceIds),
        ])
        const updateGroupIds = updateBenGroups[updateId] || []

        return evidence.filter((e: any) => {
            const evGroupIds = evidenceBenGroups[e.id] || []
            if (!BeneficiaryService.beneficiaryGroupsMatch(updateGroupIds, evGroupIds)) return false
            const evTagIds = evidenceTagsByEv[e.id] || []
            return MetricTagService.evidenceMatchesClaimTag(updateTagId, evTagIds)
        });
    }

    static async getFilesForEvidence(
        evidenceId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<any[]> {
        try {
            await OrgAccessService.assertEvidenceAccess(evidenceId, userId, requestedOrgId);
        } catch (e) {
            if ((e as any).status === 404) return [];
            throw e;
        }

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

    static async getDataPointsForEvidence(
        evidenceId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<any[]> {
        await OrgAccessService.assertEvidenceAccess(evidenceId, userId, requestedOrgId);

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

        // Read-time scoping: filter out claims that don't match this evidence's
        // ben groups OR tags. Both gates apply.
        if (dataPoints.length === 0) return dataPoints
        const updateIds = dataPoints.map((dp: any) => dp.id).filter(Boolean)
        const [evidenceBenGroups, updateBenGroups, evidenceTagIds, updateTagMap] = await Promise.all([
            BeneficiaryService.getBenGroupsForEvidence([evidenceId]),
            BeneficiaryService.getBenGroupsForUpdates(updateIds),
            MetricTagService.getTagIdsForEvidence(evidenceId),
            MetricTagService.getTagIdsForUpdates(updateIds),
        ])
        const evGroupIds = evidenceBenGroups[evidenceId] || []

        return dataPoints.filter((dp: any) => {
            const claimGroupIds = updateBenGroups[dp.id] || []
            if (!BeneficiaryService.beneficiaryGroupsMatch(claimGroupIds, evGroupIds)) return false
            const claimTagId = updateTagMap[dp.id] || null
            return MetricTagService.evidenceMatchesClaimTag(claimTagId, evidenceTagIds)
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
        evidenceBenGroupIds: string[] = [],
        evidenceTagIds: string[] = []
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

            // Scoping gates: ben groups + tags. Both must pass.
            // Tags live in kpi_update_metric_tags, fetched via the service.
            const [updateBenGroups, updateTagMap] = await Promise.all([
                BeneficiaryService.getBenGroupsForUpdates(candidateUpdateIds),
                MetricTagService.getTagIdsForUpdates(candidateUpdateIds),
            ])

            const filteredUpdateIds = candidateUpdateIds.filter(updateId => {
                const updateGroupIds = updateBenGroups[updateId] || []
                if (!BeneficiaryService.beneficiaryGroupsMatch(updateGroupIds, evidenceBenGroupIds)) return false
                return MetricTagService.evidenceMatchesClaimTag(updateTagMap[updateId] ?? null, evidenceTagIds)
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

    /**
     * Re-evaluate `evidence_kpi_updates` for ONE evidence row against every
     * claim under the evidence's KPIs. Adds any newly-passing links and
     * prunes any existing links that fail the current gates (tag, ben group,
     * location, dates).
     *
     * Triggered after any operation that mutates the evidence's gate state —
     * tag changes, ben group changes, location changes, date changes — so
     * the support relationship stays in sync without requiring a manual
     * "rebuild links" run.
     */
    static async reconcileLinksForEvidence(evidenceId: string, userId: string): Promise<{ created: number; pruned: number }> {
        try {
            const { data: ev } = await supabase
                .from('evidence')
                .select('id, date_represented, date_range_start, date_range_end')
                .eq('id', evidenceId)
                .maybeSingle()
            if (!ev) return { created: 0, pruned: 0 }

            const [
                { data: kpiLinks },
                { data: locLinks },
                { data: existingLinks },
                evTagIds,
                evBgMap,
            ] = await Promise.all([
                supabase.from('evidence_kpis').select('kpi_id').eq('evidence_id', evidenceId),
                supabase.from('evidence_locations').select('location_id').eq('evidence_id', evidenceId),
                supabase.from('evidence_kpi_updates').select('kpi_update_id').eq('evidence_id', evidenceId),
                MetricTagService.getTagIdsForEvidence(evidenceId),
                BeneficiaryService.getBenGroupsForEvidence([evidenceId]),
            ])

            const kpiIds = (kpiLinks || []).map((l: any) => l.kpi_id)
            const evLocIds = (locLinks || []).map((l: any) => l.location_id)
            const evBgIds = evBgMap[evidenceId] || []
            const alreadyLinked = new Set((existingLinks || []).map((l: any) => l.kpi_update_id))
            const evStart = (ev.date_range_start || ev.date_represented || '') as string
            const evEnd = (ev.date_range_end || null) as string | null

            // No KPI association → no candidate claims to compare against,
            // and any existing link is by definition stale.
            if (kpiIds.length === 0) {
                if (alreadyLinked.size === 0) return { created: 0, pruned: 0 }
                await supabase
                    .from('evidence_kpi_updates')
                    .delete()
                    .eq('evidence_id', evidenceId)
                return { created: 0, pruned: alreadyLinked.size }
            }

            const { data: claimRows } = await supabase
                .from('kpi_updates')
                .select('id, kpi_id, location_id, date_represented, date_range_start, date_range_end')
                .in('kpi_id', kpiIds)
            const claims = (claimRows || []) as any[]
            const claimIds = claims.map(c => c.id)

            const [updateBgMap, updateTagMap] = claimIds.length > 0
                ? await Promise.all([
                    BeneficiaryService.getBenGroupsForUpdates(claimIds),
                    MetricTagService.getTagIdsForUpdates(claimIds),
                ])
                : [{} as Record<string, string[]>, {} as Record<string, string | null>]

            const passes = (claim: any): boolean => {
                const claimStart = (claim.date_range_start || claim.date_represented || '') as string
                const claimEnd = (claim.date_range_end || null) as string | null
                if (!evStart || !claimStart) return false
                if (!this.datesOverlap(evStart, evEnd, claimStart, claimEnd)) return false
                if (!claim.location_id || !evLocIds.includes(claim.location_id)) return false
                if (!BeneficiaryService.beneficiaryGroupsMatch(updateBgMap[claim.id] || [], evBgIds)) return false
                if (!MetricTagService.evidenceMatchesClaimTag(updateTagMap[claim.id] ?? null, evTagIds)) return false
                return true
            }

            const linksToCreate: { evidence_id: string; kpi_update_id: string; user_id: string }[] = []
            const linksToPrune: string[] = []

            for (const claim of claims) {
                const linked = alreadyLinked.has(claim.id)
                const ok = passes(claim)
                if (ok && !linked) {
                    linksToCreate.push({ evidence_id: evidenceId, kpi_update_id: claim.id, user_id: userId })
                } else if (!ok && linked) {
                    linksToPrune.push(claim.id)
                }
            }

            // Existing links pointing at a claim that's no longer under the
            // evidence's KPIs (e.g. claim was reparented) are also stale.
            const visitedClaimIds = new Set(claims.map(c => c.id))
            for (const existingId of alreadyLinked) {
                if (!visitedClaimIds.has(existingId)) linksToPrune.push(existingId)
            }

            if (linksToCreate.length > 0) {
                const { error } = await supabase.from('evidence_kpi_updates').insert(linksToCreate)
                if (error) console.error('reconcileLinksForEvidence insert error:', error.message)
            }
            if (linksToPrune.length > 0) {
                const { error } = await supabase
                    .from('evidence_kpi_updates')
                    .delete()
                    .eq('evidence_id', evidenceId)
                    .in('kpi_update_id', linksToPrune)
                if (error) console.error('reconcileLinksForEvidence prune error:', error.message)
            }

            return { created: linksToCreate.length, pruned: linksToPrune.length }
        } catch (err) {
            console.error('reconcileLinksForEvidence failed:', err)
            return { created: 0, pruned: 0 }
        }
    }

    /**
     * Re-evaluate every `evidence_kpi_updates` row pointing at a single
     * claim. Mirror of `reconcileLinksForEvidence` but scoped to the claim
     * side — used when a claim's tag, ben groups, location, or dates change.
     */
    static async reconcileLinksForUpdate(updateId: string, userId: string): Promise<{ created: number; pruned: number }> {
        try {
            const { data: claim } = await supabase
                .from('kpi_updates')
                .select('id, kpi_id, location_id, date_represented, date_range_start, date_range_end')
                .eq('id', updateId)
                .maybeSingle()
            if (!claim) return { created: 0, pruned: 0 }

            // Pull claim-side gate values once.
            const [{ data: existingLinks }, claimTagMap, claimBgMap] = await Promise.all([
                supabase.from('evidence_kpi_updates').select('evidence_id').eq('kpi_update_id', updateId),
                MetricTagService.getTagIdsForUpdates([updateId]),
                BeneficiaryService.getBenGroupsForUpdates([updateId]),
            ])
            const claimTag = claimTagMap[updateId] ?? null
            const claimBgIds = claimBgMap[updateId] || []
            const linkedEvidenceIds = new Set((existingLinks || []).map((l: any) => l.evidence_id))

            // Candidate evidence = everything attached to the claim's KPI.
            const { data: candidateLinks } = await supabase
                .from('evidence_kpis')
                .select('evidence_id')
                .eq('kpi_id', claim.kpi_id)
            const candidateEvidenceIds = Array.from(
                new Set((candidateLinks || []).map((l: any) => l.evidence_id))
            )

            // Walk every evidence in scope (linked or not) so we both add
            // newly-passing matches AND prune stale ones.
            const allEvidenceIds = Array.from(new Set([...candidateEvidenceIds, ...linkedEvidenceIds]))
            if (allEvidenceIds.length === 0) return { created: 0, pruned: 0 }

            const { data: evidenceRows } = await supabase
                .from('evidence')
                .select('id, date_represented, date_range_start, date_range_end')
                .in('id', allEvidenceIds)
            const evidenceList = (evidenceRows || []) as any[]
            const evidenceById = new Map<string, any>(evidenceList.map(e => [e.id, e]))

            const [
                { data: locLinks },
                evTagsMap,
                evBgMap,
            ] = await Promise.all([
                supabase.from('evidence_locations').select('evidence_id, location_id').in('evidence_id', allEvidenceIds),
                MetricTagService.getTagIdsForEvidences(allEvidenceIds),
                BeneficiaryService.getBenGroupsForEvidence(allEvidenceIds),
            ])
            const locByEv: Record<string, string[]> = {}
            ;(locLinks || []).forEach((l: any) => {
                if (!locByEv[l.evidence_id]) locByEv[l.evidence_id] = []
                locByEv[l.evidence_id].push(l.location_id)
            })

            const claimStart = (claim.date_range_start || claim.date_represented || '') as string
            const claimEnd = (claim.date_range_end || null) as string | null

            const passes = (evId: string): boolean => {
                const ev = evidenceById.get(evId)
                if (!ev) return false
                const evStart = (ev.date_range_start || ev.date_represented || '') as string
                const evEnd = (ev.date_range_end || null) as string | null
                if (!evStart || !claimStart) return false
                if (!this.datesOverlap(evStart, evEnd, claimStart, claimEnd)) return false
                if (!claim.location_id || !(locByEv[evId] || []).includes(claim.location_id)) return false
                if (!BeneficiaryService.beneficiaryGroupsMatch(claimBgIds, evBgMap[evId] || [])) return false
                if (!MetricTagService.evidenceMatchesClaimTag(claimTag, evTagsMap[evId] || [])) return false
                return true
            }

            const linksToCreate: { evidence_id: string; kpi_update_id: string; user_id: string }[] = []
            const linksToPrune: string[] = []

            for (const evId of allEvidenceIds) {
                const linked = linkedEvidenceIds.has(evId)
                const ok = passes(evId)
                if (ok && !linked) {
                    linksToCreate.push({ evidence_id: evId, kpi_update_id: updateId, user_id: userId })
                } else if (!ok && linked) {
                    linksToPrune.push(evId)
                }
            }

            if (linksToCreate.length > 0) {
                const { error } = await supabase.from('evidence_kpi_updates').insert(linksToCreate)
                if (error) console.error('reconcileLinksForUpdate insert error:', error.message)
            }
            if (linksToPrune.length > 0) {
                const { error } = await supabase
                    .from('evidence_kpi_updates')
                    .delete()
                    .eq('kpi_update_id', updateId)
                    .in('evidence_id', linksToPrune)
                if (error) console.error('reconcileLinksForUpdate prune error:', error.message)
            }

            return { created: linksToCreate.length, pruned: linksToPrune.length }
        } catch (err) {
            console.error('reconcileLinksForUpdate failed:', err)
            return { created: 0, pruned: 0 }
        }
    }

    /**
     * Idempotent backfill: re-evaluates every evidence-claim pair in the org under
     * the current rules (date overlap + location + ben groups + tag) and creates
     * any missing links AND prunes any links that no longer satisfy the gates.
     *
     * Used to backfill historical data after the tag-gate rule was introduced —
     * existing evidence + claims that should match but were never linked
     * (because they were created before the rule, or before the user added a
     * tag) get connected without needing a manual re-save.
     *
     * Safe to call repeatedly. Returns counts of mutations so callers can decide
     * whether to surface a toast.
     */
    static async backfillLinksForOrg(userId: string, requestedOrgId?: string): Promise<{
        linksCreated: number
        linksPruned: number
        evidenceProcessed: number
        claimsScanned: number
    }> {
        const orgId = await InitiativeService.getEffectiveOrganizationId(userId, requestedOrgId)
        if (!orgId) return { linksCreated: 0, linksPruned: 0, evidenceProcessed: 0, claimsScanned: 0 }

        // Pull all initiatives in the org so we can scope to their KPIs.
        const { data: initiatives } = await supabase
            .from('initiatives')
            .select('id')
            .eq('organization_id', orgId)
        const initiativeIds = (initiatives || []).map((i: any) => i.id)
        if (initiativeIds.length === 0) {
            return { linksCreated: 0, linksPruned: 0, evidenceProcessed: 0, claimsScanned: 0 }
        }

        // Pull all evidence in the org via initiative_id.
        const { data: evidenceRows } = await supabase
            .from('evidence')
            .select('id, initiative_id, date_represented, date_range_start, date_range_end')
            .in('initiative_id', initiativeIds)
        const evidenceList = (evidenceRows || []) as any[]
        if (evidenceList.length === 0) {
            return { linksCreated: 0, linksPruned: 0, evidenceProcessed: 0, claimsScanned: 0 }
        }
        const evidenceIds = evidenceList.map(e => e.id)

        // Pre-fetch supporting data in bulk so we don't N+1.
        const [
            { data: kpiLinks },
            { data: locLinks },
            { data: existingUpdateLinks },
            evidenceTagMap,
            evidenceBgMap,
        ] = await Promise.all([
            supabase.from('evidence_kpis').select('evidence_id, kpi_id').in('evidence_id', evidenceIds),
            supabase.from('evidence_locations').select('evidence_id, location_id').in('evidence_id', evidenceIds),
            supabase.from('evidence_kpi_updates').select('evidence_id, kpi_update_id').in('evidence_id', evidenceIds),
            MetricTagService.getTagIdsForEvidences(evidenceIds),
            BeneficiaryService.getBenGroupsForEvidence(evidenceIds),
        ])

        const kpiIdsByEv: Record<string, string[]> = {}
        ;(kpiLinks || []).forEach((l: any) => {
            if (!kpiIdsByEv[l.evidence_id]) kpiIdsByEv[l.evidence_id] = []
            kpiIdsByEv[l.evidence_id].push(l.kpi_id)
        })
        const locIdsByEv: Record<string, string[]> = {}
        ;(locLinks || []).forEach((l: any) => {
            if (!locIdsByEv[l.evidence_id]) locIdsByEv[l.evidence_id] = []
            locIdsByEv[l.evidence_id].push(l.location_id)
        })
        const existingByEv: Record<string, Set<string>> = {}
        ;(existingUpdateLinks || []).forEach((l: any) => {
            if (!existingByEv[l.evidence_id]) existingByEv[l.evidence_id] = new Set()
            existingByEv[l.evidence_id].add(l.kpi_update_id)
        })

        // Pull every claim for these initiatives once (org-scoped).
        const { data: kpisRows } = await supabase
            .from('kpis')
            .select('id')
            .in('initiative_id', initiativeIds)
        const kpiIds = (kpisRows || []).map((k: any) => k.id)
        const { data: claimRows } = await supabase
            .from('kpi_updates')
            .select('id, kpi_id, location_id, date_represented, date_range_start, date_range_end')
            .in('kpi_id', kpiIds.length > 0 ? kpiIds : ['00000000-0000-0000-0000-000000000000'])
        const claims = (claimRows || []) as any[]
        const claimIds = claims.map(c => c.id)

        const [updateBgMap, updateTagMap] = claimIds.length > 0
            ? await Promise.all([
                BeneficiaryService.getBenGroupsForUpdates(claimIds),
                MetricTagService.getTagIdsForUpdates(claimIds),
            ])
            : [{} as Record<string, string[]>, {} as Record<string, string | null>]

        const claimsByKpi: Record<string, any[]> = {}
        claims.forEach(c => {
            if (!claimsByKpi[c.kpi_id]) claimsByKpi[c.kpi_id] = []
            claimsByKpi[c.kpi_id].push(c)
        })

        const datesOverlap = (s1: string, e1: string | null, s2: string, e2: string | null): boolean => {
            const end1 = e1 || s1
            const end2 = e2 || s2
            return s1 <= end2 && s2 <= end1
        }

        const linksToCreate: { evidence_id: string; kpi_update_id: string; user_id: string }[] = []
        const linksToPrune: { evidence_id: string; kpi_update_id: string }[] = []

        for (const ev of evidenceList) {
            const kpiIdList = kpiIdsByEv[ev.id] || []
            const evLocIds = locIdsByEv[ev.id] || []
            const evTagIds = evidenceTagMap[ev.id] || []
            const evBgIds = evidenceBgMap[ev.id] || []
            const evStart = (ev.date_range_start || ev.date_represented || '') as string
            const evEnd = (ev.date_range_end || null) as string | null
            const alreadyLinked = existingByEv[ev.id] || new Set<string>()

            // Candidate claims = union of every KPI this evidence is linked to.
            const candidateClaims: any[] = []
            for (const kid of kpiIdList) {
                const list = claimsByKpi[kid]
                if (list) candidateClaims.push(...list)
            }

            for (const claim of candidateClaims) {
                const claimStart = (claim.date_range_start || claim.date_represented || '') as string
                const claimEnd = (claim.date_range_end || null) as string | null
                const passes =
                    !!evStart && !!claimStart &&
                    datesOverlap(evStart, evEnd, claimStart, claimEnd) &&
                    !!claim.location_id && evLocIds.includes(claim.location_id) &&
                    BeneficiaryService.beneficiaryGroupsMatch(updateBgMap[claim.id] || [], evBgIds) &&
                    MetricTagService.evidenceMatchesClaimTag(updateTagMap[claim.id] ?? null, evTagIds)

                if (passes && !alreadyLinked.has(claim.id)) {
                    linksToCreate.push({ evidence_id: ev.id, kpi_update_id: claim.id, user_id: userId })
                }
            }

            // Prune any existing link that fails the current gates.
            // IMPORTANT: prune only when a constraint EXISTS and isn't met.
            // If the claim or evidence has a null gate value (legacy data —
            // null location_id, no ben groups, no tag), treat that gate as
            // "no constraint" and leave the existing link alone. Otherwise
            // we'd nuke every historical link the moment a claim slips into
            // a partial state (e.g. its location was deleted and FK set null).
            for (const linkedClaimId of alreadyLinked) {
                const claim = claims.find(c => c.id === linkedClaimId)
                if (!claim) continue // claim deleted — let FK handle it
                const claimStart = (claim.date_range_start || claim.date_represented || '') as string
                const claimEnd = (claim.date_range_end || null) as string | null

                // Date check: only prune if BOTH have dates AND they don't overlap.
                if (evStart && claimStart && !datesOverlap(evStart, evEnd, claimStart, claimEnd)) {
                    linksToPrune.push({ evidence_id: ev.id, kpi_update_id: claim.id })
                    continue
                }

                // Location check: only prune if claim HAS a location and evidence
                // doesn't include it. Null claim location = no location constraint.
                if (claim.location_id && evLocIds.length > 0 && !evLocIds.includes(claim.location_id)) {
                    linksToPrune.push({ evidence_id: ev.id, kpi_update_id: claim.id })
                    continue
                }

                // Ben groups + tag use service helpers that already treat
                // missing values as "no constraint" gracefully.
                if (!BeneficiaryService.beneficiaryGroupsMatch(updateBgMap[claim.id] || [], evBgIds)) {
                    linksToPrune.push({ evidence_id: ev.id, kpi_update_id: claim.id })
                    continue
                }
                if (!MetricTagService.evidenceMatchesClaimTag(updateTagMap[claim.id] ?? null, evTagIds)) {
                    linksToPrune.push({ evidence_id: ev.id, kpi_update_id: claim.id })
                    continue
                }
            }
        }

        // Bulk apply mutations.
        if (linksToCreate.length > 0) {
            // Insert in chunks to stay under PostgREST's row limit.
            for (let i = 0; i < linksToCreate.length; i += 500) {
                const chunk = linksToCreate.slice(i, i + 500)
                const { error } = await supabase.from('evidence_kpi_updates').insert(chunk)
                if (error) console.error('backfill insert error:', error.message)
            }
        }

        for (const stale of linksToPrune) {
            await supabase
                .from('evidence_kpi_updates')
                .delete()
                .eq('evidence_id', stale.evidence_id)
                .eq('kpi_update_id', stale.kpi_update_id)
        }

        return {
            linksCreated: linksToCreate.length,
            linksPruned: linksToPrune.length,
            evidenceProcessed: evidenceList.length,
            claimsScanned: claims.length,
        }
    }
} 