import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthService } from './services/auth'
import { SubscriptionService } from './services/subscription'
import { User, SubscriptionStatus } from './types'
import { TutorialProvider } from './context/TutorialContext'
import { StorageProvider } from './context/StorageContext'
import InteractiveTutorial from './components/InteractiveTutorial'
import TrialBanner from './components/TrialBanner'
import MobileApp from './components/MobileApp'

// Pages
import HomePage from './pages/HomePage'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import InitiativePage from './pages/InitiativePage'
import AccountPage from './pages/AccountPage'
import PublicOrganizationPage from './pages/PublicOrganizationPage'
import TrialActivationPage from './pages/TrialActivationPage'
import SubscriptionExpiredPage from './pages/SubscriptionExpiredPage'
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
    const [showAuth, setShowAuth] = useState(false)
    const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
    const [checkingSubscription, setCheckingSubscription] = useState(false)
    const isMobile = useIsMobile()

    useEffect(() => {
        // Get initial user
        checkUser()

        // Listen for auth changes
        const { data: authListener } = AuthService.onAuthStateChange((user) => {
            setUser(user)
            if (user) {
                setShowAuth(false)
            } else {
                // User logged out - clear subscription status
                setSubscriptionStatus(null)
            }
        })

        return () => {
            authListener?.subscription?.unsubscribe()
        }
    }, [])

    // Check subscription when user changes
    useEffect(() => {
        if (user) {
            checkSubscription()
        } else {
            setSubscriptionStatus(null)
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

    const checkSubscription = async () => {
        if (!user) return

        setCheckingSubscription(true)
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
            setCheckingSubscription(false)
        }
    }

    const handleGetStarted = () => {
        setShowAuth(true)
    }

    const handleTrialStarted = () => {
        // Re-check subscription after trial is started
        checkSubscription()
    }

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

    // Show auth page when explicitly requested
    if (showAuth && !user) {
        return (
            <>
                <AuthPage />
                <Toaster position="top-right" />
            </>
        )
    }

    // User is logged in - check subscription status
    if (user) {
        // Still checking subscription
        if (checkingSubscription || subscriptionStatus === null) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Checking subscription...</p>
                    </div>
                </div>
            )
        }

        // User needs to activate trial (status is 'none')
        if (subscriptionStatus.subscription.status === 'none') {
            return (
                <>
                    <TrialActivationPage onTrialStarted={handleTrialStarted} />
                    <Toaster position="top-right" />
                </>
            )
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
        const isOnTrial = subscriptionStatus.subscription.status === 'trial'
        
        // Show mobile app for mobile users
        if (isMobile) {
            return (
                <Router>
                    <div className="min-h-screen" style={{ backgroundColor: '#F9FAFB' }}>
                        <StorageProvider>
                            {/* Show trial banner if on trial */}
                            {isOnTrial && (
                                <TrialBanner 
                                    remainingDays={subscriptionStatus.remainingTrialDays} 
                                />
                            )}
                            <div className={isOnTrial ? 'pt-10' : ''}>
                                <MobileApp user={user} subscriptionStatus={subscriptionStatus} />
                            </div>
                        </StorageProvider>
                        <Toaster position="top-center" />
                    </div>
                </Router>
            )
        }

        // Desktop app
        return (
            <Router>
                <StorageProvider>
                    <TutorialProvider>
                        {/* Show trial banner if on trial */}
                        {isOnTrial && (
                            <TrialBanner 
                                remainingDays={subscriptionStatus.remainingTrialDays} 
                            />
                        )}
                        
                        {/* Add top padding when banner is showing */}
                        <div className={isOnTrial ? 'pt-10' : ''}>
                            <Routes>
                                {/* Public routes - accessible without auth */}
                                <Route path="/org/:slug" element={<PublicOrganizationPage />} />
                                
                                {/* Authenticated routes */}
                                <Route path="/*" element={
                                    <Layout user={user}>
                                        <Routes>
                                            <Route index element={<Dashboard />} />
                                            <Route path="initiatives/:id" element={<InitiativePage />} />
                                            <Route path="initiatives/:id/metrics/:kpiId" element={<InitiativePage />} />
                                            <Route path="account" element={<AccountPage subscriptionStatus={subscriptionStatus} />} />
                                        </Routes>
                                    </Layout>
                                } />
                            </Routes>
                        </div>
                        <InteractiveTutorial />
                    </TutorialProvider>
                </StorageProvider>
                <Toaster position="top-right" />
            </Router>
        )
    }

    // Not logged in - show public routes and homepage
    return (
        <Router>
            <Routes>
                {/* Public routes - accessible without auth */}
                <Route path="/org/:slug" element={<PublicOrganizationPage />} />
                
                {/* Homepage for non-authenticated users */}
                <Route path="/*" element={<HomePage onGetStarted={handleGetStarted} />} />
            </Routes>
            <Toaster position="top-right" />
        </Router>
    )
}

export default App
