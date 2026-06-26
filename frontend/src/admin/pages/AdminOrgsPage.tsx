import { useEffect, useState } from 'react'
import { Search, Loader2, Building2, SlidersHorizontal, X, LogIn } from 'lucide-react'
import { AdminApi, AdminOrg, PatchOrgLimitsInput } from '../../services/adminApi'
import { notify } from '../../lib/notify'
import { enterSupportMode } from '../support'

function planLabel(org: AdminOrg): string {
    const s = org.subscription
    if (!s || !s.status || s.status === 'none') return 'No plan'
    if (s.status === 'trial') return 'Trial'
    return s.plan_tier ? `${s.plan_tier}` : s.status
}

function usageCell(used: number, limit?: number | null): string {
    if (limit === null || limit === undefined) return `${used} / ∞`
    return `${used} / ${limit}`
}

/** ISO timestamp → YYYY-MM-DD for a date input. */
function toDateInput(iso?: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
}

function LimitsModal({
    org,
    onClose,
    onSaved,
}: {
    org: AdminOrg
    onClose: () => void
    onSaved: () => void
}) {
    const [teamLimit, setTeamLimit] = useState<string>(
        org.subscription?.team_members_limit != null ? String(org.subscription.team_members_limit) : ''
    )
    const [initiativesLimit, setInitiativesLimit] = useState<string>(
        org.subscription?.initiatives_limit != null ? String(org.subscription.initiatives_limit) : ''
    )
    const [trialEnds, setTrialEnds] = useState<string>(toDateInput(org.subscription?.trial_ends_at))
    const [saving, setSaving] = useState(false)

    const parseLimit = (v: string): number | null => {
        const t = v.trim()
        if (t === '') return null // blank = unlimited
        const n = Number(t)
        return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
    }

    const handleSave = async () => {
        const updates: PatchOrgLimitsInput = {
            team_members_limit: parseLimit(teamLimit),
            initiatives_limit: parseLimit(initiativesLimit),
        }
        // Only touch trial date if a value is present (avoids clearing it accidentally).
        if (trialEnds.trim()) {
            updates.trial_ends_at = new Date(`${trialEnds}T23:59:59Z`).toISOString()
        }

        setSaving(true)
        try {
            await AdminApi.patchOrgLimits(org.id, updates)
            notify.success(`Limits updated for ${org.name}`)
            onSaved()
        } catch (err) {
            notify.error((err as Error).message || 'Failed to update limits')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Edit limits</h2>
                        <p className="text-xs text-slate-500">{org.name}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Team member limit</label>
                        <input
                            type="number"
                            min={0}
                            value={teamLimit}
                            onChange={e => setTeamLimit(e.target.value)}
                            placeholder="Blank = unlimited"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                        />
                        <p className="text-xs text-slate-400 mt-1">Currently using {org.usage.team_members}. Leave blank for unlimited.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Initiative limit</label>
                        <input
                            type="number"
                            min={0}
                            value={initiativesLimit}
                            onChange={e => setInitiativesLimit(e.target.value)}
                            placeholder="Blank = unlimited"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                        />
                        <p className="text-xs text-slate-400 mt-1">Currently using {org.usage.initiatives}. Leave blank for unlimited.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Trial end date</label>
                        <input
                            type="date"
                            value={trialEnds}
                            onChange={e => setTrialEnds(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                        />
                        <p className="text-xs text-slate-400 mt-1">Extend or set a trial. Leave unchanged to keep the current date.</p>
                    </div>

                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-500">
                        Quota changes only — never touches payment or billing.
                    </div>
                </div>

                <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save limits'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function AdminOrgsPage() {
    const [orgs, setOrgs] = useState<AdminOrg[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [editing, setEditing] = useState<AdminOrg | null>(null)

    const load = async (q?: string) => {
        setLoading(true)
        setError(null)
        try {
            setOrgs(await AdminApi.listOrgs(q))
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    const onSearch = (e: React.FormEvent) => {
        e.preventDefault()
        load(search.trim() || undefined)
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-1">
                <Building2 className="w-6 h-6 text-slate-700" />
                <h1 className="text-2xl font-semibold text-slate-900">Organizations</h1>
            </div>
            <p className="text-sm text-slate-500 mb-6">Every customer organization on the platform.</p>

            <form onSubmit={onSearch} className="mb-5 flex gap-2 max-w-md">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name or slug…"
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                    />
                </div>
                <button type="submit" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700">
                    Search
                </button>
            </form>

            {loading ? (
                <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading organizations…
                </div>
            ) : error ? (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
            ) : orgs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No organizations found.</div>
            ) : (
                <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-slate-500 border-b border-slate-200">
                                <th className="px-4 py-3 font-medium">Organization</th>
                                <th className="px-4 py-3 font-medium">Owner</th>
                                <th className="px-4 py-3 font-medium">Plan</th>
                                <th className="px-4 py-3 font-medium">Team</th>
                                <th className="px-4 py-3 font-medium">Initiatives</th>
                                <th className="px-4 py-3 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orgs.map(org => (
                                <tr key={org.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-900">{org.name}</div>
                                        <div className="text-xs text-slate-400">{org.slug}</div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">{org.owner.email || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs capitalize">
                                            {planLabel(org)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        {usageCell(org.usage.team_members, org.subscription?.team_members_limit)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        {usageCell(org.usage.initiatives, org.subscription?.initiatives_limit)}
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                        <button
                                            onClick={() => setEditing(org)}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-100"
                                        >
                                            <SlidersHorizontal className="w-3.5 h-3.5" /> Edit limits
                                        </button>
                                        <button
                                            onClick={async () => {
                                                try { await AdminApi.logSupportSession(org.id) } catch { /* non-blocking */ }
                                                enterSupportMode({ id: org.id, name: org.name })
                                            }}
                                            className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-700"
                                            title="Open this org in support mode"
                                        >
                                            <LogIn className="w-3.5 h-3.5" /> Open
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {editing && (
                <LimitsModal
                    org={editing}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null)
                        load(search.trim() || undefined)
                    }}
                />
            )}
        </div>
    )
}
