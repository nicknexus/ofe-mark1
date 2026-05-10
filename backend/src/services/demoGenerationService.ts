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
    metadata?: Record<string, any>;
};

type ScrapedPage = {
    url: string;
    title: string;
    description: string;
    markdown: string;
    metadata: Record<string, any>;
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
const MIN_TOTAL_CONTEXT_CHARS = 1500;
const DEFAULT_MODEL = 'gpt-4o-mini';

const HIGH_SIGNAL_PATTERNS = [
    /about/i,
    /who-we-are/i,
    /our-team/i,
    /\bteam\b/i,
    /mission/i,
    /vision/i,
    /value/i,
    /program/i,
    /programme/i,
    /service/i,
    /\bwork\b/i,
    /our-work/i,
    /what-we-do/i,
    /how-we-help/i,
    /where-we-work/i,
    /\bwhere\b/i,
    /impact/i,
    /our-impact/i,
    /outcome/i,
    /result/i,
    /report/i,
    /annual/i,
    /strategy/i,
    /strategie/i,
    /donate/i,
    /support-us/i,
    /get-involved/i,
    /story/i,
    /stories/i,
    /community/i,
    /communities/i,
    /education/i,
    /school/i,
    /\bchild/i,
    /\bfamily/i,
    /\bfood\b/i,
    /\bwater\b/i,
    /\bhealth/i,
    /\bfield\b/i,
    /initiative/i,
    /project/i,
    /campaign/i,
    /partner/i,
    /focus-area/i,
];

// File extensions and path segments that should never be scraped (no useful content)
const EXCLUDE_EXTENSIONS = /\.(xml|json|pdf|ico|rss|atom|txt|zip|css|js|jpg|jpeg|png|gif|svg|webp|mp3|mp4|mov|webm|ics|csv)(\?|$)/i;
const EXCLUDE_SEGMENT_PATTERNS = [
    /\/sitemap/i,
    /\/feed\b/i,
    /\/rss\b/i,
    /\/tag\//i,
    /\/category\//i,
    /\/author\//i,
    /\/page\/\d/i,
    /\/wp-/i,
    /\/admin\b/i,
    /\/login\b/i,
    /\/signin\b/i,
    /\/signup\b/i,
    /\/account\b/i,
    /\/cart\b/i,
    /\/checkout\b/i,
    /\/search\b/i,
    /\/privacy/i,
    /\/terms/i,
    /\/cookie/i,
    /\/legal/i,
    /\/disclaimer/i,
    /\/gdpr/i,
    /\/contact\b/i,
    /\/subscribe/i,
    /\/newsletter/i,
];

function isExcludedUrl(parsed: URL): boolean {
    const pathname = parsed.pathname;
    if (EXCLUDE_EXTENSIONS.test(pathname)) return true;
    for (const pattern of EXCLUDE_SEGMENT_PATTERNS) {
        if (pattern.test(pathname)) return true;
    }
    return false;
}

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

function insufficientContextError(details: string): DemoGenerationError {
    return new DemoGenerationError(
        502,
        'website_scrape_insufficient',
        'We could not read enough of that website to build a demo. Try a different URL or retry shortly.',
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

function topSegment(pathname: string): string {
    const parts = pathname.split('/').filter(Boolean);
    return parts[0] || '';
}

export function selectHighSignalUrls(baseUrl: string, links: FirecrawlMapLink[], maxPages: number): string[] {
    const base = new URL(baseUrl);
    const homepage = base.toString();
    const scored = new Map<string, { url: string; score: number; depth: number; topSeg: string }>();
    scored.set(homepage, { url: homepage, score: 1000, depth: 0, topSeg: '' });

    const fallbackPool = new Map<string, { url: string; depth: number; topSeg: string }>();

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
        if (isExcludedUrl(parsed)) continue;
        const url = parsed.toString();
        if (url === homepage) continue;
        const depth = parsed.pathname.split('/').filter(Boolean).length;
        const topSeg = topSegment(parsed.pathname);

        const title = typeof link === 'string' ? '' : link.title || '';
        const description = typeof link === 'string' ? '' : link.description || '';
        const haystack = `${parsed.pathname} ${title} ${description}`;
        const signalScore = HIGH_SIGNAL_PATTERNS.reduce((score, pattern) => score + (pattern.test(haystack) ? 15 : 0), 0);
        const score = signalScore - depth * 2;

        if (score > 0) {
            const existing = scored.get(url);
            if (!existing || score > existing.score) {
                scored.set(url, { url, score, depth, topSeg });
            }
        } else if (depth <= 2) {
            const existing = fallbackPool.get(url);
            if (!existing || depth < existing.depth) {
                fallbackPool.set(url, { url, depth, topSeg });
            }
        }
    }

    const segCounts = new Map<string, number>();
    const segLimit = 1;
    const picked: string[] = [];
    const seen = new Set<string>();

    const tryPick = (item: { url: string; topSeg: string }) => {
        if (picked.length >= maxPages) return false;
        if (seen.has(item.url)) return false;
        const count = segCounts.get(item.topSeg) || 0;
        if (item.topSeg && count >= segLimit) return false;
        seen.add(item.url);
        segCounts.set(item.topSeg, count + 1);
        picked.push(item.url);
        return true;
    };

    // homepage first
    tryPick({ url: homepage, topSeg: '' });

    const ranked = [...scored.values()].filter((s) => s.url !== homepage).sort((a, b) => b.score - a.score);
    for (const item of ranked) tryPick(item);

    if (picked.length < maxPages) {
        const fallbacks = [...fallbackPool.values()].sort((a, b) => a.depth - b.depth);
        for (const item of fallbacks) tryPick(item);
    }

    // Last-resort: if seg-limit blocked us and we still have room, allow a second pick per seg
    if (picked.length < maxPages) {
        const all = [...ranked, ...[...fallbackPool.values()]];
        for (const item of all) {
            if (picked.length >= maxPages) break;
            if (seen.has(item.url)) continue;
            seen.add(item.url);
            picked.push(item.url);
        }
    }

    return picked;
}

function envMaxPages(): number {
    const raw = Number(process.env.DEMO_GENERATION_MAX_PAGES);
    if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MAX_PAGES;
    return Math.min(Math.max(Math.floor(raw), 1), 8);
}

function newTraceId(): string {
    return Math.random().toString(36).slice(2, 8);
}

function logStep(traceId: string, stage: string, message: string, extra?: Record<string, unknown>) {
    const ts = new Date().toISOString();
    const tail = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
    console.log(`[DemoGen ${traceId}] ${ts} ${stage} ${message}${tail}`);
}

function logWarn(traceId: string, stage: string, message: string, extra?: Record<string, unknown>) {
    const ts = new Date().toISOString();
    const tail = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
    console.warn(`[DemoGen ${traceId}] ${ts} ${stage} WARN ${message}${tail}`);
}

function summarizeUrl(url: string): string {
    try {
        const u = new URL(url);
        return `${u.hostname}${u.pathname}`;
    } catch {
        return url.slice(0, 80);
    }
}

async function firecrawlRequest<T>(
    path: string,
    body: Record<string, unknown>,
    timeoutMs: number,
    ctx?: { traceId: string; stage: string; label: string }
): Promise<T> {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw configError('FIRECRAWL_API_KEY is missing');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    if (ctx) logStep(ctx.traceId, ctx.stage, `firecrawl ${path} → ${ctx.label}`, { timeoutMs });
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

        if (ctx) {
            logStep(ctx.traceId, ctx.stage, `firecrawl ${path} ok`, {
                label: ctx.label,
                ms: Date.now() - startedAt,
                status: response.status,
                bytes: text.length,
            });
        }

        return payload as T;
    } catch (error) {
        if (ctx) {
            const message = error instanceof Error ? error.message : String(error);
            logWarn(ctx.traceId, ctx.stage, `firecrawl ${path} failed`, {
                label: ctx.label,
                ms: Date.now() - startedAt,
                error: message.slice(0, 240),
            });
        }
        if (error instanceof DemoGenerationError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw scrapeError(message);
    } finally {
        clearTimeout(timer);
    }
}

const DEFAULT_BRAND_COLOR = '#c0dfa1';

function packScrapedContext(scrapes: ScrapedPage[]): string {
    let remaining = MAX_TOTAL_CONTEXT_CHARS;
    const chunks: string[] = [];

    for (const page of scrapes) {
        if (remaining <= 0) break;
        const content = cleanText(page.markdown || page.description, MAX_PAGE_MARKDOWN_CHARS);
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

// Distribute update dates so they don't cluster. Newest ~2 months ago, oldest ~24 months ago.
function distributeUpdateDates<T extends { date_represented: string }>(updates: T[]): T[] {
    if (updates.length <= 1) return updates;
    const today = new Date();
    const monthsBack = (offset: number) => {
        const d = new Date(today);
        d.setDate(15);
        d.setMonth(d.getMonth() - offset);
        return d.toISOString().slice(0, 10);
    };

    const sorted = [...updates].sort((a, b) => (a.date_represented < b.date_represented ? -1 : 1));
    const dateSet = new Set(sorted.map((u) => u.date_represented));
    const tooClustered = dateSet.size < sorted.length * 0.7;
    if (!tooClustered && sorted.length === updates.length) {
        // model produced distinct enough dates already — trust it
        const minDate = sorted[0].date_represented;
        const maxDate = sorted[sorted.length - 1].date_represented;
        const spanMonths = (() => {
            const a = new Date(minDate); const b = new Date(maxDate);
            return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
        })();
        if (spanMonths >= 6) return updates;
    }

    // Otherwise, evenly redistribute newest→oldest across 2..24 months ago
    const newestMonths = 2;
    const oldestMonths = Math.max(newestMonths + 6, Math.min(30, 6 * updates.length));
    const step = (oldestMonths - newestMonths) / Math.max(1, updates.length - 1);
    return updates.map((u, i) => ({
        ...u,
        date_represented: monthsBack(Math.round(newestMonths + i * step)),
    }));
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
        const selectedUrls = await this.discoverUrls(websiteUrl, maxPages, traceId);
        logStep(traceId, '1/6 DISCOVER', 'selected pages', {
            ms: Date.now() - discoverStart,
            count: selectedUrls.length,
            urls: selectedUrls.map(summarizeUrl),
        });

        const scrapeStart = Date.now();
        logStep(traceId, '2/6 SCRAPE', 'scraping selected pages in parallel', { count: selectedUrls.length });
        const { pages: scrapedPages, homepageOk } = await this.scrapeUrls(selectedUrls, traceId, websiteUrl);
        const totalMarkdownChars = scrapedPages.reduce((s, p) => s + p.markdown.length, 0);
        const substantivePages = scrapedPages.filter((p) => p.markdown.length >= 1000).length;
        logStep(traceId, '2/6 SCRAPE', 'finished scraping', {
            ms: Date.now() - scrapeStart,
            successful: scrapedPages.length,
            failed: selectedUrls.length - scrapedPages.length,
            homepageOk,
            substantivePages,
            totalMarkdownChars,
        });
        if (scrapedPages.length === 0) throw scrapeError('No pages could be scraped');
        if (substantivePages === 0) {
            throw insufficientContextError(
                `No scraped page returned >=1000 chars of content (total ${totalMarkdownChars} chars across ${scrapedPages.length} pages); refusing to generate from nav/scrap content alone`
            );
        }
        if (totalMarkdownChars < MIN_TOTAL_CONTEXT_CHARS) {
            throw insufficientContextError(
                `Scraped only ${totalMarkdownChars} chars across ${scrapedPages.length} pages, below ${MIN_TOTAL_CONTEXT_CHARS} threshold`
            );
        }
        if (!homepageOk) {
            logWarn(traceId, '2/6 SCRAPE', 'homepage scrape failed; proceeding with subpage content', {
                substantivePages,
                totalMarkdownChars,
            });
        }

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
        logStep(traceId, '5/6 PERSIST', 'writing demo org to database');
        const persisted = await DemoPersistenceService.createGeneratedDemo(userId, draft, nameOverride);
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

    private static async discoverUrls(websiteUrl: string, maxPages: number, traceId: string): Promise<string[]> {
        // Run multiple topical /map calls in parallel so we surface about/programs/impact pages
        // even when the org's URL slugs don't match our regex patterns.
        const searches: { search?: string; label: string }[] = [
            { label: 'no-search' },
            { search: 'about mission impact', label: 'search:about+mission+impact' },
            { search: 'programs services where we work', label: 'search:programs+where' },
            { search: 'donate annual report stories', label: 'search:donate+report+stories' },
        ];

        const mapPromises = searches.map(({ search, label }) =>
            firecrawlRequest<{ success: boolean; links?: FirecrawlMapLink[] }>(
                '/map',
                {
                    url: websiteUrl,
                    sitemap: 'include',
                    includeSubdomains: false,
                    ignoreQueryParameters: true,
                    limit: 40,
                    timeout: 12000,
                    ...(search ? { search } : {}),
                },
                15000,
                { traceId, stage: '1/6 DISCOVER', label }
            )
                .then((res) => ({ ok: true as const, label, links: res.links || [] }))
                .catch((error) => ({
                    ok: false as const,
                    label,
                    error: error instanceof Error ? error.message : String(error),
                }))
        );

        const settled = await Promise.all(mapPromises);

        const merged: FirecrawlMapLink[] = [];
        const seen = new Set<string>();
        let anyOk = false;
        let configErr: DemoGenerationError | null = null;

        for (const result of settled) {
            if (!result.ok) {
                logWarn(traceId, '1/6 DISCOVER', 'map call failed', {
                    label: result.label,
                    error: result.error.slice(0, 240),
                });
                // Surface config errors immediately
                if (result.error.includes('FIRECRAWL_API_KEY is missing')) {
                    configErr = configError('FIRECRAWL_API_KEY is missing');
                }
                continue;
            }
            anyOk = true;
            logStep(traceId, '1/6 DISCOVER', 'map call returned', {
                label: result.label,
                links: result.links.length,
            });
            for (const link of result.links) {
                const url = typeof link === 'string' ? link : link.url;
                if (!url || seen.has(url)) continue;
                seen.add(url);
                merged.push(link);
            }
        }

        if (configErr) throw configErr;

        if (!anyOk) {
            logWarn(traceId, '1/6 DISCOVER', 'all map calls failed, falling back to homepage only');
            return [websiteUrl];
        }

        const selected = selectHighSignalUrls(websiteUrl, merged, maxPages);
        logStep(traceId, '1/6 DISCOVER', 'merged map results', {
            totalUniqueLinks: merged.length,
            selected: selected.length,
            maxPages,
        });
        return selected;
    }

    private static async scrapeOne(
        url: string,
        label: string,
        traceId: string,
        opts: { serverTimeoutMs?: number; clientTimeoutMs?: number } = {}
    ): Promise<ScrapedPage | null> {
        const startedAt = Date.now();
        const serverTimeoutMs = opts.serverTimeoutMs ?? 25000;
        const clientTimeoutMs = opts.clientTimeoutMs ?? serverTimeoutMs + 5000;
        try {
            const response = await firecrawlRequest<{ success: boolean; data?: FirecrawlScrapeData }>(
                '/scrape',
                {
                    url,
                    formats: ['markdown'],
                    onlyMainContent: true,
                    onlyCleanContent: true,
                    maxAge: 172800000,
                    removeBase64Images: true,
                    blockAds: true,
                    timeout: serverTimeoutMs,
                },
                clientTimeoutMs,
                { traceId, stage: '2/6 SCRAPE', label }
            );
            const data = response.data || {};
            const metadata = data.metadata || {};
            const markdown = data.markdown || '';
            logStep(traceId, '2/6 SCRAPE', 'page scraped', {
                label,
                ms: Date.now() - startedAt,
                markdownChars: markdown.length,
            });
            return {
                url,
                title: cleanText(metadata.title || metadata.ogTitle, 200),
                description: cleanText(metadata.description || metadata.ogDescription, 500),
                markdown,
                metadata,
            };
        } catch (error) {
            logWarn(traceId, '2/6 SCRAPE', 'page scrape failed', {
                label,
                ms: Date.now() - startedAt,
                error: error instanceof Error ? error.message.slice(0, 240) : String(error),
            });
            return null;
        }
    }

    private static async scrapeUrls(
        urls: string[],
        traceId: string,
        homepageUrl: string
    ): Promise<{ pages: ScrapedPage[]; homepageOk: boolean }> {
        if (urls.length === 0) return { pages: [], homepageOk: false };

        const tasks = urls.map((url, i) => {
            const label = `${i + 1}/${urls.length} ${summarizeUrl(url)}`;
            return this.scrapeOne(url, label, traceId).then((page) => ({ url, page }));
        });
        const settled = await Promise.all(tasks);

        const pages: ScrapedPage[] = [];
        let homepageOk = false;
        let homepagePresent = false;
        for (const { url, page } of settled) {
            if (url === homepageUrl) homepagePresent = true;
            if (page) {
                pages.push(page);
                if (url === homepageUrl) homepageOk = true;
            }
        }

        if (homepagePresent && !homepageOk) {
            const otherSubstantive = pages.filter((p) => p.markdown.length >= 1000).length;
            const otherTotalChars = pages.reduce((s, p) => s + p.markdown.length, 0);
            const haveEnoughWithoutHomepage = otherSubstantive >= 2 || otherTotalChars >= 5000;

            if (haveEnoughWithoutHomepage) {
                logStep(traceId, '2/6 SCRAPE', 'skipping homepage retry — already have substantive subpage content', {
                    otherSubstantive,
                    otherTotalChars,
                });
            } else {
                logStep(traceId, '2/6 SCRAPE', 'retrying homepage with longer timeout', {
                    otherSubstantive,
                    otherTotalChars,
                });
                const retry = await this.scrapeOne(
                    homepageUrl,
                    `retry ${summarizeUrl(homepageUrl)}`,
                    traceId,
                    { serverTimeoutMs: 45000, clientTimeoutMs: 55000 }
                );
                if (retry) {
                    pages.unshift(retry);
                    homepageOk = true;
                }
            }
        }

        return { pages, homepageOk };
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
            max_tokens: 8000,
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
                        '- 1 initiative',
                        '- LOCATIONS (1 to 4): READ THE SCRAPED CONTENT CAREFULLY for any specific city, town, region, district, province, or country names where the organization operates. Return one location per distinct named place you find, up to 4. Examples of signals: "we work in Port-au-Prince and Jacmel", "our school in Cité Soleil", "programs across rural Haiti and the Dominican Republic", "communities in Bukavu, Goma, and Kinshasa". Use real latitude/longitude for each named place. If the content only ever mentions one country with no city-level detail, then 1 location is fine — but err on the side of including multiple if multiple place names appear.',
                        '- BENEFICIARY GROUPS: 1-2 groups, each with name, description, plausible age range and total_number',
                        '- METRICS: 4-6 metrics, balanced across input/output/impact categories.',
                        '- METRIC UPDATES (impact claims): EACH METRIC MUST HAVE 4 to 6 updates. These are the historical impact claims and the most important data.',
                        `  Date rules — VERY IMPORTANT: spread updates across time. The most recent update should be roughly 1-3 months before today (${todayString()}). The earliest update should be at least 18-30 months ago. Use a roughly quarterly cadence between them. NEVER put two updates on the same exact date and NEVER cluster them within the same week. Example pattern for 5 updates if today is 2026-05-10: 2026-03-15, 2025-11-10, 2025-07-20, 2025-03-05, 2024-09-12.`,
                        '  Vary the values too — show realistic growth or seasonality, not flat or random numbers. Each update needs a descriptive label (e.g. "Q1 2026 enrollment", "Spring 2025 cohort"), a short contextual note, and the appropriate location_index + beneficiary_group_indexes.',
                        '- 1-2 text-only stories',
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
