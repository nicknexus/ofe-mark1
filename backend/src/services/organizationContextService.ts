import { supabase } from '../utils/supabase';
import { OrganizationContext, StatCard, StatCardType, TheoryStage, Strategy } from '../types';

const TEXT_FIELDS = [
    'problem_statement',
    'theory_of_change',
    'additional_info',
] as const;

const MAX_STAT_CARDS = 12;
const MAX_THEORY_STAGES = 12;
const MAX_STRATEGIES = 12;

type TextField = typeof TEXT_FIELDS[number];

interface UpsertInput {
    featured_video_url?: string;
    problem_statement?: string;
    stats_and_statements?: StatCard[] | null;
    theory_of_change?: string;
    theory_of_change_stages?: TheoryStage[] | null;
    strategies?: Strategy[] | null;
    additional_info?: string;
}

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

function sanitizeFeaturedVideoUrl(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let parsed: URL;
    try {
        parsed = new URL(withScheme);
    } catch {
        return '';
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    const host = parsed.hostname.toLowerCase();
    if (!YT_HOSTS.has(host) && !VIMEO_HOSTS.has(host)) return '';
    return parsed.toString();
}

function randomId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStatType(v: unknown): StatCardType {
    return v === 'stat' ? 'stat' : 'statement';
}

function sanitizeUrl(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    // Accept http/https. If it looks like a domain without scheme, prefix https://.
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const u = new URL(withScheme);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
        return u.toString();
    } catch {
        return '';
    }
}

function sanitizeStatCards(raw: unknown): StatCard[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const cards: StatCard[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const type = normalizeStatType(rec.type);
        const title = typeof rec.title === 'string' ? rec.title : '';
        const description = typeof rec.description === 'string' ? rec.description : '';
        const source = typeof rec.source === 'string' ? rec.source : '';
        const source_url = sanitizeUrl(rec.source_url);
        const value = typeof rec.value === 'string' ? rec.value : '';

        // Drop empty cards.
        // Stat: requires a value. Statement: requires a title.
        if (type === 'stat' && !value.trim()) continue;
        if (type === 'statement' && !title.trim() && !description.trim()) continue;

        let id = typeof rec.id === 'string' && rec.id.trim().length > 0 ? rec.id : '';
        if (!id || seen.has(id)) id = randomId();
        seen.add(id);

        const created_at =
            typeof rec.created_at === 'string' && rec.created_at.trim().length > 0
                ? rec.created_at
                : new Date().toISOString();

        cards.push({
            id,
            type,
            // Strip value on statement cards so data stays clean.
            value: type === 'stat' ? value : '',
            title,
            description,
            source,
            source_url,
            created_at,
        });
        if (cards.length >= MAX_STAT_CARDS) break;
    }
    return cards;
}

function sanitizeTheoryStages(raw: unknown): TheoryStage[] {
    return sanitizeTitledList<TheoryStage>(raw, MAX_THEORY_STAGES);
}

function sanitizeStrategies(raw: unknown): Strategy[] {
    return sanitizeTitledList<Strategy>(raw, MAX_STRATEGIES);
}

function sanitizeTitledList<T extends { id: string; title: string; description: string }>(
    raw: unknown,
    max: number
): T[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const title = typeof rec.title === 'string' ? rec.title : '';
        const description = typeof rec.description === 'string' ? rec.description : '';
        if (!title.trim() && !description.trim()) continue;

        let id = typeof rec.id === 'string' && rec.id.trim().length > 0 ? rec.id : '';
        if (!id || seen.has(id)) id = randomId();
        seen.add(id);

        out.push({ id, title, description } as T);
        if (out.length >= max) break;
    }
    return out;
}

export class OrganizationContextService {
    /**
     * Fetch the context row for an org the user owns.
     * Returns null if no row exists yet (org hasn't filled it in).
     * Throws if the user isn't the owner.
     */
    static async getForOwner(orgId: string, userId: string): Promise<OrganizationContext | null> {
        await this.assertOwner(orgId, userId);

        const { data, error } = await supabase
            .from('organization_context')
            .select('*')
            .eq('organization_id', orgId)
            .maybeSingle();

        if (error) throw new Error(`Failed to fetch context: ${error.message}`);
        return data || null;
    }

    /**
     * Upsert the context row. Only owner can edit.
     * Empty strings are persisted as empty strings (intentional clears).
     */
    static async upsertForOwner(
        orgId: string,
        userId: string,
        input: UpsertInput
    ): Promise<OrganizationContext> {
        await this.assertOwner(orgId, userId);

        const payload: Record<string, any> = { organization_id: orgId };
        for (const field of TEXT_FIELDS as readonly TextField[]) {
            if (field in input) {
                payload[field] = input[field] ?? null;
            }
        }
        if ('featured_video_url' in input) {
            payload.featured_video_url = sanitizeFeaturedVideoUrl(input.featured_video_url) || null;
        }
        if ('stats_and_statements' in input) {
            payload.stats_and_statements = sanitizeStatCards(input.stats_and_statements);
        }
        if ('theory_of_change_stages' in input) {
            payload.theory_of_change_stages = sanitizeTheoryStages(input.theory_of_change_stages);
        }
        if ('strategies' in input) {
            payload.strategies = sanitizeStrategies(input.strategies);
        }

        const { data, error } = await supabase
            .from('organization_context')
            .upsert(payload, { onConflict: 'organization_id' })
            .select()
            .single();

        if (error) throw new Error(`Failed to save context: ${error.message}`);
        return data;
    }

    /**
     * Public read by org slug. Only returns when the parent org is public.
     */
    static async getPublicBySlug(slug: string): Promise<OrganizationContext | null> {
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id, is_public')
            .eq('slug', slug)
            .eq('is_public', true)
            .maybeSingle();

        if (orgError) throw new Error(`Failed to resolve organization: ${orgError.message}`);
        if (!org) return null;

        const { data, error } = await supabase
            .from('organization_context')
            .select('*')
            .eq('organization_id', org.id)
            .maybeSingle();

        if (error) throw new Error(`Failed to fetch context: ${error.message}`);
        return data || null;
    }

    /**
     * Phase 1 (full-access baseline): editing organization-context content
     * (problem statement, theory of change, etc.) is content-level, not
     * account-level, so team members are allowed. Org-account fields like
     * name/branding/billing remain owner-only via OrganizationService.update.
     */
    private static async assertOwner(orgId: string, userId: string): Promise<void> {
        const { data: org, error } = await supabase
            .from('organizations')
            .select('owner_id')
            .eq('id', orgId)
            .maybeSingle();

        if (error) throw new Error(`Failed to verify organization: ${error.message}`);
        if (!org) throw new Error('Organization not found');

        if (org.owner_id === userId) return;

        const { TeamService } = await import('./teamService');
        const membership = await TeamService.getUserTeamMembership(userId, orgId);
        if (membership) return;

        const permissionError = new Error('Permission denied - must be a member of this organization');
        (permissionError as any).status = 403;
        throw permissionError;
    }
}
