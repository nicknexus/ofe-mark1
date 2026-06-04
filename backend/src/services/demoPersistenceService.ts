import { supabase } from '../utils/supabase';
import { OrganizationService } from './organizationService';

export type GeneratedMetricType = 'number' | 'percentage';
export type GeneratedMetricCategory = 'input' | 'output' | 'impact';

export interface GeneratedStatCard {
    type: 'stat' | 'statement';
    value: string;
    title: string;
    description: string;
    source: string;
    source_url: string;
}

export interface GeneratedTitledItem {
    title: string;
    description: string;
}

export interface GeneratedLocation {
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    country: string;
}

export interface GeneratedBeneficiaryGroup {
    name: string;
    description: string;
    age_range_start: number | null;
    age_range_end: number | null;
    total_number: number | null;
}

export interface GeneratedKpiUpdate {
    value: number;
    date_represented: string;
    label: string;
    note: string;
    location_index: number;
    beneficiary_group_indexes: number[];
}

export interface GeneratedMetric {
    title: string;
    description: string;
    metric_type: GeneratedMetricType;
    unit_of_measurement: string;
    category: GeneratedMetricCategory;
    updates: GeneratedKpiUpdate[];
}

export interface GeneratedStory {
    title: string;
    description: string;
    date_represented: string;
    location_index: number;
    beneficiary_group_indexes: number[];
}

export interface GeneratedDemoDraft {
    organization: {
        name: string;
        description: string;
        statement: string;
        website_url: string;
        donation_url: string;
        logo_url: string;
        brand_color: string;
    };
    context: {
        problem_statement: string;
        theory_of_change: string;
        additional_info: string;
        stats_and_statements: GeneratedStatCard[];
        theory_of_change_stages: GeneratedTitledItem[];
        strategies: GeneratedTitledItem[];
    };
    initiative: {
        title: string;
        description: string;
        region: string;
        location: string;
    };
    locations: GeneratedLocation[];
    beneficiary_groups: GeneratedBeneficiaryGroup[];
    metrics: GeneratedMetric[];
    stories: GeneratedStory[];
}

interface CreateDemoOrgInput {
    name: string;
    userId: string;
    description?: string | null;
    statement?: string | null;
    website_url?: string | null;
    donation_url?: string | null;
    logo_url?: string | null;
    brand_color?: string | null;
}

function randomId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeString(value: unknown, maxLength?: number): string {
    const next = typeof value === 'string' ? value.trim() : '';
    return maxLength ? next.slice(0, maxLength) : next;
}

async function insertOrThrow(table: string, payload: any, context: string): Promise<any> {
    const { data, error } = await supabase
        .from(table)
        .insert([payload])
        .select()
        .single();

    if (error || !data) {
        throw new Error(`${context}: ${error?.message || 'insert returned no row'}`);
    }

    return data;
}

export class DemoPersistenceService {
    static async makeUniqueOrganizationSlug(name: string, excludeId?: string): Promise<string> {
        const baseSlug = OrganizationService.generateSlug(name) || 'demo';
        let slug = baseSlug;
        let attempt = 0;

        while (attempt < 100) {
            let query = supabase
                .from('organizations')
                .select('id')
                .eq('slug', slug);

            if (excludeId) {
                query = query.neq('id', excludeId);
            }

            const { data: check, error } = await query.maybeSingle();
            if (error) throw new Error(`Failed to check demo slug: ${error.message}`);
            if (!check) return slug;

            attempt++;
            slug = `${baseSlug}-${attempt}`;
        }

        return `${baseSlug}-${Date.now().toString().slice(-6)}`;
    }

    static async makeUniqueInitiativeSlug(title: string): Promise<string> {
        const baseSlug = `demo-${OrganizationService.generateSlug(title) || 'initiative'}`;
        for (let tries = 0; tries < 10; tries++) {
            const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
            const { data, error } = await supabase
                .from('initiatives')
                .select('id')
                .eq('slug', slug)
                .maybeSingle();
            if (error) throw new Error(`Failed to check initiative slug: ${error.message}`);
            if (!data) return slug;
        }
        return `${baseSlug}-${Date.now().toString().slice(-6)}`;
    }

    static async createDemoOrganization(input: CreateDemoOrgInput): Promise<any> {
        const name = safeString(input.name, 255);
        if (!name) throw new Error('Demo name is required');

        const slug = await this.makeUniqueOrganizationSlug(name);
        const { data: org, error } = await supabase
            .from('organizations')
            .insert([
                {
                    name,
                    slug,
                    description: input.description || null,
                    statement: input.statement || null,
                    website_url: input.website_url || null,
                    donation_url: input.donation_url || null,
                    logo_url: input.logo_url || null,
                    brand_color: input.brand_color || null,
                    owner_id: input.userId,
                    is_public: true,
                    is_demo: true,
                    demo_public_share: true,
                },
            ])
            .select()
            .single();

        if (error || !org) {
            throw new Error(`Failed to create demo org: ${error?.message || 'insert returned no row'}`);
        }

        await OrganizationService.addUserToOrganization(input.userId, org.id, 'owner');
        return org;
    }

    static async createGeneratedDemo(
        userId: string,
        draft: GeneratedDemoDraft,
        nameOverride?: string
    ): Promise<any> {
        const org = await this.createDemoOrganization({
            userId,
            name: safeString(nameOverride) || draft.organization.name,
            description: draft.organization.description,
            statement: draft.organization.statement,
            website_url: draft.organization.website_url,
            donation_url: draft.organization.donation_url,
            logo_url: draft.organization.logo_url,
            brand_color: draft.organization.brand_color,
        });

        try {
            await this.seedGeneratedContent(org.id, userId, draft);
            return org;
        } catch (error) {
            await supabase.from('organizations').delete().eq('id', org.id);
            throw error;
        }
    }

    /**
     * Populate an ALREADY-EXISTING demo org (created as a lightweight shell)
     * with generated content. Unlike createGeneratedDemo this never creates or
     * deletes the org — a generation failure leaves the editable shell intact so
     * the admin can retry. The org's name/slug are preserved (the admin already
     * named the shell); only profile fields are filled in from the draft.
     */
    static async populateExistingDemo(
        organizationId: string,
        userId: string,
        draft: GeneratedDemoDraft
    ): Promise<any> {
        const { error: updateErr } = await supabase
            .from('organizations')
            .update({
                description: draft.organization.description || null,
                statement: draft.organization.statement || null,
                website_url: draft.organization.website_url || null,
                donation_url: draft.organization.donation_url || null,
                logo_url: draft.organization.logo_url || null,
                brand_color: draft.organization.brand_color || null,
            })
            .eq('id', organizationId);
        if (updateErr) throw new Error(`Failed to update demo org profile: ${updateErr.message}`);

        await this.seedGeneratedContent(organizationId, userId, draft);

        const { data: org, error } = await supabase
            .from('organizations')
            .select()
            .eq('id', organizationId)
            .single();
        if (error || !org) throw new Error(`Failed to reload populated demo org: ${error?.message}`);
        return org;
    }

    static async seedGeneratedContent(
        organizationId: string,
        userId: string,
        draft: GeneratedDemoDraft
    ): Promise<{
        initiativeId: string;
        locationIds: string[];
        beneficiaryGroupIds: string[];
        kpiIds: string[];
        storyIds: string[];
    }> {
        const initiative = await insertOrThrow(
            'initiatives',
            {
                title: draft.initiative.title,
                description: draft.initiative.description,
                region: draft.initiative.region || null,
                location: draft.initiative.location || null,
                slug: await this.makeUniqueInitiativeSlug(draft.initiative.title),
                is_public: true,
                organization_id: organizationId,
                user_id: userId,
                display_order: 0,
            },
            'Failed to create generated initiative'
        );
        const initiativeId = initiative.id as string;

        const locationIds: string[] = [];
        for (let i = 0; i < draft.locations.length; i++) {
            const loc = draft.locations[i];
            const location = await insertOrThrow(
                'locations',
                {
                    name: loc.name,
                    description: loc.description || null,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    country: loc.country || null,
                    organization_id: organizationId,
                    initiative_id: initiativeId,
                    user_id: userId,
                    display_order: i,
                },
                'Failed to create generated location'
            );
            locationIds.push(location.id);

            const { error: linkErr } = await supabase
                .from('initiative_locations')
                .insert([{ initiative_id: initiativeId, location_id: location.id }]);
            if (linkErr) throw new Error(`Failed to link generated location: ${linkErr.message}`);
        }

        const beneficiaryGroupIds: string[] = [];
        for (let i = 0; i < draft.beneficiary_groups.length; i++) {
            const group = draft.beneficiary_groups[i];
            const created = await insertOrThrow(
                'beneficiary_groups',
                {
                    name: group.name,
                    description: group.description || null,
                    age_range_start: group.age_range_start,
                    age_range_end: group.age_range_end,
                    total_number: group.total_number,
                    initiative_id: initiativeId,
                    user_id: userId,
                    display_order: i,
                },
                'Failed to create generated beneficiary group'
            );
            beneficiaryGroupIds.push(created.id);
        }

        const kpiIds: string[] = [];
        for (let i = 0; i < draft.metrics.length; i++) {
            const metric = draft.metrics[i];
            const kpi = await insertOrThrow(
                'kpis',
                {
                    title: metric.title,
                    description: metric.description,
                    metric_type: metric.metric_type,
                    unit_of_measurement: metric.unit_of_measurement,
                    category: metric.category,
                    initiative_id: initiativeId,
                    user_id: userId,
                    display_order: i,
                },
                'Failed to create generated metric'
            );
            kpiIds.push(kpi.id);

            for (const update of metric.updates) {
                const locationId = locationIds[update.location_index] || locationIds[0];
                const createdUpdate = await insertOrThrow(
                    'kpi_updates',
                    {
                        kpi_id: kpi.id,
                        value: update.value,
                        date_represented: update.date_represented,
                        label: update.label || null,
                        note: update.note || null,
                        location_id: locationId,
                        user_id: userId,
                    },
                    'Failed to create generated metric update'
                );

                const links = update.beneficiary_group_indexes
                    .map((idx) => beneficiaryGroupIds[idx])
                    .filter(Boolean)
                    .map((groupId) => ({
                        kpi_update_id: createdUpdate.id,
                        beneficiary_group_id: groupId,
                        user_id: userId,
                    }));

                if (links.length > 0) {
                    const { error: linkErr } = await supabase
                        .from('kpi_update_beneficiary_groups')
                        .insert(links);
                    if (linkErr) throw new Error(`Failed to link generated metric update: ${linkErr.message}`);
                }
            }
        }

        const storyIds: string[] = [];
        for (const story of draft.stories) {
            const locationId = locationIds[story.location_index] || locationIds[0];
            const createdStory = await insertOrThrow(
                'stories',
                {
                    title: story.title,
                    description: story.description || null,
                    media_type: 'text',
                    date_represented: story.date_represented,
                    location_id: locationId,
                    initiative_id: initiativeId,
                    user_id: userId,
                },
                'Failed to create generated story'
            );
            storyIds.push(createdStory.id);

            if (locationId) {
                const { error: storyLocErr } = await supabase
                    .from('story_locations')
                    .insert([{ story_id: createdStory.id, location_id: locationId, user_id: userId }]);
                if (storyLocErr) throw new Error(`Failed to link generated story location: ${storyLocErr.message}`);
            }

            const storyLinks = story.beneficiary_group_indexes
                .map((idx) => beneficiaryGroupIds[idx])
                .filter(Boolean)
                .map((groupId) => ({
                    story_id: createdStory.id,
                    beneficiary_group_id: groupId,
                }));

            if (storyLinks.length > 0) {
                const { error: storyBenErr } = await supabase
                    .from('story_beneficiaries')
                    .insert(storyLinks);
                if (storyBenErr) throw new Error(`Failed to link generated story beneficiary: ${storyBenErr.message}`);
            }
        }

        const statCards = draft.context.stats_and_statements.map((card) => ({
            id: randomId(),
            type: card.type,
            value: card.type === 'stat' ? card.value : '',
            title: card.title,
            description: card.description,
            source: card.source,
            source_url: card.source_url,
            created_at: new Date().toISOString(),
        }));

        const stages = draft.context.theory_of_change_stages.map((stage) => ({
            id: randomId(),
            title: stage.title,
            description: stage.description,
        }));

        const strategies = draft.context.strategies.map((strategy) => ({
            id: randomId(),
            title: strategy.title,
            description: strategy.description,
        }));

        const { error: contextErr } = await supabase
            .from('organization_context')
            .insert([
                {
                    organization_id: organizationId,
                    problem_statement: draft.context.problem_statement,
                    stats_and_statements: statCards,
                    theory_of_change: draft.context.theory_of_change,
                    theory_of_change_stages: stages,
                    strategies,
                    additional_info: draft.context.additional_info,
                },
            ]);
        if (contextErr) throw new Error(`Failed to create generated context: ${contextErr.message}`);

        return {
            initiativeId,
            locationIds,
            beneficiaryGroupIds,
            kpiIds,
            storyIds,
        };
    }
}
