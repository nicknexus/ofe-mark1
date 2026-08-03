import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
    ArrowLeft,
    Loader2,
    LogIn,
    SlidersHorizontal,
    CreditCard,
    BadgePercent,
    ExternalLink,
    RotateCcw,
    ShieldAlert,
} from 'lucide-react'
import { AdminApi, AdminAccount } from '../../services/adminApi'
import { notify } from '../../lib/notify'
import { enterSupportMode } from '../support'
import ChangePlanModal from '../components/ChangePlanModal'
import LimitsModal from '../components/LimitsModal'
import {
    PlanBadge,
    OrgAvatar,
    Section,
    Field,
    UsageMeter,
    Button,
    EmptyState,
    FeatureFlag,
    formatBytes,
    formatDate,
    formatRelative,
    formatMoney,
} from '../components/ui'

/** Human summary of a Stripe discount: "SAVE20 · 20% off, forever". */
function describeDiscount(d: NonNullable<NonNullable<AdminAccount['billing']>['discount']>): string {
    const amount =
        d.percent_off != null
            ? `${d.percent_off}% off`
            : d.amount_off != null
                ? `${formatMoney(d.amount_off, d.currency)} off`
                : 'discount'
    const duration =
        d.duration === 'forever'
            ? 'forever'
            : d.duration === 'once'
                ? 'once'
                : d.duration_in_months
                    ? `for ${d.duration_in_months} months`
                    : ''
    return [amount, duration].filter(Boolean).join(', ')
}

export default function AdminOrgAccountPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [account, setAccount] = useState<AdminAccount | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showPlan, setShowPlan] = useState(false)
    const [showLimits, setShowLimits] = useState(false)
    const [resetting, setResetting] = useState(false)

    const load = useCallback(async () => {
        if (!id) return
        try {
            setAccount(await AdminApi.getOrgAccount(id))
            setError(null)
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setLoading(false)
        }
    }, [id])

    useEffect(() => {
        load()
    }, [load])

    const handleOpenSupport = async () => {
        if (!account) return
        try {
            await AdminApi.logSupportSession(account.org.id)
        } catch {
            /* non-blocking */
        }
        enterSupportMode({ id: account.org.id, name: account.org.name })
    }

    const handleResetLimits = async () => {
        if (!account) return
        setResetting(true)
        try {
            await AdminApi.resetLimits(account.org.id)
            notify.success('Limits reset to plan defaults')
            await load()
        } catch (err) {
            notify.error((err as Error).message || 'Failed to reset limits')
        } finally {
            setResetting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading account…
            </div>
        )
    }

    if (error || !account) {
        return (
            <div className="p-8 max-w-3xl mx-auto">
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/orgs')} className="mb-4">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                </Button>
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error || 'Account not found.'}
                </div>
            </div>
        )
    }

    const { org, owner, plan, billing, usage, team, activity, access_code } = account
    const overridden = plan.overridden_fields.length > 0

    return (
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
            <Link
                to="/admin/orgs"
                className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-4"
            >
                <ArrowLeft className="w-4 h-4" /> Organizations
            </Link>

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div className="flex items-start gap-3 min-w-0">
                    <OrgAvatar name={org.name} logoUrl={org.logo_url} brandColor={org.brand_color} size="md" />
                    <div className="min-w-0">
                        <h1 className="text-xl font-semibold text-slate-900 truncate">{org.name}</h1>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <PlanBadge tier={plan.tier} source={plan.source} status={plan.status} size="sm" />
                            <span className="text-xs text-slate-400">
                                /{org.slug} · {org.is_public ? 'Public' : 'Private'} · Joined {formatDate(org.created_at)}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={() => setShowLimits(true)}>
                        <SlidersHorizontal className="w-3.5 h-3.5" /> Edit limits
                    </Button>
                    <Button onClick={() => setShowPlan(true)}>Change plan</Button>
                    <Button variant="primary" onClick={handleOpenSupport}>
                        <LogIn className="w-3.5 h-3.5" /> Open in support mode
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main column */}
                <div className="lg:col-span-2 space-y-4">
                    <Section
                        title="Plan & limits"
                        description={
                            overridden
                                ? 'Some limits have been set manually and differ from this tier.'
                                : `Standard ${plan.name} allowances.`
                        }
                        actions={
                            overridden ? (
                                <Button size="sm" onClick={handleResetLimits} disabled={resetting}>
                                    {resetting ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    )}
                                    Reset to defaults
                                </Button>
                            ) : undefined
                        }
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                            <UsageMeter label="Initiatives" used={usage.initiatives} limit={plan.effective_limits.initiatives_limit} />
                            <UsageMeter label="Team members" used={usage.team_members} limit={plan.effective_limits.team_members_limit} />
                            <UsageMeter label="Locations" used={usage.locations} limit={plan.effective_limits.locations_limit} />
                            <UsageMeter
                                label="Storage"
                                used={usage.storage_used_bytes}
                                limit={plan.effective_limits.storage_limit_bytes}
                                format={formatBytes}
                            />
                            <UsageMeter
                                label="AI reports today"
                                used={usage.ai_reports_today}
                                limit={plan.effective_limits.ai_reports_per_day}
                            />
                        </div>

                        {overridden && (
                            <p className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                                Custom: {plan.overridden_fields.map(f => f.replace(/_/g, ' ')).join(', ')}
                            </p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-slate-100">
                            <FeatureFlag enabled={plan.features.tags} label="Metric tags" />
                            <FeatureFlag enabled={plan.features.beneficiaryGroups} label="Beneficiary groups" />
                        </div>
                    </Section>

                    <Section
                        title="Billing"
                        description={
                            plan.source === 'admin'
                                ? 'Granted by an admin — no payment attached.'
                                : plan.source === 'code'
                                    ? 'Comped via access code.'
                                    : undefined
                        }
                    >
                        {plan.source === 'admin' ? (
                            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-amber-900">
                                    <p className="font-medium">Comped {plan.name}</p>
                                    <p className="text-xs text-amber-800 mt-0.5">
                                        No Stripe subscription. Access continues until an admin changes it.
                                    </p>
                                </div>
                            </div>
                        ) : !billing ? (
                            <EmptyState>No billing record — this customer has never started a subscription.</EmptyState>
                        ) : !billing.available ? (
                            <EmptyState>
                                {billing.reason === 'stripe_not_configured'
                                    ? 'Stripe is not configured on this environment.'
                                    : `Could not reach Stripe${billing.message ? `: ${billing.message}` : ''}.`}
                            </EmptyState>
                        ) : (
                            <dl>
                                <Field label="Stripe status">
                                    <span className="capitalize">{billing.status || '—'}</span>
                                    {billing.cancel_at_period_end && (
                                        <span className="ml-2 text-xs text-amber-600">cancels at period end</span>
                                    )}
                                </Field>
                                <Field label="Price">
                                    {billing.price
                                        ? `${formatMoney(billing.price.amount, billing.price.currency)}${
                                              billing.price.interval ? ` / ${billing.price.interval}` : ''
                                          }`
                                        : '—'}
                                </Field>
                                <Field label="Renews">
                                    {billing.current_period_end
                                        ? `${formatDate(billing.current_period_end)} (${formatRelative(billing.current_period_end)})`
                                        : '—'}
                                </Field>
                                <Field label="Card">
                                    {billing.card ? (
                                        <span className="inline-flex items-center gap-1.5">
                                            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="capitalize">{billing.card.brand}</span> ····{billing.card.last4}
                                            <span className="text-slate-400 text-xs">
                                                {billing.card.exp_month}/{String(billing.card.exp_year).slice(-2)}
                                            </span>
                                        </span>
                                    ) : (
                                        '—'
                                    )}
                                </Field>
                                <Field label="Discount">
                                    {billing.discount ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                            <BadgePercent className="w-3.5 h-3.5" />
                                            {billing.discount.code && (
                                                <span className="font-mono text-xs font-semibold">{billing.discount.code}</span>
                                            )}
                                            <span className="text-xs">{describeDiscount(billing.discount)}</span>
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">None</span>
                                    )}
                                </Field>
                                {billing.stripe_customer_id && (
                                    <Field label="Stripe customer">
                                        <a
                                            href={`https://dashboard.stripe.com/customers/${billing.stripe_customer_id}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 font-mono text-xs text-sky-700 hover:underline"
                                        >
                                            {billing.stripe_customer_id}
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </Field>
                                )}
                            </dl>
                        )}

                        {access_code && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                Access code{' '}
                                <span className="font-mono font-semibold text-slate-900">{access_code.code}</span>{' '}
                                redeemed {formatRelative(access_code.redeemed_at)}
                                {access_code.days_granted ? ` · ${access_code.days_granted} days granted` : ''}
                            </div>
                        )}
                    </Section>

                    <Section title="Team" description={`${team.length} member${team.length === 1 ? '' : 's'}${usage.pending_invites ? ` · ${usage.pending_invites} pending invite${usage.pending_invites === 1 ? '' : 's'}` : ''}`}>
                        {team.length === 0 ? (
                            <EmptyState>No team members yet.</EmptyState>
                        ) : (
                            <div className="-mx-5 -my-4 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <tbody>
                                        {team.map(m => (
                                            <tr key={m.id} className="border-b border-slate-50 last:border-0">
                                                <td className="px-5 py-2.5">
                                                    <div className="text-slate-900">{m.email || '—'}</div>
                                                    {m.name && <div className="text-xs text-slate-400">{m.name}</div>}
                                                </td>
                                                <td className="px-5 py-2.5 text-right">
                                                    <span className="text-xs capitalize text-slate-500">
                                                        {m.member_type || 'member'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-2.5 text-right text-xs text-slate-400 whitespace-nowrap">
                                                    {m.joined_at ? formatDate(m.joined_at) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Section>

                    <Section title="Admin activity" description="Support actions taken on this organization.">
                        {activity.length === 0 ? (
                            <EmptyState>Nothing recorded yet.</EmptyState>
                        ) : (
                            <ul className="space-y-2.5">
                                {activity.map(a => (
                                    <li key={a.id} className="flex items-baseline justify-between gap-4 text-sm">
                                        <div className="min-w-0">
                                            <span className="font-mono text-xs text-slate-700">{a.action}</span>
                                            {a.admin_email && (
                                                <span className="ml-2 text-xs text-slate-400 truncate">{a.admin_email}</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                                            {formatRelative(a.created_at)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Section>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    <Section title="Account owner">
                        <dl>
                            <Field label="Name">{owner.name || '—'}</Field>
                            <Field label="Email">
                                {owner.email ? (
                                    <a href={`mailto:${owner.email}`} className="text-sky-700 hover:underline">
                                        {owner.email}
                                    </a>
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Verified">
                                {owner.email_confirmed ? (
                                    <span className="text-emerald-600">Yes</span>
                                ) : (
                                    <span className="text-amber-600">Not confirmed</span>
                                )}
                            </Field>
                            <Field label="Signed up">{formatDate(owner.created_at)}</Field>
                            <Field label="Last seen">{formatRelative(owner.last_sign_in_at)}</Field>
                        </dl>
                    </Section>

                    <Section title="Organization">
                        <dl>
                            <Field label="Visibility">
                                {org.is_public ? (
                                    <span className="text-emerald-600">Public</span>
                                ) : (
                                    <span className="text-slate-500">Private</span>
                                )}
                            </Field>
                            <Field label="Public page">
                                {org.is_public ? (
                                    <a
                                        href={`/org/${org.slug}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-sky-700 hover:underline"
                                    >
                                        /org/{org.slug} <ExternalLink className="w-3 h-3" />
                                    </a>
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Website">
                                {org.website_url ? (
                                    <a
                                        href={org.website_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-sky-700 hover:underline truncate"
                                    >
                                        Visit <ExternalLink className="w-3 h-3" />
                                    </a>
                                ) : (
                                    '—'
                                )}
                            </Field>
                            <Field label="Storage used">{formatBytes(usage.storage_used_bytes)}</Field>
                        </dl>
                    </Section>
                </div>
            </div>

            {showPlan && (
                <ChangePlanModal
                    account={account}
                    onClose={() => setShowPlan(false)}
                    onSaved={() => {
                        setShowPlan(false)
                        load()
                    }}
                />
            )}
            {showLimits && (
                <LimitsModal
                    account={account}
                    onClose={() => setShowLimits(false)}
                    onSaved={() => {
                        setShowLimits(false)
                        load()
                    }}
                />
            )}
        </div>
    )
}
