import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { formatDate } from '../../utils'
import { TeamService, TeamMember, TeamInvitation, TeamCapacity } from '../../services/team'
import { useTeam } from '../../context/TeamContext'
import {
  defaultTeamMemberToggles,
  fullScope,
  togglesToGrants,
  validateTeamMemberInvite,
  type MemberType,
  type TeamMemberPermissionToggles,
  type TeamMemberScope,
} from '../../types/teamPermissions'
import ConfirmDialog from '../ConfirmDialog'
import { notify } from '../../lib/notify'
import type { ConfirmState } from './accountTypes'
import { TeamsTab } from './TeamsTab'

export function TeamAdminPanel() {
  const { organizationName, activeOrganization, canManageTeam } = useTeam()

  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<TeamInvitation[]>([])
  const [capacity, setCapacity] = useState<TeamCapacity | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMemberType, setInviteMemberType] = useState<MemberType>('admin')
  const [invitePermissionToggles, setInvitePermissionToggles] = useState<TeamMemberPermissionToggles>(defaultTeamMemberToggles)
  const [inviteScope, setInviteScope] = useState<TeamMemberScope>(fullScope)
  const [inviteRequiresApproval, setInviteRequiresApproval] = useState(false)
  const [sending, setSending] = useState(false)
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const [resendingInvite, setResendingInvite] = useState<string | null>(null)
  const [revokingInvite, setRevokingInvite] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null)

  const loadTeamData = async () => {
    try {
      setLoading(true)
      const [membersData, invitationsData, capacityData] = await Promise.all([
        TeamService.getMembers(),
        TeamService.getPendingInvitations(),
        TeamService.getCapacity(),
      ])
      setMembers(membersData)
      setInvitations(invitationsData)
      setCapacity(capacityData)
    } catch {
      notify.error('Failed to load team data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canManageTeam) loadTeamData()
  }, [canManageTeam, activeOrganization?.id])

  const handleSendInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) { notify.error('Please enter an email address'); return }

    if (inviteMemberType === 'team_member') {
      const validationError = validateTeamMemberInvite(inviteMemberType, invitePermissionToggles, inviteScope)
      if (validationError) {
        notify.error(validationError)
        return
      }
    }

    setSending(true)
    try {
      const result = await TeamService.sendInvite({
        email: inviteEmail.trim(),
        memberType: inviteMemberType,
        canAddImpactClaims: invitePermissionToggles.addClaims,
        permissions:
          inviteMemberType === 'team_member'
            ? togglesToGrants(invitePermissionToggles)
            : undefined,
        scope: inviteMemberType === 'team_member' ? inviteScope : undefined,
        requiresEvidenceApproval: inviteMemberType === 'team_member' ? inviteRequiresApproval : false,
      })
      if (result.emailSent) notify.success(`Invitation sent to ${inviteEmail}`)
      else notify.success('Invitation created, but email could not be sent.')
      setInviteEmail('')
      setInviteMemberType('admin')
      setInvitePermissionToggles(defaultTeamMemberToggles)
      setInviteScope(fullScope)
      setInviteRequiresApproval(false)
      loadTeamData()
    } catch (error) {
      notify.error((error as Error).message)
    } finally {
      setSending(false)
    }
  }

  const handleRemoveMember = async (member: TeamMember) => {
    setRemovingMember(member.id)
    try {
      await TeamService.removeMember(member.id)
      notify.success('Member removed')
      loadTeamData()
    } catch (error) {
      notify.error((error as Error).message)
    } finally {
      setRemovingMember(null)
    }
  }

  const handleResendInvite = async (invitation: TeamInvitation) => {
    setResendingInvite(invitation.id)
    try {
      const result = await TeamService.resendInvite(invitation.id)
      if (result.emailSent) notify.success('Invitation resent')
      else notify.error('Failed to send email')
      loadTeamData()
    } catch (error) {
      notify.error((error as Error).message)
    } finally {
      setResendingInvite(null)
    }
  }

  const handleRevokeInvite = async (invitation: TeamInvitation) => {
    setRevokingInvite(invitation.id)
    try {
      await TeamService.revokeInvite(invitation.id)
      notify.success('Invitation revoked')
      loadTeamData()
    } catch (error) {
      notify.error((error as Error).message)
    } finally {
      setRevokingInvite(null)
    }
  }

  return (
    <>
      <TeamsTab
        organizationName={activeOrganization?.name || organizationName}
        organizationLogo={activeOrganization?.logo_url}
        organizationStatement={activeOrganization?.statement}
        members={members}
        invitations={invitations}
        capacity={capacity}
        loading={loading}
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        memberType={inviteMemberType}
        setMemberType={setInviteMemberType}
        permissionToggles={invitePermissionToggles}
        setPermissionToggles={setInvitePermissionToggles}
        inviteScope={inviteScope}
        setInviteScope={setInviteScope}
        inviteRequiresApproval={inviteRequiresApproval}
        setInviteRequiresApproval={setInviteRequiresApproval}
        sending={sending}
        handleSendInvite={handleSendInvite}
        removingMember={removingMember}
        resendingInvite={resendingInvite}
        revokingInvite={revokingInvite}
        handleRemoveMember={(member: TeamMember) => setConfirmDialog({
          title: 'Remove team member',
          message: `Remove ${member.user_email || member.user_name || 'this member'} from the team?`,
          confirmLabel: 'Remove member',
          onConfirm: () => handleRemoveMember(member),
        })}
        handleResendInvite={handleResendInvite}
        handleRevokeInvite={(invitation: TeamInvitation) => setConfirmDialog({
          title: 'Revoke invitation',
          message: `Revoke invitation for ${invitation.email}?`,
          confirmLabel: 'Revoke invitation',
          onConfirm: () => handleRevokeInvite(invitation),
        })}
        formatDate={formatDate}
        onTeamDataChanged={loadTeamData}
      />
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          tone="danger"
          onConfirm={() => {
            const action = confirmDialog.onConfirm
            setConfirmDialog(null)
            action()
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </>
  )
}
