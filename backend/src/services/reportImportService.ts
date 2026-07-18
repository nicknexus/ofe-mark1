import OpenAI, { toFile } from 'openai';
import { supabase } from '../utils/supabase';
import { openai, isOpenAIConfigured } from '../utils/openai';
import { OrgAccessService } from './orgAccessService';

/**
 * Annual report import.
 *
 * A charity uploads their annual report (a large, often image-heavy PDF). We
 * hand the whole file to a vision-capable model, which reads both the text and
 * the charts/infographics, and returns a structured set of *suggestions* mapped
 * to our data model (org profile, context, initiatives, metrics, beneficiary
 * groups, locations). Nothing is written to the core tables here — the user
 * reviews/edits the suggestions in the app and applies the ones they want via
 * the existing create endpoints.
 *
 * State for each upload lives in `report_imports` so a slow extraction can be
 * polled (GET /:id) and isn't lost if the original request times out.
 */

export type ReportImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ReportImportRow {
    id: string;
    organization_id: string;
    user_id: string | null;
    file_name: string | null;
    file_path: string | null;
    file_url: string | null;
    status: ReportImportStatus;
    error: string | null;
    extracted: ExtractedSuggestions;
    created_at: string;
    updated_at: string;
}

// --- Shape of the suggestions the model returns -----------------------------
// These mirror the create payloads used elsewhere so the frontend can apply
// them with minimal mapping. Everything is optional/best-effort.

export interface ExtractedSuggestions {
    organization?: {
        statement?: string;        // mission statement, <=150 chars (org.statement)
        description?: string;      // short paragraph (org.description)
        website_url?: string;
        donation_url?: string;
    };
    context?: {
        problem_statement?: string;
        theory_of_change?: string;
        strategies?: { title: string; description?: string }[];
        // Headline numbers & financials become stat/statement cards.
        stats_and_statements?: {
            type: 'stat' | 'statement';
            value?: string;
            title: string;
            description?: string;
            source?: string;
        }[];
        // Charity number, registered address, leadership, ratings, etc.
        additional_info?: string;
    };
    locations?: { name: string; country?: string }[];
    initiatives?: { title: string; description?: string; region?: string }[];
    metrics?: {
        title: string;
        description?: string;
        unit_of_measurement: string;
        metric_type: 'number' | 'percentage';
        category: 'input' | 'output' | 'impact';
        // Title of the suggested initiative this metric belongs to (free text;
        // matched against created/existing initiatives in the review UI). May be
        // omitted for organisation-wide metrics.
        initiative?: string;
        // The reported value from the report, if one was stated, so we can also
        // create an initial data point (kpi_update).
        value?: number;
        // Period the value covers (ISO dates). period_label is human text from
        // the report, e.g. "FY2025".
        period_start?: string;
        period_end?: string;
        period_label?: string;
        tags?: string[];
    }[];
    beneficiary_groups?: {
        name: string;
        description?: string;
        total_number?: number | null;
        age_range_start?: number | null;
        age_range_end?: number | null;
        initiative?: string;
    }[];
    // A short human-readable summary of what the model found / couldn't find.
    summary?: string;
}

const EXTRACTION_MODEL = 'gpt-4o';

const EXTRACTION_INSTRUCTIONS = `You are a data-extraction assistant for an impact-tracking platform used by charities and non-profits. You are given a charity's annual report as a PDF (it may be long and image-heavy — read the charts, infographics and tables, not just the body text).

Extract the information below and return it as a SINGLE JSON object (no prose, no markdown) matching this shape:

{
  "organization": {
    "statement": "one-line mission statement, max 150 chars",
    "description": "1-3 sentence description of what the org does",
    "website_url": "https://...",
    "donation_url": "https://..."
  },
  "context": {
    "problem_statement": "the problem/need the org addresses (a paragraph)",
    "theory_of_change": "how their work leads to impact, if stated",
    "strategies": [{ "title": "Strategic priority", "description": "..." }],
    "stats_and_statements": [
      { "type": "stat", "value": "440,000", "title": "Client visits", "description": "Direct client visits in FY2025", "source": "Annual Report 2025" },
      { "type": "statement", "title": "Vision", "description": "..." }
    ],
    "additional_info": "charity number, registered address, phone, leadership (CEO/board chair), ratings, awards — as readable lines"
  },
  "locations": [{ "name": "City, Region", "country": "Country" }],
  "initiatives": [{ "title": "Program name", "description": "what it does", "region": "where" }],
  "metrics": [
    {
      "title": "What is measured (e.g. Meals distributed)",
      "description": "short definition",
      "unit_of_measurement": "People | Meals | Pounds | Dollars | Hours | %",
      "metric_type": "number" | "percentage",
      "category": "input" | "output" | "impact",
      "initiative": "title of the related program above, or omit for org-wide",
      "value": 440000,
      "period_start": "2024-07-01",
      "period_end": "2025-06-30",
      "period_label": "FY2025",
      "tags": ["optional", "themes"]
    }
  ],
  "beneficiary_groups": [
    { "name": "Children (<18)", "description": "...", "total_number": 7313, "age_range_start": 0, "age_range_end": 17, "initiative": "related program or omit" }
  ],
  "summary": "1-2 sentences on what you found and anything notable you could not extract"
}

Rules:
- Use ONLY information present in the report. Never invent numbers, dates, names, or URLs. Omit any field you are unsure about (omit the key entirely rather than guessing).
- Categorise metrics sensibly: "input" = resources put in (funds, food purchased), "output" = direct results (meals, visits, people served), "impact" = longer-term outcomes.
- For percentages use metric_type "percentage" and unit "%".
- Convert shorthand to plain numbers where clear (e.g. "9.5M lbs" -> value 9500000, unit "Pounds"). If unclear, omit the value but keep the metric definition.
- Keep arrays focused on the most important items (roughly up to 12 metrics, 8 initiatives, 8 beneficiary groups, 10 locations, 12 stat cards).
- statement must be <= 150 characters.`;

function pickStatus(v: unknown): ReportImportStatus {
    return v === 'processing' || v === 'completed' || v === 'failed' ? v : 'pending';
}

export class ReportImportService {
    /** Create a new import job row for the caller's active org. */
    static async create(
        userId: string,
        requestedOrgId: string | undefined,
        input: { file_name?: string; file_path?: string; file_url?: string }
    ): Promise<ReportImportRow> {
        const ctx = await OrgAccessService.assertOrgContext(userId, requestedOrgId);

        const { data, error } = await supabase
            .from('report_imports')
            .insert({
                organization_id: ctx.organizationId,
                user_id: userId,
                file_name: input.file_name ?? null,
                file_path: input.file_path ?? null,
                file_url: input.file_url ?? null,
                status: 'pending',
                extracted: {},
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to create import: ${error.message}`);
        return data as ReportImportRow;
    }

    static async getById(
        id: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<ReportImportRow | null> {
        const ctx = await OrgAccessService.assertOrgContext(userId, requestedOrgId);
        const { data, error } = await supabase
            .from('report_imports')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw new Error(`Failed to fetch import: ${error.message}`);
        if (!data || data.organization_id !== ctx.organizationId) return null;
        return data as ReportImportRow;
    }

    static async listForOrg(
        userId: string,
        requestedOrgId?: string
    ): Promise<ReportImportRow[]> {
        const ctx = await OrgAccessService.assertOrgContext(userId, requestedOrgId);
        const { data, error } = await supabase
            .from('report_imports')
            .select('*')
            .eq('organization_id', ctx.organizationId)
            .order('created_at', { ascending: false })
            .limit(20);
        if (error) throw new Error(`Failed to list imports: ${error.message}`);
        return (data ?? []) as ReportImportRow[];
    }

    private static async setStatus(
        id: string,
        status: ReportImportStatus,
        patch: Partial<Pick<ReportImportRow, 'error' | 'extracted'>> = {}
    ): Promise<void> {
        await supabase
            .from('report_imports')
            .update({ status, ...patch })
            .eq('id', id);
    }

    /**
     * Run extraction for an existing job and persist the result. Returns the
     * updated row. Throws (and marks the row failed) on hard errors so the
     * route can surface a message.
     *
     * NOTE: this is intentionally synchronous (the HTTP request waits for the
     * model). A large report can take 30-90s — on serverless deployments make
     * sure the function's max duration is raised accordingly. The job row is
     * written to 'processing' first so a timed-out request can still be polled
     * via GET /:id, and a 'failed' status is recorded on error.
     */
    static async process(
        id: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<ReportImportRow> {
        const job = await this.getById(id, userId, requestedOrgId);
        if (!job) throw OrgAccessService.accessDenied('Import not found');

        if (!isOpenAIConfigured() || !openai) {
            await this.setStatus(id, 'failed', { error: 'AI extraction is not configured' });
            throw new Error('AI extraction is not configured');
        }
        if (!job.file_url && !job.file_path) {
            await this.setStatus(id, 'failed', { error: 'No file to process' });
            throw new Error('No file to process');
        }

        await this.setStatus(id, 'processing', { error: null });

        try {
            console.log(`[ReportImport] ${id}: downloading source (${job.file_url || job.file_path})`);
            const { buffer, fileName } = await this.downloadSource(job);
            console.log(`[ReportImport] ${id}: downloaded ${buffer.length} bytes, sending to OpenAI`);
            const extracted = await this.extract(openai, buffer, fileName);
            console.log(`[ReportImport] ${id}: extraction complete`);
            await this.setStatus(id, 'completed', { extracted, error: null });
            return { ...job, status: 'completed', extracted, error: null };
        } catch (err: any) {
            const message = err?.message || 'Extraction failed';
            console.error(`[ReportImport] ${id}: processing failed —`, err?.stack || message);
            await this.setStatus(id, 'failed', { error: message.slice(0, 1000) });
            throw err;
        }
    }

    /** Fetch the uploaded PDF bytes, preferring a signed download for the path. */
    private static async downloadSource(
        job: ReportImportRow
    ): Promise<{ buffer: Buffer; fileName: string }> {
        const fileName = job.file_name || 'annual-report.pdf';

        // Preferred: pull straight from storage by path (works for private buckets).
        if (job.file_path) {
            const { data, error } = await supabase.storage
                .from('evidence-files')
                .download(job.file_path);
            if (!error && data) {
                const arrayBuf = await data.arrayBuffer();
                return { buffer: Buffer.from(arrayBuf), fileName };
            }
        }

        // Fallback: fetch the public URL.
        if (job.file_url) {
            const res = await fetch(job.file_url);
            if (!res.ok) throw new Error(`Failed to download report (${res.status})`);
            const arrayBuf = await res.arrayBuffer();
            return { buffer: Buffer.from(arrayBuf), fileName };
        }

        throw new Error('No file to process');
    }

    /** Upload the PDF to OpenAI and ask the model to extract structured suggestions. */
    private static async extract(
        client: OpenAI,
        buffer: Buffer,
        fileName: string
    ): Promise<ExtractedSuggestions> {
        // The Files API handles larger PDFs than inline base64 and lets the
        // vision model rasterise each page (so image-heavy reports work).
        const uploaded = await client.files.create({
            file: await toFile(buffer, fileName, { type: 'application/pdf' }),
            purpose: 'user_data',
        });

        try {
            const completion = await client.chat.completions.create({
                model: EXTRACTION_MODEL,
                temperature: 0.2,
                max_tokens: 4000,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: EXTRACTION_INSTRUCTIONS },
                    {
                        role: 'user',
                        content: [
                            { type: 'file', file: { file_id: uploaded.id } },
                            {
                                type: 'text',
                                text: 'Extract the structured JSON described in your instructions from this annual report.',
                            },
                        ] as any,
                    },
                ],
            });

            const raw = completion.choices[0]?.message?.content || '{}';
            return this.normalize(raw);
        } finally {
            // Best-effort cleanup of the uploaded file.
            client.files.delete(uploaded.id).catch(() => undefined);
        }
    }

    /** Parse + defensively clamp the model output to our shape. */
    private static normalize(raw: string): ExtractedSuggestions {
        let parsed: any = {};
        try {
            parsed = JSON.parse(raw);
        } catch {
            // Strip code fences if the model wrapped the JSON despite instructions.
            const match = raw.match(/\{[\s\S]*\}/);
            if (match) {
                try { parsed = JSON.parse(match[0]); } catch { parsed = {}; }
            }
        }
        if (!parsed || typeof parsed !== 'object') return {};

        const str = (v: unknown, max = 4000) =>
            typeof v === 'string' ? v.trim().slice(0, max) : undefined;
        const num = (v: unknown) => {
            if (typeof v === 'number' && Number.isFinite(v)) return v;
            if (typeof v === 'string') {
                const n = Number(v.replace(/[^0-9.\-]/g, ''));
                return Number.isFinite(n) ? n : undefined;
            }
            return undefined;
        };
        const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

        const out: ExtractedSuggestions = {};

        if (parsed.organization && typeof parsed.organization === 'object') {
            const o = parsed.organization;
            out.organization = {
                statement: str(o.statement, 150),
                description: str(o.description, 2000),
                website_url: str(o.website_url, 500),
                donation_url: str(o.donation_url, 500),
            };
        }

        if (parsed.context && typeof parsed.context === 'object') {
            const c = parsed.context;
            out.context = {
                problem_statement: str(c.problem_statement),
                theory_of_change: str(c.theory_of_change),
                additional_info: str(c.additional_info),
                strategies: arr(c.strategies)
                    .map((s: any) => ({ title: str(s?.title, 200) || '', description: str(s?.description) }))
                    .filter((s) => s.title)
                    .slice(0, 12),
                stats_and_statements: arr(c.stats_and_statements)
                    .map((s: any) => ({
                        type: s?.type === 'stat' ? 'stat' as const : 'statement' as const,
                        value: str(s?.value, 60),
                        title: str(s?.title, 200) || '',
                        description: str(s?.description, 600),
                        source: str(s?.source, 200),
                    }))
                    .filter((s) => (s.type === 'stat' ? !!s.value : !!s.title || !!s.description))
                    .slice(0, 12),
            };
        }

        out.locations = arr(parsed.locations)
            .map((l: any) => ({ name: str(l?.name, 200) || '', country: str(l?.country, 120) }))
            .filter((l) => l.name)
            .slice(0, 12);

        out.initiatives = arr(parsed.initiatives)
            .map((i: any) => ({
                title: str(i?.title, 200) || '',
                description: str(i?.description, 2000),
                region: str(i?.region, 200),
            }))
            .filter((i) => i.title)
            .slice(0, 10);

        out.metrics = arr(parsed.metrics)
            .map((m: any) => ({
                title: str(m?.title, 200) || '',
                description: str(m?.description, 1000),
                unit_of_measurement: str(m?.unit_of_measurement, 60) || '',
                metric_type: m?.metric_type === 'percentage' ? 'percentage' as const : 'number' as const,
                category: ['input', 'output', 'impact'].includes(m?.category) ? m.category : 'output' as const,
                initiative: str(m?.initiative, 200),
                value: num(m?.value),
                period_start: str(m?.period_start, 40),
                period_end: str(m?.period_end, 40),
                period_label: str(m?.period_label, 60),
                tags: arr(m?.tags).map((t: any) => str(t, 60)).filter(Boolean) as string[],
            }))
            .filter((m) => m.title && m.unit_of_measurement)
            .slice(0, 16);

        out.beneficiary_groups = arr(parsed.beneficiary_groups)
            .map((g: any) => ({
                name: str(g?.name, 200) || '',
                description: str(g?.description, 1000),
                total_number: num(g?.total_number) ?? null,
                age_range_start: num(g?.age_range_start) ?? null,
                age_range_end: num(g?.age_range_end) ?? null,
                initiative: str(g?.initiative, 200),
            }))
            .filter((g) => g.name)
            .slice(0, 12);

        out.summary = str(parsed.summary, 600);

        return out;
    }
}
