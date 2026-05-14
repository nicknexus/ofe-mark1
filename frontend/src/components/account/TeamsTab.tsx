import {
    AlertTriangle,
    Clock,
    Mail,
    RefreshCw,
    Send,
    Trash2,
    UserPlus,
    Users,
    X,
} from 'lucide-react'
import type { TeamMember, TeamInvitation } from '../../services/team'
import type { TeamsTabProps } from './accountTypes'

export function TeamsTab({
    organizationName, members, invitations, capacity, loading,
    inviteEmail, setInviteEmail, sending, handleSendInvite,
    removingMember, resendingInvite, revokingInvite,
    handleRemoveMember, handleResendInvite, handleRevokeInvite, formatDate,
}: TeamsTabProps) {
    if (loading) {
        return (
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading team data...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Invite Form */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-50 rounded-xl"><UserPlus className="w-5 h-5 text-primary-600" /></div>
                        <h2 className="text-lg font-semibold text-gray-800">Invite Team Member</h2>
                    </div>
                    {capacity && (
                        <div className={`text-sm px-3 py-1 rounded-full ${capacity.canAdd ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {capacity.current} / {capacity.limit} seats used
                        </div>
                    )}
                </div>

                {capacity && !capacity.canAdd ? (
                    <div className="p-4 bg-amber-50 rounded-xl text-amber-800">
                        <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-5 h-5" /><span className="font-medium">Team Limit Reached</span></div>
                        <p className="text-sm">Remove a member or revoke an invitation to add more.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSendInvite} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                            <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all" />
                        </div>
                        <button type="submit" disabled={sending || !inviteEmail.trim()} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                            {sending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</> : <><Send className="w-4 h-4" />Send Invitation</>}
                        </button>
                    </form>
                )}
            </div>

            {/* Team Members */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-50 rounded-xl"><Users className="w-5 h-5 text-green-600" /></div>
                    <h2 className="text-lg font-semibold text-gray-800">Team Members ({members.length})</h2>
                </div>
                {members.length === 0 ? (
                    <div className="text-center py-8 text-gray-500"><Users className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">No team members yet</p></div>
                ) : (
                    <div className="space-y-3">
                        {members.map((member: TeamMember) => (
                            <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                                        <span className="text-primary-700 font-medium">{(member.user_name || member.user_email || '?')[0].toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{member.user_name || member.user_email}</p>
                                        {member.user_name && member.user_email && <p className="text-xs text-gray-500">{member.user_email}</p>}
                                        <p className="text-xs text-gray-400">Joined {formatDate(member.joined_at)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => handleRemoveMember(member)} disabled={removingMember === member.id} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                        {removingMember === member.id ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pending Invitations */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-amber-50 rounded-xl"><Mail className="w-5 h-5 text-amber-600" /></div>
                    <h2 className="text-lg font-semibold text-gray-800">Pending Invitations ({invitations.length})</h2>
                </div>
                {invitations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500"><Mail className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">No pending invitations</p></div>
                ) : (
                    <div className="space-y-3">
                        {invitations.map((invitation: TeamInvitation) => {
                            const isExpired = new Date(invitation.expires_at) < new Date()
                            return (
                                <div key={invitation.id} className={`flex items-center justify-between p-4 rounded-xl ${isExpired ? 'bg-red-50' : 'bg-gray-50'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isExpired ? 'bg-red-100' : 'bg-amber-100'}`}>
                                            {isExpired ? <X className="w-5 h-5 text-red-500" /> : <Clock className="w-5 h-5 text-amber-500" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">{invitation.email}</p>
                                            <p className="text-xs text-gray-500">Sent {formatDate(invitation.created_at)} • <span className={isExpired ? 'text-red-500' : ''}>{isExpired ? 'Expired' : `Expires ${formatDate(invitation.expires_at)}`}</span></p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleResendInvite(invitation)} disabled={resendingInvite === invitation.id} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
                                            {resendingInvite === invitation.id ? <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => handleRevokeInvite(invitation)} disabled={revokingInvite === invitation.id} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            {revokingInvite === invitation.id ? <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
