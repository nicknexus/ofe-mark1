import React, { useState, useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthService } from './services/auth'
import { SubscriptionService } from './services/subscription'
import { TeamService, PendingInviteCheck } from './services/team'
import { User, SubscriptionStatus } from './types'
import { TutorialProvider } from './context/TutorialContext'
import { StorageProvider } from './context/StorageContext'
import { TeamProvider } from './context/TeamContext'
import InteractiveTutorial from './components/InteractiveTutorial'
import TrialBanner from './components/TrialBanner'
import MobileApp from './components/MobileApp'
import { isStandalone as checkStandalone } from './utils/pwa'
import { useVersionCheck } from './hooks/useVersionCheck'
import PWALoadingScreen from './components/pwa/PWALoadingScreen'
import PWAAuthPage from './components/pwa/PWAAuthPage'
import InstallPrompt from './components/pwa/InstallPrompt'
import UpdateBanner from './components/pwa/UpdateBanner'

// Pages
import HomePage from './pages/HomePage'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import InitiativePage from './pages/InitiativePage'
import AccountPage from './pages/AccountPage'
import PublicOrganizationPage from './pages/PublicOrganizationPage'
import PublicInitiativePage from './pages/PublicInitiativePage'
import PublicMetricPage from './pages/PublicMetricPage'
import PublicStoryPage from './pages/PublicStoryPage'
import PublicEvidencePage from './pages/PublicEvidencePage'
import PublicImpactClaimPage from './pages/PublicImpactClaimPage'
import ExplorePage from './pages/ExplorePage'
import TrialActivationPage from './pages/TrialActivationPage'
import SubscriptionExpiredPage from './pages/SubscriptionExpiredPage'
import TeamSettingsPage from './pages/TeamSettingsPage'
import InviteAcceptPage from './pages/InviteAcceptPage'
import TermsOfServicePage from './pages/TermsOfServicePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import Layout from './components/Layout'

// Hook to detect mobile
function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() => {
        // Initialize with actual value to prevent flash
        if (typeof window !== 'undefined') {
            return window.innerWidth < 768
        }
        return false
    })

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    return isMobile
}

function App() {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
    const [checkingSubscription, setCheckingSubscription] = useState(false)
    const [pendingInvite, setPendingInvite] = useState<PendingInviteCheck | null>(null)
    const [checkingPendingInvite, setCheckingPendingInvite] = useState(false)
    const isMobile = useIsMobile()
    const standalone = checkStandalone()
    const { updateAvailable, dismiss: dismissUpdate, refresh: refreshApp } = useVersionCheck()
    const checkedUserIdRef = useRef<string | null>(null)

    useEffect(() => {
        // Get initial user
        checkUser()

        // Listen for auth changes
        const { data: authListener } = AuthService.onAuthStateChange((user) => {
            setUser(user)
            if (!user) {
                // User logged out - clear subscription status
                setSubscriptionStatus(null)
            }
        })

        return () => {
            authListener?.subscription?.unsubscribe()
        }
    }, [])

    // Check subscription when user changes (only once per user)
    useEffect(() => {
        if (user) {
            // Only do a blocking check if this is a new user we haven't checked yet
            if (checkedUserIdRef.current !== user.id) {
                checkedUserIdRef.current = user.id
                checkSubscription(true) // blocking check
            }
        } else {
            setSubscriptionStatus(null)
            checkedUserIdRef.current = null
        }
    }, [user])

    const checkUser = async () => {
        try {
            const currentUser = await AuthService.getCurrentUser()
            setUser(currentUser)
        } catch (error) {
            console.error('Error checking user:', error)
        } finally {
            setLoading(false)
        }
    }

    const checkSubscription = async (showLoader = false) => {
        if (!user) return

        // Only show blocking loader on initial check
        if (showLoader) {
            setCheckingSubscription(true)
        }
        try {
            const status = await SubscriptionService.getStatus()
            setSubscriptionStatus(status)
        } catch (error) {
            console.error('Error checking subscription:', error)
            // On error, create a default status that allows access
            // This prevents locking users out if the subscription check fails
            setSubscriptionStatus({
                hasAccess: false,
                reason: 'error',
                subscription: {
                    id: '',
                    user_id: user.id,
                    status: 'none',
                    created_at: '',
                    updated_at: ''
                },
                remainingTrialDays: null
            })
        } finally {
            if (showLoader) {
                setCheckingSubscription(false)
            }
        }
    }

    const handleTrialStarted = () => {
        // Re-check subscription after trial is started (show loader since user expects it)
        checkSubscription(true)
    }

    // Shared public routes fragment used in multiple render branches
    const publicRoutes = (
        <>
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/org/:slug" element={<PublicOrganizationPage />} />
            <Route path="/org/:orgSlug/:initiativeSlug" element={<PublicInitiativePage />} />
            <Route path="/org/:orgSlug/:initiativeSlug/metric/:metricSlug" element={<PublicMetricPage />} />
            <Route path="/org/:orgSlug/:initiativeSlug/claim/:claimId" element={<PublicImpactClaimPage />} />
            <Route path="/org/:orgSlug/:initiativeSlug/story/:storyId" element={<PublicStoryPage />} />
            <Route path="/org/:orgSlug/:initiativeSlug/evidence/:evidenceId" element={<PublicEvidencePage />} />
        </>
    )

    // ─── PWA STANDALONE MODE ───────────────────────────────────────────
    if (standalone) {
        if (loading) return <PWALoadingScreen />

        if (!user) {
            return (
                <Router>
                    <Routes>
                        {publicRoutes}
                        <Route path="/invite/:token" element={<InviteAcceptPage />} />
                        <Route path="/*" element={
                            <PWAAuthPage onAuthSuccess={() => window.location.reload()} />
                        } />
                    </Routes>
                    <Toaster position="top-center" />
                </Router>
            )
        }

        // Gate: Terms of Service
        if (!user.accepted_terms_of_service) {
            return (
                <>
                    <TermsOfServicePage onAccepted={async () => {
                        const updatedUser = await AuthService.getCurrentUser()
                        if (updatedUser) setUser(updatedUser)
                    }} />
                    <Toaster position="top-center" />
                </>
            )
        }

        // Gate: Subscription check loading
        if (checkingSubscription && subscriptionStatus === null) {
            return <PWALoadingScreen />
        }
        if (subscriptionStatus === null) {
            checkSubscription(true)
            return <PWALoadingScreen />
        }

        // Gate: No subscription — check for pending invites / trial
        if (subscriptionStatus.subscription.status === 'none' && !subscriptionStatus.hasAccess) {
            if (pendingInvite === null && !checkingPendingInvite) {
                setCheckingPendingInvite(true)
                TeamService.checkMyPendingInvite()
                    .then(result => setPendingInvite(result))
                    .catch(() => setPendingInvite({ hasPendingInvite: false }))
                    .finally(() => setCheckingPendingInvite(false))
                return <PWALoadingScreen />
            }
            if (checkingPendingInvite) return <PWALoadingScreen />

            if (pendingInvite?.hasPendingInvite && pendingInvite.inviteToken) {
                return (
                    <Router>
                        <Routes>
                            <Route path="/invite/:token" element={<InviteAcceptPage onInviteAccepted={() => { window.location.href = '/' }} />} />
                            <Route path="*" element={<Navigate to={`/invite/${pendingInvite.inviteToken}`} replace />} />
                        </Routes>
                        <Toaster position="top-center" />
                    </Router>
                )
            }

            return (
                <>
                    <TrialActivationPage onTrialStarted={handleTrialStarted} />
                    <Toaster position="top-center" />
                </>
            )
        }

        // Gate: Subscription expired
        if (!subscriptionStatus.hasAccess) {
            return (
                <>
                    <SubscriptionExpiredPage
                        reason={subscriptionStatus.reason}
                        remainingDays={subscriptionStatus.remainingTrialDays}
                    />
                    <Toaster position="top-center" />
                </>
            )
        }

        // All gates passed — render PWA app
        const isOnTrial = subscriptionStatus.subscription.status === 'trial' && (subscriptionStatus.remainingTrialDays ?? 0) > 0
        const bannerDismissed = localStorage.getItem('nexus-trial-banner-dismissed') === 'true'
        const showTrialBanner = isOnTrial && !bannerDismissed

        return (
            <Router>
                <div className="min-h-screen" style={{ backgroundColor: '#F9FAFB' }}>
                    <StorageProvider>
                        <TeamProvider>
                            {showTrialBanner && (
                                <TrialBanner remainingDays={subscriptionStatus.remainingTrialDays} />
                            )}
                            <Routes>
                                {publicRoutes}
                                <Route path="/*" element={
                                    <MobileApp user={user} subscriptionStatus={subscriptionStatus} />
                                } />
                            </Routes>
                            {updateAvailable && <UpdateBanner onRefresh={refreshApp} onDismiss={dismissUpdate} />}
                        </TeamProvider>
                    </StorageProvider>
                    <Toaster position="top-center" />
                </div>
            </Router>
        )
    }

    // ─── BROWSER MODE ──────────────────────────────────────────────────

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        )
    }

    // User is logged in - check terms of service, then subscription status
    if (user) {
        // Gate on Terms of Service acceptance before anything else
        if (!user.accepted_terms_of_service) {
            return (
                <>
                    <TermsOfServicePage onAccepted={async () => {
                        const updatedUser = await AuthService.getCurrentUser()
                        if (updatedUser) setUser(updatedUser)
                    }} />
                    <Toaster position="top-right" />
                </>
            )
        }

        // Check if user is trying to access an invite page - always allow this
        const isOnInvitePage = window.location.pathname.startsWith('/invite/')

        // Only show blocking loader on initial subscription check (unless on invite page)
        if (checkingSubscription && subscriptionStatus === null && !isOnInvitePage) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Checking subscription...</p>
                    </div>
                </div>
            )
        }

        // If on invite page, let them through immediately to accept the invite
        if (isOnInvitePage) {
            return (
                <Router>
                    <Routes>
                        <Route
                            path="/invite/:token"
                            element={<InviteAcceptPage onInviteAccepted={() => {
                                window.location.href = '/'
                            }} />}
                        />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                    <Toaster position="top-right" />
                </Router>
            )
        }

        // If we have no subscription status yet and not checking, something's wrong - trigger check
        if (subscriptionStatus === null) {
            checkSubscription(true)
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Checking subscription...</p>
                    </div>
                </div>
            )
        }

        // User has no own subscription (status is 'none') but might have inherited access
        // or a pending team invitation
        if (subscriptionStatus.subscription.status === 'none') {
            if (subscriptionStatus.hasAccess) {
                // They have inherited access - let them through to the app
            } else {
                if (pendingInvite === null && !checkingPendingInvite) {
                    setCheckingPendingInvite(true)
                    TeamService.checkMyPendingInvite()
                        .then(result => {
                            setPendingInvite(result)
                        })
                        .catch(() => {
                            setPendingInvite({ hasPendingInvite: false })
                        })
                        .finally(() => {
                            setCheckingPendingInvite(false)
                        })

                    return (
                        <div className="min-h-screen flex items-center justify-center bg-gray-50">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                                <p className="mt-4 text-gray-600">Checking account...</p>
                            </div>
                        </div>
                    )
                }

                if (checkingPendingInvite) {
                    return (
                        <div className="min-h-screen flex items-center justify-center bg-gray-50">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                                <p className="mt-4 text-gray-600">Checking account...</p>
                            </div>
                        </div>
                    )
                }

                if (pendingInvite?.hasPendingInvite && pendingInvite.inviteToken) {
                    return (
                        <Router>
                            <Routes>
                                <Route
                                    path="/invite/:token"
                                    element={<InviteAcceptPage onInviteAccepted={() => {
                                        window.location.href = '/'
                                    }} />}
                                />
                                <Route
                                    path="*"
                                    element={<Navigate to={`/invite/${pendingInvite.inviteToken}`} replace />}
                                />
                            </Routes>
                            <Toaster position="top-right" />
                        </Router>
                    )
                }

                return (
                    <>
                        <TrialActivationPage onTrialStarted={handleTrialStarted} />
                        <Toaster position="top-right" />
                    </>
                )
            }
        }

        // User subscription expired or cancelled
        if (!subscriptionStatus.hasAccess) {
            return (
                <>
                    <SubscriptionExpiredPage
                        reason={subscriptionStatus.reason}
                        remainingDays={subscriptionStatus.remainingTrialDays}
                    />
                    <Toaster position="top-right" />
                </>
            )
        }

        // User has access - show the app
        const isOnTrial = subscriptionStatus.subscription.status === 'trial' && (subscriptionStatus.remainingTrialDays ?? 0) > 0
        const bannerDismissed = localStorage.getItem('nexus-trial-banner-dismissed') === 'true'
        const showTrialBanner = isOnTrial && !bannerDismissed

        // Mobile browser: show install gate (prod only, skip in dev for testing)
        if (isMobile && import.meta.env.PROD) {
            return <InstallPrompt onLogout={async () => {
                await AuthService.signOut()
                setUser(null)
            }} />
        }

        // Mobile in dev mode: bypass install gate for testing
        if (isMobile) {
            return (
                <Router>
                    <div className="min-h-screen" style={{ backgroundColor: '#F9FAFB' }}>
                        <StorageProvider>
                            <TeamProvider>
                                {showTrialBanner && (
                                    <TrialBanner
                                        remainingDays={subscriptionStatus.remainingTrialDays}
                                    />
                                )}
                                <Routes>
                                    {publicRoutes}
                                    <Route path="/*" element={
                                        <MobileApp user={user} subscriptionStatus={subscriptionStatus} />
                                    } />
                                </Routes>
                            </TeamProvider>
                        </StorageProvider>
                        <Toaster position="top-center" />
                    </div>
                </Router>
            )
        }

        // Desktop app (completely unchanged)
        return (
            <Router>
                <StorageProvider>
                    <TeamProvider>
                        <TutorialProvider>
                            {showTrialBanner && (
                                <TrialBanner
                                    remainingDays={subscriptionStatus.remainingTrialDays}
                                />
                            )}

                            <Routes>
                                {publicRoutes}

                                {/* Invite acceptance page */}
                                <Route path="/invite/:token" element={<InviteAcceptPage />} />

                                {/* Authenticated routes */}
                                <Route path="/*" element={
                                    <Layout user={user}>
                                        <Routes>
                                            <Route index element={<Dashboard />} />
                                            <Route path="initiatives/:id" element={<InitiativePage />} />
                                            <Route path="initiatives/:id/metrics/:kpiId" element={<InitiativePage />} />
                                            <Route path="account" element={<AccountPage subscriptionStatus={subscriptionStatus} />} />
                                            <Route path="settings/team" element={<TeamSettingsPage />} />
                                            <Route path="*" element={<Navigate to="/" replace />} />
                                        </Routes>
                                    </Layout>
                                } />
                            </Routes>
                            <InteractiveTutorial />
                        </TutorialProvider>
                    </TeamProvider>
                </StorageProvider>
                <Toaster position="top-right" />
            </Router>
        )
    }

    // Not logged in - show public routes and homepage
    return (
        <Router>
            <Routes>
                {publicRoutes}

                {/* Invite acceptance page (accessible without login) */}
                <Route path="/invite/:token" element={<InviteAcceptPage />} />

                {/* Login/Auth page */}
                <Route path="/login" element={<AuthPage />} />

                {/* Homepage for non-authenticated users */}
                <Route path="/*" element={<HomePage />} />
            </Routes>
            <Toaster position="top-right" />
        </Router>
    )
}

export default App
