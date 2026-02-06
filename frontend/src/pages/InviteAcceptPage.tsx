import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { 
    Users, CheckCircle, XCircle, Clock, 
    LogIn, UserPlus
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

    // Fetch invite details with reload fallback for post-signup timing issues
    useEffect(() => {
        const fetchInvite = async (): Promise<void> => {
            if (!token) {
                setError('Invalid invitation link - no token provided')
                setLoading(false)
                return
            }

            console.log(`[InviteAcceptPage] Fetching invite with token: ${token.substring(0, 10)}... (length: ${token.length})`)
            
            // Check for post-signup flag
            const isPostSignup = sessionStorage.getItem('just_signed_up') === 'true'
            const hasReloaded = sessionStorage.getItem('invite_page_reloaded') === 'true'
            console.log(`[InviteAcceptPage] isPostSignup: ${isPostSignup}, hasReloaded: ${hasReloaded}`)

            try {
                const inviteDetails = await TeamService.getInviteDetails(token)
                console.log(`[InviteAcceptPage] Successfully fetched invite for org: ${inviteDetails.organization_name}`)
                // Clear flags on success
                sessionStorage.removeItem('just_signed_up')
                sessionStorage.removeItem('invite_page_reloaded')
                setInvite(inviteDetails)
                setLoading(false)
            } catch (err) {
                console.error(`[InviteAcceptPage] Error fetching invite:`, err)
                
                // If we haven't already reloaded, do a reload (handles post-signup timing issues)
                if (!hasReloaded) {
                    console.log(`[InviteAcceptPage] First failure, attempting page reload to fix timing issue...`)
                    sessionStorage.setItem('invite_page_reloaded', 'true')
                    sessionStorage.removeItem('just_signed_up')
                    // Wait a moment then reload
                    await new Promise(resolve => setTimeout(resolve, 500))
                    window.location.reload()
                    return
                }
                
                // Already reloaded once, show the error (it's a real invalid invite)
                console.log(`[InviteAcceptPage] Already reloaded once, showing error`)
                sessionStorage.removeItem('invite_page_reloaded')
                setError((err as Error).message)
                setLoading(false)
            }
        }
        fetchInvite()
    }, [token])

    const handleAccept = async () => {
        if (!token) return

        setAccepting(true)
        
        // Retry logic for transient serverless connection issues
        const maxRetries = 3
        let lastError: Error | null = null
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[InviteAcceptPage] Accept attempt ${attempt}/${maxRetries}`)
                const result = await TeamService.acceptInvite(token)
                toast.success(result.message || 'Welcome to the team!')
                
                // Use callback if provided, otherwise do a full page reload
                // Full reload ensures subscription status and team context are fresh
                if (onInviteAccepted) {
                    onInviteAccepted()
                } else {
                    window.location.href = '/'
                }
                return // Success, exit
            } catch (err) {
                lastError = err as Error
                console.error(`[InviteAcceptPage] Accept attempt ${attempt} failed:`, err)
                
                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    await new Promise(r => setTimeout(r, 500 * attempt))
                }
            }
        }
        
        // All retries failed
        toast.error(lastError?.message || 'Failed to accept invitation. Please try again.')
        setAccepting(false)
    }

    const brandColor = '#c0dfa1'

    const pageWrapper = (children: React.ReactNode) => (
        <div className="min-h-screen font-figtree relative">
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(ellipse 80% 50% at 20% 40%, ${brandColor}90, transparent 60%),
                        radial-gradient(ellipse 60% 80% at 80% 20%, ${brandColor}70, transparent 55%),
                        radial-gradient(ellipse 50% 60% at 60% 80%, ${brandColor}60, transparent 55%),
                        linear-gradient(180deg, white 0%, #fafafa 100%)
                    `
                }}
            />
            <div className="relative z-10 flex items-center justify-center p-4 min-h-screen">
                {children}
            </div>
        </div>
    )

    const logoHeader = () => (
        <div className="text-center mb-6">
            <div className="flex justify-center items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-lg overflow-hidden">
                    <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                </div>
                <span className="text-xl font-newsreader font-extralight text-foreground">Nexus Impacts</span>
            </div>
        </div>
    )

    // Loading state
    if (loading || checkingUser) {
        return pageWrapper(
            <div className="glass-card p-12 rounded-3xl text-center max-w-md w-full">
                {logoHeader()}
                <div className="flex items-center justify-center gap-1.5 mb-3">
                    <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '600ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '600ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '600ms' }} />
                </div>
                <p className="text-muted-foreground text-sm font-medium">Loading invitation...</p>
            </div>
        )
    }

    // Error state
    if (error || !invite) {
        return pageWrapper(
            <div className="glass-card p-8 max-w-md w-full text-center">
                {logoHeader()}
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">Invalid Invitation</h1>
                <p className="text-muted-foreground mb-6">{error || 'This invitation link is not valid.'}</p>
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-gray-800 font-medium rounded-xl transition-colors"
                >
                    Go to Homepage
                </Link>
            </div>
        )
    }

    // Expired or revoked invitation
    if (invite.status !== 'pending' || invite.is_expired) {
        const isExpired = invite.is_expired || invite.status === 'expired'
        const isRevoked = invite.status === 'revoked'
        const isAccepted = invite.status === 'accepted'

        return pageWrapper(
            <div className="glass-card p-8 max-w-md w-full text-center">
                {logoHeader()}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isAccepted ? 'bg-primary-500/30' : 'bg-amber-100'}`}>
                    {isAccepted ? (
                        <CheckCircle className="w-8 h-8 text-primary-500" />
                    ) : isExpired ? (
                        <Clock className="w-8 h-8 text-amber-500" />
                    ) : (
                        <XCircle className="w-8 h-8 text-amber-500" />
                    )}
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                    {isAccepted ? 'Already Accepted' : isExpired ? 'Invitation Expired' : 'Invitation Revoked'}
                </h1>
                <p className="text-muted-foreground mb-6">
                    {isAccepted
                        ? 'This invitation has already been accepted. You can log in to access the organization.'
                        : isExpired
                            ? 'This invitation has expired. Please contact the organization owner for a new invitation.'
                            : 'This invitation has been revoked by the organization owner.'}
                </p>
                <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-gray-800 font-medium rounded-xl transition-colors"
                >
                    <LogIn className="w-4 h-4" />
                    Go to Login
                </Link>
            </div>
        )
    }

    // Valid pending invitation
    return pageWrapper(
        <div className="glass-card p-8 max-w-md w-full">
            {logoHeader()}
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary-500/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary-500/40">
                    <Users className="w-8 h-8 text-primary-500" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">You're Invited!</h1>
                <p className="text-muted-foreground">
                    {invite.inviter_name || invite.inviter_email} has invited you to join
                </p>
            </div>

            <div className="bg-white/40 backdrop-blur rounded-xl border border-white/60 p-4 mb-6">
                <h2 className="text-lg font-semibold text-foreground text-center">
                    {invite.organization_name}
                </h2>
            </div>

            <div className="space-y-3 mb-6">
                <h3 className="text-sm font-medium text-foreground">What you'll be able to do:</h3>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-primary-500 flex-shrink-0" />
                        <span>View all initiatives, KPIs, and evidence</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle className="w-4 h-4 text-primary-500 flex-shrink-0" />
                        <span>Create and edit data</span>
                    </div>
                    {invite.can_add_impact_claims ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="w-4 h-4 text-primary-500 flex-shrink-0" />
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

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/40 rounded-xl p-3 mb-6 border border-white/60">
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span>
                    This invitation expires on {new Date(invite.expires_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                    })}
                </span>
            </div>

            {user ? (
                <div className="space-y-3">
                    <div className="text-center text-sm text-muted-foreground mb-2">
                        Logged in as <strong className="text-foreground">{user.email}</strong>
                    </div>
                    <button
                        onClick={handleAccept}
                        disabled={accepting}
                        className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-gray-800 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {accepting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" />
                                Joining...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                Accept Invitation
                            </>
                        )}
                    </button>
                    <p className="text-center text-xs text-muted-foreground">
                        Not {user.email}?{' '}
                        <button
                            type="button"
                            onClick={async () => {
                                await AuthService.signOut()
                                window.location.reload()
                            }}
                            className="text-primary-500 hover:text-primary-600 font-medium"
                        >
                            Sign out
                        </button>
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <Link
                        to={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                        className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-gray-800 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <LogIn className="w-4 h-4" />
                        Log In to Accept
                    </Link>
                    <div className="text-center text-sm text-muted-foreground">
                        Don't have an account?
                    </div>
                    <Link
                        to={`/login?signup=true&redirect=${encodeURIComponent(`/invite/${token}`)}`}
                        className="w-full px-6 py-3 bg-white/60 hover:bg-white/80 text-foreground font-medium rounded-xl border border-white/80 transition-colors flex items-center justify-center gap-2"
                    >
                        <UserPlus className="w-4 h-4" />
                        Sign Up to Accept
                    </Link>
                </div>
            )}
        </div>
    )
}
