import net from 'net';
import { openai, isOpenAIConfigured } from '../utils/openai';
import {
    DemoPersistenceService,
    GeneratedDemoDraft,
    GeneratedMetric,
    GeneratedMetricCategory,
    GeneratedMetricType,
} from './demoPersistenceService';

type FirecrawlMapLink = {
    url?: string;
    title?: string;
    description?: string;
} | string;

type FirecrawlScrapeData = {
    markdown?: string;
    summary?: string;
    images?: string[];
    metadata?: Record<string, any>;
    branding?: Record<string, any>;
};

type ScrapedPage = {
    url: string;
    title: string;
    description: string;
    markdown: string;
    summary: string;
    images: string[];
    metadata: Record<string, any>;
    branding: Record<string, any>;
};

export class DemoGenerationError extends Error {
    status: number;
    code: string;
    publicMessage: string;

    constructor(status: number, code: string, publicMessage: string, details?: string) {
        super(details || publicMessage);
        this.status = status;
        this.code = code;
        this.publicMessage = publicMessage;
    }
}

const FIRECRAWL_BASE_URL = 'https://api.firecrawl.dev/v2';
const DEFAULT_MAX_PAGES = 5;
const MAX_PAGE_MARKDOWN_CHARS = 6000;
const MAX_TOTAL_CONTEXT_CHARS = 26000;
const DEFAULT_MODEL = 'gpt-4o-mini';

const HIGH_SIGNAL_PATTERNS = [
    /about/i,
    /who-we-are/i,
    /mission/i,
    /vision/i,
    /program/i,
    /programme/i,
    /service/i,
    /work/i,
    /impact/i,
    /outcome/i,
    /result/i,
    /report/i,
    /annual/i,
    /strategy/i,
    /donate/i,
];

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

function cleanText(value: unknown, maxLength: number, fallback = ''): string {
    const raw = typeof value === 'string' ? value : fallback;
    const normalized = raw.replace(/\s+/g, ' ').trim();
    return normalized.slice(0, maxLength);
}

function ensureText(value: unknown, label: string, maxLength: number): string {
    const next = cleanText(value, maxLength);
    if (!next) throw invalidDraft(`${label} is required`);
    return next;
}

function invalidDraft(details: string): DemoGenerationError {
    return new DemoGenerationError(
        422,
        'invalid_generated_draft',
        'The generated draft was incomplete. Try again or create a manual demo.',
        details
    );
}

function configError(details: string): DemoGenerationError {
    return new DemoGenerationError(
        500,
        'demo_generation_not_configured',
        'AI demo generation is not configured.',
        details
    );
}

function scrapeError(details: string): DemoGenerationError {
    return new DemoGenerationError(
        502,
        'website_scrape_failed',
        'We could not read that website.',
        details
    );
}

export function normalizeWebsiteUrl(raw: unknown): string {
    if (typeof raw !== 'string' || !raw.trim()) {
        throw new DemoGenerationError(400, 'invalid_url', 'Website URL is required.');
    }

    const withScheme = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
    let parsed: URL;
    try {
        parsed = new URL(withScheme);
    } catch {
        throw new DemoGenerationError(400, 'invalid_url', 'Enter a valid website URL.');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new DemoGenerationError(400, 'invalid_url', 'Website URL must start with http or https.');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (isBlockedHostname(hostname)) {
        throw new DemoGenerationError(400, 'invalid_url', 'Enter a public website URL.');
    }

    parsed.hash = '';
    return parsed.toString();
}

function isBlockedHostname(hostname: string): boolean {
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
    if (!hostname.includes('.') && net.isIP(hostname) === 0) return true;

    const ipVersion = net.isIP(hostname);
    if (ipVersion === 4) {
        const [a, b] = hostname.split('.').map((part) => Number(part));
        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168)
        );
    }

    if (ipVersion === 6) {
        const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
        return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80');
    }

    return false;
}

export function selectHighSignalUrls(baseUrl: string, links: FirecrawlMapLink[], maxPages: number): string[] {
    const base = new URL(baseUrl);
    const byUrl = new Map<string, { url: string; score: number }>();
    byUrl.set(base.toString(), { url: base.toString(), score: 1000 });

    for (const link of links) {
        const rawUrl = typeof link === 'string' ? link : link.url;
        if (!rawUrl) continue;
        let parsed: URL;
        try {
            parsed = new URL(rawUrl, base);
        } catch {
            continue;
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
        if (parsed.hostname !== base.hostname) continue;
        parsed.hash = '';
        parsed.search = '';

        const title = typeof link === 'string' ? '' : link.title || '';
        const description = typeof link === 'string' ? '' : link.description || '';
        const haystack = `${parsed.pathname} ${title} ${description}`;
        const signalScore = HIGH_SIGNAL_PATTERNS.reduce((score, pattern) => score + (pattern.test(haystack) ? 15 : 0), 0);
        const depthPenalty = parsed.pathname.split('/').filter(Boolean).length * 2;
        const score = signalScore - depthPenalty;

        if (score <= 0) continue;
        const existing = byUrl.get(parsed.toString());
        if (!existing || score > existing.score) {
            byUrl.set(parsed.toString(), { url: parsed.toString(), score });
        }
    }

    return [...byUrl.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, maxPages)
        .map((item) => item.url);
}

function envMaxPages(): number {
    const raw = Number(process.env.DEMO_GENERATION_MAX_PAGES);
    if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MAX_PAGES;
    return Math.min(Math.max(Math.floor(raw), 1), 8);
}

async function firecrawlRequest<T>(path: string, body: Record<string, unknown>, timeoutMs: number): Promise<T> {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw configError('FIRECRAWL_API_KEY is missing');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${FIRECRAWL_BASE_URL}${path}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        const text = await response.text();
        let payload: any = {};
        if (text.trim()) {
            try {
                payload = JSON.parse(text);
            } catch {
                payload = { error: text };
            }
        }

        if (!response.ok || payload.success === false) {
            throw scrapeError(payload.error || payload.message || `Firecrawl returned ${response.status}`);
        }

        return payload as T;
    } catch (error) {
        if (error instanceof DemoGenerationError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw scrapeError(message);
    } finally {
        clearTimeout(timer);
    }
}

function extractImageUrl(scrapes: ScrapedPage[]): string {
    for (const page of scrapes) {
        const meta = page.metadata || {};
        const fromMeta = meta.logo || meta.ogImage || meta['og:image'] || meta.favicon;
        if (typeof fromMeta === 'string' && /^https?:\/\//i.test(fromMeta)) return fromMeta;
        const firstImage = page.images.find((url) => /^https?:\/\//i.test(url));
        if (firstImage) return firstImage;
    }
    return '';
}

function extractBrandColor(scrapes: ScrapedPage[]): string {
    const colorPattern = /^#[0-9a-f]{6}$/i;
    for (const page of scrapes) {
        const branding = page.branding || {};
        const candidates = [
            branding?.colors?.primary,
            branding?.colors?.accent,
            branding?.colors?.background,
            branding?.buttonPrimary?.background,
        ];
        for (const candidate of candidates) {
            if (typeof candidate === 'string' && colorPattern.test(candidate.trim())) {
                return candidate.trim();
            }
        }
    }
    return '#c0dfa1';
}

function packScrapedContext(scrapes: ScrapedPage[]): string {
    let remaining = MAX_TOTAL_CONTEXT_CHARS;
    const chunks: string[] = [];

    for (const page of scrapes) {
        if (remaining <= 0) break;
        const content = cleanText(page.markdown || page.summary || page.description, MAX_PAGE_MARKDOWN_CHARS);
        if (!content) continue;

        const chunk = [
            `URL: ${page.url}`,
            page.title ? `Title: ${page.title}` : '',
            page.description ? `Description: ${page.description}` : '',
            `Content: ${content}`,
        ].filter(Boolean).join('\n');

        chunks.push(chunk.slice(0, remaining));
        remaining -= chunk.length;
    }

    return chunks.join('\n\n---\n\n');
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

function normalizeDraft(raw: any, sourceUrl: string, hints: { logoUrl: string; brandColor: string; nameOverride?: string }): GeneratedDemoDraft {
    if (!raw || typeof raw !== 'object') throw invalidDraft('Draft root is not an object');
    const organization = raw.organization || {};
    const context = raw.context || {};
    const initiative = raw.initiative || {};

    const locationsRaw = Array.isArray(raw.locations) ? raw.locations.slice(0, 2) : [];
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
        const updatesRaw = Array.isArray(metric?.updates) ? metric.updates.slice(0, 4) : [];
        if (updatesRaw.length < 2) throw invalidDraft(`Metric ${metricIndex + 1} needs at least two updates`);

        return {
            title: ensureText(metric?.title, `Metric ${metricIndex + 1} title`, 120),
            description: ensureText(metric?.description, `Metric ${metricIndex + 1} description`, 500),
            metric_type: metricType,
            unit_of_measurement: cleanText(metric?.unit_of_measurement, 60, metricType === 'percentage' ? '%' : 'people') || (metricType === 'percentage' ? '%' : 'people'),
            category: normalizeMetricCategory(metric?.category),
            updates: updatesRaw.map((update: any, updateIndex: number) => {
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
            }),
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
            logo_url: normalizeUrl(organization.logo_url) || hints.logoUrl,
            brand_color: normalizeBrandColor(organization.brand_color, hints.brandColor),
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
            title: ensureText(initiative.title, 'Initiative title', 140),
            description: ensureText(initiative.description, 'Initiative description', 1200),
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
    static async generateFromWebsite(userId: string, input: { website_url: unknown; name?: unknown }): Promise<any> {
        if (!isOpenAIConfigured()) {
            throw configError('OPENAI_API_KEY is missing');
        }

        const websiteUrl = normalizeWebsiteUrl(input.website_url);
        const nameOverride = typeof input.name === 'string' ? input.name.trim() : '';
        const maxPages = envMaxPages();
        const selectedUrls = await this.discoverUrls(websiteUrl, maxPages);
        const scrapedPages = await this.scrapeUrls(selectedUrls);
        if (scrapedPages.length === 0) throw scrapeError('No pages could be scraped');

        const logoUrl = extractImageUrl(scrapedPages);
        const brandColor = extractBrandColor(scrapedPages);
        const draft = await this.generateDraft({
            websiteUrl,
            nameOverride,
            logoUrl,
            brandColor,
            packedContext: packScrapedContext(scrapedPages),
        });

        return DemoPersistenceService.createGeneratedDemo(userId, draft, nameOverride);
    }

    private static async discoverUrls(websiteUrl: string, maxPages: number): Promise<string[]> {
        try {
            const mapResponse = await firecrawlRequest<{ success: boolean; links?: FirecrawlMapLink[] }>(
                '/map',
                {
                    url: websiteUrl,
                    sitemap: 'include',
                    includeSubdomains: false,
                    ignoreQueryParameters: true,
                    limit: 40,
                    timeout: 12000,
                },
                15000
            );
            return selectHighSignalUrls(websiteUrl, mapResponse.links || [], maxPages);
        } catch (error) {
            if (error instanceof DemoGenerationError && error.code === 'demo_generation_not_configured') throw error;
            console.warn('[DemoGeneration] map failed, scraping homepage only:', error instanceof Error ? error.message : error);
            return [websiteUrl];
        }
    }

    private static async scrapeUrls(urls: string[]): Promise<ScrapedPage[]> {
        const results: ScrapedPage[] = [];

        for (const url of urls) {
            try {
                const response = await firecrawlRequest<{ success: boolean; data?: FirecrawlScrapeData }>(
                    '/scrape',
                    {
                        url,
                        formats: ['markdown', 'summary', 'images', 'branding'],
                        onlyMainContent: true,
                        onlyCleanContent: true,
                        maxAge: 172800000,
                        removeBase64Images: true,
                        blockAds: true,
                        timeout: 25000,
                    },
                    30000
                );
                const data = response.data || {};
                const metadata = data.metadata || {};
                results.push({
                    url,
                    title: cleanText(metadata.title || metadata.ogTitle, 200),
                    description: cleanText(metadata.description || metadata.ogDescription, 500),
                    markdown: data.markdown || '',
                    summary: data.summary || '',
                    images: Array.isArray(data.images) ? data.images.filter((img) => typeof img === 'string') : [],
                    metadata,
                    branding: data.branding || {},
                });
            } catch (error) {
                console.warn('[DemoGeneration] scrape failed:', url, error instanceof Error ? error.message : error);
            }
        }

        return results;
    }

    private static async generateDraft(args: {
        websiteUrl: string;
        nameOverride: string;
        logoUrl: string;
        brandColor: string;
        packedContext: string;
    }): Promise<GeneratedDemoDraft> {
        if (!args.packedContext.trim()) throw scrapeError('Scraped pages contained no usable text');

        const model = process.env.OPENAI_DEMO_MODEL || DEFAULT_MODEL;
        const completion = await openai!.chat.completions.create({
            model,
            temperature: 0.7,
            max_tokens: 6000,
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
                        'Use the scraped website to infer the organization, mission, program themes, target beneficiaries, and plausible impact metrics.',
                        'All metrics, beneficiaries, stories, and numbers must be dummy demo data, not factual claims from the real organization.',
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
                        `Logo hint: ${args.logoUrl || 'none'}`,
                        `Brand color hint: ${args.brandColor}`,
                        `Today: ${todayString()}`,
                        '',
                        'Generate one lean realistic demo profile:',
                        '- 1 organization profile and context page',
                        '- 1 initiative',
                        '- 1-2 locations with real coordinates for plausible service areas',
                        '- 1-2 beneficiary groups',
                        '- 4-6 metrics, each with 2-4 synthetic historical updates',
                        '- 1-2 text-only stories',
                        '- no evidence records or uploaded files',
                        '',
                        'Metric categories must be balanced across input, output, and impact.',
                        'For percentage metrics, values must be 0-100.',
                        'For location_index and beneficiary_group_indexes, reference zero-based indexes from the arrays you return.',
                        'Use a concise mission statement under 150 characters.',
                        '',
                        'Scraped website context:',
                        args.packedContext,
                    ].filter(Boolean).join('\n'),
                },
            ],
        } as any);

        const content = completion.choices[0]?.message?.content;
        if (!content) throw invalidDraft('OpenAI returned no content');

        let parsed: any;
        try {
            parsed = JSON.parse(content);
        } catch (error) {
            throw invalidDraft(error instanceof Error ? error.message : 'OpenAI returned invalid JSON');
        }

        return normalizeDraft(parsed, args.websiteUrl, {
            logoUrl: args.logoUrl,
            brandColor: args.brandColor,
            nameOverride: args.nameOverride,
        });
    }
}
