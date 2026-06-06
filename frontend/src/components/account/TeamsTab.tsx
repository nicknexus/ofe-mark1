import { useState } from 'react'
import {
 AlertTriangle,
 Clock,
 Mail,
 Pencil,
 RefreshCw,
 Trash2,
 UserPlus,
 Users,
 X,
} from 'lucide-react'
import type { FormEvent } from 'react'
import type { TeamMember, TeamInvitation } from '../../services/team'
import type { TeamsTabProps } from './accountTypes'
import ModalFrame from '../ModalFrame'
import { SectionLoader, Spinner } from '../ui'
import { TeamInviteForm } from './TeamInviteForm'
import { TeamMemberEditModal } from './TeamMemberEditModal'

function memberRoleLabel(member: TeamMember): string {
 if (member.member_type === 'admin') return 'Admin'
 if (member.member_type === 'team_member') return 'Team member'
 return 'Admin'
}

export function TeamsTab({
 organizationName, members, invitations, capacity, loading,
 inviteEmail, setInviteEmail, memberType, setMemberType,
 permissionToggles, setPermissionToggles,
 inviteScope, setInviteScope,
 sending, handleSendInvite,
 removingMember, resendingInvite, revokingInvite,
 handleRemoveMember, handleResendInvite, handleRevokeInvite, formatDate,
 onTeamDataChanged,
}: TeamsTabProps) {
 const [editTarget, setEditTarget] = useState<
 { kind: 'member'; record: TeamMember } | { kind: 'invitation'; record: TeamInvitation } | null
 >(null)
 const [showInvite, setShowInvite] = useState(false)

 const onInviteSubmit = async (e: FormEvent) => {
 await handleSendInvite(e)
 setShowInvite(false)
 }

 if (loading) {
 return (
 <div className="app-card"><SectionLoader label="Loading team data..." /></div>
 )
 }

 return (
 <>
 <TeamMemberEditModal
 target={editTarget}
 onClose={() => setEditTarget(null)}
 onSaved={onTeamDataChanged}
 />
 <div className="space-y-6">
 <div className="app-card p-6">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-primary-50 rounded-xl"><UserPlus className="w-5 h-5 text-primary-600" /></div>
 <div>
 <h2 className="text-lg font-semibold text-gray-800">Invite Team Member</h2>
 {organizationName && (
 <p className="text-xs text-gray-500">{organizationName}</p>
 )}
 </div>
 </div>
 {capacity && (
 <div className={`text-sm px-3 py-1 rounded-full ${capacity.canAdd ? 'bg-impact-100 text-impact-700' : 'bg-amber-100 text-amber-700'}`}>
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
 <button
 type="button"
 onClick={() => setShowInvite(true)}
 className="app-btn app-btn-primary w-full flex items-center justify-center gap-2"
 >
 <UserPlus className="w-4 h-4" /> Invite team member
 </button>
 )}
 </div>

 {showInvite && (
 <ModalFrame
 zIndexClass="z-[1000]"
 size="2xl"
 panelClassName="bg-white rounded-xl border border-gray-200 max-w-6xl w-full max-h-[92vh] overflow-hidden shadow-app-modal flex flex-col"
 >
 <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
 <div className="flex items-center gap-3 min-w-0">
 <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
 <UserPlus className="w-5 h-5" />
 </div>
 <div className="min-w-0">
 <h2 className="text-base font-semibold text-gray-900 truncate">Invite team member</h2>
 {organizationName && <p className="text-xs text-gray-500 truncate">{organizationName}</p>}
 </div>
 </div>
 <button type="button" onClick={() => setShowInvite(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
 <X className="w-5 h-5" />
 </button>
 </div>
 <div className="p-5 overflow-y-auto flex-1">
 <TeamInviteForm
 inviteEmail={inviteEmail}
 setInviteEmail={setInviteEmail}
 memberType={memberType}
 setMemberType={setMemberType}
 permissionToggles={permissionToggles}
 setPermissionToggles={setPermissionToggles}
 scope={inviteScope}
 setScope={setInviteScope}
 sending={sending}
 onSubmit={onInviteSubmit}
 />
 </div>
 </ModalFrame>
 )}

 <div className="app-card p-6">
 <div className="flex items-center gap-3 mb-4">
 <div className="p-2 bg-impact-50 rounded-xl"><Users className="w-5 h-5 text-impact-600" /></div>
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
 <div className="flex items-center gap-2">
 <p className="font-medium text-gray-900">{member.user_name || member.user_email}</p>
 <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
 {memberRoleLabel(member)}
 </span>
 </div>
 {member.user_name && member.user_email && <p className="text-xs text-gray-500">{member.user_email}</p>}
 <p className="text-xs text-gray-400">Joined {formatDate(member.joined_at)}</p>
 </div>
 </div>
 <div className="flex items-center gap-1">
 <button
 type="button"
 onClick={() => setEditTarget({ kind: 'member', record: member })}
 className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
 title="Edit role & permissions"
 >
 <Pencil className="w-4 h-4" />
 </button>
 <button onClick={() => handleRemoveMember(member)} disabled={removingMember === member.id} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
 {removingMember === member.id ? <Spinner className="w-4 h-4 border-red-500 border-t-transparent" /> : <Trash2 className="w-4 h-4" />}
 </button>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="app-card p-6">
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
 const roleLabel = invitation.member_type === 'admin' ? 'Admin' : 'Team member'
 return (
 <div key={invitation.id} className={`flex items-center justify-between p-4 rounded-xl ${isExpired ? 'bg-red-50' : 'bg-gray-50'}`}>
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isExpired ? 'bg-red-100' : 'bg-amber-100'}`}>
 {isExpired ? <X className="w-5 h-5 text-red-500" /> : <Clock className="w-5 h-5 text-amber-500" />}
 </div>
 <div>
 <div className="flex items-center gap-2">
 <p className="font-medium text-gray-900">{invitation.email}</p>
 <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">{roleLabel}</span>
 </div>
 <p className="text-xs text-gray-500">Sent {formatDate(invitation.created_at)} • <span className={isExpired ? 'text-red-500' : ''}>{isExpired ? 'Expired' : `Expires ${formatDate(invitation.expires_at)}`}</span></p>
 </div>
 </div>
 <div className="flex items-center gap-1">
 {!isExpired && (
 <button
 type="button"
 onClick={() => setEditTarget({ kind: 'invitation', record: invitation })}
 className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
 title="Edit role & permissions"
 >
 <Pencil className="w-4 h-4" />
 </button>
 )}
 <button onClick={() => handleResendInvite(invitation)} disabled={resendingInvite === invitation.id} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors">
 {resendingInvite === invitation.id ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
 </button>
 <button onClick={() => handleRevokeInvite(invitation)} disabled={revokingInvite === invitation.id} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
 {revokingInvite === invitation.id ? <Spinner className="w-4 h-4 border-red-500 border-t-transparent" /> : <Trash2 className="w-4 h-4" />}
 </button>
 </div>
 </div>
 )
 })}
 </div>
 )}
 </div>
 </div>
 </>
 )
}
