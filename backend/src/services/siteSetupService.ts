import dns from 'dns';
import { openai, isOpenAIConfigured } from '../utils/openai';
import { supabase } from '../utils/supabase';
import { InitiativeService } from './initiativeService';
import { MetricDefinitionService } from './metricDefinitionService';
import { LocationService } from './locationService';
import { OrganizationService } from './organizationService';
import { OrganizationContextService } from './organizationContextService';
import { SubscriptionService } from './subscriptionService';
import { TeamService } from './teamService';
import { OrgAccessService } from './orgAccessService';
import {
    MAX_TOTAL_CONTEXT_CHARS,
    SiteBranding,
    SiteCrawlError,
    assertEnoughContent,
    cleanText,
    configError,
    discoverUrls,
    envMaxPages,
    fetchBranding,
    filterSameSiteUrls,
    isBlockedHostname,
    isPrivateIp,
    logStep,
    logWarn,
    newTraceId,
    normalizeWebsiteUrl,
    packScrapedContext,
    scrapeUrls,
} from './siteCrawlService';

/**
 * "Set up from your website" for real accounts. Unlike demo generation this
 * only extracts what the site states (no synthetic values), returns a draft
 * for the user to review, and persists through the normal services so plan
 * limits and permissions apply.
 *
 * Split into short steps (discover, scrape, branding, extract, apply) because
 * the API runs on Vercel with a 60s function limit.
 */

const DEFAULT_MODEL = 'gpt-5.4-mini';
const MAX_PROGRAMS = 6;
const MAX_METRICS = 10;
const MAX_LOCATIONS = 8;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

export type SetupMetricType = 'number' | 'percentage';
export type SetupMetricCategory = 'input' | 'output' | 'impact';

export interface SetupProgram {
    id: string;
    title: string;
    description: string;
    region: string;
    source: string;
    /** Set on programs already in the account (rescan): shown as metric targets, never created. */
    existing_id?: string;
}

export interface SetupMetric {
    id: string;
    title: string;
    description: string;
    metric_type: SetupMetricType;
    unit_of_measurement: string;
    category: SetupMetricCategory;
    program_ids: string[];
    rationale: string;
    /** Existing metric to link to program_ids instead of creating one. */
    existing_id?: string;
}

export interface SetupLocation {
    id: string;
    name: string;
    /** Town or district the place sits in; anchors the geocoder lookup. */
    area: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
    program_ids: string[];
    /** Existing location to link to program_ids instead of creating one. */
    existing_id?: string;
}

/** What the account already has, so a rescan only suggests what is missing. */
interface ExistingSnapshot {
    programs: { id: string; title: string; description: string }[];
    metrics: { id: string; title: string; program_ids: string[] }[];
    locations: { id: string; name: string; country: string; program_ids: string[] }[];
}

export interface SetupTitledItem {
    title: string;
    description: string;
}

export interface SetupStory {
    problem_statement: string;
    theory_of_change: string;
    theory_of_change_stages: SetupTitledItem[];
    strategies: SetupTitledItem[];
}

export interface SetupOrganization {
    description: string;
    statement: string;
    donation_url: string;
}

export interface SiteSetupDraft {
    website_url: string;
    organization: SetupOrganization;
    programs: SetupProgram[];
    metrics: SetupMetric[];
    locations: SetupLocation[];
    story: SetupStory;
}

/**
 * One unit of the apply phase. The client sends these one at a time (programs
 * first, then metrics/locations with the program id map) so each request stays
 * well inside the serverless time limit and the UI can show real progress.
 */
export type SiteSetupApplyStep =
    | { kind: 'program'; program: SetupProgram }
    | { kind: 'metric'; metric: SetupMetric; program_id_map: Record<string, string> }
    | { kind: 'location'; location: SetupLocation; program_id_map: Record<string, string> }
    | {
        kind: 'profile';
        website_url: string;
        organization: SetupOrganization;
        story: SetupStory | null;
        branding: { brand_color: string | null; logo_url: string | null };
    };

export interface SiteSetupStepResult {
    id: string | null;
    errors: string[];
}

const SITE_SETUP_SCHEMA: Record<string, any> = {
    type: 'object',
    additionalProperties: false,
    required: ['organization', 'service_area', 'programs', 'metrics', 'locations', 'story'],
    properties: {
        service_area: { type: 'string' },
        organization: {
            type: 'object',
            additionalProperties: false,
            required: ['description', 'statement', 'donation_url'],
            properties: {
                description: { type: 'string' },
                statement: { type: 'string' },
                donation_url: { type: 'string' },
            },
        },
        programs: {
            type: 'array',
            maxItems: MAX_PROGRAMS,
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'description', 'region', 'source', 'existing_index'],
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    region: { type: 'string' },
                    source: { type: 'string' },
                    existing_index: { type: 'integer' },
                },
            },
        },
        metrics: {
            type: 'array',
            maxItems: MAX_METRICS,
            items: {
                type: 'object',
                additionalProperties: false,
                required: [
                    'title', 'description', 'metric_type', 'unit_of_measurement', 'category',
                    'program_indexes', 'existing_program_indexes', 'existing_index', 'rationale',
                ],
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    metric_type: { type: 'string', enum: ['number', 'percentage'] },
                    unit_of_measurement: { type: 'string' },
                    category: { type: 'string', enum: ['input', 'output', 'impact'] },
                    program_indexes: { type: 'array', items: { type: 'integer' } },
                    existing_program_indexes: { type: 'array', items: { type: 'integer' } },
                    existing_index: { type: 'integer' },
                    rationale: { type: 'string' },
                },
            },
        },
        locations: {
            type: 'array',
            maxItems: MAX_LOCATIONS,
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['name', 'area', 'country', 'program_indexes', 'existing_program_indexes', 'existing_index'],
                properties: {
                    name: { type: 'string' },
                    area: { type: 'string' },
                    country: { type: 'string' },
                    program_indexes: { type: 'array', items: { type: 'integer' } },
                    existing_program_indexes: { type: 'array', items: { type: 'integer' } },
                    existing_index: { type: 'integer' },
                },
            },
        },
        story: {
            type: 'object',
            additionalProperties: false,
            required: ['problem_statement', 'theory_of_change', 'theory_of_change_stages', 'strategies'],
            properties: {
                problem_statement: { type: 'string' },
                theory_of_change: { type: 'string' },
                theory_of_change_stages: { type: 'array', maxItems: 5, items: titledItemSchema() },
                strategies: { type: 'array', maxItems: 5, items: titledItemSchema() },
            },
        },
    },
};

function titledItemSchema(): Record<string, any> {
    return {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description'],
        properties: {
            title: { type: 'string' },
            description: { type: 'string' },
        },
    };
}

function setupError(status: number, code: string, message: string, details?: string): SiteCrawlError {
    return new SiteCrawlError(status, code, message, details);
}

function normalizeHttpUrl(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
        const parsed = new URL(value.trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
    } catch {
        return '';
    }
}

function metricType(value: unknown): SetupMetricType {
    return value === 'percentage' ? 'percentage' : 'number';
}

function metricCategory(value: unknown): SetupMetricCategory {
    return value === 'input' || value === 'impact' ? value : 'output';
}

function coord(value: unknown, limit: number): number | null {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || Math.abs(n) > limit) return null;
    return n;
}

function titledList(raw: unknown, max: number): SetupTitledItem[] {
    return (Array.isArray(raw) ? raw : [])
        .map((item: any) => ({
            title: cleanText(item?.title, 120),
            description: cleanText(item?.description, 500),
        }))
        .filter((item) => item.title || item.description)
        .slice(0, max);
}

function normalizeStory(raw: any): SetupStory {
    return {
        problem_statement: cleanText(raw?.problem_statement, 1200),
        theory_of_change: cleanText(raw?.theory_of_change, 1200),
        theory_of_change_stages: titledList(raw?.theory_of_change_stages, 5),
        strategies: titledList(raw?.strategies, 5),
    };
}

/** Model output → draft with stable client ids (p0, m0, l0) for cross-references. */
const PERIOD = '(?:day|week|month|quarter|year|school year|academic year|term|semester|annum)';

/**
 * Metric titles name what is counted; the period is picked when logging.
 * "Daily meals provided per day" -> "Meals provided",
 * "Number of students enrolled per year (Pre-K to 13)" -> "Students enrolled".
 */
export function tidyMetricTitle(raw: string): string {
    const tidied = raw
        .replace(/\([^)]*\)/g, ' ')
        .replace(new RegExp(`\\b(?:per|each|every|a|an)\\s+${PERIOD}\\b`, 'gi'), ' ')
        .replace(/\b(?:daily|weekly|monthly|quarterly|annually|annual|yearly|per annum)\b/gi, ' ')
        .replace(new RegExp(`\\b(?:this|last|current)\\s+${PERIOD}\\b`, 'gi'), ' ')
        .replace(/\b(?:in|during|for)\s+(?:fy\s*)?\d{4}(?:[-/]\d{2,4})?\b/gi, ' ')
        .replace(/\b(?:year|month)[- ]to[- ]date\b/gi, ' ')
        .replace(/^\s*(?:total|the|number of|no\.? of|# of|count of|amount of)\s+/i, '')
        .replace(/\s+(?:of|in|for|to|by|per|across|over)\s*$/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    // "Students enrolled in Pre-K to 13th grade education" -> "Students enrolled";
    // the scope already lives in the program the metric sits in.
    const scoped = tidied.split(' ').length > 5
        ? tidied.match(/^(.+?\b(?:enrolled|served|treated|provided|reached|trained|supported|receiving|delivered|distributed|built|completed))\s+(?:in|at|through|across|from|within|under)\s+.+$/i)
        : null;
    if (scoped) return scoped[1].charAt(0).toUpperCase() + scoped[1].slice(1);
    if (tidied.length < 3) return raw;
    return tidied.charAt(0).toUpperCase() + tidied.slice(1);
}

/** Lowercase, accent-free form for comparing place names ("Léogâne" = "leogane"). */
function foldText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Program titles name a service, not a count: "Daily meals for 300 children"
 * -> "Meals", "Educating 500+ students (Pre-K to 12)" -> "Educating students".
 */
export function tidyProgramTitle(raw: string): string {
    const tidied = raw
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\b(?:for|to|serving|reaching|helping|supporting)\s+(?:over|more than|nearly|about|up to)?\s*[\d,.]+\+?\s*\w*/gi, ' ')
        .replace(/\b(?:over|more than|nearly|about|up to)?\s*[\d,.]+\+?\s*%?/g, ' ')
        .replace(new RegExp(`\\b(?:per|each|every|a|an)\\s+${PERIOD}\\b`, 'gi'), ' ')
        .replace(/\b(?:daily|weekly|monthly|quarterly|annually|annual|yearly)\b/gi, ' ')
        .replace(/^\s*(?:number of|no\.? of|# of|total)\s+/i, '')
        .replace(/\s+(?:of|in|for|to|by|per|and|&)\s*$/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    // "Medical care for students, family & staff" -> "Medical care". Long titles
    // only, so short proper names like "Food for Thought" survive.
    const unscoped = tidied.split(' ').length >= 5 ? tidied.replace(/\s+(?:for|serving|in|across)\s+.+$/i, '') : tidied;
    const result = unscoped.split(' ').length >= 2 ? unscoped : tidied;
    if (result.length < 3) return raw;
    return result.charAt(0).toUpperCase() + result.slice(1);
}

const flatText = (value: string) => foldText(value).replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * True when the site backs this program up: its quoted source appears in the
 * scraped text, or most of the title's words do (prefix match, so "nutrition"
 * finds "nutritious"). Anything else is the model guessing.
 */
function isGrounded(program: { title: string; source: string }, flatContext: string): boolean {
    const source = flatText(program.source);
    if (source.length >= 12 && flatContext.includes(source)) return true;
    const words = flatText(program.title)
        .split(' ')
        .filter((w) => w.length >= 4 && !['program', 'programs', 'programme', 'project', 'projects', 'services', 'initiative'].includes(w));
    if (words.length === 0) return false;
    const found = words.filter((w) => flatContext.includes(w.slice(0, Math.max(4, w.length - 3)))).length;
    return found / words.length >= 0.6;
}

const MATCH_STOPWORDS = new Set(['program', 'programs', 'programme', 'programmes', 'and', 'the', 'of', 'for', 'a', 'an', 'our', 'services', 'service', 'initiative', 'project']);

function matchTokens(value: string): Set<string> {
    return new Set(
        foldText(value)
            .replace(/&/g, ' and ')
            .split(/[^a-z0-9]+/)
            .filter((t) => t && !MATCH_STOPWORDS.has(t))
    );
}

/** Same thing worded differently: "Medical & dental care" = "Medical and dental care program". */
function namesMatch(a: string, b: string): boolean {
    if (foldText(a) === foldText(b)) return true;
    const ta = matchTokens(a);
    const tb = matchTokens(b);
    if (ta.size === 0 || tb.size === 0) return false;
    const shared = [...ta].filter((t) => tb.has(t)).length;
    const union = new Set([...ta, ...tb]).size;
    return shared / union >= 0.75 || (shared >= 2 && (shared === ta.size || shared === tb.size));
}

/**
 * The model's own match when the names share at least one real word (so a
 * careless index cannot swallow a genuinely new item), else a name match.
 */
function findExisting<T>(items: T[], index: unknown, name: string, nameOf: (item: T) => string): T | undefined {
    const i = Number(index);
    if (Number.isInteger(i) && i >= 0 && i < items.length) {
        const tokens = matchTokens(nameOf(items[i]));
        if ([...matchTokens(name)].some((t) => tokens.has(t))) return items[i];
    }
    return items.find((item) => namesMatch(nameOf(item), name));
}

const existingProgramDraftId = (id: string) => `x-${id}`;

async function loadExisting(orgId: string): Promise<ExistingSnapshot> {
    const [{ data: programs }, { data: definitions }, { data: locations }] = await Promise.all([
        supabase.from('initiatives').select('id, title, description').eq('organization_id', orgId)
            .order('display_order', { ascending: true }).limit(40),
        supabase.from('metric_definitions').select('id, title').eq('organization_id', orgId).limit(120),
        supabase.from('locations').select('id, name, country').eq('organization_id', orgId).limit(80),
    ]);
    const defIds = (definitions || []).map((d: any) => d.id);
    const locIds = (locations || []).map((l: any) => l.id);
    const [{ data: kpis }, { data: locLinks }] = await Promise.all([
        defIds.length
            ? supabase.from('kpis').select('definition_id, initiative_id').in('definition_id', defIds).is('archived_at', null)
            : Promise.resolve({ data: [] as any[] }),
        locIds.length
            ? supabase.from('initiative_locations').select('location_id, initiative_id').in('location_id', locIds)
            : Promise.resolve({ data: [] as any[] }),
    ]);
    const linksBy = (rows: any[] | null, key: string) => {
        const map = new Map<string, string[]>();
        for (const r of rows || []) map.set(r[key], [...(map.get(r[key]) || []), r.initiative_id]);
        return map;
    };
    const metricLinks = linksBy(kpis, 'definition_id');
    const locationLinks = linksBy(locLinks, 'location_id');
    return {
        programs: (programs || []).map((p: any) => ({ id: p.id, title: p.title || '', description: p.description || '' })),
        metrics: (definitions || []).map((d: any) => ({ id: d.id, title: d.title || '', program_ids: metricLinks.get(d.id) || [] })),
        locations: (locations || []).map((l: any) => ({
            id: l.id, name: l.name || '', country: l.country || '', program_ids: locationLinks.get(l.id) || [],
        })),
    };
}

function existingPromptBlock(existing: ExistingSnapshot): string[] {
    if (!existing.programs.length && !existing.metrics.length && !existing.locations.length) {
        return ['This account is empty: set every existing_index to -1 and every existing_program_indexes to [].'];
    }
    const programIndex = new Map(existing.programs.map((p, i) => [p.id, i]));
    const refs = (ids: string[]) => ids.map((id) => programIndex.get(id)).filter((i) => i !== undefined).join(',');
    return [
        'ALREADY IN THIS ACCOUNT. Suggest only what is missing; never suggest these again, even worded differently:',
        `Existing programs: ${existing.programs.map((p, i) => `[${i}] ${p.title}`).join('; ') || 'none'}`,
        `Existing metrics: ${existing.metrics.map((m, i) => `[${i}] ${m.title}${m.program_ids.length ? ` (programs ${refs(m.program_ids)})` : ''}`).join('; ') || 'none'}`,
        `Existing locations: ${existing.locations.map((l, i) => `[${i}] ${l.name}${l.country ? `, ${l.country}` : ''}`).join('; ') || 'none'}`,
        'Rules for existing items:',
        '- PROGRAMS: return only programs not covered by an existing one. If a service on the site is an existing program, do not return it. If you still return one, set existing_index to its number; otherwise -1. Returning zero programs is fine when nothing is new.',
        '- METRICS may belong to existing programs: put their numbers in existing_program_indexes (and new programs in program_indexes). Prefer new metrics for existing programs that have few. Never re-suggest an existing metric; if an existing metric should also belong to another program, return it with existing_index set to its number, else -1.',
        '- LOCATIONS: never re-suggest an existing location. If an existing location should be linked to a new program, return it with existing_index set; otherwise -1. Use existing_program_indexes for existing programs that run there.',
    ];
}

function normalizeExtraction(
    raw: any,
    websiteUrl: string,
    existing: ExistingSnapshot,
    context: string,
    traceId: string
): SiteSetupDraft {
    if (!raw || typeof raw !== 'object') {
        throw setupError(422, 'invalid_generated_draft', 'We could not make sense of that website. Try again or set up manually.');
    }
    const flatContext = flatText(context);

    // Existing programs ride along as metric/location targets; the client never creates them.
    const existingPrograms: SetupProgram[] = existing.programs.map((p) => ({
        id: existingProgramDraftId(p.id),
        title: p.title,
        description: p.description,
        region: '',
        source: '',
        existing_id: p.id,
    }));

    // AI program index -> draft program id (new "pN" or a matched existing "x-<id>").
    const aiProgramIds: (string | null)[] = [];
    const newPrograms: SetupProgram[] = [];
    for (const p of Array.isArray(raw.programs) ? raw.programs : []) {
        const title = tidyProgramTitle(cleanText(p?.title, 140));
        if (!title) { aiProgramIds.push(null); continue; }
        if (!isGrounded({ title, source: cleanText(p?.source, 240) }, flatContext)) {
            logWarn(traceId, 'SETUP', 'dropped ungrounded program', { title, source: p?.source });
            aiProgramIds.push(null);
            continue;
        }
        const existingMatch = findExisting(existing.programs, p?.existing_index, title, (x) => x.title);
        if (existingMatch) { aiProgramIds.push(existingProgramDraftId(existingMatch.id)); continue; }
        const duplicate = newPrograms.find((x) => namesMatch(x.title, title));
        if (duplicate) { aiProgramIds.push(duplicate.id); continue; }
        if (newPrograms.length >= MAX_PROGRAMS) { aiProgramIds.push(null); continue; }
        const id = `p${newPrograms.length}`;
        newPrograms.push({
            id,
            title,
            description: cleanText(p?.description, 1200),
            region: cleanText(p?.region, 120),
            source: cleanText(p?.source, 240),
        });
        aiProgramIds.push(id);
    }
    const programs = [...existingPrograms, ...newPrograms];

    const programIdsFor = (indexes: unknown, existingIndexes?: unknown): string[] => {
        const fromAi = (Array.isArray(indexes) ? indexes : [])
            .map((i) => aiProgramIds[Number(i)])
            .filter((id): id is string => !!id);
        const fromExisting = (Array.isArray(existingIndexes) ? existingIndexes : [])
            .map((i) => existing.programs[Number(i)])
            .filter(Boolean)
            .map((p) => existingProgramDraftId(p.id));
        return [...new Set([...fromAi, ...fromExisting])];
    };

    const seenMetric = new Set<string>();
    const metrics: SetupMetric[] = [];
    for (const m of Array.isArray(raw.metrics) ? raw.metrics : []) {
        const title = tidyMetricTitle(cleanText(m?.title, 120));
        if (!title) continue;
        let programIds = programIdsFor(m?.program_indexes, m?.existing_program_indexes);
        const match = findExisting(existing.metrics, m?.existing_index, title, (x) => x.title);
        if (match) {
            // Only worth showing if it links the existing metric somewhere new.
            const linked = new Set(match.program_ids.map(existingProgramDraftId));
            programIds = programIds.filter((id) => !linked.has(id));
            if (programIds.length === 0) continue;
        }
        const key = (match ? match.title : title).toLowerCase();
        if (seenMetric.has(key)) {
            // Two programs both counting "Students enrolled" share one metric.
            const dup = metrics.find((x) => x.title.toLowerCase() === key);
            if (dup) dup.program_ids = [...new Set([...dup.program_ids, ...programIds])];
            continue;
        }
        seenMetric.add(key);
        const type = metricType(m?.metric_type);
        metrics.push({
            id: `m${metrics.length}`,
            title: match ? match.title : title,
            description: cleanText(m?.description, 500),
            metric_type: type,
            unit_of_measurement: cleanText(m?.unit_of_measurement, 60) || (type === 'percentage' ? '%' : 'people'),
            category: metricCategory(m?.category),
            program_ids: programIds,
            rationale: cleanText(m?.rationale, 240),
            ...(match ? { existing_id: match.id } : {}),
        });
        if (metrics.length >= MAX_METRICS) break;
    }

    // "Léogâne area (villages along Route 2)" -> "Léogâne"
    const serviceArea = cleanText(raw.service_area, 120)
        .split(/[(,]/)[0]
        .replace(/\b(area|region|district|villages?|communities|surroundings?)\b.*$/i, '')
        .trim();
    const seenLocation = new Set<string>();
    const candidates: SetupLocation[] = [];
    for (const l of Array.isArray(raw.locations) ? raw.locations : []) {
        const country = cleanText(l?.country, 80);
        const area = cleanText(l?.area, 80) || serviceArea;
        // Models still glue area/country onto the name; keep just the place.
        const name = cleanText(l?.name, 120)
            .split(',')
            .map((part) => part.trim())
            .filter((part, i) => i === 0 || (foldText(part) !== foldText(country) && foldText(part) !== foldText(area)))
            .join(', ');
        if (!name || seenLocation.has(foldText(name))) continue;
        let programIds = programIdsFor(l?.program_indexes, l?.existing_program_indexes);
        const match = findExisting(existing.locations, l?.existing_index, name, (x) => x.name);
        if (match) {
            const linked = new Set(match.program_ids.map(existingProgramDraftId));
            programIds = programIds.filter((id) => !linked.has(id));
            if (programIds.length === 0) continue;
        }
        seenLocation.add(foldText(name));
        // Model coordinates are guesses; the client pins these with a geocoder lookup.
        candidates.push({
            id: '',
            name: match ? match.name : name,
            area: area && foldText(area) !== foldText(name) ? area : '',
            country: match ? match.country || country : country,
            latitude: null,
            longitude: null,
            program_ids: programIds,
            ...(match ? { existing_id: match.id } : {}),
        });
    }
    // "Léogâne area" next to the villages inside it is a region, not a site.
    const regionName = /\b(area|region|district|villages|communities)\b/i;
    const locations = candidates
        .filter((l) => l.existing_id || !(candidates.length > 1 && regionName.test(l.name)))
        .slice(0, MAX_LOCATIONS)
        .map((l, i) => ({ ...l, id: `l${i}` }));

    const org = raw.organization || {};
    return {
        website_url: websiteUrl,
        organization: {
            description: cleanText(org.description, 900),
            statement: cleanText(org.statement, 150),
            donation_url: normalizeHttpUrl(org.donation_url),
        },
        programs,
        metrics,
        locations,
        story: normalizeStory(raw.story),
    };
}

function mapProgramIds(ids: unknown, programIdMap: Record<string, string> | undefined): string[] {
    const map = programIdMap && typeof programIdMap === 'object' ? programIdMap : {};
    const mapped = (Array.isArray(ids) ? ids : [])
        .map((id) => map[String(id)])
        .filter((id): id is string => typeof id === 'string' && !!id);
    return [...new Set(mapped)];
}

async function geocode(name: string, country: string): Promise<{ lat: number; lng: number; country?: string } | null> {
    const q = country && !name.toLowerCase().includes(country.toLowerCase()) ? `${name}, ${country}` : name;
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`,
            { headers: { 'User-Agent': 'OFE App (site setup)' }, signal: AbortSignal.timeout(6000) }
        );
        if (!res.ok) return null;
        const data: any = await res.json();
        const hit = data?.[0];
        if (!hit) return null;
        return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), country: hit.address?.country };
    } catch {
        return null;
    }
}

/** Fetches a remote image without letting the URL reach private networks. */
async function fetchPublicImage(rawUrl: string): Promise<Buffer> {
    let current = rawUrl;
    for (let hop = 0; hop < 4; hop++) {
        const parsed = new URL(current);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('unsupported protocol');
        const host = parsed.hostname.toLowerCase();
        if (isBlockedHostname(host)) throw new Error('blocked host');
        const addresses = await dns.promises.lookup(host, { all: true });
        if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) throw new Error('blocked address');

        const res = await fetch(current, {
            redirect: 'manual',
            signal: AbortSignal.timeout(8000),
            headers: { 'User-Agent': 'OFE App (site setup)', Accept: 'image/*' },
        });
        if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get('location');
            if (!location) throw new Error('redirect without location');
            current = new URL(location, current).toString();
            continue;
        }
        if (!res.ok) throw new Error(`logo fetch returned ${res.status}`);
        const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!type.startsWith('image/')) throw new Error(`not an image (${type || 'unknown'})`);
        const declared = Number(res.headers.get('content-length') || 0);
        if (declared > MAX_LOGO_BYTES) throw new Error('logo too large');
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > MAX_LOGO_BYTES) throw new Error('logo too large');
        return buf;
    }
    throw new Error('too many redirects');
}

export class SiteSetupService {
    /** Org-settings editors only: setup writes branding and profile fields. */
    static async assertCanSetup(userId: string, requestedOrgId?: string): Promise<string> {
        const orgId = await OrgAccessService.resolveActiveOrganizationId(userId, requestedOrgId);
        if (!orgId || !(await TeamService.canEditOrgSettings(userId, orgId))) {
            throw setupError(403, 'forbidden', 'Only the organization owner or an admin can run website setup.');
        }
        return orgId;
    }

    static async discover(userId: string, rawUrl: unknown, requestedOrgId?: string): Promise<{ website_url: string; urls: string[] }> {
        await this.assertCanSetup(userId, requestedOrgId);
        const websiteUrl = normalizeWebsiteUrl(rawUrl);
        const traceId = newTraceId();
        logStep(traceId, 'SETUP', 'discover requested', { userId, websiteUrl });
        const urls = await discoverUrls(websiteUrl, envMaxPages(), traceId, { mapTimeoutMs: 12000 });
        return { website_url: websiteUrl, urls };
    }

    static async scrape(
        userId: string,
        input: { website_url: unknown; urls: unknown },
        requestedOrgId?: string
    ): Promise<{ context: string; pages: number }> {
        await this.assertCanSetup(userId, requestedOrgId);
        const websiteUrl = normalizeWebsiteUrl(input.website_url);
        const urls = filterSameSiteUrls(websiteUrl, input.urls, envMaxPages());
        const traceId = newTraceId();
        logStep(traceId, 'SETUP', 'scrape requested', { userId, websiteUrl, count: urls.length });
        const { pages, homepageOk, attempted } = await scrapeUrls(urls, traceId, websiteUrl, {
            serverTimeoutMs: 22000,
            allowHomepageRetry: false,
        });
        assertEnoughContent(pages, attempted, traceId, homepageOk);
        return { context: packScrapedContext(pages), pages: pages.length };
    }

    static async branding(userId: string, rawUrl: unknown, requestedOrgId?: string): Promise<SiteBranding> {
        await this.assertCanSetup(userId, requestedOrgId);
        const websiteUrl = normalizeWebsiteUrl(rawUrl);
        return fetchBranding(websiteUrl, newTraceId(), 45000);
    }

    static async extract(
        userId: string,
        input: { website_url: unknown; context: unknown },
        requestedOrgId?: string
    ): Promise<SiteSetupDraft> {
        const orgId = await this.assertCanSetup(userId, requestedOrgId);
        if (!isOpenAIConfigured() || !openai) throw configError('OPENAI_API_KEY is missing');

        const existing = await loadExisting(orgId);
        const websiteUrl = normalizeWebsiteUrl(input.website_url);
        const context = typeof input.context === 'string' ? input.context.slice(0, MAX_TOTAL_CONTEXT_CHARS + 2000) : '';
        if (context.trim().length < 200) {
            throw setupError(400, 'missing_context', 'We could not read enough of that website. Try again.');
        }

        const traceId = newTraceId();
        const model = process.env.OPENAI_SETUP_MODEL || process.env.OPENAI_DEMO_MODEL || DEFAULT_MODEL;
        const startedAt = Date.now();
        logStep(traceId, 'SETUP', 'extract requested', { userId, websiteUrl, model, contextChars: context.length });

        const completion = await openai.chat.completions.create(
            {
                model,
                max_completion_tokens: 6000,
                response_format: {
                    type: 'json_schema',
                    json_schema: { name: 'site_setup_draft', strict: true, schema: SITE_SETUP_SCHEMA },
                },
                messages: [
                    {
                        role: 'system',
                        content: [
                            'You set up a real charity\'s account on an impact-tracking platform by reading its website.',
                            'Extract only what the website actually says. Never invent numbers, results, places, or programs.',
                            'The user will review and edit every suggestion before anything is saved.',
                            'Return only the JSON object required by the schema.',
                        ].join(' '),
                    },
                    {
                        role: 'user',
                        content: [
                            `Website URL: ${websiteUrl}`,
                            '',
                            'Return:',
                            `- PROGRAMS (1-${MAX_PROGRAMS}): the concrete service lines the organization delivers directly to the people it serves. A program is the container its metrics will live inside, so each one must be specific enough that you can name 2-3 things to count within it (e.g. "Food and nutrition program" holds "meals served" and "children receiving daily meals").`,
                            '  Sites call these programs, projects, initiatives, services or focus areas. If the site has a page or list of its programs or projects, that list is your starting point.',
                            '  DO NOT GUESS. Only return a program when the content explicitly says the organization runs or delivers it. Never infer programs from the cause area, photos, donation options, partner logos or a single passing word, and never add programs that this kind of charity "usually" runs. If you are not sure, leave it out: 2 certain programs beat 5 with a guess.',
                            '  Naming: when the site gives a program or project a proper name (e.g. "Hope Clinic", "Project Agua"), keep it. Otherwise write a plain name from the site\'s own words, e.g. "Primary and secondary education", "Trade school", "Medical and dental care", "Clean water". A bullet list of services ("Medical care", "Dental care", "Health education & supplies") is NOT a list of programs: apply the merge rules below to it. Generic headings ("Education programs", "Our programs", "Health") are not names; use the specific service instead.',
                            '  Titles never contain numbers, quantities, frequencies, who is served, or results: those belong in metrics or the description. "Feeding program", not "Daily meals for 300 children". "Medical and dental care", not "Medical care for students, family & staff". "Primary school", not "500 students enrolled". "Clean water", not "Wells built".',
                            '  Default to merging. Split only when services run as clearly separate operations (different facility, staff and participants). Example: an "Education" section listing elementary school, high school and a vocational school becomes "Primary and secondary education" and "Trade school".',
                            '  Grade levels or age groups of the same service stay ONE program ("Primary and secondary education", never separate "Primary" and "Secondary"). Health services delivered to the same people stay ONE program (medical check-ups, vaccinations and dental care become "Medical and dental care", never separate "Medical care" and "Dental care"). Fold small supporting activities into the program they serve (hygiene education or school counselors belong to the health or education program).',
                            '  Read the body text, not just menus and lists. A service described in sentences still counts when the site says the organization delivers it, e.g. "every student receives a hot meal each school day" is a feeding program.',
                            '  NEVER return as a program: generic categories or website menu headings ("Education", "Healthcare and wellbeing", "Community"); funding or giving mechanisms ("Child sponsorship", "Donate", "Monthly giving", "Gift catalog", "Adopt a family"); events, galas, trips or campaigns; catch-all buckets ("Special projects", "Meeting needs", "Other initiatives", "Our work"); internal operations (hiring or employing staff, employee counts, internships, buying local supplies, fundraising). If one of these describes real services (e.g. sponsorship pays for school fees and meals), return the underlying services instead.',
                            '  Self-check before answering: for every program, could a staff member log a number against it next month? If not, rename it to the specific service or drop it. Then check pairs: would the same staff report both numbers to the same manager? If yes, merge them into one program.',
                            '  title: the specific service name. description: 2-3 sentences on what is delivered, to whom, and where. region: where it runs if stated, else "". source: 5-15 words copied word for word from the content that prove the organization runs it (no paraphrasing; programs whose quote is not in the content are discarded).',
                            `- METRICS (3-${MAX_METRICS}): measurable indicators for the programs above. Describe WHAT is measured, never a value. Each metric should belong to a specific program (e.g. "students enrolled" to the education program, "patients treated" to the medical program), aim for 1-3 per program. Prefer metrics the site already reports. title: a short noun phrase of what is counted, 2-4 words, e.g. "Meals provided", "Students enrolled", "Patients treated", "Wells built". NEVER put a time period or frequency in the title ("per day", "daily", "per year", "annually", "this year", "in 2024"): the reporting period is chosen later when numbers are logged. Also no "Number of" prefix, no targets, and no scope details in parentheses (put those in the description). Never suggest internal operations (staff or employees hired, volunteers, budget, fundraising) or fixed facts that do not change as work happens (grades offered, years active, number of sites). Balance categories: input = resources in, output = direct results delivered, impact = longer-term change. unit_of_measurement: plain unit like "people", "meals", "hours", "%". program_indexes: zero-based indexes into PROGRAMS this metric applies to (at least one; only use several when the metric truly spans them). rationale: one short sentence on why, citing the site if possible.`,
                            `- LOCATIONS (0-${MAX_LOCATIONS}): specific cities, towns, regions, or countries where the organization delivers its work, as named on the site. When the site lists individual sites (schools, clinics, villages, branches, often as links under headings like "Our schools" or "Where we work"), return EACH one instead of only the wider region. Do not include a head-office mailing address unless it is also where programs run. Never return the wider region itself as a location when you are listing the sites inside it. name: the place itself only (e.g. "Mathare"), never with the area or country attached, never a building or street address. area: the town, city or district the place sits in, as the site describes it ("14 villages in the Kisumu area" gives each village area "Kisumu"); empty when the place is itself a city or region. country: the full country name. Return an empty array if no places are named. program_indexes: programs that run there (empty if unclear).`,
                            '- SERVICE_AREA: the main town, city or district where the work happens, as a bare place name a map would know (e.g. "14 villages in the Kisumu area" gives "Kisumu"). Empty if the site only names a country or works in many unrelated places.',
                            '- ORGANIZATION: description (3-4 sentences on mission, approach, geography), statement (one-line mission under 150 characters), donation_url (full URL to the donate page if one appears in the content, else "").',
                            '- STORY: problem_statement (2-4 sentences on the problem they address), theory_of_change (2-4 sentences linking activities to long-term change), theory_of_change_stages (2-5 short steps), strategies (2-5 approaches they use). Use "" or [] when the site gives nothing to go on.',
                            '',
                            ...existingPromptBlock(existing),
                            '',
                            'Scraped website content:',
                            context,
                        ].join('\n'),
                    },
                ],
            } as any,
            { timeout: 50000 }
        );

        const content = completion.choices[0]?.message?.content;
        logStep(traceId, 'SETUP', 'extract completion received', {
            ms: Date.now() - startedAt,
            finishReason: completion.choices[0]?.finish_reason || null,
            totalTokens: (completion as any)?.usage?.total_tokens ?? null,
        });
        if (!content) throw setupError(422, 'invalid_generated_draft', 'We could not make sense of that website. Try again.');

        let parsed: any;
        try {
            parsed = JSON.parse(content);
        } catch {
            throw setupError(422, 'invalid_generated_draft', 'We could not make sense of that website. Try again.');
        }

        const draft = normalizeExtraction(parsed, websiteUrl, existing, context, traceId);
        if (draft.programs.length === 0) {
            throw setupError(422, 'no_programs_found', 'We could not find any programs on that website. Try another page or set up manually.');
        }
        return draft;
    }

    static async applyStep(userId: string, step: SiteSetupApplyStep, requestedOrgId?: string): Promise<SiteSetupStepResult> {
        const orgId = await this.assertCanSetup(userId, requestedOrgId);
        const started = Date.now();
        let result: SiteSetupStepResult;
        switch (step?.kind) {
            case 'program': result = await this.applyProgram(userId, step.program, requestedOrgId); break;
            case 'metric': result = await this.applyMetric(userId, orgId, step.metric, step.program_id_map, requestedOrgId); break;
            case 'location': result = await this.applyLocation(userId, orgId, step.location, step.program_id_map, requestedOrgId); break;
            case 'profile': result = await this.applyProfile(userId, orgId, step); break;
            default: throw setupError(400, 'invalid_step', 'Unknown setup step.');
        }
        logStep(newTraceId(), 'SETUP', 'apply step', { kind: step.kind, ms: Date.now() - started, errors: result.errors.length });
        return result;
    }

    private static async applyProgram(userId: string, p: SetupProgram, requestedOrgId?: string): Promise<SiteSetupStepResult> {
        const title = cleanText(p?.title, 140);
        if (!title) return { id: null, errors: [] };
        const usage = await SubscriptionService.getInitiativesUsage(userId, requestedOrgId);
        if (usage.limit !== null && usage.current >= usage.limit) {
            return { id: null, errors: [`${title}: program limit reached on your plan`] };
        }
        try {
            const initiative = await InitiativeService.create(
                {
                    title,
                    description: cleanText(p?.description, 1200) || title,
                    region: cleanText(p?.region, 120) || undefined,
                } as any,
                userId,
                requestedOrgId
            );
            return { id: initiative.id ?? null, errors: [] };
        } catch (e) {
            return { id: null, errors: [`${title}: ${(e as Error).message}`] };
        }
    }

    private static async applyMetric(
        userId: string,
        orgId: string,
        m: SetupMetric,
        programIdMap: Record<string, string>,
        requestedOrgId?: string
    ): Promise<SiteSetupStepResult> {
        const title = cleanText(m?.title, 120);
        if (!title) return { id: null, errors: [] };
        const initiativeIds = mapProgramIds(m?.program_ids, programIdMap);
        const attachAll = async (definitionId: string): Promise<SiteSetupStepResult> => {
            const errors: string[] = [];
            for (const initiativeId of initiativeIds) {
                try {
                    await MetricDefinitionService.attachToInitiative(definitionId, initiativeId, userId, requestedOrgId);
                } catch (attachErr) {
                    errors.push(`${title}: ${(attachErr as Error).message}`);
                }
            }
            return { id: definitionId, errors };
        };
        if (m?.existing_id) {
            const { data: owned } = await supabase
                .from('metric_definitions')
                .select('id')
                .eq('id', m.existing_id)
                .eq('organization_id', orgId)
                .maybeSingle();
            if (!owned) return { id: null, errors: [`${title}: metric no longer exists`] };
            return attachAll(owned.id);
        }
        try {
            const created = await MetricDefinitionService.create(
                {
                    title,
                    description: cleanText(m?.description, 500),
                    metric_type: metricType(m?.metric_type),
                    unit_of_measurement: cleanText(m?.unit_of_measurement, 60) || 'people',
                    category: metricCategory(m?.category),
                    initiative_ids: initiativeIds,
                },
                userId,
                requestedOrgId
            );
            return { id: created.id ?? null, errors: [] };
        } catch (e) {
            const message = (e as Error).message;
            if (!message.includes('already has a metric')) return { id: null, errors: [`${title}: ${message}`] };
            const { data: existing } = await supabase
                .from('metric_definitions')
                .select('id')
                .eq('organization_id', orgId)
                .ilike('title', title)
                .maybeSingle();
            if (!existing) return { id: null, errors: [`${title}: ${message}`] };
            return attachAll(existing.id);
        }
    }

    private static async applyLocation(
        userId: string,
        orgId: string,
        l: SetupLocation,
        programIdMap: Record<string, string>,
        requestedOrgId?: string
    ): Promise<SiteSetupStepResult> {
        const name = cleanText(l?.name, 120);
        if (!name) return { id: null, errors: [] };
        if (l?.existing_id) {
            const { data: owned } = await supabase
                .from('locations')
                .select('id')
                .eq('id', l.existing_id)
                .eq('organization_id', orgId)
                .maybeSingle();
            if (!owned) return { id: null, errors: [`${name}: location no longer exists`] };
            const errors: string[] = [];
            for (const initiativeId of mapProgramIds(l?.program_ids, programIdMap)) {
                await LocationService.linkToInitiative(owned.id, initiativeId, userId, requestedOrgId).catch((e) =>
                    errors.push(`${name}: ${(e as Error).message}`)
                );
            }
            return { id: owned.id, errors };
        }
        const usage = await SubscriptionService.getLocationsUsage(userId, requestedOrgId);
        if (usage.limit !== null && usage.current >= usage.limit) {
            return { id: null, errors: [`${name}: location limit reached on your plan`] };
        }
        const country = cleanText(l?.country, 80);
        let latitude = coord(l?.latitude, 90);
        let longitude = coord(l?.longitude, 180);
        let resolvedCountry = country;
        if (latitude === null || longitude === null) {
            // "Village, Area" first so namesakes elsewhere lose; then the place
            // alone; then pin to the area itself.
            const area = cleanText(l?.area, 80);
            const geo = area
                ? (await geocode(`${name}, ${area}`, country)) || (await geocode(name, country)) || (await geocode(area, country))
                : await geocode(name, country);
            if (!geo) return { id: null, errors: [`${name}: could not find it on the map`] };
            latitude = geo.lat;
            longitude = geo.lng;
            resolvedCountry = country || geo.country || '';
        }
        const initiativeIds = mapProgramIds(l?.program_ids, programIdMap);
        try {
            const location = await LocationService.create(
                {
                    name,
                    latitude,
                    longitude,
                    country: resolvedCountry || undefined,
                    initiative_id: initiativeIds[0],
                } as any,
                userId,
                requestedOrgId
            );
            const errors: string[] = [];
            for (const initiativeId of initiativeIds.slice(1)) {
                await LocationService.linkToInitiative(location.id!, initiativeId, userId, requestedOrgId).catch((e) =>
                    errors.push(`${name}: ${(e as Error).message}`)
                );
            }
            return { id: location.id ?? null, errors };
        } catch (e) {
            return { id: null, errors: [`${name}: ${(e as Error).message}`] };
        }
    }

    /** Organization text, brand color, logo and story. Never overwrites existing text. */
    private static async applyProfile(
        userId: string,
        orgId: string,
        input: Extract<SiteSetupApplyStep, { kind: 'profile' }>
    ): Promise<SiteSetupStepResult> {
        const errors: string[] = [];
        const logoUrl = normalizeHttpUrl(input?.branding?.logo_url);

        const profileTask = (async () => {
            try {
                const current = await OrganizationService.getById(orgId, userId);
                const updates: Record<string, any> = {};
                const websiteUrl = normalizeHttpUrl(input?.website_url);
                if (websiteUrl && !current?.website_url) updates.website_url = websiteUrl;
                const description = cleanText(input?.organization?.description, 900);
                if (description && !current?.description) updates.description = description;
                const statement = cleanText(input?.organization?.statement, 150);
                if (statement && !current?.statement) updates.statement = statement;
                const donationUrl = normalizeHttpUrl(input?.organization?.donation_url);
                if (donationUrl && !current?.donation_url) updates.donation_url = donationUrl;
                const color = typeof input?.branding?.brand_color === 'string' ? input.branding.brand_color.trim().toLowerCase() : '';
                if (/^#[0-9a-f]{6}$/.test(color)) updates.brand_color = color;
                if (Object.keys(updates).length > 0) await OrganizationService.update(orgId, updates, userId);
            } catch (e) {
                errors.push(`Organization profile: ${(e as Error).message}`);
            }
        })();

        // Downloaded in parallel; written after the profile update so the two org writes don't race.
        const logoTask = logoUrl
            ? (async () => {
                const raw = await fetchPublicImage(logoUrl);
                const sharp = (await import('sharp')).default;
                return sharp(raw, { density: 300 })
                    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
                    .png()
                    .toBuffer();
            })().catch((e: Error) => e)
            : null;

        const storyTask = input?.story
            ? (async () => {
                try {
                    const story = normalizeStory(input.story);
                    const existing = await OrganizationContextService.getForOwner(orgId, userId);
                    const patch: Record<string, any> = {};
                    if (story.problem_statement && !existing?.problem_statement) patch.problem_statement = story.problem_statement;
                    if (story.theory_of_change && !existing?.theory_of_change) patch.theory_of_change = story.theory_of_change;
                    if (story.theory_of_change_stages.length && !(existing?.theory_of_change_stages || []).length) {
                        patch.theory_of_change_stages = story.theory_of_change_stages;
                    }
                    if (story.strategies.length && !(existing?.strategies || []).length) patch.strategies = story.strategies;
                    if (Object.keys(patch).length > 0) await OrganizationContextService.upsertForOwner(orgId, userId, patch as any);
                } catch (e) {
                    errors.push(`Your story: ${(e as Error).message}`);
                }
            })()
            : Promise.resolve();

        await profileTask;
        if (logoTask) {
            try {
                const png = await logoTask;
                if (png instanceof Error) throw png;
                await OrganizationService.replaceLogo(orgId, userId, png, 'image/png', '.png');
            } catch (e) {
                logWarn(newTraceId(), 'SETUP', 'logo import failed', { logoUrl, error: (e as Error).message.slice(0, 200) });
                errors.push('Logo: we could not import it, upload it from Account settings instead');
            }
        }
        await storyTask;
        return { id: orgId, errors };
    }
}
