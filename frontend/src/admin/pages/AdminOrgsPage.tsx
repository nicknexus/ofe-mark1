import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, X, ArrowUpDown, RefreshCw } from 'lucide-react'
import { AdminApi, AdminOrg } from '../../services/adminApi'
import { PlanBadge, StatCard, UsageMeter, Button, OrgAvatar, formatBytes, formatRelative } from '../components/ui'

type SortKey = 'created_at' | 'name' | 'plan' | 'initiatives' | 'storage' | 'last_seen'
type Filter = 'all' | 'paying' | 'comped' | 'free' | 'attention'

/** Accounts needing a human look: payment problems, or pressed against a limit. */
function needsAttention(org: AdminOrg): boolean {
    const status = org.subscription?.status
    if (status === 'past_due' || status === 'expired') return true
    const atLimit = (used: number, limit?: number | null) =>
        limit !== null && limit !== undefined && limit > 0 && used >= limit
    return (
        atLimit(org.usage.initiatives, org.subscription?.initiatives_limit) ||
        atLimit(org.usage.team_members, org.subscription?.team_members_limit) ||
        atLimit(org.usage.locations, org.subscription?.locations_limit)
    )
}

function matchesFilter(org: AdminOrg, filter: Filter): boolean {
    switch (filter) {
        case 'paying':
            return org.plan_source === 'stripe'
        case 'comped':
            return org.plan_source === 'admin' || org.plan_source === 'code'
        case 'free':
            return org.plan_source === 'free' || org.plan_source === 'none'
        case 'attention':
            return needsAttention(org)
        default:
            return true
    }
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

    const stats = useMemo(
        () => ({
            total: orgs.length,
            paying: orgs.filter(o => o.plan_source === 'stripe').length,
            comped: orgs.filter(o => o.plan_source === 'admin' || o.plan_source === 'code').length,
            attention: orgs.filter(needsAttention).length,
        }),
        [orgs]
    )

    const visible = useMemo(() => {
        const rows = orgs.filter(o => matchesFilter(o, filter))
        const dir = sort.dir === 'asc' ? 1 : -1
        return [...rows].sort((a, b) => {
            switch (sort.key) {
                case 'name':
                    return a.name.localeCompare(b.name) * dir
                case 'plan':
                    return ((TIER_RANK[a.subscription?.plan_tier || 'free'] || 0) -
                        (TIER_RANK[b.subscription?.plan_tier || 'free'] || 0)) * dir
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <StatCard label="Organizations" value={stats.total} onClick={() => setFilter('all')} active={filter === 'all'} />
                <StatCard label="Paying" value={stats.paying} tone="positive" hint="Active Stripe subscription" onClick={() => setFilter('paying')} active={filter === 'paying'} />
                <StatCard label="Comped" value={stats.comped} tone="warning" hint="Granted without payment" onClick={() => setFilter('comped')} active={filter === 'comped'} />
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
                                <SortHeader label="Initiatives" sortKey="initiatives" />
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
                                        <PlanBadge
                                            tier={org.subscription?.plan_tier}
                                            source={org.plan_source}
                                            status={org.subscription?.status}
                                            size="sm"
                                        />
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
