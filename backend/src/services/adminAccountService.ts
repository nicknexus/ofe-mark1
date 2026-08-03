import { supabase } from '../utils/supabase';
import { stripe } from '../utils/stripe';
import { TeamService } from './teamService';
import { EntitlementService } from './entitlementService';
import { SubscriptionService, Subscription } from './subscriptionService';
import { PLAN_CATALOG, PlanTier, getPlan, normaliseTier, planLimitColumns } from '../config/planCatalog';

/**
 * ADMIN ACCOUNT SERVICE — everything the support console needs to understand
 * and repair one customer account.
 *
 * Kept out of routes/admin.ts because the interesting logic here is the
 * derivations (is this plan paid or comped? are these limits custom?), not the
 * HTTP plumbing.
 */

/**
 * Period end written for admin-granted plans. Deliberately absurd so nobody
 * mistakes it for a real billing date — comps have no billing cycle, and this
 * exists only so builds that predate the comp concept still read them as valid.
 */
const COMP_PERIOD_END = '2999-12-31T00:00:00.000Z';

/** Where a customer's current plan came from. */
export type PlanSource =
    | 'stripe'   // real, paying Stripe subscription
    | 'admin'    // granted by a platform admin without payment
    | 'code'     // access-code comped trial
    | 'free'     // on the always-free plan
    | 'none';    // never picked a plan

export interface OrgUsage {
    initiatives: number;
    team_members: number;
    locations: number;
    storage_used_bytes: number;
}

export interface AdminOrgRow {
    id: string;
    name: string;
    slug: string;
    is_public: boolean;
    created_at: string;
    logo_url: string | null;
    brand_color: string | null;
    owner: { id: string | null; email?: string; name?: string; last_sign_in_at?: string | null };
    subscription: Partial<Subscription> | null;
    plan_source: PlanSource;
    limits_overridden: boolean;
    usage: OrgUsage;
}

// ─── User directory ──────────────────────────────────────────────────────────

interface DirectoryEntry {
    email?: string;
    name?: string;
    created_at?: string;
    last_sign_in_at?: string | null;
    email_confirmed_at?: string | null;
}

const DIRECTORY_TTL_MS = 60 * 1000;
let directoryCache: { expires: number; map: Map<string, DirectoryEntry> } | null = null;

/**
 * All auth users as one map, cached briefly.
 *
 * The org list previously called auth.admin.getUserById() once PER ROW — 500
 * orgs meant 500 sequential auth round-trips. Pulling the directory once also
 * makes searching by owner email possible, which per-row lookups can't do
 * (emails live in auth, not in a table we can filter on).
 */
async function getUserDirectory(): Promise<Map<string, DirectoryEntry>> {
    if (directoryCache && directoryCache.expires > Date.now()) return directoryCache.map;

    const map = new Map<string, DirectoryEntry>();
    for (let page = 1; page <= 50; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) {
            console.error('[adminAccount] listUsers failed:', error.message);
            break;
        }
        const users = data?.users ?? [];
        for (const u of users) {
            map.set(u.id, {
                email: u.email ?? undefined,
                name: (u.user_metadata as any)?.name,
                created_at: u.created_at,
                last_sign_in_at: (u as any).last_sign_in_at ?? null,
                email_confirmed_at: (u as any).email_confirmed_at ?? null,
            });
        }
        if (users.length < 200) break;
    }

    directoryCache = { expires: Date.now() + DIRECTORY_TTL_MS, map };
    return map;
}

/** Drop the cached directory (after creating/promoting an account). */
export function bustUserDirectory(): void {
    directoryCache = null;
}

// ─── Derivations ─────────────────────────────────────────────────────────────

/**
 * Whether this plan is being paid for, comped by us, or neither.
 *
 * An admin-granted plan is stored as status 'active' with NO
 * stripe_subscription_id — that combination is what distinguishes a comp from
 * a real paying customer, so nothing extra needs storing.
 */
export function derivePlanSource(sub: Partial<Subscription> | null | undefined): PlanSource {
    if (!sub || !sub.status || sub.status === 'none') return 'none';
    if (sub.stripe_subscription_id) return 'stripe';
    if (sub.status === 'active') return 'admin';
    if (sub.status === 'trial') return 'code';
    return 'free';
}

const LIMIT_FIELDS = [
    'initiatives_limit',
    'team_members_limit',
    'locations_limit',
    'storage_limit_bytes',
    'ai_reports_per_day',
] as const;

/** Which limit columns have been hand-edited away from their tier's defaults. */
export function overriddenLimitFields(sub: Partial<Subscription> | null | undefined): string[] {
    if (!sub || !sub.status || sub.status === 'none') return [];
    const plan = getPlan(sub.plan_tier);
    return LIMIT_FIELDS.filter((field) => {
        const current = (sub as any)[field];
        if (current === undefined) return false; // column not loaded — not a diff
        return current !== (plan as any)[field];
    });
}

// ─── List ────────────────────────────────────────────────────────────────────

export class AdminAccountService {
    /**
     * Customer orgs with owner, plan and usage — batched.
     * `search` matches org name, slug, OR owner email.
     */
    static async listOrgs(opts: {
        search?: string;
        restrictToOrgIds?: string[] | null;
    }): Promise<AdminOrgRow[]> {
        const search = opts.search?.trim().toLowerCase() ?? '';

        let query = supabase
            .from('organizations')
            .select('id, name, slug, is_public, owner_id, created_at, storage_used_bytes, logo_url, brand_color')
            .eq('is_demo', false)
            .order('created_at', { ascending: false })
            .limit(500);

        if (opts.restrictToOrgIds) {
            if (opts.restrictToOrgIds.length === 0) return [];
            query = query.in('id', opts.restrictToOrgIds);
        }

        const { data: allOrgs, error } = await query;
        if (error) throw error;

        const directory = await getUserDirectory();

        // Filter in memory so owner email is searchable alongside name/slug.
        const orgs = search
            ? (allOrgs || []).filter((o) => {
                  const owner = o.owner_id ? directory.get(o.owner_id) : undefined;
                  return (
                      o.name?.toLowerCase().includes(search) ||
                      o.slug?.toLowerCase().includes(search) ||
                      owner?.email?.toLowerCase().includes(search) ||
                      owner?.name?.toLowerCase().includes(search)
                  );
              })
            : allOrgs || [];

        if (orgs.length === 0) return [];

        const orgIds = orgs.map((o) => o.id);
        const ownerIds = Array.from(new Set(orgs.map((o) => o.owner_id).filter(Boolean))) as string[];

        // Three batched queries instead of four per row.
        const [subsResult, initiativeRows, memberRows, locationRows] = await Promise.all([
            ownerIds.length
                ? supabase.from('subscriptions').select('*').in('user_id', ownerIds)
                : Promise.resolve({ data: [] as any[] }),
            supabase.from('initiatives').select('organization_id').in('organization_id', orgIds),
            supabase.from('team_members').select('organization_id').in('organization_id', orgIds),
            supabase.from('locations').select('organization_id').in('organization_id', orgIds),
        ]);

        const subsByOwner = new Map<string, Subscription>();
        for (const s of (subsResult as any).data || []) subsByOwner.set(s.user_id, s);

        const tally = (rows: { organization_id: string }[] | null | undefined) => {
            const counts = new Map<string, number>();
            for (const r of rows || []) {
                counts.set(r.organization_id, (counts.get(r.organization_id) || 0) + 1);
            }
            return counts;
        };
        const initiativeCounts = tally((initiativeRows as any).data);
        const memberCounts = tally((memberRows as any).data);
        const locationCounts = tally((locationRows as any).data);

        return orgs.map((org) => {
            const owner = org.owner_id ? directory.get(org.owner_id) : undefined;
            const sub = org.owner_id ? subsByOwner.get(org.owner_id) ?? null : null;
            return {
                id: org.id,
                name: org.name,
                slug: org.slug,
                is_public: org.is_public,
                created_at: org.created_at,
                logo_url: org.logo_url ?? null,
                brand_color: org.brand_color ?? null,
                owner: {
                    id: org.owner_id ?? null,
                    email: owner?.email,
                    name: owner?.name,
                    last_sign_in_at: owner?.last_sign_in_at ?? null,
                },
                subscription: sub,
                plan_source: derivePlanSource(sub),
                limits_overridden: overriddenLimitFields(sub).length > 0,
                usage: {
                    initiatives: initiativeCounts.get(org.id) || 0,
                    team_members: memberCounts.get(org.id) || 0,
                    locations: locationCounts.get(org.id) || 0,
                    storage_used_bytes: org.storage_used_bytes || 0,
                },
            };
        });
    }

    // ─── Detail ──────────────────────────────────────────────────────────────

    /**
     * Everything about one account. `includeStripeIds` is reserved for super
     * admins — raw Stripe ids are actionable in the Stripe dashboard, so support
     * agents get the human-readable billing facts without the keys to them.
     */
    static async getAccount(orgId: string, opts: { includeStripeIds: boolean }) {
        const { data: org, error } = await supabase
            .from('organizations')
            .select(
                'id, name, slug, description, is_public, is_demo, owner_id, created_at, logo_url, brand_color, website_url, donation_url, storage_used_bytes'
            )
            .eq('id', orgId)
            .maybeSingle();
        if (error) throw error;
        if (!org) return null;

        const directory = await getUserDirectory();
        const ownerEntry = org.owner_id ? directory.get(org.owner_id) : undefined;

        const subscription = org.owner_id
            ? await SubscriptionService.getByUserId(org.owner_id)
            : null;

        const [initiatives, members, locations, pendingInvites, teamMembers, accessCode, activity] =
            await Promise.all([
                supabase.from('initiatives').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
                supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
                supabase.from('locations').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
                TeamService.getPendingInviteCount(orgId).catch(() => 0),
                TeamService.getTeamMembers(orgId).catch(() => []),
                org.owner_id ? this.getLatestAccessCode(org.owner_id) : Promise.resolve(null),
                supabase
                    .from('admin_audit_log')
                    .select('id, admin_email, action, detail, created_at')
                    .eq('organization_id', orgId)
                    .order('created_at', { ascending: false })
                    .limit(20),
            ]);

        const billing = await this.getBilling(subscription, opts.includeStripeIds);
        const planTier = normaliseTier(subscription?.plan_tier);
        const catalog = PLAN_CATALOG[planTier];
        const overridden = overriddenLimitFields(subscription);

        // AI reports used today (same UTC-day window the quota check uses).
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const { count: aiReportsToday } = await supabase
            .from('ai_report_log')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .gte('created_at', startOfDay.toISOString());

        return {
            org: {
                id: org.id,
                name: org.name,
                slug: org.slug,
                description: org.description,
                is_public: org.is_public,
                is_demo: org.is_demo,
                created_at: org.created_at,
                logo_url: org.logo_url,
                brand_color: org.brand_color,
                website_url: org.website_url,
                donation_url: org.donation_url,
            },
            owner: {
                id: org.owner_id ?? null,
                email: ownerEntry?.email ?? null,
                name: ownerEntry?.name ?? null,
                created_at: ownerEntry?.created_at ?? null,
                last_sign_in_at: ownerEntry?.last_sign_in_at ?? null,
                email_confirmed: !!ownerEntry?.email_confirmed_at,
            },
            plan: {
                tier: planTier,
                name: catalog.name,
                status: subscription?.status ?? 'none',
                source: derivePlanSource(subscription),
                trial_ends_at: subscription?.trial_ends_at ?? null,
                catalog_limits: {
                    initiatives_limit: catalog.initiatives_limit,
                    team_members_limit: catalog.team_members_limit,
                    locations_limit: catalog.locations_limit,
                    storage_limit_bytes: catalog.storage_limit_bytes,
                    ai_reports_per_day: catalog.ai_reports_per_day,
                },
                effective_limits: {
                    initiatives_limit: subscription?.initiatives_limit ?? null,
                    team_members_limit: subscription?.team_members_limit ?? null,
                    locations_limit: subscription?.locations_limit ?? null,
                    storage_limit_bytes: subscription?.storage_limit_bytes ?? null,
                    ai_reports_per_day: subscription?.ai_reports_per_day ?? null,
                },
                overridden_fields: overridden,
                features: catalog.features,
            },
            billing,
            access_code: accessCode,
            usage: {
                initiatives: initiatives.count || 0,
                team_members: members.count || 0,
                locations: locations.count || 0,
                storage_used_bytes: org.storage_used_bytes || 0,
                ai_reports_today: aiReportsToday || 0,
                pending_invites: pendingInvites,
            },
            team: (teamMembers || []).map((m: any) => ({
                id: m.id,
                user_id: m.user_id,
                email: m.user_email ?? null,
                name: m.user_name ?? null,
                member_type: m.member_type ?? null,
                joined_at: m.joined_at ?? null,
            })),
            activity: (activity as any).data || [],
        };
    }

    /** Most recent comped access code redeemed by this user, if any. */
    private static async getLatestAccessCode(userId: string) {
        const { data, error } = await supabase
            .from('access_code_redemptions')
            .select('created_at, access_codes(code, days_granted, description)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error || !data) return null;
        const code = (data as any).access_codes;
        return {
            code: code?.code ?? null,
            days_granted: code?.days_granted ?? null,
            description: code?.description ?? null,
            redeemed_at: (data as any).created_at,
        };
    }

    /**
     * Retrieve a subscription with its discounts expanded, falling back to a
     * plain retrieve if that expansion is rejected.
     *
     * Nested array expansion (`discounts.promotion_code`) is the only way to
     * read the redeemed code, but an expansion Stripe dislikes fails the whole
     * request — which would blank the billing panel for every account, not just
     * discounted ones. The fallback keeps the common case working and simply
     * loses the code text.
     */
    private static async retrieveSubscriptionWithDiscounts(subscriptionId: string): Promise<any> {
        const base = ['default_payment_method', 'items.data.price'];
        try {
            return await stripe!.subscriptions.retrieve(subscriptionId, {
                expand: [...base, 'discounts.promotion_code'],
            });
        } catch (e) {
            console.warn('[adminAccount] discount expansion failed, retrying without:', (e as Error).message);
            return stripe!.subscriptions.retrieve(subscriptionId, { expand: base });
        }
    }

    /**
     * Live billing facts from Stripe: real status, price, renewal, card, and
     * any active discount. Best-effort — Stripe being unreachable must not stop
     * an admin from seeing the rest of the account, so failures return a null
     * block with a reason rather than throwing.
     */
    static async getBilling(
        subscription: Subscription | null,
        includeStripeIds: boolean
    ): Promise<Record<string, unknown> | null> {
        if (!subscription?.stripe_customer_id && !subscription?.stripe_subscription_id) return null;
        if (!stripe) return { available: false, reason: 'stripe_not_configured' };

        try {
            let sub: any = null;
            if (subscription.stripe_subscription_id) {
                sub = await this.retrieveSubscriptionWithDiscounts(subscription.stripe_subscription_id);
            }

            // Where a discount lives depends on how it was applied:
            //  - redeemed at checkout  → on the SUBSCRIPTION
            //  - added to the account  → on the CUSTOMER
            // Stripe v20 replaced Subscription.discount with a `discounts`
            // array whose entries are ids unless expanded, so skip any that
            // didn't come back expanded rather than rendering "[object]".
            let discount: any =
                (sub?.discounts ?? []).find((d: unknown) => d && typeof d === 'object') ?? null;

            let customer: any = null;
            if (subscription.stripe_customer_id) {
                customer = await stripe.customers.retrieve(subscription.stripe_customer_id, {
                    expand: ['discount.promotion_code'],
                });
                if (!discount && !customer?.deleted) discount = customer?.discount ?? null;
            }

            const price = sub?.items?.data?.[0]?.price;
            const card = sub?.default_payment_method?.card;

            return {
                available: true,
                status: sub?.status ?? null,
                cancel_at_period_end: sub?.cancel_at_period_end ?? false,
                current_period_end: sub?.items?.data?.[0]?.current_period_end
                    ? new Date(sub.items.data[0].current_period_end * 1000).toISOString()
                    : sub?.current_period_end
                        ? new Date(sub.current_period_end * 1000).toISOString()
                        : null,
                price: price
                    ? {
                          nickname: price.nickname ?? null,
                          amount: price.unit_amount ?? null,
                          currency: price.currency ?? null,
                          interval: price.recurring?.interval ?? null,
                      }
                    : null,
                card: card
                    ? { brand: card.brand, last4: card.last4, exp_month: card.exp_month, exp_year: card.exp_year }
                    : null,
                discount: discount
                    ? {
                          code: discount.promotion_code?.code ?? null,
                          name: discount.coupon?.name ?? discount.coupon?.id ?? null,
                          percent_off: discount.coupon?.percent_off ?? null,
                          amount_off: discount.coupon?.amount_off ?? null,
                          currency: discount.coupon?.currency ?? null,
                          duration: discount.coupon?.duration ?? null,
                          duration_in_months: discount.coupon?.duration_in_months ?? null,
                          ends_at: discount.end ? new Date(discount.end * 1000).toISOString() : null,
                      }
                    : null,
                ...(includeStripeIds
                    ? {
                          stripe_customer_id: subscription.stripe_customer_id ?? null,
                          stripe_subscription_id: subscription.stripe_subscription_id ?? null,
                      }
                    : {}),
            };
        } catch (e) {
            console.error('[adminAccount] Stripe lookup failed:', (e as Error).message);
            return { available: false, reason: 'stripe_error', message: (e as Error).message };
        }
    }

    // ─── Plan changes ────────────────────────────────────────────────────────

    /**
     * Is this customer genuinely paying right now? Checked LIVE against Stripe
     * rather than the local row, so a missed webhook can't let an admin
     * overwrite a real paying subscription with a comp.
     */
    static async isActivelyPaying(subscription: Subscription | null): Promise<boolean> {
        if (!subscription?.stripe_subscription_id) return false;
        if (!stripe) return true; // can't verify → assume paying, refuse to touch it

        try {
            const sub = (await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)) as any;
            return ['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status);
        } catch (e) {
            const code = (e as any)?.code;
            // A subscription Stripe has never heard of is stale local data.
            if (code === 'resource_missing') return false;
            console.error('[adminAccount] paying check failed, refusing change:', (e as Error).message);
            return true; // fail closed — never clobber billing we can't verify
        }
    }

    /**
     * Move an org's owner onto a tier without payment.
     *
     * Comped paid tiers are stored as status 'active' with the Stripe
     * subscription link cleared: that's what marks them as admin-granted, and
     * it stops the Stripe sync on /subscription/status from later reading a
     * stale cancelled subscription and undoing the grant.
     */
    static async changePlan(orgId: string, tier: PlanTier): Promise<Subscription> {
        const { data: org } = await supabase
            .from('organizations')
            .select('id, owner_id, is_demo')
            .eq('id', orgId)
            .maybeSingle();
        if (!org || org.is_demo) throw Object.assign(new Error('Organization not found'), { status: 404 });
        if (!org.owner_id) {
            throw Object.assign(new Error('This organization has no owner to assign a plan to'), { status: 400 });
        }

        await SubscriptionService.getOrCreate(org.owner_id);

        const updates: Record<string, unknown> =
            tier === 'free'
                ? { status: 'free', ...planLimitColumns('free') }
                : {
                      status: 'active',
                      ...planLimitColumns(tier),
                      stripe_subscription_id: null,
                      stripe_price_id: null,
                      current_period_start: new Date().toISOString(),
                      // A far-future period end, NOT a real billing date.
                      //
                      // Current code identifies a comp by "active with no Stripe
                      // subscription" and ignores this field. But any older build
                      // still running (a not-yet-deployed environment, a rollback,
                      // a second region mid-deploy) checks `current_period_end >
                      // now` and, on failing that, WRITES status 'expired' to the
                      // row — silently destroying the comp in a shared database.
                      // Dating it far out makes a comp survive both code paths.
                      current_period_end: COMP_PERIOD_END,
                      cancel_at_period_end: false,
                      cancelled_at: null,
                      trial_ends_at: null,
                  };

        const { data, error } = await supabase
            .from('subscriptions')
            .update(updates)
            .eq('user_id', org.owner_id)
            .select()
            .single();
        if (error) throw error;

        // Visibility of over-limit content is derived from the plan at read
        // time, so drop the cache or the change won't show until it expires.
        EntitlementService.bustAll();
        return data;
    }

    /** Snap an org's limits back to its tier's catalog defaults. */
    static async resetLimits(orgId: string): Promise<Subscription> {
        const { data: org } = await supabase
            .from('organizations')
            .select('owner_id')
            .eq('id', orgId)
            .maybeSingle();
        if (!org?.owner_id) throw Object.assign(new Error('Organization not found'), { status: 404 });

        const sub = await SubscriptionService.getByUserId(org.owner_id);
        const tier = normaliseTier(sub?.plan_tier);

        const { data, error } = await supabase
            .from('subscriptions')
            .update(planLimitColumns(tier))
            .eq('user_id', org.owner_id)
            .select()
            .single();
        if (error) throw error;

        EntitlementService.bustAll();
        return data;
    }
}
