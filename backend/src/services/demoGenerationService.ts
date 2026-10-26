import { openai, isOpenAIConfigured } from '../utils/openai';
import {
    DemoPersistenceService,
    GeneratedDemoDraft,
    GeneratedMetric,
    GeneratedMetricCategory,
    GeneratedMetricType,
} from './demoPersistenceService';
import {
    SiteCrawlError,
    assertEnoughContent,
    cleanText,
    configError,
    discoverUrls,
    envMaxPages,
    logStep,
    logWarn,
    newTraceId,
    normalizeWebsiteUrl,
    packScrapedContext,
    scrapeError,
    scrapeUrls,
    summarizeUrl,
} from './siteCrawlService';

export { SiteCrawlError as DemoGenerationError } from './siteCrawlService';

const DEFAULT_MODEL = 'gpt-5.4-nano';
const DEFAULT_BRAND_COLOR = '#c0dfa1';

const DEMO_DRAFT_SCHEMA: Record<string, any> = {
    type: 'object',
    additionalProperties: false,
    required: ['organization', 'context', 'initiative', 'locations', 'beneficiary_groups', 'metrics', 'stories'],
    properties: {
        organization: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'description', 'statement', 'website_url', 'donation_url', 'logo_url', 'brand_color'],
            properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                statement: { type: 'string' },
                website_url: { type: 'string' },
                donation_url: { type: 'string' },
                logo_url: { type: 'string' },
                brand_color: { type: 'string' },
            },
        },
        context: {
            type: 'object',
            additionalProperties: false,
            required: [
                'problem_statement',
                'theory_of_change',
                'additional_info',
                'stats_and_statements',
                'theory_of_change_stages',
                'strategies',
            ],
            properties: {
                problem_statement: { type: 'string' },
                theory_of_change: { type: 'string' },
                additional_info: { type: 'string' },
                stats_and_statements: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['type', 'value', 'title', 'description', 'source', 'source_url'],
                        properties: {
                            type: { type: 'string', enum: ['stat', 'statement'] },
                            value: { type: 'string' },
                            title: { type: 'string' },
                            description: { type: 'string' },
                            source: { type: 'string' },
                            source_url: { type: 'string' },
                        },
                    },
                },
                theory_of_change_stages: {
                    type: 'array',
                    items: titledItemSchema(),
                },
                strategies: {
                    type: 'array',
                    items: titledItemSchema(),
                },
            },
        },
        initiative: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'description', 'region', 'location'],
            properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                region: { type: 'string' },
                location: { type: 'string' },
            },
        },
        locations: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['name', 'description', 'latitude', 'longitude', 'country'],
                properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    country: { type: 'string' },
                },
            },
        },
        beneficiary_groups: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['name', 'description', 'age_range_start', 'age_range_end', 'total_number'],
                properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    age_range_start: nullableIntegerSchema(),
                    age_range_end: nullableIntegerSchema(),
                    total_number: nullableIntegerSchema(),
                },
            },
        },
        metrics: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'description', 'metric_type', 'unit_of_measurement', 'category', 'updates'],
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    metric_type: { type: 'string', enum: ['number', 'percentage'] },
                    unit_of_measurement: { type: 'string' },
                    category: { type: 'string', enum: ['input', 'output', 'impact'] },
                    updates: {
                        type: 'array',
                        minItems: 4,
                        maxItems: 6,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['value', 'date_represented', 'label', 'note', 'location_index', 'beneficiary_group_indexes'],
                            properties: {
                                value: { type: 'number' },
                                date_represented: { type: 'string' },
                                label: { type: 'string' },
                                note: { type: 'string' },
                                location_index: { type: 'integer' },
                                beneficiary_group_indexes: {
                                    type: 'array',
                                    items: { type: 'integer' },
                                },
                            },
                        },
                    },
                },
            },
        },
        stories: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'description', 'date_represented', 'location_index', 'beneficiary_group_indexes'],
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    date_represented: { type: 'string' },
                    location_index: { type: 'integer' },
                    beneficiary_group_indexes: {
                        type: 'array',
                        items: { type: 'integer' },
                    },
                },
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

function nullableIntegerSchema(): Record<string, any> {
    return {
        anyOf: [
            { type: 'integer' },
            { type: 'null' },
        ],
    };
}

function ensureText(value: unknown, label: string, maxLength: number): string {
    const next = cleanText(value, maxLength);
    if (!next) throw invalidDraft(`${label} is required`);
    return next;
}

function invalidDraft(details: string): SiteCrawlError {
    return new SiteCrawlError(
        422,
        'invalid_generated_draft',
        'The generated draft was incomplete. Try again or create a manual demo.',
        details
    );
}

function todayString(): string {
    return new Date().toISOString().slice(0, 10);
}

function fallbackDate(index: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() - (index + 2));
    d.setDate(15);
    return d.toISOString().slice(0, 10);
}

function safeDate(value: unknown, index: number): string {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallbackDate(index);
    if (raw > todayString()) return fallbackDate(index);
    return raw;
}

// Redistribute update dates so charts look natural and always have data in the current month.
// Newest update lands on day 1 of the current month (no jitter applied to it), oldest ≈ 170 days ago.
function distributeUpdateDates<T extends { date_represented: string }>(updates: T[]): T[] {
    if (updates.length <= 1) return updates;

    const today = new Date();
    const n = updates.length;
    const sorted = [...updates].sort((a, b) => (a.date_represented < b.date_represented ? -1 : 1));

    const oldestDaysAgo = 170;
    // Anchor newest update to day 1 of the current month so graphs never show a current-month gap.
    const newestDaysAgo = today.getDate() - 1; // 0 on the 1st, 9 on the 10th, etc.
    const span = oldestDaysAgo - newestDaysAgo;
    const slotSize = span / Math.max(1, n - 1);
    const maxJitter = Math.min(slotSize * 0.35, 10);

    return sorted.map((u, i) => {
        const isNewest = i === n - 1;
        const t = n === 1 ? 0 : i / (n - 1);
        const baseDaysAgo = oldestDaysAgo - t * span;
        // No jitter on the newest point — keeps it firmly within the current month.
        const jitter = isNewest ? 0 : (Math.random() * 2 - 1) * maxJitter;
        const daysAgo = Math.round(Math.max(newestDaysAgo, Math.min(oldestDaysAgo, baseDaysAgo + jitter)));

        const d = new Date(today);
        d.setDate(d.getDate() - daysAgo);
        return {
            ...u,
            date_represented: d.toISOString().slice(0, 10),
        };
    });
}

function clampIndex(value: unknown, length: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || length <= 0) return 0;
    return Math.min(Math.max(Math.floor(numeric), 0), length - 1);
}

function normalizeIndexes(value: unknown, length: number): number[] {
    if (!Array.isArray(value) || length <= 0) return [];
    return [...new Set(value.map((item) => clampIndex(item, length)))];
}

function normalizeUrl(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
        const parsed = new URL(value.trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
    } catch {
        return '';
    }
}

function normalizeBrandColor(value: unknown, fallback: string): string {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
    return fallback;
}

function nullableInteger(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Math.round(numeric));
}

function normalizeMetricType(value: unknown): GeneratedMetricType {
    return value === 'percentage' ? 'percentage' : 'number';
}

function normalizeMetricCategory(value: unknown): GeneratedMetricCategory {
    return value === 'input' || value === 'impact' ? value : 'output';
}

function normalizeDraft(raw: any, sourceUrl: string, hints: { nameOverride?: string }): GeneratedDemoDraft {
    if (!raw || typeof raw !== 'object') throw invalidDraft('Draft root is not an object');
    const organization = raw.organization || {};
    const context = raw.context || {};
    const initiative = raw.initiative || {};

    const locationsRaw = Array.isArray(raw.locations) ? raw.locations.slice(0, 4) : [];
    if (locationsRaw.length === 0) throw invalidDraft('At least one location is required');
    const locations = locationsRaw.map((loc: any, index: number) => {
        const latitude = Number(loc?.latitude);
        const longitude = Number(loc?.longitude);
        return {
            name: ensureText(loc?.name, `Location ${index + 1} name`, 120),
            description: cleanText(loc?.description, 500),
            latitude: Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : 43.6532,
            longitude: Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : -79.3832,
            country: cleanText(loc?.country, 80),
        };
    });

    const groupsRaw = Array.isArray(raw.beneficiary_groups) ? raw.beneficiary_groups.slice(0, 2) : [];
    if (groupsRaw.length === 0) throw invalidDraft('At least one beneficiary group is required');
    const beneficiaryGroups = groupsRaw.map((group: any, index: number) => ({
        name: ensureText(group?.name, `Beneficiary group ${index + 1} name`, 120),
        description: ensureText(group?.description, `Beneficiary group ${index + 1} description`, 700),
        age_range_start: nullableInteger(group?.age_range_start),
        age_range_end: nullableInteger(group?.age_range_end),
        total_number: nullableInteger(group?.total_number),
    }));

    const metricsRaw = Array.isArray(raw.metrics) ? raw.metrics.slice(0, 6) : [];
    if (metricsRaw.length < 4) throw invalidDraft('At least four metrics are required');
    const metrics: GeneratedMetric[] = metricsRaw.map((metric: any, metricIndex: number) => {
        const metricType = normalizeMetricType(metric?.metric_type);
        const updatesRaw = Array.isArray(metric?.updates) ? metric.updates.slice(0, 6) : [];
        if (updatesRaw.length < 4) throw invalidDraft(`Metric ${metricIndex + 1} needs at least four updates`);

        const updatesNormalized = updatesRaw.map((update: any, updateIndex: number) => {
            const value = Number(update?.value);
            const boundedValue = metricType === 'percentage'
                ? Math.min(Math.max(Number.isFinite(value) ? value : 75, 0), 100)
                : Math.max(Number.isFinite(value) ? value : 1, 0);

            return {
                value: Math.round(boundedValue * 100) / 100,
                date_represented: safeDate(update?.date_represented, metricIndex * 4 + updateIndex),
                label: cleanText(update?.label, 120, `Update ${updateIndex + 1}`),
                note: cleanText(update?.note, 500),
                location_index: clampIndex(update?.location_index, locations.length),
                beneficiary_group_indexes: normalizeIndexes(update?.beneficiary_group_indexes, beneficiaryGroups.length),
            };
        });

        return {
            title: ensureText(metric?.title, `Metric ${metricIndex + 1} title`, 120),
            description: ensureText(metric?.description, `Metric ${metricIndex + 1} description`, 500),
            metric_type: metricType,
            unit_of_measurement: cleanText(metric?.unit_of_measurement, 60, metricType === 'percentage' ? '%' : 'people') || (metricType === 'percentage' ? '%' : 'people'),
            category: normalizeMetricCategory(metric?.category),
            updates: distributeUpdateDates(updatesNormalized),
        };
    });

    const storiesRaw = Array.isArray(raw.stories) ? raw.stories.slice(0, 2) : [];
    if (storiesRaw.length === 0) throw invalidDraft('At least one story is required');

    return {
        organization: {
            name: ensureText(hints.nameOverride || organization.name, 'Organization name', 120),
            description: ensureText(organization.description, 'Organization description', 900),
            statement: ensureText(organization.statement, 'Organization statement', 150),
            website_url: normalizeUrl(organization.website_url) || sourceUrl,
            donation_url: normalizeUrl(organization.donation_url),
            logo_url: '',
            brand_color: DEFAULT_BRAND_COLOR,
        },
        context: {
            problem_statement: ensureText(context.problem_statement, 'Problem statement', 1200),
            theory_of_change: ensureText(context.theory_of_change, 'Theory of change', 1200),
            additional_info: cleanText(context.additional_info, 1200),
            stats_and_statements: (Array.isArray(context.stats_and_statements) ? context.stats_and_statements : [])
                .slice(0, 6)
                .map((card: any) => ({
                    type: card?.type === 'stat' ? 'stat' as const : 'statement' as const,
                    value: cleanText(card?.value, 80),
                    title: cleanText(card?.title, 120),
                    description: cleanText(card?.description, 500),
                    source: cleanText(card?.source, 120),
                    source_url: normalizeUrl(card?.source_url),
                }))
                .filter((card: any) => card.type === 'stat' ? card.value : (card.title || card.description)),
            theory_of_change_stages: (Array.isArray(context.theory_of_change_stages) ? context.theory_of_change_stages : [])
                .slice(0, 5)
                .map((stage: any) => ({
                    title: cleanText(stage?.title, 120),
                    description: cleanText(stage?.description, 500),
                }))
                .filter((stage: any) => stage.title && stage.description),
            strategies: (Array.isArray(context.strategies) ? context.strategies : [])
                .slice(0, 5)
                .map((strategy: any) => ({
                    title: cleanText(strategy?.title, 120),
                    description: cleanText(strategy?.description, 500),
                }))
                .filter((strategy: any) => strategy.title && strategy.description),
        },
        initiative: {
            title: ensureText(initiative.title, 'Program title', 140),
            description: ensureText(initiative.description, 'Program description', 1200),
            region: cleanText(initiative.region, 120),
            location: cleanText(initiative.location, 120) || locations[0].name,
        },
        locations,
        beneficiary_groups: beneficiaryGroups,
        metrics,
        stories: storiesRaw.map((story: any, index: number) => ({
            title: ensureText(story?.title, `Story ${index + 1} title`, 140),
            description: ensureText(story?.description, `Story ${index + 1} description`, 1200),
            date_represented: safeDate(story?.date_represented, index),
            location_index: clampIndex(story?.location_index, locations.length),
            beneficiary_group_indexes: normalizeIndexes(story?.beneficiary_group_indexes, beneficiaryGroups.length),
        })),
    };
}

export class DemoGenerationService {
    static async generateFromWebsite(
        userId: string,
        input: { website_url: unknown; name?: unknown },
        organizationId?: string
    ): Promise<any> {
        const traceId = newTraceId();
        const overallStart = Date.now();

        if (!isOpenAIConfigured()) {
            throw configError('OPENAI_API_KEY is missing');
        }

        const websiteUrl = normalizeWebsiteUrl(input.website_url);
        const nameOverride = typeof input.name === 'string' ? input.name.trim() : '';
        const maxPages = envMaxPages();

        logStep(traceId, '0/6 START', 'demo generation requested', {
            userId,
            websiteUrl,
            nameOverride: nameOverride || null,
            maxPages,
        });

        const discoverStart = Date.now();
        logStep(traceId, '1/6 DISCOVER', 'mapping site for high-signal pages', { websiteUrl });
        const selectedUrls = await discoverUrls(websiteUrl, maxPages, traceId);
        logStep(traceId, '1/6 DISCOVER', 'selected pages', {
            ms: Date.now() - discoverStart,
            count: selectedUrls.length,
            urls: selectedUrls.map(summarizeUrl),
        });

        const scrapeStart = Date.now();
        logStep(traceId, '2/6 SCRAPE', 'scraping selected pages in parallel', { count: selectedUrls.length });
        const { pages: scrapedPages, homepageOk } = await scrapeUrls(selectedUrls, traceId, websiteUrl);
        logStep(traceId, '2/6 SCRAPE', 'scrape step done', { ms: Date.now() - scrapeStart });
        assertEnoughContent(scrapedPages, selectedUrls.length, traceId, homepageOk);

        const packedContext = packScrapedContext(scrapedPages);
        logStep(traceId, '3/6 EXTRACT', 'packed context', {
            packedContextChars: packedContext.length,
        });

        const draftStart = Date.now();
        logStep(traceId, '4/6 OPENAI', 'requesting structured draft from OpenAI', {
            model: process.env.OPENAI_DEMO_MODEL || DEFAULT_MODEL,
            promptChars: packedContext.length,
        });
        const draft = await this.generateDraft({
            traceId,
            websiteUrl,
            nameOverride,
            packedContext,
        });
        logStep(traceId, '4/6 OPENAI', 'draft normalized', {
            ms: Date.now() - draftStart,
            organizationName: draft.organization.name,
            metrics: draft.metrics.length,
            metricUpdates: draft.metrics.reduce((s, m) => s + m.updates.length, 0),
            locations: draft.locations.length,
            beneficiaryGroups: draft.beneficiary_groups.length,
            stories: draft.stories.length,
        });

        const persistStart = Date.now();
        logStep(traceId, '5/6 PERSIST', 'writing demo org to database', {
            mode: organizationId ? 'populate-existing' : 'create-new',
            organizationId: organizationId || null,
        });
        const persisted = organizationId
            ? await DemoPersistenceService.populateExistingDemo(organizationId, userId, draft)
            : await DemoPersistenceService.createGeneratedDemo(userId, draft, nameOverride);
        logStep(traceId, '5/6 PERSIST', 'demo org created', {
            ms: Date.now() - persistStart,
            organizationId: (persisted as any)?.id ?? (persisted as any)?.organization?.id ?? null,
            slug: (persisted as any)?.slug ?? (persisted as any)?.organization?.slug ?? null,
        });

        logStep(traceId, '6/6 DONE', 'demo generation complete', {
            totalMs: Date.now() - overallStart,
        });

        return persisted;
    }

    private static async generateDraft(args: {
        traceId: string;
        websiteUrl: string;
        nameOverride: string;
        packedContext: string;
    }): Promise<GeneratedDemoDraft> {
        if (!args.packedContext.trim()) throw scrapeError('Scraped pages contained no usable text');

        const model = process.env.OPENAI_DEMO_MODEL || DEFAULT_MODEL;
        const callStart = Date.now();
        const completion = await openai!.chat.completions.create({
            model,
            temperature: 0.7,
            max_completion_tokens: 8000,
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'generated_demo_draft',
                    strict: true,
                    schema: DEMO_DRAFT_SCHEMA,
                },
            } as any,
            messages: [
                {
                    role: 'system',
                    content: [
                        'You create synthetic demo data for a charity impact platform.',
                        'Your top priority is generating rich, plausible IMPACT DATA: metrics with multiple historical updates (the "impact claims"), specific real-coordinate locations, and well-defined beneficiary groups.',
                        'Use the scraped website to infer the organization, mission, program themes, geographic service areas, and target beneficiaries.',
                        'All metric values, beneficiary numbers, dates, and story details are dummy demo data, not factual claims about the real organization.',
                        'Write detailed, substantive descriptions throughout — organization description (3-5 sentences covering mission, approach, and geography), problem statement (3-4 sentences on the root cause and scale), theory of change (3-4 sentences linking inputs to long-term impact), program description (3-4 sentences on what the program does and who it serves), beneficiary group descriptions (2-3 sentences on who they are and why they need support), metric descriptions (2-3 sentences explaining what is measured and why it matters), and stories (3-5 sentences with specific detail — setting, challenge overcome, outcome).',
                        'Do not invent real person names. Use group-level story language.',
                        'Use only dates on or before today.',
                        'Return only the JSON object required by the schema.',
                    ].join(' '),
                },
                {
                    role: 'user',
                    content: [
                        `Website URL: ${args.websiteUrl}`,
                        args.nameOverride ? `Admin requested demo name: ${args.nameOverride}` : '',
                        `Today: ${todayString()}`,
                        '',
                        'Required demo profile (focus on impact data; branding will be set manually later):',
                        '- 1 organization profile (name, short description, mission statement, website_url)',
                        '- Organization context: problem_statement, theory_of_change, 2-5 theory_of_change_stages, 2-5 strategies',
                        '- 1 program',
                        '- LOCATIONS (1 to 4): READ THE SCRAPED CONTENT CAREFULLY for any specific city, town, region, district, province, or country names where the organization operates. Return one location per distinct named place you find, up to 4. Examples of signals: "we work in Port-au-Prince and Jacmel", "our school in Cité Soleil", "programs across rural Haiti and the Dominican Republic", "communities in Bukavu, Goma, and Kinshasa". Use real latitude/longitude for each named place. If the content only ever mentions one country with no city-level detail, then 1 location is fine — but err on the side of including multiple if multiple place names appear.',
                        '- BENEFICIARY GROUPS: 1-2 groups, each with name, description, plausible age range and total_number',
                        '- METRICS: 4-6 metrics, balanced across input/output/impact categories.',
                        '- METRIC UPDATES (impact claims): EACH METRIC MUST HAVE 4 to 6 updates. These are the historical impact claims and the most important data.',
                        `  Date rules — VERY IMPORTANT: spread updates across time. The most recent update should be roughly 1-3 months before today (${todayString()}). The earliest update should be at least 18-30 months ago. Use a roughly quarterly cadence between them. NEVER put two updates on the same exact date and NEVER cluster them within the same week. Example pattern for 5 updates if today is 2026-05-10: 2026-03-15, 2025-11-10, 2025-07-20, 2025-03-05, 2024-09-12.`,
                        '  Vary the values too — show realistic growth or seasonality, not flat or random numbers. Each update needs a descriptive label (e.g. "Q1 2026 enrollment", "Spring 2025 cohort"), a note of 1-2 full sentences providing context for that data point (e.g. what drove the change, seasonal factors, a specific milestone), and the appropriate location_index + beneficiary_group_indexes.',
                        '- 1-2 text-only stories (each 3-5 sentences: set the scene, describe a real challenge faced, explain how the program helped, and state the concrete outcome)',
                        '- no evidence records or uploaded files',
                        '',
                        'For percentage metrics, values must be 0-100. For number metrics, use realistic absolute counts.',
                        'For location_index and beneficiary_group_indexes, reference zero-based indexes from the arrays you return.',
                        'Mission statement under 150 characters.',
                        '',
                        'Scraped website context:',
                        args.packedContext,
                    ].filter(Boolean).join('\n'),
                },
            ],
        } as any);

        const content = completion.choices[0]?.message?.content;
        const usage = (completion as any)?.usage || {};
        logStep(args.traceId, '4/6 OPENAI', 'completion received', {
            ms: Date.now() - callStart,
            model,
            finishReason: completion.choices[0]?.finish_reason || null,
            promptTokens: usage.prompt_tokens ?? null,
            completionTokens: usage.completion_tokens ?? null,
            totalTokens: usage.total_tokens ?? null,
            contentChars: content?.length ?? 0,
        });
        if (!content) throw invalidDraft('OpenAI returned no content');

        let parsed: any;
        try {
            parsed = JSON.parse(content);
        } catch (error) {
            logWarn(args.traceId, '4/6 OPENAI', 'failed to parse JSON content', {
                error: error instanceof Error ? error.message.slice(0, 240) : String(error),
                preview: content.slice(0, 200),
            });
            throw invalidDraft(error instanceof Error ? error.message : 'OpenAI returned invalid JSON');
        }

        try {
            return normalizeDraft(parsed, args.websiteUrl, {
                nameOverride: args.nameOverride,
            });
        } catch (error) {
            logWarn(args.traceId, '4/6 OPENAI', 'draft normalization rejected the model output', {
                error: error instanceof Error ? error.message.slice(0, 240) : String(error),
            });
            throw error;
        }
    }
}
