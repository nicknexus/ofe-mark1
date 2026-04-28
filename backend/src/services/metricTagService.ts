import { supabase } from '../utils/supabase'
import { MetricTag } from '../types'
import { InitiativeService } from './initiativeService'

export class MetricTagService {
    /**
     * Resolve the org context for the caller. Mirrors InitiativeService.
     */
    private static async getOrgId(userId: string, requestedOrgId?: string): Promise<string | null> {
        return InitiativeService.getEffectiveOrganizationId(userId, requestedOrgId)
    }

    static async getAll(userId: string, requestedOrgId?: string): Promise<MetricTag[]> {
        const orgId = await this.getOrgId(userId, requestedOrgId)
        if (!orgId) return []

        const { data, error } = await supabase
            .from('metric_tags')
            .select('*')
            .eq('organization_id', orgId)
            .order('name', { ascending: true })

        if (error) throw new Error(`Failed to fetch metric tags: ${error.message}`)
        return data || []
    }

    /**
     * Returns all org tags with usage counts (KPIs attached, claims attached).
     */
    static async getAllWithCounts(userId: string, requestedOrgId?: string): Promise<MetricTag[]> {
        const orgId = await this.getOrgId(userId, requestedOrgId)
        if (!orgId) return []

        const { data: tags, error } = await supabase
            .from('metric_tags')
            .select('*')
            .eq('organization_id', orgId)
            .order('name', { ascending: true })

        if (error) throw new Error(`Failed to fetch metric tags: ${error.message}`)
        if (!tags || tags.length === 0) return []

        const tagIds = tags.map((t: any) => t.id)

        const [{ data: kpiLinks }, { data: claimLinks }] = await Promise.all([
            supabase.from('kpi_metric_tags').select('tag_id, kpi_id').in('tag_id', tagIds),
            supabase.from('kpi_update_metric_tags').select('tag_id, kpi_update_id').in('tag_id', tagIds),
        ])

        const metricCount: Record<string, number> = {}
        const claimCount: Record<string, number> = {}
        for (const l of (kpiLinks || [])) {
            metricCount[l.tag_id] = (metricCount[l.tag_id] || 0) + 1
        }
        for (const l of (claimLinks || [])) {
            claimCount[l.tag_id] = (claimCount[l.tag_id] || 0) + 1
        }

        return tags.map((t: any) => ({
            ...t,
            metric_count: metricCount[t.id] || 0,
            claim_count: claimCount[t.id] || 0,
        }))
    }

    static async getById(id: string, userId: string, requestedOrgId?: string): Promise<MetricTag | null> {
        const orgId = await this.getOrgId(userId, requestedOrgId)
        if (!orgId) return null

        const { data, error } = await supabase
            .from('metric_tags')
            .select('*')
            .eq('id', id)
            .eq('organization_id', orgId)
            .maybeSingle()

        if (error) throw new Error(`Failed to fetch metric tag: ${error.message}`)
        return data
    }

    /**
     * Create a tag (or return existing one if name collides case-insensitively).
     * This is idempotent so the frontend can "create or select" easily.
     */
    static async create(name: string, userId: string, requestedOrgId?: string): Promise<MetricTag> {
        const orgId = await this.getOrgId(userId, requestedOrgId)
        if (!orgId) throw new Error('No organization context')

        const cleanName = (name || '').trim()
        if (!cleanName) throw new Error('Tag name is required')

        // Case-insensitive lookup first.
        const { data: existing } = await supabase
            .from('metric_tags')
            .select('*')
            .eq('organization_id', orgId)
            .ilike('name', cleanName)
            .maybeSingle()

        if (existing) return existing

        const { data, error } = await supabase
            .from('metric_tags')
            .insert([{
                organization_id: orgId,
                name: cleanName,
                created_by: userId,
            }])
            .select()
            .single()

        if (error) throw new Error(`Failed to create metric tag: ${error.message}`)
        return data
    }

    static async update(id: string, updates: Partial<MetricTag>, userId: string, requestedOrgId?: string): Promise<MetricTag> {
        const tag = await this.getById(id, userId, requestedOrgId)
        if (!tag) throw new Error('Metric tag not found or access denied')

        const safeUpdates: any = { updated_at: new Date().toISOString() }
        if (typeof updates.name === 'string') safeUpdates.name = updates.name.trim()
        if (updates.color !== undefined) safeUpdates.color = updates.color
        // parent_id / is_public are reserved; allow but unused in v1.
        if (updates.parent_id !== undefined) safeUpdates.parent_id = updates.parent_id
        if (updates.is_public !== undefined) safeUpdates.is_public = updates.is_public

        const { data, error } = await supabase
            .from('metric_tags')
            .update(safeUpdates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw new Error(`Failed to update metric tag: ${error.message}`)
        return data
    }

    /**
     * Delete a tag. Cascades via FKs:
     *   - kpi_metric_tags rows for this tag are removed.
     *   - kpi_update_metric_tags rows for this tag are removed (claims become untagged).
     */
    static async delete(id: string, userId: string, requestedOrgId?: string): Promise<void> {
        const tag = await this.getById(id, userId, requestedOrgId)
        if (!tag) throw new Error('Metric tag not found or access denied')

        const { error } = await supabase.from('metric_tags').delete().eq('id', id)
        if (error) throw new Error(`Failed to delete metric tag: ${error.message}`)
    }

    /**
     * Replace the set of tags attached to a KPI.
     * Cascades to claims: any kpi_update_metric_tags row for this KPI's
     * updates pointing to a tag no longer in `tagIds` is deleted.
     */
    static async replaceTagsForKpi(kpiId: string, tagIds: string[], userId: string, requestedOrgId?: string): Promise<void> {
        const orgId = await this.getOrgId(userId, requestedOrgId)
        if (!orgId) throw new Error('No organization context')

        // Validate every tag belongs to the caller's org.
        if (tagIds.length > 0) {
            const { data: validTags } = await supabase
                .from('metric_tags')
                .select('id')
                .eq('organization_id', orgId)
                .in('id', tagIds)
            const validIds = new Set((validTags || []).map((t: any) => t.id))
            const invalid = tagIds.filter(id => !validIds.has(id))
            if (invalid.length > 0) {
                throw new Error(`Invalid metric tag IDs: ${invalid.join(', ')}`)
            }
        }

        // Replace links.
        await supabase.from('kpi_metric_tags').delete().eq('kpi_id', kpiId)

        if (tagIds.length > 0) {
            const links = tagIds.map(tag_id => ({ kpi_id: kpiId, tag_id }))
            const { error } = await supabase.from('kpi_metric_tags').insert(links)
            if (error) throw new Error(`Failed to attach tags to KPI: ${error.message}`)
        }

        // Cascade: drop claim->tag links for this KPI's updates pointing to
        // tags no longer attached to the KPI. Done programmatically to avoid
        // PostgREST `not in` formatting quirks with UUID arrays.
        const { data: updates } = await supabase
            .from('kpi_updates')
            .select('id')
            .eq('kpi_id', kpiId)

        const updateIds = (updates || []).map((u: any) => u.id)
        if (updateIds.length > 0) {
            if (tagIds.length === 0) {
                await supabase
                    .from('kpi_update_metric_tags')
                    .delete()
                    .in('kpi_update_id', updateIds)
            } else {
                const { data: existingClaimLinks } = await supabase
                    .from('kpi_update_metric_tags')
                    .select('id, tag_id')
                    .in('kpi_update_id', updateIds)
                const allowed = new Set(tagIds)
                const orphanIds = (existingClaimLinks || [])
                    .filter((l: any) => !allowed.has(l.tag_id))
                    .map((l: any) => l.id)
                if (orphanIds.length > 0) {
                    await supabase
                        .from('kpi_update_metric_tags')
                        .delete()
                        .in('id', orphanIds)
                }
            }
        }
    }

    static async getTagIdsForKpi(kpiId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('kpi_metric_tags')
            .select('tag_id')
            .eq('kpi_id', kpiId)
        if (error) throw new Error(`Failed to fetch KPI tags: ${error.message}`)
        return (data || []).map((r: any) => r.tag_id)
    }

    /**
     * Bulk fetch tag_ids per kpi.
     */
    static async getTagIdsForKpis(kpiIds: string[]): Promise<Record<string, string[]>> {
        if (kpiIds.length === 0) return {}
        const { data } = await supabase
            .from('kpi_metric_tags')
            .select('kpi_id, tag_id')
            .in('kpi_id', kpiIds)
        const map: Record<string, string[]> = {}
        for (const id of kpiIds) map[id] = []
        for (const row of (data || [])) {
            if (!map[row.kpi_id]) map[row.kpi_id] = []
            map[row.kpi_id].push(row.tag_id)
        }
        return map
    }

    /**
     * Set or clear the single tag attached to a kpi_update.
     * tagId === null clears it. Otherwise tag must be in the parent KPI's tags.
     */
    static async setTagForUpdate(updateId: string, tagId: string | null, kpiId: string): Promise<void> {
        if (tagId === null || tagId === undefined || tagId === '') {
            await supabase.from('kpi_update_metric_tags').delete().eq('kpi_update_id', updateId)
            return
        }

        // Validate the tag is on the parent KPI.
        const { data: link } = await supabase
            .from('kpi_metric_tags')
            .select('id')
            .eq('kpi_id', kpiId)
            .eq('tag_id', tagId)
            .maybeSingle()
        if (!link) throw new Error('Tag is not attached to the parent metric')

        // Upsert (UNIQUE on kpi_update_id enforces single tag).
        await supabase.from('kpi_update_metric_tags').delete().eq('kpi_update_id', updateId)
        const { error } = await supabase
            .from('kpi_update_metric_tags')
            .insert([{ kpi_update_id: updateId, tag_id: tagId }])
        if (error) throw new Error(`Failed to attach tag to claim: ${error.message}`)
    }

    static async getTagIdForUpdate(updateId: string): Promise<string | null> {
        const { data } = await supabase
            .from('kpi_update_metric_tags')
            .select('tag_id')
            .eq('kpi_update_id', updateId)
            .maybeSingle()
        return (data as any)?.tag_id || null
    }

    static async getTagIdsForUpdates(updateIds: string[]): Promise<Record<string, string | null>> {
        const map: Record<string, string | null> = {}
        for (const id of updateIds) map[id] = null
        if (updateIds.length === 0) return map
        const { data } = await supabase
            .from('kpi_update_metric_tags')
            .select('kpi_update_id, tag_id')
            .in('kpi_update_id', updateIds)
        for (const row of (data || [])) {
            map[row.kpi_update_id] = row.tag_id
        }
        return map
    }

    /**
     * Replace the set of tags attached to a piece of evidence (multi-tag).
     * Independent of the metric ↔ tag relationship: tagging evidence does not
     * imply or require the evidence's supported metrics to have those tags.
     */
    static async setTagsForEvidence(evidenceId: string, tagIds: string[], userId: string, requestedOrgId?: string): Promise<void> {
        const orgId = await this.getOrgId(userId, requestedOrgId)
        if (!orgId) throw new Error('No organization context')

        if (tagIds.length > 0) {
            const { data: validTags } = await supabase
                .from('metric_tags')
                .select('id')
                .eq('organization_id', orgId)
                .in('id', tagIds)
            const validIds = new Set((validTags || []).map((t: any) => t.id))
            const invalid = tagIds.filter(id => !validIds.has(id))
            if (invalid.length > 0) {
                throw new Error(`Invalid metric tag IDs: ${invalid.join(', ')}`)
            }
        }

        await supabase.from('evidence_metric_tags').delete().eq('evidence_id', evidenceId)

        if (tagIds.length > 0) {
            const links = tagIds.map(tag_id => ({ evidence_id: evidenceId, tag_id }))
            const { error } = await supabase.from('evidence_metric_tags').insert(links)
            if (error) throw new Error(`Failed to attach tags to evidence: ${error.message}`)
        }
    }

    static async getTagIdsForEvidence(evidenceId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('evidence_metric_tags')
            .select('tag_id')
            .eq('evidence_id', evidenceId)
        if (error) throw new Error(`Failed to fetch evidence tags: ${error.message}`)
        return (data || []).map((r: any) => r.tag_id)
    }

    /**
     * Bulk fetch tag_ids per evidence row.
     */
    static async getTagIdsForEvidences(evidenceIds: string[]): Promise<Record<string, string[]>> {
        const map: Record<string, string[]> = {}
        for (const id of evidenceIds) map[id] = []
        if (evidenceIds.length === 0) return map
        const { data } = await supabase
            .from('evidence_metric_tags')
            .select('evidence_id, tag_id')
            .in('evidence_id', evidenceIds)
        for (const row of (data || [])) {
            if (!map[row.evidence_id]) map[row.evidence_id] = []
            map[row.evidence_id].push(row.tag_id)
        }
        return map
    }

    /**
     * Detail data for a single tag: list of KPIs attached and their claim totals
     * scoped to claims tagged with this tag.
     */
    static async getDetail(tagId: string, userId: string, requestedOrgId?: string) {
        const tag = await this.getById(tagId, userId, requestedOrgId)
        if (!tag) return null

        // KPIs that have this tag.
        const { data: links } = await supabase
            .from('kpi_metric_tags')
            .select('kpi_id, kpis(id, title, unit_of_measurement, metric_type, initiative_id)')
            .eq('tag_id', tagId)

        const kpis = (links || [])
            .map((l: any) => l.kpis)
            .filter(Boolean)

        // Claims tagged with this tag.
        const { data: claimLinks } = await supabase
            .from('kpi_update_metric_tags')
            .select('kpi_update_id, kpi_updates(id, kpi_id, value, date_represented, label, location_id, created_at)')
            .eq('tag_id', tagId)

        const claims = (claimLinks || [])
            .map((l: any) => l.kpi_updates)
            .filter(Boolean)

        // Evidence tagged with this tag.
        const { data: evidenceLinks } = await supabase
            .from('evidence_metric_tags')
            .select('evidence_id, evidence(id, title, description, type, file_url, file_urls, date_represented, initiative_id, kpi_ids, location_id, created_at)')
            .eq('tag_id', tagId)

        const evidence = (evidenceLinks || [])
            .map((l: any) => l.evidence)
            .filter(Boolean)

        // Authorize: only return KPIs/evidence whose initiative the caller can access.
        const accessibleInitiativeIds = new Set(
            (await InitiativeService.getAll(userId, requestedOrgId)).map((i: any) => i.id)
        )
        const accessibleKpis = kpis.filter((k: any) => accessibleInitiativeIds.has(k.initiative_id))
        const accessibleKpiIds = new Set(accessibleKpis.map((k: any) => k.id))
        const accessibleClaims = claims.filter((c: any) => accessibleKpiIds.has(c.kpi_id))
        const accessibleEvidence = evidence.filter((e: any) => accessibleInitiativeIds.has(e.initiative_id))

        return {
            tag,
            kpis: accessibleKpis,
            claims: accessibleClaims,
            evidence: accessibleEvidence,
        }
    }
}
