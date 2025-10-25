import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthService } from './services/auth'
import { User } from './types'

// Pages
import HomePage from './pages/HomePage'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import InitiativePage from './pages/InitiativePage'
import KPIDetailPage from './pages/KPIDetailPage'
import Layout from './components/Layout'

// New pages
import HomeDashboard from './pages/Home/HomePage'
import LocationsPage from './pages/Locations/LocationsPage'
import LocationDetailPage from './pages/Locations/LocationDetailPage'
import BeneficiariesPage from './pages/Beneficiaries/BeneficiariesPage'
import InitiativeHomePage from './pages/Initiative/InitiativeHomePage'
import InitiativeMetricsPage from './pages/Initiative/InitiativeMetricsPage'

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

    // Show homepage when not authenticated
    if (!user) {
        return (
            <>
                <HomePage onGetStarted={handleGetStarted} />
                <Toaster position="top-right" />
            </>
        )
    }

    // Show main app when authenticated
    return (
        <Router>
            <Layout user={user}>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/initiatives/:id" element={<InitiativeHomePage />} />
                    <Route path="/initiatives/:id/kpis" element={<InitiativeMetricsPage />} />
                    <Route path="/initiatives/:initiativeId/kpis/:kpiId" element={<KPIDetailPage />} />
                    <Route path="/initiatives/:id/locations" element={<LocationsPage />} />
                    <Route path="/initiatives/:id/beneficiaries" element={<BeneficiariesPage />} />
                    <Route path="/locations" element={<LocationsPage />} />
                    <Route path="/locations/:id" element={<LocationDetailPage />} />
                    <Route path="/beneficiaries" element={<BeneficiariesPage />} />
                </Routes>
            </Layout>
            <Toaster position="top-right" />
        </Router>
    )
}

export default App 