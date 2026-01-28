import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
    ArrowLeft, Users, Mail, UserPlus, Trash2, RefreshCw, 
    Clock, CheckCircle, XCircle, AlertCircle, ToggleLeft, ToggleRight,
    Send, FileText
} from 'lucide-react'
import { TeamService, TeamMember, TeamInvitation, TeamCapacity } from '../services/team'
import { useTeam } from '../context/TeamContext'
import toast from 'react-hot-toast'

export default function TeamSettingsPage() {
    const navigate = useNavigate()
    const { hasOwnOrganization, ownedOrganization, loading: permissionsLoading } = useTeam()
    
    const [members, setMembers] = useState<TeamMember[]>([])
    const [invitations, setInvitations] = useState<TeamInvitation[]>([])
    const [capacity, setCapacity] = useState<TeamCapacity | null>(null)
    const [loading, setLoading] = useState(true)
    
    // Invite form state
    const [inviteEmail, setInviteEmail] = useState('')
    const [allowImpactClaims, setAllowImpactClaims] = useState(false)
    const [sending, setSending] = useState(false)
    
    // Action states
    const [updatingMember, setUpdatingMember] = useState<string | null>(null)
    const [removingMember, setRemovingMember] = useState<string | null>(null)
    const [resendingInvite, setResendingInvite] = useState<string | null>(null)
    const [revokingInvite, setRevokingInvite] = useState<string | null>(null)

    // Use ownedOrganization name for display
    const organizationName = ownedOrganization?.name

    useEffect(() => {
        if (!permissionsLoading && !hasOwnOrganization) {
            toast.error('Only organization owners can access team settings')
            navigate('/')
        }
    }, [hasOwnOrganization, permissionsLoading, navigate])

    useEffect(() => {
        if (hasOwnOrganization) {
            loadTeamData()
        }
    }, [hasOwnOrganization])

    const loadTeamData = async () => {
        try {
            setLoading(true)
            const [membersData, invitationsData, capacityData] = await Promise.all([
                TeamService.getMembers(),
                TeamService.getPendingInvitations(),
                TeamService.getCapacity()
            ])
            setMembers(membersData)
            setInvitations(invitationsData)
            setCapacity(capacityData)
        } catch (error) {
            toast.error('Failed to load team data')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!inviteEmail.trim()) {
            toast.error('Please enter an email address')
            return
        }

        setSending(true)
        try {
            const result = await TeamService.sendInvite(inviteEmail.trim(), allowImpactClaims)
            
            if (result.emailSent) {
                toast.success(`Invitation sent to ${inviteEmail}`)
            } else {
                toast.success('Invitation created, but email could not be sent. You can resend it.')
                if (result.emailError) {
                    console.error('Email error:', result.emailError)
                }
            }
            
            setInviteEmail('')
            setAllowImpactClaims(false)
            loadTeamData()
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setSending(false)
        }
    }

    const handleToggleMemberPermission = async (member: TeamMember) => {
        setUpdatingMember(member.id)
        try {
            await TeamService.updateMemberPermissions(member.id, !member.can_add_impact_claims)
            toast.success('Permission updated')
            loadTeamData()
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setUpdatingMember(null)
        }
    }

    const handleRemoveMember = async (member: TeamMember) => {
        if (!confirm(`Remove ${member.user_email || member.user_name || 'this member'} from the team?`)) {
            return
        }

        setRemovingMember(member.id)
        try {
            await TeamService.removeMember(member.id)
            toast.success('Member removed')
            loadTeamData()
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setRemovingMember(null)
        }
    }

    const handleResendInvite = async (invitation: TeamInvitation) => {
        setResendingInvite(invitation.id)
        try {
            const result = await TeamService.resendInvite(invitation.id)
            if (result.emailSent) {
                toast.success('Invitation resent')
            } else {
                toast.error('Failed to send email')
            }
            loadTeamData()
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setResendingInvite(null)
        }
    }

    const handleRevokeInvite = async (invitation: TeamInvitation) => {
        if (!confirm(`Revoke invitation for ${invitation.email}?`)) {
            return
        }

        setRevokingInvite(invitation.id)
        try {
            await TeamService.revokeInvite(invitation.id)
            toast.success('Invitation revoked')
            loadTeamData()
        } catch (error) {
            toast.error((error as Error).message)
        } finally {
            setRevokingInvite(null)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
    }

    if (permissionsLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading team settings...</p>
                </div>
            </div>
        )
    }

    if (!hasOwnOrganization) {
        return null // Will redirect
    }

    return (
        <div className="min-h-screen bg-gray-50 pt-24 pb-12 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={() => navigate('/account')}
                        className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back</span>
                    </button>
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900">Team Settings</h1>
                        {organizationName && (
                            <p className="text-sm text-gray-500">{organizationName}</p>
                        )}
                    </div>
                </div>

                {/* Invite Form */}
                <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary-50 rounded-xl">
                                <UserPlus className="w-5 h-5 text-primary-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-800">Invite Team Member</h2>
                        </div>
                        {capacity && (
                            <div className={`text-sm px-3 py-1 rounded-full ${
                                capacity.canAdd 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-amber-100 text-amber-700'
                            }`}>
                                {capacity.current} / {capacity.limit} seats used
                            </div>
                        )}
                    </div>

                    {capacity && !capacity.canAdd ? (
                        <div className="p-4 bg-amber-50 rounded-xl text-amber-800">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="w-5 h-5" />
                                <span className="font-medium">Team Limit Reached</span>
                            </div>
                            <p className="text-sm">
                                You've reached the maximum of {capacity.limit} team members. 
                                Remove a member or revoke a pending invitation to add more.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSendInvite} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="colleague@example.com"
                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm text-gray-700">Allow creating Impact Claims</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAllowImpactClaims(!allowImpactClaims)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                        allowImpactClaims ? 'bg-primary-500' : 'bg-gray-300'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                            allowImpactClaims ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>

                            <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
                                <strong>Note:</strong> Team members can view, create, and edit all data in your organization. 
                                Only you (the owner) can delete items. Impact Claims permission can be toggled anytime.
                            </div>

                            <button
                                type="submit"
                                disabled={sending || !inviteEmail.trim()}
                                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {sending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Send Invitation
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>

                {/* Team Members */}
                <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-50 rounded-xl">
                            <Users className="w-5 h-5 text-green-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-800">
                            Team Members ({members.length})
                        </h2>
                    </div>

                    {members.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No team members yet</p>
                            <p className="text-xs text-gray-400 mt-1">Invite someone to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {members.map((member) => (
                                <div
                                    key={member.id}
                                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                                            <span className="text-primary-700 font-medium">
                                                {(member.user_name || member.user_email || '?')[0].toUpperCase()}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {member.user_name || member.user_email}
                                            </p>
                                            {member.user_name && member.user_email && (
                                                <p className="text-xs text-gray-500">{member.user_email}</p>
                                            )}
                                            <p className="text-xs text-gray-400">
                                                Joined {formatDate(member.joined_at)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {/* Impact Claims Toggle */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">Impact Claims</span>
                                            <button
                                                onClick={() => handleToggleMemberPermission(member)}
                                                disabled={updatingMember === member.id}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                    member.can_add_impact_claims ? 'bg-green-500' : 'bg-gray-300'
                                                }`}
                                            >
                                                {updatingMember === member.id ? (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    </div>
                                                ) : (
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                            member.can_add_impact_claims ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                    />
                                                )}
                                            </button>
                                        </div>

                                        {/* Remove Button */}
                                        <button
                                            onClick={() => handleRemoveMember(member)}
                                            disabled={removingMember === member.id}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Remove member"
                                        >
                                            {removingMember === member.id ? (
                                                <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
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
                        <div className="p-2 bg-amber-50 rounded-xl">
                            <Mail className="w-5 h-5 text-amber-600" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-800">
                            Pending Invitations ({invitations.length})
                        </h2>
                    </div>

                    {invitations.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No pending invitations</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {invitations.map((invitation) => {
                                const isExpired = new Date(invitation.expires_at) < new Date()
                                
                                return (
                                    <div
                                        key={invitation.id}
                                        className={`flex items-center justify-between p-4 rounded-xl ${
                                            isExpired ? 'bg-red-50' : 'bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                                isExpired ? 'bg-red-100' : 'bg-amber-100'
                                            }`}>
                                                {isExpired ? (
                                                    <XCircle className="w-5 h-5 text-red-500" />
                                                ) : (
                                                    <Clock className="w-5 h-5 text-amber-500" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-medium text-gray-900">{invitation.email}</p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <span>Sent {formatDate(invitation.created_at)}</span>
                                                    <span>•</span>
                                                    <span className={isExpired ? 'text-red-500' : ''}>
                                                        {isExpired ? 'Expired' : `Expires ${formatDate(invitation.expires_at)}`}
                                                    </span>
                                                    {invitation.resend_count > 0 && (
                                                        <>
                                                            <span>•</span>
                                                            <span>Resent {invitation.resend_count}x</span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 mt-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                        invitation.can_add_impact_claims 
                                                            ? 'bg-green-100 text-green-700' 
                                                            : 'bg-gray-200 text-gray-600'
                                                    }`}>
                                                        {invitation.can_add_impact_claims ? 'Can add Impact Claims' : 'No Impact Claims'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Resend Button */}
                                            <button
                                                onClick={() => handleResendInvite(invitation)}
                                                disabled={resendingInvite === invitation.id}
                                                className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                                                title="Resend invitation"
                                            >
                                                {resendingInvite === invitation.id ? (
                                                    <div className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <RefreshCw className="w-4 h-4" />
                                                )}
                                            </button>

                                            {/* Revoke Button */}
                                            <button
                                                onClick={() => handleRevokeInvite(invitation)}
                                                disabled={revokingInvite === invitation.id}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Revoke invitation"
                                            >
                                                {revokingInvite === invitation.id ? (
                                                    <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
