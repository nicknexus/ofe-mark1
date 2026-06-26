import { useEffect, useState } from 'react'
import { ScrollText, Loader2 } from 'lucide-react'
import { AdminApi, AuditEntry } from '../../services/adminApi'

const ACTION_LABELS: Record<string, string> = {
    'support.enter': 'Entered support mode',
    'limits.update': 'Updated limits',
    'agent.create': 'Created support agent',
    'agent.promote': 'Promoted user to agent',
    'agent.revoke': 'Revoked support agent',
}

function describe(entry: AuditEntry): string {
    return ACTION_LABELS[entry.action] || entry.action
}

function detailText(entry: AuditEntry): string {
    if (!entry.detail) return ''
    try {
        return Object.entries(entry.detail)
            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
            .join(', ')
    } catch {
        return ''
    }
}

export default function AdminAuditPage() {
    const [entries, setEntries] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const data = await AdminApi.listAudit()
                if (!cancelled) setEntries(data)
            } catch (err) {
                if (!cancelled) setError((err as Error).message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [])

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-1">
                <ScrollText className="w-6 h-6 text-slate-700" />
                <h1 className="text-2xl font-semibold text-slate-900">Audit Log</h1>
            </div>
            <p className="text-sm text-slate-500 mb-6">Admin and support activity, most recent first.</p>

            {loading ? (
                <div className="flex items-center gap-2 text-slate-500 py-12 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
            ) : error ? (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>
            ) : entries.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">No activity yet.</div>
            ) : (
                <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-slate-500 border-b border-slate-200">
                                <th className="px-4 py-3 font-medium">When</th>
                                <th className="px-4 py-3 font-medium">Admin</th>
                                <th className="px-4 py-3 font-medium">Action</th>
                                <th className="px-4 py-3 font-medium">Organization</th>
                                <th className="px-4 py-3 font-medium">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(e => (
                                <tr key={e.id} className="border-b border-slate-100 last:border-0">
                                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-slate-700">{e.admin_email || e.admin_user_id.slice(0, 8)}</td>
                                    <td className="px-4 py-3 font-medium text-slate-900">{describe(e)}</td>
                                    <td className="px-4 py-3 text-slate-700">{e.organization_name || (e.organization_id ? e.organization_id.slice(0, 8) : '—')}</td>
                                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{detailText(e)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
