import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AdminApi, AdminAccount, PatchOrgLimitsInput } from '../../services/adminApi'
import { notify } from '../../lib/notify'
import { Modal, Button } from './ui'

/** ISO timestamp → YYYY-MM-DD for a date input. */
function toDateInput(iso?: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

/**
 * Per-account limit overrides, on top of whatever the plan grants.
 *
 * Deliberately separate from "change plan": this is the escape hatch for a
 * one-off ("give this partner 3 extra programs"), while a plan change moves
 * every limit at once. Blank means unlimited, which is why each field shows the
 * current usage — an unlimited team on a Free plan is easy to set by accident.
 */
export default function LimitsModal({
    account,
    onClose,
    onSaved,
}: {
    account: AdminAccount
    onClose: () => void
    onSaved: () => void
}) {
    const limits = account.plan.effective_limits
    const [team, setTeam] = useState(limits.team_members_limit != null ? String(limits.team_members_limit) : '')
    const [initiatives, setInitiatives] = useState(
        limits.initiatives_limit != null ? String(limits.initiatives_limit) : ''
    )
    const [locations, setLocations] = useState(limits.locations_limit != null ? String(limits.locations_limit) : '')
    const [trialEnds, setTrialEnds] = useState(toDateInput(account.plan.trial_ends_at))
    const [saving, setSaving] = useState(false)

    const parse = (v: string): number | null => {
        const t = v.trim()
        if (t === '') return null // blank = unlimited
        const n = Number(t)
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
    }

    const handleSave = async () => {
        const updates: PatchOrgLimitsInput = {
            team_members_limit: parse(team),
            initiatives_limit: parse(initiatives),
            locations_limit: parse(locations),
        }
        // Only touch the trial date when one is set, so saving limits can't
        // silently clear an existing trial.
        if (trialEnds.trim()) {
            updates.trial_ends_at = new Date(`${trialEnds}T23:59:59Z`).toISOString()
        }

        setSaving(true)
        try {
            await AdminApi.patchOrgLimits(account.org.id, updates)
            notify.success(`Limits updated for ${account.org.name}`)
            onSaved()
        } catch (err) {
            notify.error((err as Error).message || 'Failed to update limits')
        } finally {
            setSaving(false)
        }
    }

    const field = (
        label: string,
        value: string,
        setValue: (v: string) => void,
        used: number,
        planDefault: number | null
    ) => (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <input
                type="number"
                min={0}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="Blank = unlimited"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">
                Using {used} · {account.plan.name} default {planDefault === null ? 'unlimited' : planDefault}
            </p>
        </div>
    )

    return (
        <Modal
            title="Edit limits"
            subtitle={`${account.org.name} · ${account.plan.name} plan`}
            onClose={onClose}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                            </>
                        ) : (
                            'Save limits'
                        )}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                {field('Programs', initiatives, setInitiatives, account.usage.initiatives, account.plan.catalog_limits.initiatives_limit)}
                {field('Team members', team, setTeam, account.usage.team_members, account.plan.catalog_limits.team_members_limit)}
                {field('Locations', locations, setLocations, account.usage.locations, account.plan.catalog_limits.locations_limit)}

                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Trial end date</label>
                    <input
                        type="date"
                        value={trialEnds}
                        onChange={e => setTrialEnds(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    />
                    <p className="mt-1 text-xs text-slate-400">Leave unchanged to keep the current date.</p>
                </div>

                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Quotas only — never touches payment or billing. To move every limit at once, change their plan
                    instead.
                </p>
            </div>
        </Modal>
    )
}
