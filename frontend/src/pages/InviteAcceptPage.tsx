import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
    Users, CheckCircle, XCircle, Clock,
    LogIn, UserPlus, ArrowLeft, Mail, ArrowRight
} from 'lucide-react'
import { TeamService, InviteDetails } from '../services/team'
import { formatDate } from '../utils'
import { AuthService } from '../services/auth'
import { supabase } from '../services/supabase'
import MarketingPageShell, { MarketingLogoHeader } from '../components/MarketingPageShell'
import toast from 'react-hot-toast'

interface InviteAcceptPageProps {
    onInviteAccepted?: () => void
}

type Mode = 'choose' | 'login' | 'signup'

// Module-level (survives remounts within a single page load). Once we've forced a
// sign-out for a given invite, we don't do it again — otherwise the app re-rendering
// after the user signs in/up here would immediately sign them back out mid-accept.
const forcedSignOutTokens = new Set<string>()

export default function InviteAcceptPage({ onInviteAccepted }: InviteAcceptPageProps = {}) {
    const { token } = useParams<{ token: string }>()

    const [invite, setInvite] = useState<InviteDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [ready, setReady] = useState(false)
    const [declined, setDeclined] = useState(false)

    const [mode, setMode] = useState<Mode>('choose')
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [declining, setDeclining] = useState(false)

    // Force a logged-out state the moment we land here, no matter who is logged in
    // on this browser. The invitation is for a specific email, so we never want a
    // stray admin session to leak into the accept flow. Guarded module-level so it
    // runs once per page load, not on every remount (which would log the user back
    // out right after they sign in/up to accept).
    useEffect(() => {
        const key = token || '__no_token__'
        if (forcedSignOutTokens.has(key)) {
            setReady(true)
            return
        }
        forcedSignOutTokens.add(key)
        ;(async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (session) await supabase.auth.signOut()
            } catch (err) {
                console.warn('[InviteAcceptPage] forced sign-out failed:', err)
            } finally {
                setReady(true)
            }
        })()
    }, [token])

    // Fetch invite details once we're signed out.
    useEffect(() => {
        if (!ready) return
        let cancelled = false

        ;(async () => {
            if (!token) {
                setError('Invalid invitation link — no token provided')
                setLoading(false)
                return
            }
            try {
                const details = await TeamService.getInviteDetails(token)
                if (cancelled) return
                setInvite(details)
            } catch (err) {
                if (!cancelled) setError((err as Error).message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()

        return () => { cancelled = true }
    }, [ready, token])

    const handleAccept = async (reload = true) => {
        if (!token) return
        // Refresh so the just-created session token is current before accepting.
        try { await supabase.auth.refreshSession() } catch (_) { /* continue */ }

        const maxRetries = 3
        let lastError: Error | null = null
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await TeamService.acceptInvite(token)
                toast.success(result.message || 'Welcome to the team!')
                if (onInviteAccepted) onInviteAccepted()
                else if (reload) window.location.href = '/'
                return
            } catch (err) {
                lastError = err as Error
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 800 * attempt))
                    try { await supabase.auth.refreshSession() } catch (_) { /* ignore */ }
                }
            }
        }
        throw lastError || new Error('Failed to accept invitation')
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!invite) return
        setSubmitting(true)
        try {
            await AuthService.signIn(invite.email, password)
            await handleAccept()
        } catch (err) {
            toast.error((err as Error).message || 'Could not sign in')
            setSubmitting(false)
        }
    }

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!invite) return
        if (password.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }
        setSubmitting(true)
        try {
            // No organizationName — invited users join via the team, not a new org.
            await AuthService.signUp(invite.email, password, name)
            // Brand-new users hit the Terms-of-Service gate next, which unmounts the
            // router. Move off the /invite URL now so that once Terms is accepted the
            // app boots straight to the dashboard (loader → dashboard) instead of
            // briefly re-rendering this invite page. No hard reload — the Terms flow
            // drives the rest.
            window.history.replaceState({}, '', '/')
            await handleAccept(false)
        } catch (err) {
            toast.error((err as Error).message || 'Could not create account')
            setSubmitting(false)
        }
    }

    const handleDecline = async () => {
        if (!token) return
        setDeclining(true)
        try {
            await TeamService.declineInvite(token)
            setDeclined(true)
        } catch (err) {
            toast.error((err as Error).message || 'Could not decline invitation')
        } finally {
            setDeclining(false)
        }
    }

    const pageWrapper = (children: React.ReactNode, contentClassName = 'max-w-md w-full space-y-6') => (
        <MarketingPageShell
            contentClassName={contentClassName}
            centerClassName="flex items-center justify-center p-4 sm:p-6 min-h-screen"
        >
            {children}
        </MarketingPageShell>
    )

    const logoHeader = () => (
        <div className="text-center mb-6">
            <MarketingLogoHeader />
        </div>
    )

    // ── Loading ────────────────────────────────────────────────────────────
    if (!ready || loading) {
        return pageWrapper(
            <div className="glass-card p-12 rounded-3xl text-center w-full">
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

    // ── Declined confirmation ──────────────────────────────────────────────
    if (declined) {
        return pageWrapper(
            <div className="glass-card p-8 w-full text-center">
                {logoHeader()}
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-8 h-8 text-gray-400" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">Invitation Declined</h1>
                <p className="text-muted-foreground mb-6">
                    No problem — you won't be added to {invite?.organization_name || 'the organization'}.
                </p>
                <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-gray-800 font-medium rounded-xl transition-colors">
                    Go to Homepage
                </Link>
            </div>
        )
    }

    // ── Error ──────────────────────────────────────────────────────────────
    if (error || !invite) {
        return pageWrapper(
            <div className="glass-card p-8 w-full text-center">
                {logoHeader()}
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">Invalid Invitation</h1>
                <p className="text-muted-foreground mb-6">{error || 'This invitation link is not valid.'}</p>
                <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-gray-800 font-medium rounded-xl transition-colors">
                    Go to Homepage
                </Link>
            </div>
        )
    }

    // ── Expired / revoked / accepted / declined (terminal) ─────────────────
    if (invite.status !== 'pending' || invite.is_expired) {
        const isExpired = invite.is_expired || invite.status === 'expired'
        const isAccepted = invite.status === 'accepted'
        const isDeclined = invite.status === 'declined'
        const title = isAccepted ? 'Already Accepted' : isExpired ? 'Invitation Expired' : isDeclined ? 'Invitation Declined' : 'Invitation Revoked'
        const message = isAccepted
            ? 'This invitation has already been accepted. You can log in to access the organization.'
            : isExpired
                ? 'This invitation has expired. Please contact the organization owner for a new invitation.'
                : isDeclined
                    ? 'This invitation was declined. Contact the organization owner if you change your mind.'
                    : 'This invitation has been revoked by the organization owner.'

        return pageWrapper(
            <div className="glass-card p-8 w-full text-center">
                {logoHeader()}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isAccepted ? 'bg-primary-500/30' : 'bg-amber-100'}`}>
                    {isAccepted ? <CheckCircle className="w-8 h-8 text-primary-500" /> : isExpired ? <Clock className="w-8 h-8 text-amber-500" /> : <XCircle className="w-8 h-8 text-amber-500" />}
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">{title}</h1>
                <p className="text-muted-foreground mb-6">{message}</p>
                <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-500 hover:bg-primary-600 text-gray-800 font-medium rounded-xl transition-colors">
                    <LogIn className="w-4 h-4" />
                    Go to Login
                </Link>
            </div>
        )
    }

    // ── CHOOSE: full-width, two big side-by-side cards ─────────────────────
    if (mode === 'choose') {
        return pageWrapper(
            <div className="w-full">
                {logoHeader()}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary-500/30 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary-500/40">
                        <Users className="w-8 h-8 text-primary-500" />
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-semibold text-foreground mb-1">You're invited to join</h1>
                    <p className="text-2xl sm:text-3xl font-bold text-primary-600 mb-4">{invite.organization_name}</p>
                    <div className="inline-flex items-center justify-center gap-2 text-sm bg-white/50 rounded-full px-4 py-2 border border-white/70">
                        <Mail className="w-4 h-4 text-primary-500 flex-shrink-0" />
                        <span className="text-muted-foreground">Invitation for</span>
                        <strong className="text-foreground break-all">{invite.email}</strong>
                    </div>
                </div>

                <p className="text-center text-base font-medium text-foreground mb-4">How would you like to continue?</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {/* New user */}
                    <button
                        type="button"
                        onClick={() => setMode('signup')}
                        className="group text-left rounded-2xl border-2 border-primary-300 bg-primary-50/60 hover:bg-primary-50 hover:border-primary-400 hover:shadow-lg transition-all p-7 sm:p-8 flex flex-col"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-primary-500 flex items-center justify-center mb-5">
                            <UserPlus className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">I'm new here</h2>
                        <p className="text-sm text-muted-foreground mb-6 flex-1">
                            I don't have a Nexus account yet. Create one to join {invite.organization_name}.
                        </p>
                        <span className="inline-flex items-center gap-2 text-primary-700 font-semibold">
                            Create an account
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </span>
                    </button>

                    {/* Existing user */}
                    <button
                        type="button"
                        onClick={() => setMode('login')}
                        className="group text-left rounded-2xl border-2 border-gray-200 bg-white/70 hover:bg-white hover:border-gray-300 hover:shadow-lg transition-all p-7 sm:p-8 flex flex-col"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-5">
                            <LogIn className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">I have an account</h2>
                        <p className="text-sm text-muted-foreground mb-6 flex-1">
                            I already use Nexus. Sign in with my existing account to join {invite.organization_name}.
                        </p>
                        <span className="inline-flex items-center gap-2 text-gray-800 font-semibold">
                            Sign in
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </span>
                    </button>
                </div>

                <div className="flex flex-col items-center gap-3 mt-8">
                    <button
                        type="button"
                        onClick={handleDecline}
                        disabled={declining}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        {declining ? 'Declining...' : 'No thanks, decline this invitation'}
                    </button>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Expires {formatDate(invite.expires_at, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                </div>
            </div>,
            'max-w-3xl w-full'
        )
    }

    // ── LOGIN / SIGNUP forms (narrow card) ─────────────────────────────────
    const lockedEmailField = (
        <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email</label>
            <input
                type="email"
                value={invite.email}
                readOnly
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-100 text-sm text-muted-foreground cursor-not-allowed"
            />
        </div>
    )

    const passwordField = (autoComplete: string) => (
        <div>
            <label className="block text-sm font-medium text-foreground mb-1">Password</label>
            <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={autoComplete}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 bg-white/80 text-sm"
                placeholder={autoComplete === 'new-password' ? 'Create a password (min 6 chars)' : 'Enter your password'}
                required
                minLength={6}
            />
        </div>
    )

    return pageWrapper(
        <div className="glass-card p-8 w-full">
            <button
                type="button"
                onClick={() => { setMode('choose'); setPassword(''); setName('') }}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
            >
                <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-6">
                <div className="w-14 h-14 bg-primary-500/30 rounded-full flex items-center justify-center mx-auto mb-3 border border-primary-500/40">
                    {mode === 'signup' ? <UserPlus className="w-7 h-7 text-primary-500" /> : <LogIn className="w-7 h-7 text-primary-500" />}
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-1">
                    {mode === 'signup' ? 'Create your account' : 'Sign in to join'}
                </h1>
                <p className="text-sm text-muted-foreground">to join {invite.organization_name}</p>
            </div>

            {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                    {lockedEmailField}
                    {passwordField('current-password')}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-gray-800 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {submitting ? (
                            <><div className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" /> Joining...</>
                        ) : (
                            <><LogIn className="w-4 h-4" /> Log in & join</>
                        )}
                    </button>
                    <p className="text-center text-xs text-muted-foreground">
                        Forgot your password?{' '}
                        <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium">Reset it here</Link>
                    </p>
                </form>
            )}

            {mode === 'signup' && (
                <form onSubmit={handleSignup} className="space-y-4">
                    {lockedEmailField}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Your name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoComplete="name"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 bg-white/80 text-sm"
                            placeholder="Jane Doe"
                            required
                        />
                    </div>
                    {passwordField('new-password')}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-gray-800 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {submitting ? (
                            <><div className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" /> Creating account...</>
                        ) : (
                            <><UserPlus className="w-4 h-4" /> Create account & join</>
                        )}
                    </button>
                </form>
            )}
        </div>
    )
}
