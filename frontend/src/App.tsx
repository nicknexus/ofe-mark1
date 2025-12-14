import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthService } from './services/auth'
import { User } from './types'
import { TutorialProvider } from './context/TutorialContext'
import InteractiveTutorial from './components/InteractiveTutorial'

// Pages
import HomePage from './pages/HomePage'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import InitiativePage from './pages/InitiativePage'
import AccountPage from './pages/AccountPage'
import PublicOrganizationPage from './pages/PublicOrganizationPage'
import Layout from './components/Layout'

function App() {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [showAuth, setShowAuth] = useState(false)

    useEffect(() => {
        // Get initial user
        checkUser()

        // Listen for auth changes
        const { data: authListener } = AuthService.onAuthStateChange((user) => {
            setUser(user)
            if (user) {
                setShowAuth(false)
            }
        })

        return () => {
            authListener?.subscription?.unsubscribe()
        }
    }, [])

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

    const handleGetStarted = () => {
        setShowAuth(true)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
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

    // Main routing - public routes available to all, authenticated routes wrapped in Layout
    return (
        <Router>
            <Routes>
                {/* Public routes - accessible without auth */}
                <Route path="/org/:slug" element={<PublicOrganizationPage />} />
                
                {/* Authenticated routes */}
                {user ? (
                    <Route path="/*" element={
                        <TutorialProvider>
                            <Layout user={user}>
                                <Routes>
                                    <Route index element={<Dashboard />} />
                                    <Route path="initiatives/:id" element={<InitiativePage />} />
                                    <Route path="initiatives/:id/metrics/:kpiId" element={<InitiativePage />} />
                                    <Route path="account" element={<AccountPage />} />
                                </Routes>
                            </Layout>
                            <InteractiveTutorial />
                        </TutorialProvider>
                    } />
                ) : (
                    <Route path="/*" element={<HomePage onGetStarted={handleGetStarted} />} />
                )}
            </Routes>
            <Toaster position="top-right" />
        </Router>
    )
}

export default App 