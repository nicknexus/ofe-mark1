import net from 'net';

/**
 * Firecrawl-backed website reader shared by admin demo generation and the
 * in-app "set up from your website" flow. Discovers high-signal pages, scrapes
 * them, and packs the markdown into a bounded prompt context.
 */

export type FirecrawlMapLink = {
    url?: string;
    title?: string;
    description?: string;
} | string;

type FirecrawlScrapeData = {
    markdown?: string;
    links?: string[];
    metadata?: Record<string, any>;
    branding?: Record<string, any>;
};

export type ScrapedPage = {
    url: string;
    title: string;
    description: string;
    markdown: string;
    metadata: Record<string, any>;
    links?: string[];
};

export class SiteCrawlError extends Error {
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
export const MAX_TOTAL_CONTEXT_CHARS = 26000;
const MIN_TOTAL_CONTEXT_CHARS = 1500;
const THIN_CONTEXT_CHARS = 3000;

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

// The page that lists what the org delivers. Always worth a scrape slot.
const CORE_PAGE_PATTERN = /\/(what-we-do|our-work|our-programs?|programs?|programmes?|our-projects?|projects?|initiatives?|services|how-we-help)(\/|$)/i;

// Scrape-able but rarely describe what the org delivers; ranked below program pages.
const LOW_SIGNAL_PATTERNS = [
    /\/(all-)?events?(\/|$)/i,
    /\/news(\/|$)/i,
    /\/blog(\/|$)/i,
    /\/press(\/|$)/i,
    /\/gala/i,
    /\/shop\b/i,
    /\/store\b/i,
    /\/careers?\b/i,
    /\/jobs?\b/i,
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

export function cleanText(value: unknown, maxLength: number, fallback = ''): string {
    const raw = typeof value === 'string' ? value : fallback;
    const normalized = raw.replace(/\s+/g, ' ').trim();
    return normalized.slice(0, maxLength);
}

export function configError(details: string): SiteCrawlError {
    return new SiteCrawlError(
        500,
        'demo_generation_not_configured',
        'AI website reading is not configured.',
        details
    );
}

export function scrapeError(details: string): SiteCrawlError {
    return new SiteCrawlError(
        502,
        'website_scrape_failed',
        'We could not read that website.',
        details
    );
}

function insufficientContextError(details: string): SiteCrawlError {
    return new SiteCrawlError(
        502,
        'website_scrape_insufficient',
        'We could not read enough of that website. Try a different URL or retry shortly.',
        details
    );
}

export function normalizeWebsiteUrl(raw: unknown): string {
    if (typeof raw !== 'string' || !raw.trim()) {
        throw new SiteCrawlError(400, 'invalid_url', 'Website URL is required.');
    }

    const withScheme = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
    let parsed: URL;
    try {
        parsed = new URL(withScheme);
    } catch {
        throw new SiteCrawlError(400, 'invalid_url', 'Enter a valid website URL.');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new SiteCrawlError(400, 'invalid_url', 'Website URL must start with http or https.');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (isBlockedHostname(hostname)) {
        throw new SiteCrawlError(400, 'invalid_url', 'Enter a public website URL.');
    }

    parsed.hash = '';
    return parsed.toString();
}

export function isBlockedHostname(hostname: string): boolean {
    if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
    if (!hostname.includes('.') && net.isIP(hostname) === 0) return true;
    return isPrivateIp(hostname);
}

export function isPrivateIp(address: string): boolean {
    const ipVersion = net.isIP(address);
    if (ipVersion === 4) {
        const [a, b] = address.split('.').map((part) => Number(part));
        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168)
        );
    }

    if (ipVersion === 6) {
        const normalized = address.replace(/^\[|\]$/g, '').toLowerCase();
        if (normalized.startsWith('::ffff:')) return isPrivateIp(normalized.slice(7));
        return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80');
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

        // Path beats title; descriptions are skipped because site builders
        // often repeat one site-wide meta description on every page.
        const title = typeof link === 'string' ? '' : link.title || '';
        const pathScore = HIGH_SIGNAL_PATTERNS.reduce((score, pattern) => score + (pattern.test(parsed.pathname) ? 20 : 0), 0);
        const titleScore = HIGH_SIGNAL_PATTERNS.reduce((score, pattern) => score + (pattern.test(title) ? 8 : 0), 0);
        const coreBoost = CORE_PAGE_PATTERN.test(parsed.pathname) ? 60 : 0;
        const lowSignal = LOW_SIGNAL_PATTERNS.some((pattern) => pattern.test(parsed.pathname));
        const score = pathScore + titleScore + coreBoost - depth * 2 - (lowSignal ? 40 : 0);

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

export function envMaxPages(): number {
    const raw = Number(process.env.DEMO_GENERATION_MAX_PAGES);
    if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_MAX_PAGES;
    return Math.min(Math.max(Math.floor(raw), 1), 8);
}

export function newTraceId(): string {
    return Math.random().toString(36).slice(2, 8);
}

export function logStep(traceId: string, stage: string, message: string, extra?: Record<string, unknown>) {
    const ts = new Date().toISOString();
    const tail = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
    console.log(`[SiteCrawl ${traceId}] ${ts} ${stage} ${message}${tail}`);
}

export function logWarn(traceId: string, stage: string, message: string, extra?: Record<string, unknown>) {
    const ts = new Date().toISOString();
    const tail = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : '';
    console.warn(`[SiteCrawl ${traceId}] ${ts} ${stage} WARN ${message}${tail}`);
}

export function summarizeUrl(url: string): string {
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
        if (error instanceof SiteCrawlError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw scrapeError(message);
    } finally {
        clearTimeout(timer);
    }
}

export function packScrapedContext(scrapes: ScrapedPage[]): string {
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

/** Rejects scrapes that only captured nav/boilerplate. */
export function assertEnoughContent(pages: ScrapedPage[], attempted: number, traceId: string, homepageOk: boolean): void {
    const totalMarkdownChars = pages.reduce((s, p) => s + p.markdown.length, 0);
    const substantivePages = pages.filter((p) => p.markdown.length >= 1000).length;
    logStep(traceId, 'SCRAPE', 'finished scraping', {
        successful: pages.length,
        failed: attempted - pages.length,
        homepageOk,
        substantivePages,
        totalMarkdownChars,
    });
    if (pages.length === 0) throw scrapeError('No pages could be scraped');
    if (substantivePages === 0) {
        throw insufficientContextError(
            `No scraped page returned >=1000 chars of content (total ${totalMarkdownChars} chars across ${pages.length} pages); refusing to generate from nav/scrap content alone`
        );
    }
    if (totalMarkdownChars < MIN_TOTAL_CONTEXT_CHARS) {
        throw insufficientContextError(
            `Scraped only ${totalMarkdownChars} chars across ${pages.length} pages, below ${MIN_TOTAL_CONTEXT_CHARS} threshold`
        );
    }
    if (!homepageOk) {
        logWarn(traceId, 'SCRAPE', 'homepage scrape failed; proceeding with subpage content', {
            substantivePages,
            totalMarkdownChars,
        });
    }
}

export async function discoverUrls(
    websiteUrl: string,
    maxPages: number,
    traceId: string,
    opts: { mapTimeoutMs?: number } = {}
): Promise<string[]> {
    const mapTimeoutMs = opts.mapTimeoutMs ?? 15000;
    // Run multiple topical /map calls in parallel so we surface about/programs/impact pages
    // even when the org's URL slugs don't match our regex patterns.
    const searches: { search?: string; label: string }[] = [
        { label: 'no-search' },
        { search: 'about mission impact', label: 'search:about+mission+impact' },
        { search: 'programs services what we do where we work', label: 'search:programs+where' },
        { search: 'our projects initiatives', label: 'search:projects' },
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
                // The unfiltered call sees the whole site: on blog-heavy sites the
                // program page can sit past the first 40 links.
                limit: search ? 40 : 200,
                timeout: Math.max(mapTimeoutMs - 3000, 5000),
                ...(search ? { search } : {}),
            },
            mapTimeoutMs,
            { traceId, stage: 'DISCOVER', label }
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
    let configErr: SiteCrawlError | null = null;

    for (const result of settled) {
        if (!result.ok) {
            logWarn(traceId, 'DISCOVER', 'map call failed', {
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
        logStep(traceId, 'DISCOVER', 'map call returned', {
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
        logWarn(traceId, 'DISCOVER', 'all map calls failed, falling back to homepage only');
        return [websiteUrl];
    }

    const selected = selectHighSignalUrls(websiteUrl, merged, maxPages);
    logStep(traceId, 'DISCOVER', 'merged map results', {
        totalUniqueLinks: merged.length,
        selected: selected.length,
        maxPages,
    });
    return selected;
}

async function scrapeOne(
    url: string,
    label: string,
    traceId: string,
    opts: { serverTimeoutMs?: number; clientTimeoutMs?: number; withLinks?: boolean; fullPage?: boolean } = {}
): Promise<ScrapedPage | null> {
    const startedAt = Date.now();
    const serverTimeoutMs = opts.serverTimeoutMs ?? 25000;
    const clientTimeoutMs = opts.clientTimeoutMs ?? serverTimeoutMs + 5000;
    try {
        const response = await firecrawlRequest<{ success: boolean; data?: FirecrawlScrapeData }>(
            '/scrape',
            {
                url,
                formats: opts.withLinks ? ['markdown', 'links'] : ['markdown'],
                onlyMainContent: !opts.fullPage,
                onlyCleanContent: true,
                maxAge: 172800000,
                removeBase64Images: true,
                blockAds: true,
                timeout: serverTimeoutMs,
            },
            clientTimeoutMs,
            { traceId, stage: 'SCRAPE', label }
        );
        const data = response.data || {};
        const metadata = data.metadata || {};
        const markdown = data.markdown || '';
        const statusCode = Number(metadata.statusCode);
        if (statusCode >= 400) {
            logWarn(traceId, 'SCRAPE', 'page returned error status', { label, statusCode });
            return null;
        }
        logStep(traceId, 'SCRAPE', 'page scraped', {
            label,
            ms: Date.now() - startedAt,
            markdownChars: markdown.length,
            ...(opts.withLinks ? { links: data.links?.length || 0 } : {}),
        });
        return {
            url,
            title: cleanText(metadata.title || metadata.ogTitle, 200),
            description: cleanText(metadata.description || metadata.ogDescription, 500),
            markdown,
            metadata,
            links: data.links,
        };
    } catch (error) {
        logWarn(traceId, 'SCRAPE', 'page scrape failed', {
            label,
            ms: Date.now() - startedAt,
            error: error instanceof Error ? error.message.slice(0, 240) : String(error),
        });
        return null;
    }
}

export async function scrapeUrls(
    urls: string[],
    traceId: string,
    homepageUrl: string,
    opts: { serverTimeoutMs?: number; allowHomepageRetry?: boolean; maxPages?: number } = {}
): Promise<{ pages: ScrapedPage[]; homepageOk: boolean; attempted: number }> {
    if (urls.length === 0) return { pages: [], homepageOk: false, attempted: 0 };
    const allowHomepageRetry = opts.allowHomepageRetry ?? true;
    const maxPages = opts.maxPages ?? envMaxPages();
    // JS-rendered sites (SPAs) often have no sitemap, so /map only finds the homepage.
    // The rendered homepage's own links are the fallback discovery source.
    const needsLinks = urls.length < maxPages;

    const tasks = urls.map((url, i) => {
        const label = `${i + 1}/${urls.length} ${summarizeUrl(url)}`;
        return scrapeOne(url, label, traceId, {
            serverTimeoutMs: opts.serverTimeoutMs,
            withLinks: needsLinks && url === homepageUrl,
        }).then((page) => ({ url, page }));
    });
    const settled = await Promise.all(tasks);
    let attempted = urls.length;

    // Follow-ups run in parallel so the extra round trip stays inside one request budget.
    const homepage = settled.find((s) => s.url === homepageUrl)?.page;
    const homepageLinks = homepage?.links || [];
    const extra = needsLinks && homepageLinks.length > 0
        ? selectHighSignalUrls(homepageUrl, homepageLinks, maxPages).filter((url) => !urls.includes(url)).slice(0, maxPages - urls.length)
        : [];
    // onlyMainContent can strip most of a single-page site; take the whole page instead.
    const firstPassChars = settled.reduce((s, x) => s + (x.page?.markdown.length || 0), 0);
    const rescrapeFull = !!homepage && firstPassChars < THIN_CONTEXT_CHARS;
    if (extra.length > 0) {
        logStep(traceId, 'SCRAPE', 'scraping pages linked from rendered homepage', {
            homepageLinks: homepageLinks.length,
            extra: extra.map(summarizeUrl),
        });
    }
    if (rescrapeFull) logStep(traceId, 'SCRAPE', 'content thin; rescraping homepage as full page', { firstPassChars });
    attempted += extra.length;
    const [more, full] = await Promise.all([
        Promise.all(extra.map((url, i) =>
            scrapeOne(url, `link ${i + 1}/${extra.length} ${summarizeUrl(url)}`, traceId, { serverTimeoutMs: opts.serverTimeoutMs })
                .then((page) => ({ url, page }))
        )),
        rescrapeFull
            ? scrapeOne(homepageUrl, `full ${summarizeUrl(homepageUrl)}`, traceId, { serverTimeoutMs: opts.serverTimeoutMs, fullPage: true })
            : Promise.resolve(null),
    ]);
    settled.push(...more);
    if (full && homepage && full.markdown.length > homepage.markdown.length) {
        const index = settled.findIndex((s) => s.page === homepage);
        settled[index] = { url: homepageUrl, page: full };
    }

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

    if (allowHomepageRetry && homepagePresent && !homepageOk) {
        const otherSubstantive = pages.filter((p) => p.markdown.length >= 1000).length;
        const otherTotalChars = pages.reduce((s, p) => s + p.markdown.length, 0);
        const haveEnoughWithoutHomepage = otherSubstantive >= 2 || otherTotalChars >= 5000;

        if (haveEnoughWithoutHomepage) {
            logStep(traceId, 'SCRAPE', 'skipping homepage retry — already have substantive subpage content', {
                otherSubstantive,
                otherTotalChars,
            });
        } else {
            logStep(traceId, 'SCRAPE', 'retrying homepage with longer timeout', {
                otherSubstantive,
                otherTotalChars,
            });
            const retry = await scrapeOne(
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

    return { pages, homepageOk, attempted };
}

/** Restricts client-supplied page URLs to the site being scanned. */
export function filterSameSiteUrls(websiteUrl: string, urls: unknown, maxPages: number): string[] {
    const base = new URL(websiteUrl);
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of Array.isArray(urls) ? urls : []) {
        if (typeof raw !== 'string') continue;
        let parsed: URL;
        try {
            parsed = new URL(raw);
        } catch {
            continue;
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
        if (parsed.hostname !== base.hostname) continue;
        parsed.hash = '';
        const url = parsed.toString();
        if (seen.has(url)) continue;
        seen.add(url);
        out.push(url);
        if (out.length >= maxPages) break;
    }
    if (out.length === 0) out.push(base.toString());
    return out;
}

export interface SiteBranding {
    colors: string[];
    logo_url: string;
}

function normalizeHex(value: unknown): string {
    if (typeof value !== 'string') return '';
    const raw = value.trim().toLowerCase();
    const short = raw.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
    if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
    if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
    const rgb = raw.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
    if (rgb) {
        const hex = rgb.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
        return `#${hex}`;
    }
    return '';
}

function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
}

/** Brand candidates only: drops near-white, near-black and greys. */
export function pickBrandColors(candidates: unknown[]): string[] {
    const out: string[] = [];
    for (const c of candidates) {
        const hex = normalizeHex(c);
        if (!hex || out.includes(hex)) continue;
        const lum = luminance(hex);
        if (lum > 0.92 || lum < 0.06) continue;
        if (saturation(hex) < 0.12) continue;
        out.push(hex);
        if (out.length >= 4) break;
    }
    return out;
}

function absoluteHttpUrl(value: unknown, base: string): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().startsWith('data:')) return '';
    try {
        const parsed = new URL(value.trim(), base);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
    } catch {
        return '';
    }
}

/** Best-effort brand color + logo via Firecrawl's `branding` format. Never throws. */
export async function fetchBranding(websiteUrl: string, traceId: string, timeoutMs = 40000): Promise<SiteBranding> {
    try {
        const response = await firecrawlRequest<{ success: boolean; data?: FirecrawlScrapeData }>(
            '/scrape',
            {
                url: websiteUrl,
                formats: ['branding'],
                maxAge: 172800000,
                blockAds: true,
                timeout: Math.max(timeoutMs - 5000, 10000),
            },
            timeoutMs,
            { traceId, stage: 'BRANDING', label: summarizeUrl(websiteUrl) }
        );
        const branding = response.data?.branding || {};
        const colors = branding.colors || {};
        const components = branding.components || {};
        const images = branding.images || {};
        const metadata = response.data?.metadata || {};

        const brandColors = pickBrandColors([
            colors.primary,
            components.buttonPrimary?.background,
            colors.accent,
            colors.secondary,
            colors.link,
            metadata.themeColor,
            metadata['theme-color'],
        ]);

        const logoUrl =
            absoluteHttpUrl(branding.logo, websiteUrl) ||
            absoluteHttpUrl(images.logo, websiteUrl);

        logStep(traceId, 'BRANDING', 'branding extracted', { colors: brandColors, hasLogo: !!logoUrl });
        return { colors: brandColors, logo_url: logoUrl };
    } catch (error) {
        logWarn(traceId, 'BRANDING', 'branding extraction failed', {
            error: error instanceof Error ? error.message.slice(0, 240) : String(error),
        });
        return { colors: [], logo_url: '' };
    }
}
