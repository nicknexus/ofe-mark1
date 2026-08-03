import { useState } from 'react'
import { Loader2, ArrowRight, AlertTriangle, Lock } from 'lucide-react'
import { AdminApi, AdminAccount, PlanTier, PlanLimits } from '../../services/adminApi'
import { notify } from '../../lib/notify'
import { Modal, Button, formatBytes } from './ui'

/**
 * Plan limits mirrored from the backend catalog so the diff can be shown before
 * committing. The server is still the only writer — it re-derives every value
 * from its own catalog, so a drift here shows a wrong preview but can never
 * write a wrong limit.
 */
const CATALOG: Record<PlanTier, PlanLimits & { name: string }> = {
    free: {
        name: 'Free',
        initiatives_limit: 1,
        team_members_limit: 2,
        locations_limit: 3,
        storage_limit_bytes: 25 * 1024 ** 3,
        ai_reports_per_day: 1,
    },
    growth: {
        name: 'Growth',
        initiatives_limit: 10,
        team_members_limit: 10,
        locations_limit: 15,
        storage_limit_bytes: 300 * 1024 ** 3,
        ai_reports_per_day: null,
    },
    pro: {
        name: 'Pro',
        initiatives_limit: 25,
        team_members_limit: 20,
        locations_limit: 30,
        storage_limit_bytes: 1024 ** 4,
        ai_reports_per_day: null,
    },
}

const ROWS: { key: keyof PlanLimits; label: string; format: (n: number | null) => string }[] = [
    { key: 'initiatives_limit', label: 'Initiatives', format: n => (n === null ? 'Unlimited' : String(n)) },
    { key: 'team_members_limit', label: 'Team members', format: n => (n === null ? 'Unlimited' : String(n)) },
    { key: 'locations_limit', label: 'Locations', format: n => (n === null ? 'Unlimited' : String(n)) },
    { key: 'storage_limit_bytes', label: 'Storage', format: n => (n === null ? 'Unlimited' : formatBytes(n)) },
    { key: 'ai_reports_per_day', label: 'AI reports / day', format: n => (n === null ? 'Unlimited' : String(n)) },
]

export default function ChangePlanModal({
    account,
    onClose,
    onSaved,
}: {
    account: AdminAccount
    onClose: () => void
    onSaved: () => void
}) {
    const currentTier = account.plan.tier
    const [tier, setTier] = useState<PlanTier>(currentTier)
    const [reason, setReason] = useState('')
    const [saving, setSaving] = useState(false)

    const isPaying = account.plan.source === 'stripe' && account.billing?.status === 'active'
    const target = CATALOG[tier]
    const current = account.plan.effective_limits

    // What content would drop out of view if this shrinks their allowances.
    const willHide = [
        {
            label: 'initiatives',
            used: account.usage.initiatives,
            limit: target.initiatives_limit,
        },
        {
            label: 'locations',
            used: account.usage.locations,
            limit: target.locations_limit,
        },
    ].filter(r => r.limit !== null && r.used > (r.limit as number))

    const handleSave = async () => {
        setSaving(true)
        try {
            await AdminApi.changePlan(account.org.id, tier, reason.trim() || undefined)
            notify.success(`${account.org.name} moved to ${target.name}`)
            onSaved()
        } catch (err) {
            // Includes the 409 'paying_customer' refusal — the message explains
            // that this belongs in Stripe, so surface it as-is.
            notify.error((err as Error).message || 'Failed to change plan')
            setSaving(false)
        }
    }

    return (
        <Modal
            wide
            title="Change plan"
            subtitle={`${account.org.name} · currently ${account.plan.name}`}
            onClose={onClose}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        disabled={saving || isPaying || tier === currentTier}
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Applying…
                            </>
                        ) : (
                            `Move to ${target.name}`
                        )}
                    </Button>
                </>
            }
        >
            {isPaying ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 mb-4 flex gap-2.5">
                    <Lock className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-sky-900">
                        <p className="font-medium">This customer is paying through Stripe.</p>
                        <p className="mt-0.5 text-sky-800">
                            Change their plan in Stripe instead — editing it here would leave billing and access out of
                            sync. Cancelled or lapsed subscriptions can be changed from here.
                        </p>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-slate-600 mb-4">
                    Grants the plan immediately without payment. Limits update to the tier's defaults.
                </p>
            )}

            <div className="grid grid-cols-3 gap-2 mb-5">
                {(Object.keys(CATALOG) as PlanTier[]).map(t => (
                    <button
                        key={t}
                        type="button"
                        disabled={isPaying}
                        onClick={() => setTier(t)}
                        className={`rounded-xl border px-3 py-3 text-left transition-all disabled:opacity-50 disabled:pointer-events-none ${
                            tier === t
                                ? 'border-slate-900 ring-1 ring-slate-900 bg-slate-50'
                                : 'border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-900">{CATALOG[t].name}</span>
                            {t === currentTier && (
                                <span className="text-[10px] uppercase tracking-wide text-slate-400">Current</span>
                            )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                            {CATALOG[t].initiatives_limit} initiatives · {formatBytes(CATALOG[t].storage_limit_bytes)}
                        </p>
                    </button>
                ))}
            </div>

            {/* The diff — what actually changes for this customer. */}
            <div className="rounded-xl border border-slate-200 overflow-hidden mb-4">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium">Limit</th>
                            <th className="px-3 py-2 text-right font-medium">Now</th>
                            <th className="px-3 py-2 text-right font-medium">After</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ROWS.map(row => {
                            const before = current[row.key]
                            const after = target[row.key]
                            const changed = before !== after
                            return (
                                <tr key={row.key} className="border-t border-slate-100">
                                    <td className="px-3 py-2 text-slate-600">{row.label}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                                        {row.format(before)}
                                    </td>
                                    <td
                                        className={`px-3 py-2 text-right tabular-nums font-medium ${
                                            changed ? 'text-slate-900' : 'text-slate-400'
                                        }`}
                                    >
                                        {changed && <ArrowRight className="inline w-3 h-3 mr-1 text-slate-300" />}
                                        {row.format(after)}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {willHide.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4 flex gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-900">
                        <p className="font-medium">Some content will be hidden.</p>
                        <ul className="mt-1 space-y-0.5 text-amber-800">
                            {willHide.map(r => (
                                <li key={r.label}>
                                    {r.used} {r.label}, new limit {r.limit} — {r.used - (r.limit as number)} will be
                                    hidden from their public page.
                                </li>
                            ))}
                        </ul>
                        <p className="mt-1 text-xs text-amber-700">
                            Nothing is deleted. It reappears if they move back up.
                        </p>
                    </div>
                </div>
            )}

            <label className="block">
                <span className="text-xs font-medium text-slate-600">Reason (recorded in the audit log)</span>
                <input
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="e.g. onboarding support for pilot partner"
                    disabled={isPaying}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none disabled:bg-slate-50"
                />
            </label>
        </Modal>
    )
}
