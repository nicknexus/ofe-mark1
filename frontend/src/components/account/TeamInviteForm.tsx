import type { FormEvent } from 'react'
import { MemberType, TeamMemberPermissionToggles, TeamMemberScope } from '../../types/teamPermissions'
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
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all text-sm"
                    />
                </div>
                <div className="flex items-end">
                    <button
                        type="submit"
                        disabled={disabled || sending || !inviteEmail.trim() || !!validationError}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                    >
                        {sending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
