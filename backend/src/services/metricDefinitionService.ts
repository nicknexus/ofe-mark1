import { supabase } from '../utils/supabase';
import { MetricDefinition, MetricDefinitionWithUsage } from '../types';
import { InitiativeService } from './initiativeService';
import { OrgAccessService } from './orgAccessService';
import { PermissionService } from './permissionService';
import { MetricTagService } from './metricTagService';
import { EntitlementService } from './entitlementService';
import { aggregateKpiUpdates } from '../utils/kpiAggregation';

/**
 * Org-global metrics.
 *
 * A `metric_definitions` row is the metric itself ("Meals Provided"). A `kpis`
 * row is that metric in use inside one initiative, and owns the claims. The
 * identity fields (title / description / type / unit / category) live here and
 * are mirrored down onto every kpis row by a DB trigger, so the rest of the
 * codebase keeps reading them off `kpis` exactly as before.
 *
 * Removing a metric from an initiative ARCHIVES the kpis row rather than
 * deleting it — a claim belongs to exactly one metric, so deleting would take
 * the impact history with it. Re-attaching un-archives and restores everything.
 */
export class MetricDefinitionService {
    static generateSlug(title: string): string {
        return (title || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
            .replace(/^-+|-+$/g, '') || 'metric';
    }

    private static async getOrgId(userId: string, requestedOrgId?: string): Promise<string | null> {
        return InitiativeService.getEffectiveOrganizationId(userId, requestedOrgId);
    }

    /**
     * First free slug for `title` within the org. The DB has a unique index on
     * (organization_id, slug); this keeps us from ever hitting it.
     */
    private static async uniqueSlug(orgId: string, title: string, excludeId?: string): Promise<string> {
        const base = this.generateSlug(title);
        const { data } = await supabase
            .from('metric_definitions')
            .select('id, slug')
            .eq('organization_id', orgId)
            .like('slug', `${base}%`);

        const taken = new Set(
            (data || []).filter((r: any) => r.id !== excludeId).map((r: any) => r.slug)
        );
        if (!taken.has(base)) return base;

        let n = 2;
        while (taken.has(`${base}-${n}`)) n += 1;
        return `${base}-${n}`;
    }

    /**
     * Title uniqueness is enforced here rather than in the database: existing
     * orgs have duplicate titles across initiatives (the very thing this
     * feature lets them fix), and a DB constraint would have forced the
     * migration to rename live metrics.
     */
    private static async assertTitleFree(orgId: string, title: string, excludeId?: string): Promise<void> {
        const clean = (title || '').trim();
        if (!clean) throw new Error('Metric title is required');

        const { data } = await supabase
            .from('metric_definitions')
            .select('id')
            .eq('organization_id', orgId)
            .ilike('title', clean);

        const clash = (data || []).some((r: any) => r.id !== excludeId);
        if (clash) {
            throw new Error(`Your organization already has a metric called "${clean}"`);
        }
    }

    /**
     * All of the org's metrics, each with the initiatives using it and an
     * org-wide total.
     *
     * The total is computed over the pooled claims, never by summing the
     * per-initiative totals: percentage metrics are averaged
     * (`aggregateKpiUpdates`), and a mean of means is wrong.
     */
    static async getAll(userId: string, requestedOrgId?: string): Promise<MetricDefinitionWithUsage[]> {
        const orgId = await this.getOrgId(userId, requestedOrgId);
        if (!orgId) return [];

        const { data: definitions, error } = await supabase
            .from('metric_definitions')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: true });

        if (error) throw new Error(`Failed to fetch metrics: ${error.message}`);
        if (!definitions || definitions.length === 0) return [];

        // Only initiatives the caller can actually see.
        const initiatives = await InitiativeService.getAll(userId, requestedOrgId);
        const initiativeById = new Map(initiatives.map((i: any) => [i.id, i]));

        const { data: instances, error: instancesError } = await supabase
            .from('kpis')
            .select('id, definition_id, initiative_id, display_order, kpi_updates(id, value, date_represented)')
            .in('definition_id', definitions.map((d: any) => d.id))
            .is('archived_at', null);

        // Swallowing this would silently render every metric as "Not in use
        // yet" — indistinguishable from a genuinely unattached metric.
        if (instancesError) {
            throw new Error(`Failed to fetch metric usage: ${instancesError.message}`);
        }

        const byDefinition = new Map<string, any[]>();
        for (const row of (instances || [])) {
            if (!initiativeById.has(row.initiative_id)) continue;
            const arr = byDefinition.get(row.definition_id) || [];
            arr.push(row);
            byDefinition.set(row.definition_id, arr);
        }

        const tagsByDefinition = await MetricTagService.getTagIdsForDefinitions(
            definitions.map((d: any) => d.id)
        );

        return definitions.map((def: any) => {
            const rows = byDefinition.get(def.id) || [];
            const pooledUpdates = rows.flatMap((r: any) => r.kpi_updates || []);

            return {
                ...def,
                tag_ids: tagsByDefinition[def.id] || [],
                total_value: aggregateKpiUpdates(pooledUpdates, def.metric_type),
                update_count: pooledUpdates.length,
                initiative_count: rows.length,
                initiatives: rows
                    .map((r: any) => {
                        const initiative: any = initiativeById.get(r.initiative_id);
                        return {
                            kpi_id: r.id,
                            initiative_id: r.initiative_id,
                            initiative_title: initiative?.title || 'Untitled',
                            initiative_slug: initiative?.slug,
                            total_value: aggregateKpiUpdates(r.kpi_updates || [], def.metric_type),
                            update_count: (r.kpi_updates || []).length,
                        };
                    })
                    .sort((a, b) => a.initiative_title.localeCompare(b.initiative_title)),
            };
        });
    }

    static async getById(
        id: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<MetricDefinitionWithUsage | null> {
        const all = await this.getAll(userId, requestedOrgId);
        return all.find(d => d.id === id) || null;
    }

    /**
     * Create a definition, optionally instantiating it into initiatives right
     * away. Creating with no initiatives is deliberate and supported — the
     * metric exists at org level and can be attached later.
     */
    static async create(
        input: Partial<MetricDefinition> & { initiative_ids?: string[]; tag_ids?: string[] },
        userId: string,
        requestedOrgId?: string
    ): Promise<MetricDefinitionWithUsage> {
        const orgId = await this.getOrgId(userId, requestedOrgId);
        if (!orgId) throw new Error('No organization context');

        await PermissionService.assert(userId, requestedOrgId, 'metrics', 'create', {});

        const title = (input.title || '').trim();
        await this.assertTitleFree(orgId, title);

        const slug = await this.uniqueSlug(orgId, title);

        const { data, error } = await supabase
            .from('metric_definitions')
            .insert([{
                organization_id: orgId,
                title,
                slug,
                description: input.description || '',
                metric_type: input.metric_type || 'number',
                unit_of_measurement: input.unit_of_measurement || '',
                category: input.category || 'output',
                created_by: userId,
            }])
            .select()
            .single();

        if (error) throw new Error(`Failed to create metric: ${error.message}`);

        if (Array.isArray(input.tag_ids)) {
            await MetricTagService.replaceTagsForDefinition(data.id, input.tag_ids, userId, requestedOrgId);
        }

        for (const initiativeId of (input.initiative_ids || [])) {
            await this.attachToInitiative(data.id, initiativeId, userId, requestedOrgId);
        }

        return (await this.getById(data.id, userId, requestedOrgId))!;
    }

    /**
     * Rename / re-describe a metric. Applies everywhere it is used — the DB
     * trigger mirrors the change onto every instance, including archived ones.
     */
    static async update(
        id: string,
        updates: Partial<MetricDefinition> & { tag_ids?: string[] },
        userId: string,
        requestedOrgId?: string
    ): Promise<MetricDefinitionWithUsage> {
        const orgId = await this.getOrgId(userId, requestedOrgId);
        if (!orgId) throw new Error('No organization context');

        const { data: existing } = await supabase
            .from('metric_definitions')
            .select('*')
            .eq('id', id)
            .eq('organization_id', orgId)
            .maybeSingle();

        if (!existing) throw new Error('Metric not found or access denied');

        await PermissionService.assert(userId, requestedOrgId, 'metrics', 'edit', { resourceId: id });

        const patch: any = {};
        if (typeof updates.title === 'string' && updates.title.trim() !== existing.title) {
            const title = updates.title.trim();
            await this.assertTitleFree(orgId, title, id);
            patch.title = title;
            // The slug is part of the public URL. Renaming moves the page —
            // same behaviour initiatives already have.
            patch.slug = await this.uniqueSlug(orgId, title, id);
        }
        if (updates.description !== undefined) patch.description = updates.description;
        if (updates.metric_type !== undefined) patch.metric_type = updates.metric_type;
        if (updates.unit_of_measurement !== undefined) patch.unit_of_measurement = updates.unit_of_measurement;
        if (updates.category !== undefined) patch.category = updates.category;

        if (Object.keys(patch).length > 0) {
            const { error } = await supabase
                .from('metric_definitions')
                .update(patch)
                .eq('id', id);
            if (error) throw new Error(`Failed to update metric: ${error.message}`);
        }

        if (Array.isArray(updates.tag_ids)) {
            await MetricTagService.replaceTagsForDefinition(id, updates.tag_ids, userId, requestedOrgId);
        }

        return (await this.getById(id, userId, requestedOrgId))!;
    }

    /**
     * Put the metric into an initiative. Creates the kpis instance, or
     * un-archives the existing one so its claim history comes back.
     */
    static async attachToInitiative(
        definitionId: string,
        initiativeId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<any> {
        const orgId = await this.getOrgId(userId, requestedOrgId);
        if (!orgId) throw new Error('No organization context');

        await OrgAccessService.assertInitiativeAccess(initiativeId, userId, requestedOrgId);
        await PermissionService.assert(userId, requestedOrgId, 'metrics', 'create', { initiativeId });

        const { data: definition } = await supabase
            .from('metric_definitions')
            .select('*')
            .eq('id', definitionId)
            .eq('organization_id', orgId)
            .maybeSingle();

        if (!definition) throw new Error('Metric not found or access denied');

        // Already present (possibly archived) — restore rather than insert.
        const { data: existing } = await supabase
            .from('kpis')
            .select('id, archived_at')
            .eq('definition_id', definitionId)
            .eq('initiative_id', initiativeId)
            .maybeSingle();

        if (existing) {
            if (existing.archived_at) {
                const { data, error } = await supabase
                    .from('kpis')
                    .update({ archived_at: null })
                    .eq('id', existing.id)
                    .select()
                    .single();
                if (error) throw new Error(`Failed to restore metric: ${error.message}`);
                await MetricTagService.mirrorDefinitionTagsToKpi(data.id, definitionId, userId)
                return data;
            }
            return existing;
        }

        const { data: last } = await supabase
            .from('kpis')
            .select('display_order')
            .eq('initiative_id', initiativeId)
            .order('display_order', { ascending: false })
            .limit(1)
            .maybeSingle();

        const { data, error } = await supabase
            .from('kpis')
            .insert([{
                definition_id: definitionId,
                initiative_id: initiativeId,
                // Mirrored from the definition; the trigger keeps them in step.
                title: definition.title,
                description: definition.description || '',
                metric_type: definition.metric_type,
                unit_of_measurement: definition.unit_of_measurement,
                category: definition.category,
                user_id: userId,
                display_order: ((last as any)?.display_order ?? 0) + 1,
            }])
            .select()
            .single();

        if (error) throw new Error(`Failed to add metric to program: ${error.message}`);

        // Mirror definition tags onto the new instance so claim-tag validation
        // (and the upload wizard filter) see the same tag set as the metric.
        await MetricTagService.mirrorDefinitionTagsToKpi(data.id, definitionId, userId)

        return data;
    }

    /**
     * Remove the metric from one initiative. Archives — claims and evidence
     * links survive untouched, and re-attaching brings them back.
     */
    static async detachFromInitiative(
        definitionId: string,
        initiativeId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<void> {
        const orgId = await this.getOrgId(userId, requestedOrgId);
        if (!orgId) throw new Error('No organization context');

        await OrgAccessService.assertInitiativeAccess(initiativeId, userId, requestedOrgId);
        await PermissionService.assert(userId, requestedOrgId, 'metrics', 'delete', { initiativeId });

        const { data: definition } = await supabase
            .from('metric_definitions')
            .select('id')
            .eq('id', definitionId)
            .eq('organization_id', orgId)
            .maybeSingle();

        if (!definition) throw new Error('Metric not found or access denied');

        const { error } = await supabase
            .from('kpis')
            .update({ archived_at: new Date().toISOString() })
            .eq('definition_id', definitionId)
            .eq('initiative_id', initiativeId);

        if (error) throw new Error(`Failed to remove metric from program: ${error.message}`);
    }

    /**
     * How much impact history a detach would hide, so the confirmation can
     * state it. Counts claims, and evidence links that would go quiet with them.
     */
    static async getDetachImpact(
        definitionId: string,
        initiativeId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<{ claim_count: number; evidence_count: number }> {
        await OrgAccessService.assertInitiativeAccess(initiativeId, userId, requestedOrgId);

        const { data: kpi } = await supabase
            .from('kpis')
            .select('id')
            .eq('definition_id', definitionId)
            .eq('initiative_id', initiativeId)
            .maybeSingle();

        if (!kpi) return { claim_count: 0, evidence_count: 0 };

        const [{ count: claimCount }, { count: evidenceCount }] = await Promise.all([
            supabase.from('kpi_updates').select('id', { count: 'exact', head: true }).eq('kpi_id', kpi.id),
            supabase.from('evidence_kpis').select('id', { count: 'exact', head: true }).eq('kpi_id', kpi.id),
        ]);

        return { claim_count: claimCount || 0, evidence_count: evidenceCount || 0 };
    }

    /**
     * Delete the metric everywhere, permanently. Cascades to every instance
     * and therefore to every claim. This is the destructive path that
     * archiving exists to avoid — callers must confirm explicitly.
     */
    static async delete(id: string, userId: string, requestedOrgId?: string): Promise<void> {
        const orgId = await this.getOrgId(userId, requestedOrgId);
        if (!orgId) throw new Error('No organization context');

        const { data: existing } = await supabase
            .from('metric_definitions')
            .select('id')
            .eq('id', id)
            .eq('organization_id', orgId)
            .maybeSingle();

        if (!existing) throw new Error('Metric not found or access denied');

        await PermissionService.assert(userId, requestedOrgId, 'metrics', 'delete', { resourceId: id });

        const { error } = await supabase.from('metric_definitions').delete().eq('id', id);
        if (error) throw new Error(`Failed to delete metric: ${error.message}`);
    }

    /**
     * Public payload for one org-global metric: the pooled total plus the
     * per-initiative breakdown that lets a visitor pick which initiative to
     * view it from.
     *
     * Plan-hidden initiatives are dropped BEFORE aggregating so gated data
     * never leaks into the org-wide number.
     */
    static async getPublicBySlug(orgSlug: string, metricSlug: string, allowPrivate = false): Promise<any | null> {
        let orgQuery = supabase
            .from('organizations')
            .select('id, name, slug, is_public, logo_url, brand_color')
            .eq('slug', orgSlug);
        if (!allowPrivate) orgQuery = orgQuery.eq('is_public', true);

        const { data: org } = await orgQuery.maybeSingle();
        if (!org) return null;

        const { data: definition } = await supabase
            .from('metric_definitions')
            .select('*')
            .eq('organization_id', org.id)
            .eq('slug', metricSlug)
            .maybeSingle();

        if (!definition) return null;

        // Visibility follows the org, not the initiative — same rule as
        // PublicService.getInitiativeBySlug ("if org is public, all its
        // initiatives are visible"). Gating on initiatives.is_public here
        // would 404 metrics that the org page happily lists.
        const { data: instances, error: instancesError } = await supabase
            .from('kpis')
            .select(`
                id, initiative_id, display_order,
                initiatives!inner(id, slug, title, organization_id),
                kpi_updates(id, value, date_represented, date_range_start, date_range_end, location_id, note)
            `)
            .eq('definition_id', definition.id)
            .eq('initiatives.organization_id', org.id)
            .is('archived_at', null);

        if (instancesError) {
            throw new Error(`Failed to fetch metric usage: ${instancesError.message}`);
        }

        // Plan gate: an org over its initiative limit only exposes the oldest N.
        let rows = instances || [];
        const ent = await EntitlementService.getForOrg(org.id);
        if (ent.allowedInitiativeIds !== null) {
            const allowed = new Set(ent.allowedInitiativeIds);
            rows = rows.filter((r: any) => allowed.has(r.initiative_id));
        }

        if (rows.length === 0) return null;

        const pooledUpdates = rows.flatMap((r: any) =>
            (r.kpi_updates || []).map((u: any) => ({
                ...u,
                initiative_id: r.initiative_id,
                initiative_slug: r.initiatives?.slug,
                initiative_title: r.initiatives?.title,
            }))
        );

        return {
            id: definition.id,
            title: definition.title,
            slug: definition.slug,
            description: definition.description,
            metric_type: definition.metric_type,
            unit_of_measurement: definition.unit_of_measurement,
            category: definition.category,
            org_slug: org.slug,
            organization_name: org.name,
            organization_logo_url: org.logo_url || undefined,
            organization_brand_color: org.brand_color || undefined,
            total_value: aggregateKpiUpdates(pooledUpdates, definition.metric_type),
            update_count: pooledUpdates.length,
            initiatives: rows
                .map((r: any) => ({
                    initiative_id: r.initiative_id,
                    initiative_slug: r.initiatives?.slug,
                    initiative_title: r.initiatives?.title,
                    total_value: aggregateKpiUpdates(r.kpi_updates || [], definition.metric_type),
                    update_count: (r.kpi_updates || []).length,
                }))
                .sort((a: any, b: any) => b.total_value - a.total_value),
            updates: pooledUpdates
                .map((u: any) => ({
                    id: u.id,
                    value: u.value,
                    date_represented: u.date_represented,
                    date_range_start: u.date_range_start,
                    date_range_end: u.date_range_end,
                    location_id: u.location_id || undefined,
                    note: u.note || undefined,
                    initiative_id: u.initiative_id,
                    initiative_slug: u.initiative_slug,
                    initiative_title: u.initiative_title,
                }))
                .sort((a: any, b: any) =>
                    String(b.date_represented || '').localeCompare(String(a.date_represented || ''))
                ),
        };
    }
}
