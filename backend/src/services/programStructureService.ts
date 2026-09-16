import { supabase } from '../utils/supabase'
import { Initiative } from '../types'
import { InitiativeService } from './initiativeService'
import { KPIService } from './kpiService'
import { MetricDefinitionService } from './metricDefinitionService'
import { MetricTagService } from './metricTagService'
import { LocationService } from './locationService'
import { BeneficiaryService } from './beneficiaryService'
import { OrgAccessService } from './orgAccessService'

/**
 * Program "structure" = the scaffolding a program needs before anyone can
 * log against it: metrics (with their tags), linked locations, beneficiary
 * groups. No claims, evidence or stories.
 *
 * Two entry points build that scaffolding in one shot instead of making
 * users click through four tabs:
 *
 *  - duplicateStructure: clone another program's structure into a new one.
 *  - createFromTemplate: seed a brand-new program from a code-defined
 *    template (see PROGRAM_TEMPLATES).
 *
 * Everything routes through the existing per-entity services so permission
 * checks, org scoping, slugs, display_order and definition mirroring behave
 * exactly as they do for manual creation.
 */

export interface TemplateMetric {
    title: string
    description: string
    metric_type: 'number' | 'percentage'
    unit_of_measurement: string
    category: 'input' | 'output' | 'impact'
    tags?: string[]
}

export interface TemplateGroup {
    name: string
    description?: string
}

export interface ProgramTemplate {
    id: string
    name: string
    description: string
    metrics: TemplateMetric[]
    groups?: TemplateGroup[]
}

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
    {
        id: 'education',
        name: 'Education',
        description: 'Students reached, attendance and learning outcomes, broken down by grade.',
        metrics: [
            { title: 'Students enrolled', description: 'Number of students enrolled in the program.', metric_type: 'number', unit_of_measurement: 'students', category: 'output', tags: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'] },
            { title: 'Teachers trained', description: 'Teachers who completed training.', metric_type: 'number', unit_of_measurement: 'teachers', category: 'output' },
            { title: 'Attendance rate', description: 'Share of enrolled students attending regularly.', metric_type: 'percentage', unit_of_measurement: '%', category: 'impact', tags: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'] },
            { title: 'Learning materials distributed', description: 'Books, kits and supplies handed out.', metric_type: 'number', unit_of_measurement: 'items', category: 'input' },
        ],
        groups: [{ name: 'Students' }, { name: 'Teachers' }, { name: 'Parents and caregivers' }],
    },
    {
        id: 'health',
        name: 'Health',
        description: 'Patients seen, treatments delivered and health outcomes by service line.',
        metrics: [
            { title: 'Patients seen', description: 'Unique patients who received care.', metric_type: 'number', unit_of_measurement: 'patients', category: 'output', tags: ['Maternal', 'Child health', 'Primary care', 'Mental health'] },
            { title: 'Vaccinations administered', description: 'Doses given.', metric_type: 'number', unit_of_measurement: 'doses', category: 'output' },
            { title: 'Health workers trained', description: 'Community health workers who completed training.', metric_type: 'number', unit_of_measurement: 'workers', category: 'output' },
            { title: 'Follow-up completion rate', description: 'Share of patients who attended scheduled follow-ups.', metric_type: 'percentage', unit_of_measurement: '%', category: 'impact' },
        ],
        groups: [{ name: 'Patients' }, { name: 'Community health workers' }],
    },
    {
        id: 'livelihoods',
        name: 'Livelihoods',
        description: 'Training, income and employment outcomes for participants.',
        metrics: [
            { title: 'Participants trained', description: 'People who completed a skills course.', metric_type: 'number', unit_of_measurement: 'participants', category: 'output', tags: ['Agriculture', 'Trades', 'Digital skills', 'Business'] },
            { title: 'Small businesses supported', description: 'Businesses that received grants, loans or coaching.', metric_type: 'number', unit_of_measurement: 'businesses', category: 'output' },
            { title: 'Participants employed after 6 months', description: 'Share of graduates in paid work six months on.', metric_type: 'percentage', unit_of_measurement: '%', category: 'impact' },
            { title: 'Average household income change', description: 'Reported change in monthly household income.', metric_type: 'percentage', unit_of_measurement: '%', category: 'impact' },
        ],
        groups: [{ name: 'Participants' }, { name: 'Households' }],
    },
    {
        id: 'environment',
        name: 'Environment',
        description: 'Trees, land, water and community engagement.',
        metrics: [
            { title: 'Trees planted', description: 'Seedlings planted and recorded.', metric_type: 'number', unit_of_measurement: 'trees', category: 'output', tags: ['Native species', 'Fruit trees', 'Agroforestry'] },
            { title: 'Hectares restored', description: 'Land brought under restoration management.', metric_type: 'number', unit_of_measurement: 'hectares', category: 'impact' },
            { title: 'Community members engaged', description: 'People who took part in activities.', metric_type: 'number', unit_of_measurement: 'people', category: 'output' },
            { title: 'Seedling survival rate', description: 'Share of planted seedlings alive after 12 months.', metric_type: 'percentage', unit_of_measurement: '%', category: 'impact' },
        ],
        groups: [{ name: 'Community volunteers' }, { name: 'Landholders' }],
    },
]

export interface StructureSummary {
    initiative: Initiative
    metrics_created: number
    tags_attached: number
    locations_linked: number
    groups_created: number
}

export class ProgramStructureService {
    /** Find-or-create an org tag by name; returns its id. */
    private static async ensureTag(name: string, userId: string, requestedOrgId?: string): Promise<string> {
        const all = await MetricTagService.getAll(userId, requestedOrgId)
        const hit = all.find(t => t.name.trim().toLowerCase() === name.trim().toLowerCase())
        if (hit?.id) return hit.id
        const created = await MetricTagService.create(name, userId, requestedOrgId)
        if (!created.id) throw new Error(`Failed to create tag "${name}"`)
        return created.id
    }

    /**
     * Create a program from a template. `initiative` carries the user-entered
     * title/description; the template supplies metrics, tags and groups.
     */
    static async createFromTemplate(
        templateId: string,
        initiative: Initiative,
        userId: string,
        requestedOrgId?: string
    ): Promise<StructureSummary> {
        const template = PROGRAM_TEMPLATES.find(t => t.id === templateId)
        if (!template) throw new Error('Unknown program template')

        const created = await InitiativeService.create(initiative, userId, requestedOrgId)
        const initiativeId = created.id!

        let metricsCreated = 0
        let tagsAttached = 0
        for (const m of template.metrics) {
            const tagIds: string[] = []
            for (const tagName of m.tags || []) tagIds.push(await this.ensureTag(tagName, userId, requestedOrgId))
            await KPIService.create({
                initiative_id: initiativeId,
                title: m.title,
                description: m.description,
                metric_type: m.metric_type,
                unit_of_measurement: m.unit_of_measurement,
                category: m.category,
                tag_ids: tagIds,
            } as any, userId, requestedOrgId)
            metricsCreated += 1
            tagsAttached += tagIds.length
        }

        let groupsCreated = 0
        for (const g of template.groups || []) {
            await BeneficiaryService.create({ initiative_id: initiativeId, name: g.name, description: g.description } as any, userId, requestedOrgId)
            groupsCreated += 1
        }

        return { initiative: created, metrics_created: metricsCreated, tags_attached: tagsAttached, locations_linked: 0, groups_created: groupsCreated }
    }

    /**
     * Clone another program's structure into a new program: same metric
     * definitions (attached, not re-created, since metrics are org-global),
     * same linked locations, same beneficiary group names. No data rows.
     */
    static async duplicateStructure(
        sourceInitiativeId: string,
        initiative: Initiative,
        userId: string,
        requestedOrgId?: string
    ): Promise<StructureSummary> {
        await OrgAccessService.assertInitiativeAccess(sourceInitiativeId, userId, requestedOrgId)

        const [sourceKpis, sourceLocations, sourceGroups] = await Promise.all([
            KPIService.getAll(userId, sourceInitiativeId, requestedOrgId),
            LocationService.getAll(userId, sourceInitiativeId, requestedOrgId),
            BeneficiaryService.getAll(userId, sourceInitiativeId, requestedOrgId),
        ])

        const created = await InitiativeService.create(initiative, userId, requestedOrgId)
        const initiativeId = created.id!

        let metricsCreated = 0
        let tagsAttached = 0
        for (const kpi of sourceKpis) {
            if ((kpi as any).archived_at) continue
            const definitionId = (kpi as any).definition_id as string | undefined
            if (definitionId) {
                // Attach the shared definition; its tags mirror down automatically.
                await MetricDefinitionService.attachToInitiative(definitionId, initiativeId, userId, requestedOrgId)
                tagsAttached += (await MetricTagService.getTagIdsForDefinition(definitionId)).length
            } else {
                const tagIds = await MetricTagService.getTagIdsForKpi(kpi.id!)
                await KPIService.create({
                    initiative_id: initiativeId,
                    title: kpi.title,
                    description: kpi.description,
                    metric_type: kpi.metric_type,
                    unit_of_measurement: kpi.unit_of_measurement,
                    category: kpi.category,
                    tag_ids: tagIds,
                } as any, userId, requestedOrgId)
                tagsAttached += tagIds.length
            }
            metricsCreated += 1
        }

        let locationsLinked = 0
        for (const loc of sourceLocations) {
            if (!loc.id) continue
            await LocationService.linkToInitiative(loc.id, initiativeId, userId, requestedOrgId)
            locationsLinked += 1
        }

        let groupsCreated = 0
        for (const g of sourceGroups) {
            await BeneficiaryService.create({
                initiative_id: initiativeId,
                name: g.name,
                description: g.description,
                age_range_start: g.age_range_start ?? null,
                age_range_end: g.age_range_end ?? null,
                total_number: g.total_number ?? null,
            } as any, userId, requestedOrgId)
            groupsCreated += 1
        }

        return { initiative: created, metrics_created: metricsCreated, tags_attached: tagsAttached, locations_linked: locationsLinked, groups_created: groupsCreated }
    }

    /**
     * Readiness summary for a program: what exists, what's missing before
     * evidence can connect to a claim. Cheap counts only.
     */
    static async getReadiness(initiativeId: string, userId: string, requestedOrgId?: string): Promise<{
        metrics: number
        locations: number
        tags: number
        groups: number
        claims: number
        evidence: number
        ready: boolean
    }> {
        await OrgAccessService.assertInitiativeAccess(initiativeId, userId, requestedOrgId)
        const [{ data: kpis }, { count: locations }, { count: groups }, { count: evidence }] = await Promise.all([
            supabase.from('kpis').select('id').eq('initiative_id', initiativeId).is('archived_at', null),
            supabase.from('initiative_locations').select('id', { count: 'exact', head: true }).eq('initiative_id', initiativeId),
            supabase.from('beneficiary_groups').select('id', { count: 'exact', head: true }).eq('initiative_id', initiativeId),
            supabase.from('evidence').select('id', { count: 'exact', head: true }).eq('initiative_id', initiativeId),
        ])
        const kpiIds = (kpis || []).map((k: any) => k.id as string)
        const [{ count: tags }, { count: claims }] = kpiIds.length > 0
            ? await Promise.all([
                supabase.from('kpi_metric_tags').select('id', { count: 'exact', head: true }).in('kpi_id', kpiIds),
                supabase.from('kpi_updates').select('id', { count: 'exact', head: true }).in('kpi_id', kpiIds),
            ])
            : [{ count: 0 }, { count: 0 }]
        const metrics = kpiIds.length
        return {
            metrics,
            locations: locations || 0,
            tags: tags || 0,
            groups: groups || 0,
            claims: claims || 0,
            evidence: evidence || 0,
            ready: metrics > 0 && (locations || 0) > 0,
        }
    }
}
