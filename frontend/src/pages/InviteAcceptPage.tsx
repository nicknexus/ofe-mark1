import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
    Users, CheckCircle, XCircle, Clock, AlertCircle, 
    LogIn, UserPlus, ArrowRight, FileText
} from 'lucide-react'
import { TeamService, InviteDetails } from '../services/team'
import { AuthService } from '../services/auth'
import { User } from '../types'
import toast from 'react-hot-toast'

interface InviteAcceptPageProps {
    onInviteAccepted?: () => void
}

export default function InviteAcceptPage({ onInviteAccepted }: InviteAcceptPageProps = {}) {
    const { token } = useParams<{ token: string }>()
    const navigate = useNavigate()
    
    const [invite, setInvite] = useState<InviteDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [checkingUser, setCheckingUser] = useState(true)
    const [accepting, setAccepting] = useState(false)

    // Log token on mount for debugging
    useEffect(() => {
        console.log(`[InviteAcceptPage] Mounted with URL: ${window.location.href}`)
        console.log(`[InviteAcceptPage] Token from params: ${token}`)
    }, [token])

    // Check if user is logged in
    useEffect(() => {
        const checkUser = async () => {
            try {
                const currentUser = await AuthService.getCurrentUser()
                setUser(currentUser)
            } catch (err) {
                console.error('Error checking user:', err)
            } finally {
                setCheckingUser(false)
            }
        }
        checkUser()
    }, [])

    // Fetch invite details
    useEffect(() => {
        const fetchInvite = async () => {
            if (!token) {
                setError('Invalid invitation link - no token provided')
                setLoading(false)
                return
            }

            console.log(`[InviteAcceptPage] Fetching invite with token: ${token.substring(0, 10)}... (length: ${token.length})`)

            try {
                const inviteDetails = await TeamService.getInviteDetails(token)
                console.log(`[InviteAcceptPage] Successfully fetched invite for org: ${inviteDetails.organization_name}`)
                setInvite(inviteDetails)
            } catch (err) {
                console.error(`[InviteAcceptPage] Error fetching invite:`, err)
                setError((err as Error).message)
            } finally {
                setLoading(false)
            }
        }
        fetchInvite()
    }, [token])

    const handleAccept = async () => {
        if (!token) return

        setAccepting(true)
        try {
            const result = await TeamService.acceptInvite(token)
            toast.success(result.message || 'Welcome to the team!')
            
            // Use callback if provided, otherwise do a full page reload
            // Full reload ensures subscription status and team context are fresh
            if (onInviteAccepted) {
                onInviteAccepted()
            } else {
                window.location.href = '/'
            }
        } catch (err) {
            toast.error((err as Error).message)
            setAccepting(false)
        }
    }

    // Loading state
    if (loading || checkingUser) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-purple-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading invitation...</p>
                </div>
            </div>
        )
    }

    // Error state
    if (error || !invite) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <XCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
                    <p className="text-gray-600 mb-6">{error || 'This invitation link is not valid.'}</p>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                    >
                        Go to Homepage
                    </Link>
                </div>
            </div>
        )
    }

    // Expired or revoked invitation
    if (invite.status !== 'pending' || invite.is_expired) {
        const isExpired = invite.is_expired || invite.status === 'expired'
        const isRevoked = invite.status === 'revoked'
        const isAccepted = invite.status === 'accepted'

        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-slate-100 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                        isAccepted ? 'bg-green-100' : 'bg-amber-100'
                    }`}>
                        {isAccepted ? (
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        ) : isExpired ? (
                            <Clock className="w-8 h-8 text-amber-500" />
                        ) : (
                            <XCircle className="w-8 h-8 text-amber-500" />
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        {isAccepted ? 'Already Accepted' : isExpired ? 'Invitation Expired' : 'Invitation Revoked'}
                    </h1>
                    <p className="text-gray-600 mb-6">
                        {isAccepted 
                            ? 'This invitation has already been accepted. You can log in to access the organization.'
                            : isExpired 
                                ? 'This invitation has expired. Please contact the organization owner for a new invitation.'
                                : 'This invitation has been revoked by the organization owner.'}
                    </p>
                    <Link
                        to="/login"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors"
                    >
                        <LogIn className="w-4 h-4" />
                        Go to Login
                    </Link>
                </div>
            </div>
        )
    }

    // Valid pending invitation
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-purple-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-primary-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">You're Invited!</h1>
                    <p className="text-gray-600">
                        {invite.inviter_name || invite.inviter_email} has invited you to join
                    </p>
                </div>

                {/* Organization Info */}
                <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-xl p-4 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 text-center">
                        {invite.organization_name}
                    </h2>
                </div>

                {/* Permissions Info */}
                <div className="space-y-3 mb-6">
                    <h3 className="text-sm font-medium text-gray-700">What you'll be able to do:</h3>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span>View all initiatives, KPIs, and evidence</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span>Create and edit data</span>
                        </div>
                        {invite.can_add_impact_claims ? (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                <span>Create Impact Claims (stories)</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <XCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                <span>Impact Claims (not enabled for this invite)</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Expiry Notice */}
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg mb-6">
                    <Clock className="w-4 h-4 flex-shrink-0" />
                    <span>
                        This invitation expires on {new Date(invite.expires_at).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                        })}
                    </span>
                </div>

                {/* Action Buttons */}
                {user ? (
                    // User is logged in - show accept button
                    <div className="space-y-3">
                        <div className="text-center text-sm text-gray-600 mb-2">
                            Logged in as <strong>{user.email}</strong>
                        </div>
                        <button
                            onClick={handleAccept}
                            disabled={accepting}
                            className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {accepting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Joining...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    Accept Invitation
                                </>
                            )}
                        </button>
                        <p className="text-center text-xs text-gray-500">
                            Not {user.email}?{' '}
                            <button 
                                onClick={async () => {
                                    await AuthService.signOut()
                                    window.location.reload()
                                }}
                                className="text-primary-600 hover:underline"
                            >
                                Sign out
                            </button>
                        </p>
                    </div>
                ) : (
                    // User not logged in - show login/signup options
                    <div className="space-y-3">
                        <Link
                            to={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                            className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <LogIn className="w-4 h-4" />
                            Log In to Accept
                        </Link>
                        <div className="text-center text-sm text-gray-500">
                            Don't have an account?
                        </div>
                        <Link
                            to={`/login?signup=true&redirect=${encodeURIComponent(`/invite/${token}`)}`}
                            className="w-full px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <UserPlus className="w-4 h-4" />
                            Sign Up
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
