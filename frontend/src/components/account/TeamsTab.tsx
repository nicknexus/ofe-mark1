import { useState } from 'react'
import {
 Clock,
 Mail,
 Pencil,
 RefreshCw,
 Trash2,
 UserPlus,
 Users,
} from 'lucide-react'
import type { FormEvent } from 'react'
import type { TeamMember, TeamInvitation } from '../../services/team'
import type { TeamsTabProps } from './accountTypes'
import ModalFrame, { ModalHeader, ModalBody } from '../ModalFrame'
import { Badge, EmptyState, InlineAlert, SectionLoader, Spinner } from '../ui'
import { TeamInviteForm } from './TeamInviteForm'
import { TeamMemberEditModal } from './TeamMemberEditModal'

function memberRoleLabel(member: TeamMember): string {
 if (member.member_type === 'admin') return 'Admin'
 if (member.member_type === 'team_member') return 'Team member'
 return 'Admin'
}

function initials(name?: string | null, email?: string | null) {
 const src = (name || email || '?').trim()
 return src[0]?.toUpperCase() || '?'
}

export function TeamsTab({
 organizationName, organizationLogo, organizationStatement, members, invitations, capacity, loading,
 inviteEmail, setInviteEmail, memberType, setMemberType,
 permissionToggles, setPermissionToggles,
 inviteScope, setInviteScope,
 inviteRequiresApproval, setInviteRequiresApproval,
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
 <div className="app-card"><SectionLoader label="Loading team…" /></div>
 )
 }

 const canInvite = !capacity || capacity.canAdd

 return (
 <>
 <TeamMemberEditModal
 target={editTarget}
 onClose={() => setEditTarget(null)}
 onSaved={onTeamDataChanged}
 />

 <div className="app-card overflow-hidden">
 <div className="px-6 py-5 flex items-center justify-between gap-4">
 <div className="flex items-center gap-3 min-w-0">
 <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
 {organizationLogo ? (
 <img src={organizationLogo} alt="" className="w-full h-full object-cover" />
 ) : (
 <span className="text-sm font-semibold text-secondary-400">
 {(organizationName || '?').slice(0, 1).toUpperCase()}
 </span>
 )}
 </div>
 <div className="min-w-0">
 <p className="text-sm font-semibold text-secondary-900 truncate">{organizationName || 'Organization'}</p>
 <p className="text-xs text-secondary-500 truncate mt-0.5">
 {organizationStatement?.trim() || 'This organization’s team'}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2 flex-shrink-0">
 {capacity && (
 <span className="text-[12px] tabular-nums text-secondary-400">
 {capacity.current}/{capacity.limit} seats
 </span>
 )}
 {canInvite && (
 <button
 type="button"
 onClick={() => setShowInvite(true)}
 className="app-btn app-btn-primary app-btn-sm"
 >
 <UserPlus className="w-3.5 h-3.5" />
 Invite
 </button>
 )}
 </div>
 </div>

 {capacity && !capacity.canAdd && (
 <div className="px-6 pb-4">
 <InlineAlert tone="warning" title="Seat limit reached">
 Remove a member or revoke an invitation to add more.
 </InlineAlert>
 </div>
 )}

 <div className="px-6 pt-1 pb-2 flex items-baseline justify-between gap-2 border-t border-gray-100">
 <h2 className="app-card-title">Members</h2>
 <span className="text-[11px] tabular-nums text-secondary-400">{members.length}</span>
 </div>

 {members.length === 0 ? (
 <EmptyState icon={Users} title="No members yet" description="Invite someone to this organization." />
 ) : (
 <ul className="divide-y divide-gray-100">
 {members.map((member: TeamMember) => (
 <li key={member.id} className="px-6 py-3.5 flex items-center gap-3 hover:bg-gray-50/70 transition-colors">
 <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-800 text-[13px] font-semibold flex items-center justify-center flex-shrink-0">
 {initials(member.user_name, member.user_email)}
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 min-w-0">
 <p className="text-sm font-medium text-secondary-900 truncate">{member.user_name || member.user_email}</p>
 <Badge tone={member.member_type === 'team_member' ? 'neutral' : 'accent'}>
 {memberRoleLabel(member)}
 </Badge>
 </div>
 <p className="text-[12px] text-secondary-400 truncate mt-0.5">
 {member.user_name && member.user_email ? `${member.user_email} · ` : ''}
 Joined {formatDate(member.joined_at)}
 </p>
 </div>
 <div className="flex items-center gap-0.5 flex-shrink-0">
 <button
 type="button"
 onClick={() => setEditTarget({ kind: 'member', record: member })}
 className="app-btn app-btn-icon app-btn-ghost"
 title="Edit role and permissions"
 >
 <Pencil className="w-4 h-4" />
 </button>
 <button
 type="button"
 onClick={() => handleRemoveMember(member)}
 disabled={removingMember === member.id}
 className="app-btn app-btn-icon app-btn-ghost text-gray-400 hover:text-red-600"
 title="Remove member"
 >
 {removingMember === member.id ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
 </button>
 </div>
 </li>
 ))}
 </ul>
 )}

 <div className="px-6 pt-5 pb-2 flex items-baseline justify-between gap-2 border-t border-gray-100">
 <h2 className="app-card-title">Pending</h2>
 <span className="text-[11px] tabular-nums text-secondary-400">{invitations.length}</span>
 </div>

 {invitations.length === 0 ? (
 <div className="pb-2">
 <EmptyState icon={Mail} title="No pending invitations" />
 </div>
 ) : (
 <ul className="divide-y divide-gray-100">
 {invitations.map((invitation: TeamInvitation) => {
 const isExpired = new Date(invitation.expires_at) < new Date()
 const roleLabel = invitation.member_type === 'admin' ? 'Admin' : 'Team member'
 return (
 <li key={invitation.id} className="px-6 py-3.5 flex items-center gap-3 hover:bg-gray-50/70 transition-colors">
 <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
 isExpired ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'
 }`}>
 <Clock className="w-4 h-4" />
 </div>
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 min-w-0">
 <p className="text-sm font-medium text-secondary-900 truncate">{invitation.email}</p>
 <Badge tone={invitation.member_type === 'admin' ? 'accent' : 'neutral'}>{roleLabel}</Badge>
 {isExpired && <Badge tone="danger">Expired</Badge>}
 </div>
 <p className="text-[12px] text-secondary-400 truncate mt-0.5">
 Sent {formatDate(invitation.created_at)}
 {!isExpired && ` · expires ${formatDate(invitation.expires_at)}`}
 </p>
 </div>
 <div className="flex items-center gap-0.5 flex-shrink-0">
 {!isExpired && (
 <button
 type="button"
 onClick={() => setEditTarget({ kind: 'invitation', record: invitation })}
 className="app-btn app-btn-icon app-btn-ghost"
 title="Edit role and permissions"
 >
 <Pencil className="w-4 h-4" />
 </button>
 )}
 <button
 type="button"
 onClick={() => handleResendInvite(invitation)}
 disabled={resendingInvite === invitation.id}
 className="app-btn app-btn-icon app-btn-ghost"
 title="Resend"
 >
 {resendingInvite === invitation.id ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
 </button>
 <button
 type="button"
 onClick={() => handleRevokeInvite(invitation)}
 disabled={revokingInvite === invitation.id}
 className="app-btn app-btn-icon app-btn-ghost text-gray-400 hover:text-red-600"
 title="Revoke"
 >
 {revokingInvite === invitation.id ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
 </button>
 </div>
 </li>
 )
 })}
 </ul>
 )}
 </div>

 {showInvite && (
 <ModalFrame zIndexClass="z-[1000]" size="2xl" onClose={() => setShowInvite(false)}>
 <ModalHeader
 icon={UserPlus}
 title="Invite team member"
 subtitle={organizationName}
 onClose={() => setShowInvite(false)}
 />
 <ModalBody>
 <TeamInviteForm
 inviteEmail={inviteEmail}
 setInviteEmail={setInviteEmail}
 memberType={memberType}
 setMemberType={setMemberType}
 permissionToggles={permissionToggles}
 setPermissionToggles={setPermissionToggles}
 scope={inviteScope}
 setScope={setInviteScope}
 requiresEvidenceApproval={inviteRequiresApproval}
 setRequiresEvidenceApproval={setInviteRequiresApproval}
 sending={sending}
 onSubmit={onInviteSubmit}
 />
 </ModalBody>
 </ModalFrame>
 )}
 </>
 )
}
