/**
 * PLAN CATALOG — single source of truth for plan tiers.
 *
 * Every limit and feature flag for the Free / Growth / Pro tiers lives here.
 * Checkout, the Stripe webhook, limit enforcement, and the account UI all read
 * from this file so the DB, Stripe, and the product never drift.
 *
 * NOTE (intentional scope): right now only LIMITS and the two Free-plan feature
 * restrictions (tags, beneficiary groups) are enforced. The other feature flags
 * are placeholders for things we'll gate later (widgets, auditing, donor
 * updates) — add them to `PlanFeatures` and the enforcement layer when ready.
 */

export type PlanTier = 'free' | 'growth' | 'pro';

const GB = 1024 ** 3;
const TB = 1024 ** 4;

export interface PlanFeatures {
    /** Free plan cannot create/use metric tags (themes). */
    tags: boolean;
    /** Free plan cannot create/use beneficiary groups. */
    beneficiaryGroups: boolean;
}

export interface PlanDefinition {
    tier: PlanTier;
    name: string;
    /** null = unlimited for every *_limit / per_day field below. */
    initiatives_limit: number | null;
    team_members_limit: number | null;
    locations_limit: number | null;
    storage_limit_bytes: number | null;
    ai_reports_per_day: number | null;
    features: PlanFeatures;
}

export const PLAN_CATALOG: Record<PlanTier, PlanDefinition> = {
    free: {
        tier: 'free',
        name: 'Free',
        initiatives_limit: 1,
        team_members_limit: 2,
        locations_limit: 3,
        storage_limit_bytes: 25 * GB,
        ai_reports_per_day: 1,
        features: { tags: false, beneficiaryGroups: false },
    },
    growth: {
        tier: 'growth',
        name: 'Growth',
        initiatives_limit: 10,
        team_members_limit: 10,
        locations_limit: 15,
        storage_limit_bytes: 300 * GB,
        ai_reports_per_day: null,
        features: { tags: true, beneficiaryGroups: true },
    },
    pro: {
        tier: 'pro',
        name: 'Pro',
        initiatives_limit: 25,
        team_members_limit: 20,
        locations_limit: 30,
        storage_limit_bytes: 1 * TB,
        ai_reports_per_day: null,
        features: { tags: true, beneficiaryGroups: true },
    },
};

/** Legacy tier names mapped to current tiers (grandfathering). */
const LEGACY_TIER_MAP: Record<string, PlanTier> = {
    starter: 'growth',        // grandfathered starter customers → Growth privileges
    professional: 'pro',
    enterprise: 'pro',
};

/** Normalise any stored plan_tier (incl. legacy values) to a current PlanTier. */
export function normaliseTier(tier: string | null | undefined): PlanTier {
    if (!tier) return 'free';
    if (tier in PLAN_CATALOG) return tier as PlanTier;
    return LEGACY_TIER_MAP[tier] ?? 'free';
}

export function getPlan(tier: string | null | undefined): PlanDefinition {
    return PLAN_CATALOG[normaliseTier(tier)];
}

/** The column values to persist on a subscription for a given tier. */
export function planLimitColumns(tier: PlanTier) {
    const p = PLAN_CATALOG[tier];
    return {
        plan_tier: p.tier,
        initiatives_limit: p.initiatives_limit,
        team_members_limit: p.team_members_limit,
        locations_limit: p.locations_limit,
        storage_limit_bytes: p.storage_limit_bytes,
        ai_reports_per_day: p.ai_reports_per_day,
    };
}
