import { useEffect, useState } from 'react'
import { Users, CheckCircle } from 'lucide-react'
import { TeamService, PendingInviteCheck } from '../services/team'
import toast from 'react-hot-toast'

/**
 * Shown to an already-logged-in user who has a pending team invitation —
 * e.g. someone who already has their own Nexus account and gets invited to
 * another org. Lets them Accept (consent) or Decline from inside the app,
 * without going through the email/logout invite-accept page.
 *
 * Mounted once inside TeamProvider, so it covers every authenticated shell.
 */
const DISMISS_KEY = 'nexus-pending-invite-dismissed'

export default function PendingInviteModal() {
    const [invite, setInvite] = useState<PendingInviteCheck | null>(null)
    const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const result = await TeamService.checkMyPendingInvite()
                if (cancelled) return
                if (!result.hasPendingInvite || !result.inviteToken) return
                // Don't re-nag if they hit "Later" for this specific invite this session.
                if (sessionStorage.getItem(DISMISS_KEY) === result.inviteToken) return
                setInvite(result)
            } catch {
                /* no invite / not reachable — stay hidden */
            }
        })()
        return () => { cancelled = true }
    }, [])

    if (!invite?.hasPendingInvite || !invite.inviteToken) return null

    const handleAccept = async () => {
        if (!invite.inviteToken) return
        setBusy('accept')
        try {
            const result = await TeamService.acceptInvite(invite.inviteToken)
            toast.success(result.message || 'Welcome to the team!')
            sessionStorage.removeItem(DISMISS_KEY)
            // Reload so the new org shows up in the switcher / accessible orgs.
            window.location.reload()
        } catch (err) {
            toast.error((err as Error).message || 'Could not accept invitation')
            setBusy(null)
        }
    }

    const handleDecline = async () => {
        if (!invite.inviteToken) return
        setBusy('decline')
        try {
            await TeamService.declineInvite(invite.inviteToken)
            toast.success('Invitation declined')
            setInvite(null)
        } catch (err) {
            toast.error((err as Error).message || 'Could not decline invitation')
            setBusy(null)
        }
    }

    const handleLater = () => {
        if (invite.inviteToken) sessionStorage.setItem(DISMISS_KEY, invite.inviteToken)
        setInvite(null)
    }

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-md w-full p-6 text-center">
                <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7 text-primary-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">You've been invited</h2>
                <p className="text-sm text-gray-600 mb-5">
                    You've been invited to join{' '}
                    <strong className="text-gray-900">{invite.organizationName || 'an organization'}</strong>.
                    Accept to add it to your account, or decline if you'd rather not.
                </p>
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={handleAccept}
                        disabled={busy !== null}
                        className="w-full px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-gray-800 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {busy === 'accept' ? (
                            <><div className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" /> Joining...</>
                        ) : (
                            <><CheckCircle className="w-4 h-4" /> Accept invitation</>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={handleDecline}
                        disabled={busy !== null}
                        className="w-full px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl border border-gray-200 transition-colors disabled:opacity-50"
                    >
                        {busy === 'decline' ? 'Declining...' : 'Decline'}
                    </button>
                    <button
                        type="button"
                        onClick={handleLater}
                        disabled={busy !== null}
                        className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 pt-1"
                    >
                        Maybe later
                    </button>
                </div>
            </div>
        </div>
    )
}
