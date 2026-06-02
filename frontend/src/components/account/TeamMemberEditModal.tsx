import { useEffect, useState } from 'react'
import { Pencil, X } from 'lucide-react'
import ModalFrame from '../ModalFrame'
import { TeamService, TeamMember, TeamInvitation } from '../../services/team'
import {
    defaultTeamMemberToggles,
    fullScope,
    grantsToToggles,
    MemberType,
    TeamMemberPermissionToggles,
    TeamMemberScope,
    togglesToGrants,
} from '../../types/teamPermissions'
import { getRolePermissionValidationError, TeamRolePermissionFields } from './TeamRolePermissionFields'
import toast from 'react-hot-toast'

type EditTarget =
    | { kind: 'member'; record: TeamMember }
    | { kind: 'invitation'; record: TeamInvitation }

type TeamMemberEditModalProps = {
    target: EditTarget | null
    onClose: () => void
    onSaved: () => void
}

export function TeamMemberEditModal({ target, onClose, onSaved }: TeamMemberEditModalProps) {
    const [memberType, setMemberType] = useState<MemberType>('admin')
    const [permissionToggles, setPermissionToggles] = useState<TeamMemberPermissionToggles>(defaultTeamMemberToggles)
    const [scope, setScope] = useState<TeamMemberScope>(fullScope)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (!target) return

        const load = async () => {
            setLoading(true)
            try {
                const rawType = target.record.member_type
                const type: MemberType = rawType === 'team_member' ? 'team_member' : 'admin'
                setMemberType(type)

                if (type === 'team_member') {
                    const result =
                        target.kind === 'member'
                            ? await TeamService.getMemberPermissions(target.record.id)
                            : await TeamService.getInvitationPermissions(target.record.id)
                    const grants = result.grants
                    setScope(result.scope ?? fullScope)
                    if (grants.length > 0) {
                        setPermissionToggles(grantsToToggles(grants))
                    } else if (target.kind === 'member') {
                        setPermissionToggles(
                            grantsToToggles([
                                { resource: 'impact_claims', action: 'create', allowed: target.record.can_add_impact_claims },
                                { resource: 'evidence', action: 'edit', allowed: target.record.can_edit_evidence },
                            ])
                        )
                    } else {
                        setPermissionToggles(
                            grantsToToggles([
                                {
                                    resource: 'impact_claims',
                                    action: 'create',
                                    allowed: target.record.can_add_impact_claims,
                                },
                            ])
                        )
                    }
                } else {
                    setPermissionToggles(defaultTeamMemberToggles)
                    setScope(fullScope)
                }
            } catch (err) {
                toast.error((err as Error).message)
                onClose()
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [target, onClose])

    if (!target) return null

    const displayName =
        target.kind === 'member'
            ? target.record.user_name || target.record.user_email || 'Team member'
            : target.record.email

    const validationError = getRolePermissionValidationError(memberType, permissionToggles, scope)

    const handleSave = async () => {
        if (validationError) {
            toast.error(validationError)
            return
        }

        setSaving(true)
        try {
            const payload = {
                memberType,
                permissions: memberType === 'team_member' ? togglesToGrants(permissionToggles) : undefined,
                scope: memberType === 'team_member' ? scope : undefined,
            }

            if (target.kind === 'member') {
                await TeamService.updateMember(target.record.id, payload)
                toast.success('Member updated')
            } else {
                await TeamService.updateInvitation(target.record.id, payload)
                toast.success('Invitation updated')
            }
            onSaved()
            onClose()
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <ModalFrame
            zIndexClass="z-[1000]"
            backdropClassName="bg-gray-900/35 backdrop-blur-sm"
            panelClassName="bg-white rounded-2xl max-w-6xl w-full max-h-[92vh] overflow-hidden shadow-modal flex flex-col"
        >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center flex-shrink-0">
                        <Pencil className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-900 truncate">
                            Edit {target.kind === 'member' ? 'member' : 'invitation'}
                        </h2>
                        <p className="text-xs text-gray-500 truncate">{displayName}</p>
                    </div>
                </div>
                <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
                {loading ? (
                    <div className="py-12 flex justify-center">
                        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <TeamRolePermissionFields
                        memberType={memberType}
                        setMemberType={setMemberType}
                        permissionToggles={permissionToggles}
                        setPermissionToggles={setPermissionToggles}
                        scope={scope}
                        setScope={setScope}
                    />
                )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
                <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || loading || !!validationError}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save changes'}
                </button>
            </div>
        </ModalFrame>
    )
}
