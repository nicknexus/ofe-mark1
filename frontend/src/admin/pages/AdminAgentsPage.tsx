import { useEffect, useMemo, useState } from 'react'
import { Users, Loader2, UserPlus, Trash2, X, Search, Check, Building2 } from 'lucide-react'
import { AdminApi, SupportAgent, AdminOrg } from '../../services/adminApi'
import { notify } from '../../lib/notify'

function CreateAgentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [email, setEmail] = useState('')
    const [mode, setMode] = useState<'create' | 'promote'>('create')
    const [saving, setSaving] = useState(false)

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const res = await AdminApi.createAgent(email.trim(), mode)
            if (res.setupLink && !res.emailSent) {
                try { await navigator.clipboard.writeText(res.setupLink) } catch { /* ignore */ }
                notify.success('Agent added — set-password link copied (email unavailable)')
            } else {
                notify.success(mode === 'promote' ? 'Existing user promoted to support agent' : 'Agent created — set-password email sent')
            }
            onCreated()
        } catch (err) {
            notify.error((err as Error).message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h2 className="text-base font-semibold text-slate-900">Add support agent</h2>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={submit} className="p-5 space-y-4">
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setMode('create')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${mode === 'create' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-600'}`}>New account</button>
                        <button type="button" onClick={() => setMode('promote')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border ${mode === 'promote' ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-600'}`}>Existing user</button>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none" placeholder="agent@company.com" />
                        <p className="text-xs text-slate-400 mt-1">
                            {mode === 'create' ? 'Creates an account and emails them a set-password link.' : 'Promotes an existing Nexus account to a support agent.'}
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
                        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : 'Add agent'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function AssignOrgsModal({ agent, orgs, onClose, onSaved }: { agent: SupportAgent; orgs: AdminOrg[]; onClose: () => void; onSaved: () => void }) {
    const original = useMemo(() => new Set(agent.orgs.map(o => o.id)), [agent])
    const [selected, setSelected] = useState<Set<string>>(() => new Set(agent.orgs.map(o => o.id)))
    const [search, setSearch] = useState('')
    const [saving, setSaving] = useState(false)

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return orgs
        return orgs.filter(o => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q))
    }, [orgs, search])

    const toggle = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const changedCount =
        [...selected].filter(id => !original.has(id)).length +
        [...original].filter(id => !selected.has(id)).length

    const save = async () => {
        setSaving(true)
        try {
            const toAdd = [...selected].filter(id => !original.has(id))
            const toRemove = [...original].filter(id => !selected.has(id))
            await Promise.all([
                ...toAdd.map(id => AdminApi.assignOrg(agent.user_id, id)),
                ...toRemove.map(id => AdminApi.unassignOrg(agent.user_id, id)),
            ])
            notify.success('Organizations updated')
            onSaved()
        } catch (err) {
            notify.error((err as Error).message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
                    <div>
                        <h2 className="text-base font-semibold text-slate-900">Assign organizations</h2>
                        <p className="text-xs text-slate-500">{agent.name || agent.email}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>

                <div className="px-5 pt-4 flex-shrink-0">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search organizations…"
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none"
                        />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">{selected.size} selected</p>
                </div>

                <div className="px-5 py-3 overflow-y-auto flex-1">
                    {filtered.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">No organizations match.</p>
                    ) : (
                        <ul className="space-y-1">
                            {filtered.map(org => {
                                const checked = selected.has(org.id)
                                return (
                                    <li key={org.id}>
                                        <button
                                            type="button"
                                            onClick={() => toggle(org.id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${checked ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}
                                        >
                                            <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                                {checked && <Check className="w-3.5 h-3.5 text-white" />}
                                            </span>
                                            <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                            <span className="min-w-0">
                                                <span className="block text-sm font-medium text-slate-900 truncate">{org.name}</span>
                                                <span className="block text-xs text-slate-400 truncate">{org.owner.email || org.slug}</span>
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                <div className="flex justify-between items-center gap-2 px-5 py-4 border-t border-slate-100 flex-shrink-0">
                    <span className="text-xs text-slate-500">{changedCount > 0 ? `${changedCount} change${changedCount === 1 ? '' : 's'} pending` : 'No changes'}</span>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
                        <button onClick={save} disabled={saving || changedCount === 0} className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function AdminAgentsPage() {
    const [agents, setAgents] = useState<SupportAgent[]>([])
    const [orgs, setOrgs] = useState<AdminOrg[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [assigning, setAssigning] = useState<SupportAgent | null>(null)
    const [busy, setBusy] = useState<string | null>(null)

    const load = async () => {
        setLoading(true)
        try {
            const [a, o] = await Promise.all([AdminApi.listAgents(), AdminApi.listOrgs()])
            setAgents(a)
            setOrgs(o)
        } catch (e) {
            notify.error((e as Error).message)
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => { load() }, [])

    const revoke = async (agent: SupportAgent) => {
        if (!confirm(`Revoke support access for ${agent.email}? Their account stays, but they lose all org access.`)) return
        setBusy(agent.user_id)
        try {
            await AdminApi.revokeAgent(agent.user_id)
            await load()
        } catch (e) { notify.error((e as Error).message) } finally { setBusy(null) }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                    <Users className="w-6 h-6 text-slate-700" />
                    <h1 className="text-2xl font-semibold text-slate-900">Support Agents</h1>
                </div>
                <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700">
                    <UserPlus className="w-4 h-4" /> Add agent
                </button>
            </div>
            <p className="text-sm text-slate-500 mb-6">Sub-accounts that can support only the organizations you assign them.</p>

            {loading ? (
                <div className="flex items-center gap-2 text-slate-500 py-12 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
            ) : agents.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">No support agents yet.</div>
            ) : (
                <div className="space-y-4">
                    {agents.map(agent => (
                        <div key={agent.user_id} className="bg-white rounded-xl border border-slate-200 p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="font-medium text-slate-900">{agent.name || agent.email}</p>
                                    {agent.name && <p className="text-xs text-slate-400">{agent.email}</p>}
                                    <p className="text-xs text-slate-400 mt-0.5">{agent.last_sign_in_at ? 'Active' : 'Hasn’t signed in yet'}</p>
                                </div>
                                <button onClick={() => revoke(agent)} disabled={busy === agent.user_id} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Revoke agent">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-4">
                                <div className="flex flex-wrap gap-2 items-center min-w-0">
                                    {agent.orgs.length === 0
                                        ? <span className="text-xs text-slate-400">No organizations assigned</span>
                                        : agent.orgs.map(o => (
                                            <span key={o.id} className="inline-block px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs">{o.name}</span>
                                        ))}
                                </div>
                                <button
                                    onClick={() => setAssigning(agent)}
                                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-100"
                                >
                                    <Building2 className="w-3.5 h-3.5" /> Manage organizations
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreate && <CreateAgentModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
            {assigning && (
                <AssignOrgsModal
                    agent={assigning}
                    orgs={orgs}
                    onClose={() => setAssigning(null)}
                    onSaved={() => { setAssigning(null); load() }}
                />
            )}
        </div>
    )
}
