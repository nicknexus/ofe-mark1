import { useEffect, useState } from 'react'
import { Loader2, User as UserIcon, ShieldAlert } from 'lucide-react'
import { AdminApi, AdminOrg } from '../../services/adminApi'

function planLabel(org: AdminOrg): string {
    const s = org.subscription
    if (!s || !s.status || s.status === 'none') return 'No plan'
    if (s.status === 'trial') return 'Trial'
    return s.plan_tier ? s.plan_tier : s.status
}

function usage(used: number, limit?: number | null): string {
    return limit === null || limit === undefined ? `${used} / ∞` : `${used} / ${limit}`
}

/**
 * Read-only account view shown on the Account tab while a platform admin is in
 * support mode. Displays the customer OWNER's details (not the admin's), so
 * nothing on the screen is the admin's own data.
 */
export default function SupportAccountView({ orgId }: { orgId: string }) {
    const [org, setOrg] = useState<AdminOrg | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const data = await AdminApi.getOrg(orgId)
                if (!cancelled) setOrg(data)
            } catch (err) {
                if (!cancelled) setError((err as Error).message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [orgId])

    if (loading) {
        return (
            <div className="app-card p-8 flex items-center justify-center gap-2 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading account…
            </div>
        )
    }
    if (error || !org) {
        return <div className="app-card p-6 text-sm text-red-600">{error || 'Could not load account.'}</div>
    }

    const row = (label: string, value: string) => (
        <div className="flex justify-between py-3 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="text-sm font-medium text-gray-900">{value}</span>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2 text-sm text-red-700">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                Support mode — read-only view of <strong>{org.name}</strong>'s account. You can't change their profile or billing.
            </div>

            <div className="app-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <UserIcon className="w-5 h-5 text-gray-700" />
                    <h2 className="text-lg font-semibold text-gray-800">Account owner</h2>
                </div>
                {row('Name', org.owner.name || '—')}
                {row('Email', org.owner.email || '—')}
                {row('Organization', org.name)}
            </div>

            <div className="app-card p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Plan &amp; usage</h2>
                {row('Plan', planLabel(org))}
                {org.subscription?.trial_ends_at &&
                    row('Trial ends', new Date(org.subscription.trial_ends_at).toLocaleDateString())}
                {row('Team members', usage(org.usage.team_members, org.subscription?.team_members_limit))}
                {row('Initiatives', usage(org.usage.initiatives, org.subscription?.initiatives_limit))}
            </div>
        </div>
    )
}
