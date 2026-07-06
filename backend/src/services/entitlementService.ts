import { supabase } from '../utils/supabase';
import { getPlan, PlanFeatures, PlanTier } from '../config/planCatalog';

/**
 * ENTITLEMENT SERVICE — read-time plan enforcement.
 *
 * Answers one question everywhere: "what is this org's current plan allowed to
 * show?" Nothing is ever mutated on upgrade/downgrade; public pages and the
 * private UI both derive visibility from the owner's live subscription row.
 *
 * Rules:
 *  - allowed sets are the OLDEST `limit` rows (created_at asc) — deterministic,
 *    so public + private always agree, and matches the dashboard lock rule.
 *  - `null` allowed set = no filtering (unlimited plan, or usage under limit).
 *  - FAIL OPEN: any lookup error → no filtering. An outage or missing row can
 *    never blank out a paying customer's public page; worst case a free org
 *    briefly shows extra content.
 */

export interface OrgEntitlements {
    tier: PlanTier;
    features: PlanFeatures;
    /** null = all initiatives visible */
    allowedInitiativeIds: string[] | null;
    /** null = all locations visible */
    allowedLocationIds: string[] | null;
}

const OPEN_ENTITLEMENTS: OrgEntitlements = {
    tier: 'pro',
    features: { tags: true, beneficiaryGroups: true },
    allowedInitiativeIds: null,
    allowedLocationIds: null,
};

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, { expires: number; value: OrgEntitlements }>();
const slugCache = new Map<string, { expires: number; orgId: string | null }>();

export class EntitlementService {
    /** Drop all cached entitlements (called from Stripe webhook on plan changes). */
    static bustAll(): void {
        cache.clear();
    }

    static async getForOrg(orgId: string): Promise<OrgEntitlements> {
        const hit = cache.get(orgId);
        if (hit && hit.expires > Date.now()) return hit.value;

        let value = OPEN_ENTITLEMENTS;
        try {
            value = await this.resolve(orgId);
        } catch (e) {
            console.error(`[entitlements] resolve failed for org ${orgId}, failing open:`, (e as Error).message);
        }
        cache.set(orgId, { expires: Date.now() + CACHE_TTL_MS, value });
        return value;
    }

    /** Convenience for public routes that only know the org slug. */
    static async getForOrgSlug(slug: string): Promise<OrgEntitlements> {
        const hit = slugCache.get(slug);
        let orgId = hit && hit.expires > Date.now() ? hit.orgId : undefined;
        if (orgId === undefined) {
            let resolved: string | null = null;
            try {
                const { data } = await supabase
                    .from('organizations')
                    .select('id')
                    .eq('slug', slug)
                    .maybeSingle();
                resolved = data?.id ?? null;
            } catch {
                resolved = null;
            }
            orgId = resolved;
            slugCache.set(slug, { expires: Date.now() + CACHE_TTL_MS, orgId: resolved });
        }
        if (!orgId) return OPEN_ENTITLEMENTS; // unknown org — routes 404 on their own
        return this.getForOrg(orgId);
    }

    /** Whether a specific initiative is within the org's plan allowance. */
    static async isInitiativeAllowed(orgId: string, initiativeId: string): Promise<boolean> {
        const ent = await this.getForOrg(orgId);
        return ent.allowedInitiativeIds === null || ent.allowedInitiativeIds.includes(initiativeId);
    }

    private static async resolve(orgId: string): Promise<OrgEntitlements> {
        // Org → owner → subscription (the same row that gates app access).
        const { data: org } = await supabase
            .from('organizations')
            .select('id, owner_id')
            .eq('id', orgId)
            .maybeSingle();
        if (!org?.owner_id) return OPEN_ENTITLEMENTS;

        const { data: sub } = await supabase
            .from('subscriptions')
            .select('plan_tier, initiatives_limit, locations_limit')
            .eq('user_id', org.owner_id)
            .maybeSingle();
        if (!sub) return OPEN_ENTITLEMENTS; // no subscription row — fail open

        const plan = getPlan(sub.plan_tier);
        // Column value wins (grandfathered/custom limits); fall back to tier default.
        const initiativesLimit = sub.initiatives_limit ?? plan.initiatives_limit;
        const locationsLimit = sub.locations_limit ?? plan.locations_limit;

        const [allowedInitiativeIds, allowedLocationIds] = await Promise.all([
            this.allowedIds('initiatives', orgId, initiativesLimit),
            this.allowedIds('locations', orgId, locationsLimit),
        ]);

        return {
            tier: plan.tier,
            features: plan.features,
            allowedInitiativeIds,
            allowedLocationIds,
        };
    }

    /**
     * Oldest `limit` row ids for the org, or null when no filtering is needed.
     * Only queries ids when the org is actually over its limit.
     */
    private static async allowedIds(
        table: 'initiatives' | 'locations',
        orgId: string,
        limit: number | null
    ): Promise<string[] | null> {
        if (limit === null) return null;

        const { count, error: countError } = await supabase
            .from(table)
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', orgId);
        if (countError) throw countError;
        if ((count || 0) <= limit) return null; // under limit — show everything

        const { data, error } = await supabase
            .from(table)
            .select('id')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: true })
            .limit(limit);
        if (error) throw error;
        return (data || []).map(r => r.id);
    }
}

/**
 * Recursively strip plan-gated fields from a public payload (cosmetic hiding).
 * Removes tag and beneficiary-group data without touching anything else, so
 * hidden features leave no trace in public responses while the underlying
 * data stays intact for when the org upgrades again.
 */
const TAG_KEYS = ['tag_ids', 'tags', 'tag', 'tag_id'];
const BEN_KEYS = ['beneficiary_groups', 'beneficiary_group', 'beneficiary_group_ids', 'story_beneficiaries', 'beneficiaries'];

export function stripGatedFields<T>(payload: T, features: PlanFeatures): T {
    if (features.tags && features.beneficiaryGroups) return payload;
    const gone = new Set<string>([
        ...(features.tags ? [] : TAG_KEYS),
        ...(features.beneficiaryGroups ? [] : BEN_KEYS),
    ]);

    const walk = (node: any): any => {
        if (Array.isArray(node)) return node.map(walk);
        if (node && typeof node === 'object') {
            const out: any = {};
            for (const [k, v] of Object.entries(node)) {
                if (gone.has(k)) continue;
                out[k] = walk(v);
            }
            return out;
        }
        return node;
    };
    return walk(payload);
}
