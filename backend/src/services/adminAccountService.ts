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

/** What an account actually is right now: who pays, who has access, and why. */
export type AccountState =
    | 'paying'           // Stripe subscription being charged
    | 'discounted'       // Stripe subscription currently 100% off via a coupon
    | 'past_due'         // paid before, latest charge failed, Stripe retrying
    | 'trialing'         // card on file, converts at trial end
    | 'trial_cancelling' // card trial they cancelled; access ends at trial end
    | 'grace'            // legacy free account with no card; locks at trial end
    | 'comped'           // granted by an admin without payment
    | 'internal'         // our own accounts
    | 'ended'            // had access, it's over
    | 'no_plan';         // signed up, never added a card

const INTERNAL_EMAIL_DOMAIN = '@nexusimpacts.com';

/** Live Stripe facts for one subscription (price after discount, coupon). */
interface StripeFacts {
    mrr_cents: number;
    fully_discounted: boolean;
    discount_label: string | null;
    current_period_end: string | null;
}

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
    state: AccountState;
    has_access: boolean;
    /** The date that matters for this state: converts, locks, renews, or ended. */
    key_date: string | null;
    /** Monthly recurring revenue in cents after discounts; null when unknown. */
    mrr_cents: number | null;
    discount_label: string | null;
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

/** Same rule the app-access gate uses for an owner's own subscription. */
function hasAccessNow(sub: Partial<Subscription> | null | undefined): boolean {
    if (!sub) return false;
    return sub.status === 'active' || SubscriptionService.evaluate(sub as Subscription, { activeGraceDays: 7 });
}

/**
 * An admin-granted plan is stored as status 'active' with NO
 * stripe_subscription_id; a card-less 'trial' is a legacy free account on its
 * grace period. Everything with a Stripe id is judged by its status, not just
 * by having one.
 */
export function deriveAccountState(
    sub: Partial<Subscription> | null | undefined,
    ownerEmail: string | undefined | null,
    stripeFacts?: StripeFacts | null
): AccountState {
    if (ownerEmail?.toLowerCase().endsWith(INTERNAL_EMAIL_DOMAIN)) return 'internal';
    if (!sub || !sub.status || sub.status === 'none') return 'no_plan';
    // Stripe is still retrying, so this is a billing problem, not an ending;
    // has_access says whether they're locked meanwhile (never paid → locked).
    if (sub.stripe_subscription_id && sub.status === 'past_due') return 'past_due';
    if (!hasAccessNow(sub)) return 'ended';
    if (sub.stripe_subscription_id) {
        if (sub.status === 'past_due') return 'past_due';
        if (sub.status === 'trial') return sub.cancel_at_period_end ? 'trial_cancelling' : 'trialing';
        if (sub.status === 'active') return stripeFacts?.fully_discounted ? 'discounted' : 'paying';
        return 'ended';
    }
    if (sub.status === 'trial') return 'grace';
    return 'comped';
}

function deriveKeyDate(
    state: AccountState,
    sub: Partial<Subscription> | null | undefined,
    stripeFacts?: StripeFacts | null
): string | null {
    switch (state) {
        case 'trialing':
        case 'trial_cancelling':
        case 'grace':
            return sub?.trial_ends_at ?? null;
        case 'paying':
        case 'discounted':
        case 'past_due':
            return stripeFacts?.current_period_end ?? sub?.current_period_end ?? null;
        case 'ended':
            return sub?.cancelled_at ?? sub?.current_period_end ?? sub?.trial_ends_at ?? null;
        default:
            return null;
    }
}

// ─── Stripe snapshot ─────────────────────────────────────────────────────────

const STRIPE_TTL_MS = 60 * 1000;
let stripeCache: { expires: number; map: Map<string, StripeFacts> } | null = null;

/** Coupon object from a discount, across Stripe API versions (`coupon` → `source.coupon`). */
function couponOf(discount: any): any | null {
    if (!discount || typeof discount !== 'object') return null;
    if (discount.coupon && typeof discount.coupon === 'object') return discount.coupon;
    if (discount.source?.coupon && typeof discount.source.coupon === 'object') return discount.source.coupon;
    return null;
}

function toMonthly(amount: number, interval?: string, count = 1): number {
    switch (interval) {
        case 'year': return amount / (12 * count);
        case 'week': return (amount * 52) / (12 * count);
        case 'day': return (amount * 365) / (12 * count);
        default: return amount / count;
    }
}

function factsFor(s: any): StripeFacts {
    const nowSec = Date.now() / 1000;
    const item = s.items?.data?.[0];
    const price = item?.price;
    const invoiceAmount = (price?.unit_amount ?? 0) * (item?.quantity ?? 1);

    const discount = (s.discounts ?? []).find(
        (d: any) => d && typeof d === 'object' && (!d.end || d.end > nowSec)
    );
    const coupon = couponOf(discount);
    let discounted = invoiceAmount;
    if (coupon?.percent_off != null) discounted = invoiceAmount * (1 - coupon.percent_off / 100);
    else if (coupon?.amount_off != null) discounted = Math.max(0, invoiceAmount - coupon.amount_off);

    let discountLabel: string | null = null;
    if (discount) {
        const amount =
            coupon?.percent_off != null
                ? `${coupon.percent_off}% off`
                : coupon?.amount_off != null
                    ? `${(coupon.amount_off / 100).toFixed(2)} off`
                    : 'Discount';
        const until = discount.end
            ? ` until ${new Date(discount.end * 1000).toISOString().slice(0, 10)}`
            : coupon?.duration === 'forever' ? ' forever' : '';
        discountLabel = amount + until;
    }

    const periodEnd = item?.current_period_end ?? s.current_period_end;
    return {
        mrr_cents: s.status === 'trialing'
            ? 0
            : Math.round(toMonthly(discounted, price?.recurring?.interval, price?.recurring?.interval_count ?? 1)),
        fully_discounted: invoiceAmount > 0 && discounted <= 0,
        discount_label: discountLabel,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    };
}

/**
 * Every live Stripe subscription's price and discount in one paginated call,
 * cached briefly. Best-effort: on failure the console falls back to what the
 * database knows (no MRR, coupons not detected).
 */
async function getStripeFacts(): Promise<Map<string, StripeFacts> | null> {
    if (!stripe) return null;
    if (stripeCache && stripeCache.expires > Date.now()) return stripeCache.map;

    // Deepest expansion first; older API versions reject `source.coupon`.
    const expansions = [['data.discounts.source.coupon'], ['data.discounts'], []];
    for (const expand of expansions) {
        try {
            const map = new Map<string, StripeFacts>();
            for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100, expand }) as any) {
                if (!['active', 'past_due', 'trialing', 'unpaid'].includes(s.status)) continue;
                map.set(s.id, factsFor(s));
            }
            stripeCache = { expires: Date.now() + STRIPE_TTL_MS, map };
            return map;
        } catch (e) {
            console.warn(`[adminAccount] Stripe list failed (expand=${expand.join(',') || 'none'}):`, (e as Error).message);
        }
    }
    return null;
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
        const [subsResult, initiativeRows, memberRows, locationRows, stripeFacts] = await Promise.all([
            ownerIds.length
                ? supabase.from('subscriptions').select('*').in('user_id', ownerIds)
                : Promise.resolve({ data: [] as any[] }),
            supabase.from('initiatives').select('organization_id').in('organization_id', orgIds),
            supabase.from('team_members').select('organization_id').in('organization_id', orgIds),
            supabase.from('locations').select('organization_id').in('organization_id', orgIds),
            getStripeFacts(),
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
            const facts = sub?.stripe_subscription_id ? stripeFacts?.get(sub.stripe_subscription_id) ?? null : null;
            const state = deriveAccountState(sub, owner?.email, facts);
            const billed = state === 'paying' || state === 'discounted' || state === 'past_due';
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
                state,
                has_access: hasAccessNow(sub),
                key_date: deriveKeyDate(state, sub, facts),
                mrr_cents: billed && facts ? facts.mrr_cents : null,
                discount_label: facts?.discount_label ?? null,
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

        const [billing, stripeFacts] = await Promise.all([
            this.getBilling(subscription, opts.includeStripeIds),
            getStripeFacts(),
        ]);
        const facts = subscription?.stripe_subscription_id
            ? stripeFacts?.get(subscription.stripe_subscription_id) ?? null
            : null;
        const state = deriveAccountState(subscription, ownerEntry?.email, facts);
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
                state,
                has_access: hasAccessNow(subscription),
                key_date: deriveKeyDate(state, subscription, facts),
                discount_label: facts?.discount_label ?? null,
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
        const attempts = [
            [...base, 'discounts.promotion_code', 'discounts.source.coupon'],
            [...base, 'discounts.promotion_code'],
        ];
        for (const expand of attempts) {
            try {
                return await stripe!.subscriptions.retrieve(subscriptionId, { expand });
            } catch (e) {
                // Only a rejected expansion is worth retrying.
                if ((e as any)?.code === 'resource_missing') throw e;
                console.warn('[adminAccount] discount expansion failed, retrying:', (e as Error).message);
            }
        }
        return stripe!.subscriptions.retrieve(subscriptionId, { expand: base });
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
                    ? (() => {
                          const coupon = couponOf(discount);
                          return {
                              code: discount.promotion_code?.code ?? null,
                              name: coupon?.name ?? coupon?.id ?? null,
                              percent_off: coupon?.percent_off ?? null,
                              amount_off: coupon?.amount_off ?? null,
                              currency: coupon?.currency ?? null,
                              duration: coupon?.duration ?? null,
                              duration_in_months: coupon?.duration_in_months ?? null,
                              ends_at: discount.end ? new Date(discount.end * 1000).toISOString() : null,
                          };
                      })()
                    : null,
                ...(includeStripeIds
                    ? {
                          stripe_customer_id: subscription.stripe_customer_id ?? null,
                          stripe_subscription_id: subscription.stripe_subscription_id ?? null,
                      }
                    : {}),
            };
        } catch (e) {
            // Usually a test-mode key (local dev) reading live ids from the shared database.
            if ((e as any)?.code === 'resource_missing') {
                return { available: false, reason: 'stripe_not_found' };
            }
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
            // There is no free plan: 'free' from the admin UI removes a comp and
            // locks the account until the owner subscribes.
            tier === 'free'
                ? {
                      status: 'expired',
                      ...planLimitColumns('free'),
                      stripe_subscription_id: null,
                      stripe_price_id: null,
                      cancel_at_period_end: false,
                      trial_ends_at: null,
                  }
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
