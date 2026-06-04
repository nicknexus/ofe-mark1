import type { FormEvent } from 'react'
import { MemberType, TeamMemberPermissionToggles, TeamMemberScope } from '../../types/teamPermissions'
import { Spinner } from '../ui'
import { getRolePermissionValidationError, TeamRolePermissionFields } from './TeamRolePermissionFields'

type TeamInviteFormProps = {
 inviteEmail: string
 setInviteEmail: (value: string) => void
 memberType: MemberType
 setMemberType: (value: MemberType) => void
 permissionToggles: TeamMemberPermissionToggles
 setPermissionToggles: (value: TeamMemberPermissionToggles) => void
 scope: TeamMemberScope
 setScope: (value: TeamMemberScope) => void
 sending: boolean
 onSubmit: (e: FormEvent) => void
 disabled?: boolean
}

export function TeamInviteForm({
 inviteEmail,
 setInviteEmail,
 memberType,
 setMemberType,
 permissionToggles,
 setPermissionToggles,
 scope,
 setScope,
 sending,
 onSubmit,
 disabled,
}: TeamInviteFormProps) {
 const validationError = getRolePermissionValidationError(memberType, permissionToggles, scope)

 return (
 <form onSubmit={onSubmit} className="space-y-5">
 <TeamRolePermissionFields
 memberType={memberType}
 setMemberType={setMemberType}
 permissionToggles={permissionToggles}
 setPermissionToggles={setPermissionToggles}
 scope={scope}
 setScope={setScope}
 />

 {/* Email + send inline at the bottom */}
 <div className="flex gap-3 pt-1 border-t border-gray-100">
 <div className="flex-1">
 <label className="block text-xs font-medium text-gray-500 mb-1">Email address</label>
 <input
 type="email"
 value={inviteEmail}
 onChange={(e) => setInviteEmail(e.target.value)}
 placeholder="colleague@example.com"
 className="app-input"
 />
 </div>
 <div className="flex items-end">
 <button
 type="submit"
 disabled={disabled || sending || !inviteEmail.trim() || !!validationError}
 className="app-btn app-btn-primary flex items-center gap-2 whitespace-nowrap"
 >
 {sending ? (
 <>
 <Spinner className="w-4 h-4 border-white border-t-white/30" />
 Sending…
 </>
 ) : 'Send invitation'}
 </button>
 </div>
 </div>
 </form>
 )
}

export { defaultTeamMemberToggles } from '../../types/teamPermissions'
