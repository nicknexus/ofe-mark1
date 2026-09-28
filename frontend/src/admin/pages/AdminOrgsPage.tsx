import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, X, ArrowUpDown, RefreshCw } from 'lucide-react'
import { AdminApi, AdminOrg } from '../../services/adminApi'
import {
    PlanBadge,
    StatCard,
    UsageMeter,
    Button,
    OrgAvatar,
    formatBytes,
    formatDate,
    formatMoney,
    formatRelative,
    describeState,
} from '../components/ui'
import type { AccountState } from '../../services/adminApi'

type SortKey = 'created_at' | 'name' | 'plan' | 'initiatives' | 'storage' | 'last_seen'
type Filter = 'all' | 'paying' | 'trialing' | 'grace' | 'comped' | 'locked' | 'attention'

const FILTER_STATES: Record<Exclude<Filter, 'all' | 'attention'>, AccountState[]> = {
    paying: ['paying', 'discounted', 'past_due'],
    trialing: ['trialing', 'trial_cancelling'],
    grace: ['grace'],
    comped: ['comped', 'internal'],
    locked: ['ended', 'no_plan'],
}

/** Accounts needing a human look: a failed payment, or pressed against a limit while active. */
function needsAttention(org: AdminOrg): boolean {
    if (org.state === 'past_due') return true
    if (!org.has_access) return false
    const atLimit = (used: number, limit?: number | null) =>
        limit !== null && limit !== undefined && limit > 0 && used >= limit
    return (
        atLimit(org.usage.initiatives, org.subscription?.initiatives_limit) ||
        atLimit(org.usage.team_members, org.subscription?.team_members_limit) ||
        atLimit(org.usage.locations, org.subscription?.locations_limit)
    )
}

/** Past due but never paid: locked, so it belongs with Locked, not Paying. */
const lockedPastDue = (org: AdminOrg) => org.state === 'past_due' && !org.has_access

function matchesFilter(org: AdminOrg, filter: Filter): boolean {
    if (filter === 'all') return true
    if (filter === 'attention') return needsAttention(org)
    if (filter === 'paying' && lockedPastDue(org)) return false
    if (filter === 'locked' && lockedPastDue(org)) return true
    return FILTER_STATES[filter].includes(org.state)
}

const STATE_RANK: Record<AccountState, number> = {
    paying: 9, past_due: 8, discounted: 7, trialing: 6, trial_cancelling: 5,
    comped: 4, internal: 4, grace: 3, ended: 1, no_plan: 0,
}

const TIER_RANK: Record<string, number> = { pro: 3, growth: 2, free: 1 }

export default function AdminOrgsPage() {
    const navigate = useNavigate()
    const [orgs, setOrgs] = useState<AdminOrg[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<Filter>('all')
    const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
        key: 'created_at',
        dir: 'desc',
    })

    const load = async (q?: string, isRefresh = false) => {
        isRefresh ? setRefreshing(true) : setLoading(true)
        setError(null)
        try {
            setOrgs(await AdminApi.listOrgs(q))
        } catch (err) {
            setError((err as Error).message)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        load()
    }, [])

    // Server-side search covers name, slug and owner email — debounced so
    // typing an email doesn't fire a request per keystroke. Skips the first run
    // so landing on the page doesn't immediately repeat the initial load.
    const firstSearchRun = useRef(true)
    useEffect(() => {
        if (firstSearchRun.current) {
            firstSearchRun.current = false
            return
        }
        const t = setTimeout(() => load(search.trim() || undefined, true), 300)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search])

    const stats = useMemo(() => {
        const inState = (states: AccountState[]) => orgs.filter(o => states.includes(o.state))
        const paying = orgs.filter(o => matchesFilter(o, 'paying'))
        const mrrKnown = paying.some(o => o.mrr_cents !== null)
        const mrr = paying.reduce((sum, o) => sum + (o.mrr_cents ?? 0), 0)
        const coupons = paying.filter(o => o.state === 'discounted').length
        const grace = inState(['grace'])
        const graceEnds = grace
            .map(o => o.key_date)
            .filter((d): d is string => !!d)
            .sort()[0]
        return {
            total: orgs.length,
            withAccess: orgs.filter(o => o.has_access).length,
            paying: paying.length,
            payingHint: [mrrKnown ? `${formatMoney(mrr, 'usd')} MRR` : 'Charging a card', coupons ? `${coupons} on coupon` : null]
                .filter(Boolean)
                .join(' · '),
            trialing: inState(FILTER_STATES.trialing).length,
            trialCancelled: inState(['trial_cancelling']).length,
            grace: grace.length,
            graceHint: graceEnds ? `No card · locks ${formatDate(graceEnds)}` : 'No card on file',
            comped: inState(['comped']).length,
            internal: inState(['internal']).length,
            locked: orgs.filter(o => matchesFilter(o, 'locked')).length,
            attention: orgs.filter(needsAttention).length,
        }
    }, [orgs])

    const visible = useMemo(() => {
        const rows = orgs.filter(o => matchesFilter(o, filter))
        const dir = sort.dir === 'asc' ? 1 : -1
        return [...rows].sort((a, b) => {
            switch (sort.key) {
                case 'name':
                    return a.name.localeCompare(b.name) * dir
                case 'plan':
                    return (
                        (STATE_RANK[a.state] - STATE_RANK[b.state]) * 10 +
                        ((TIER_RANK[a.subscription?.plan_tier || 'free'] || 0) -
                            (TIER_RANK[b.subscription?.plan_tier || 'free'] || 0))
                    ) * dir
                case 'initiatives':
                    return (a.usage.initiatives - b.usage.initiatives) * dir
                case 'storage':
                    return (a.usage.storage_used_bytes - b.usage.storage_used_bytes) * dir
                case 'last_seen':
                    return (
                        (new Date(a.owner.last_sign_in_at || 0).getTime() -
                            new Date(b.owner.last_sign_in_at || 0).getTime()) * dir
                    )
                default:
                    return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
            }
        })
    }, [orgs, filter, sort])

    const toggleSort = (key: SortKey) =>
        setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))

    const SortHeader = ({ label, sortKey, align = 'left' }: { label: string; sortKey: SortKey; align?: 'left' | 'right' }) => (
        <th className={`px-4 py-2.5 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
            <button
                onClick={() => toggleSort(sortKey)}
                className={`inline-flex items-center gap-1 hover:text-slate-900 transition-colors ${
                    sort.key === sortKey ? 'text-slate-900' : ''
                }`}
            >
                {label}
                <ArrowUpDown className={`w-3 h-3 ${sort.key === sortKey ? 'opacity-100' : 'opacity-30'}`} />
            </button>
        </th>
    )

    return (
        <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
            <div className="flex items-end justify-between gap-4 mb-5">
                <div>
                    <h1 className="text-xl font-semibold text-slate-900">Organizations</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Every customer account. Click a row to open its full record.
                    </p>
                </div>
                <Button onClick={() => load(search.trim() || undefined, true)} disabled={refreshing}>
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Stat tiles double as filters — the fastest path to "who needs me". */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
                <StatCard label="Organizations" value={stats.total} hint={`${stats.withAccess} with access`} onClick={() => setFilter('all')} active={filter === 'all'} />
                <StatCard label="Paying" value={stats.paying} tone="positive" hint={stats.payingHint} onClick={() => setFilter('paying')} active={filter === 'paying'} />
                <StatCard label="Trialing" value={stats.trialing} hint={stats.trialCancelled ? `Card on file · ${stats.trialCancelled} cancelled` : 'Card on file'} onClick={() => setFilter('trialing')} active={filter === 'trialing'} />
                <StatCard label="Grace" value={stats.grace} tone={stats.grace ? 'warning' : 'default'} hint={stats.graceHint} onClick={() => setFilter('grace')} active={filter === 'grace'} />
                <StatCard label="Comped" value={stats.comped} hint={stats.internal ? `+ ${stats.internal} internal` : 'Granted by an admin'} onClick={() => setFilter('comped')} active={filter === 'comped'} />
                <StatCard label="Locked" value={stats.locked} hint="Ended or never added a card" onClick={() => setFilter('locked')} active={filter === 'locked'} />
                <StatCard label="Needs attention" value={stats.attention} tone={stats.attention ? 'danger' : 'default'} hint="Past due or at a limit" onClick={() => setFilter('attention')} active={filter === 'attention'} />
            </div>

            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search name, slug, or owner email…"
                        className="w-full pl-9 pr-9 py-2 rounded-lg border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-shadow"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                {filter !== 'all' && (
                    <Button variant="ghost" size="sm" onClick={() => setFilter('all')}>
                        Clear filter <X className="w-3 h-3" />
                    </Button>
                )}
                {refreshing && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                <span className="ml-auto text-xs tabular-nums text-slate-400">
                    {visible.length} {visible.length === 1 ? 'result' : 'results'}
                </span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin" /> Loading organizations…
                </div>
            ) : error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : visible.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
                    <p className="text-sm text-slate-500">No organizations match.</p>
                    {(search || filter !== 'all') && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                                setSearch('')
                                setFilter('all')
                            }}
                        >
                            Reset search and filters
                        </Button>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm min-w-[900px]">
                        <thead className="text-xs text-slate-500 border-b border-slate-200 bg-slate-50/60">
                            <tr>
                                <SortHeader label="Organization" sortKey="name" />
                                <th className="px-4 py-2.5 font-medium text-left">Owner</th>
                                <SortHeader label="Plan" sortKey="plan" />
                                <SortHeader label="Programs" sortKey="initiatives" />
                                <th className="px-4 py-2.5 font-medium text-left">Team</th>
                                <SortHeader label="Storage" sortKey="storage" />
                                <SortHeader label="Last seen" sortKey="last_seen" align="right" />
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map(org => (
                                <tr
                                    key={org.id}
                                    onClick={() => navigate(`/admin/orgs/${org.id}`)}
                                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <OrgAvatar
                                                name={org.name}
                                                logoUrl={org.logo_url}
                                                brandColor={org.brand_color}
                                            />
                                            <div className="min-w-0">
                                                <div className="font-medium text-slate-900 truncate max-w-[200px]">
                                                    {org.name}
                                                </div>
                                                <div className="text-xs text-slate-400 truncate max-w-[200px]">
                                                    /{org.slug}
                                                    {!org.is_public && (
                                                        <span className="ml-1.5 text-slate-300">· private</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-slate-700 truncate max-w-[200px]">{org.owner.email || '—'}</div>
                                        {org.owner.name && (
                                            <div className="text-xs text-slate-400 truncate max-w-[200px]">{org.owner.name}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <PlanBadge tier={org.subscription?.plan_tier} state={org.state} size="sm" />
                                        <div className="mt-1 text-[11px] text-slate-500 truncate max-w-[240px]">
                                            {describeState(org.state, org.key_date, org.discount_label, org.has_access)}
                                            {org.mrr_cents ? ` · ${formatMoney(org.mrr_cents, 'usd')}/mo` : ''}
                                        </div>
                                        {org.limits_overridden && (
                                            <div className="mt-1 text-[11px] text-amber-600">Custom limits</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 w-[130px]">
                                        <UsageMeter used={org.usage.initiatives} limit={org.subscription?.initiatives_limit} compact />
                                    </td>
                                    <td className="px-4 py-3 w-[130px]">
                                        <UsageMeter used={org.usage.team_members} limit={org.subscription?.team_members_limit} compact />
                                    </td>
                                    <td className="px-4 py-3 w-[140px]">
                                        <UsageMeter
                                            used={org.usage.storage_used_bytes}
                                            limit={org.subscription?.storage_limit_bytes}
                                            format={formatBytes}
                                            compact
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-slate-500 whitespace-nowrap">
                                        {formatRelative(org.owner.last_sign_in_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
