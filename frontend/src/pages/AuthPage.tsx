import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AuthService } from '../services/auth'
import toast from 'react-hot-toast'

export default function AuthPage() {
    const [searchParams] = useSearchParams()
    const [isSignUp, setIsSignUp] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        organization: ''
    })

    // Check if coming from an invite link (redirect contains /invite/)
    const redirectPath = searchParams.get('redirect') || ''
    const isFromInvite = redirectPath.includes('/invite/')
    
    // Auto-switch to signup mode if requested via URL param
    useEffect(() => {
        if (searchParams.get('signup') === 'true') {
            setIsSignUp(true)
        }
    }, [searchParams])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (isSignUp) {
                if (formData.password !== formData.confirmPassword) {
                    toast.error('Passwords do not match')
                    setLoading(false)
                    return
                }

                // Organization is required UNLESS signing up from an invite link
                if (!isFromInvite && (!formData.organization || formData.organization.trim() === '')) {
                    toast.error('Organization name is required')
                    setLoading(false)
                    return
                }

                await AuthService.signUp(
                    formData.email, 
                    formData.password,
                    formData.name,
                    formData.organization || undefined // Pass undefined if empty
                )

                toast.success('Account created successfully!')
                
                // Small delay to ensure session is fully persisted before navigation
                // This prevents race conditions where the new page loads before auth is ready
                await new Promise(resolve => setTimeout(resolve, 500))
                
                // Use window.location for redirect to ensure URL is updated before App re-renders
                // This is important because the Router instance changes when auth state changes
                if (redirectPath) {
                    console.log('[AuthPage] Redirecting to:', redirectPath)
                    window.location.href = redirectPath
                } else {
                    window.location.href = '/'
                }
                return // Don't continue after redirect
            } else {
                await AuthService.signIn(formData.email, formData.password)
                toast.success('Welcome back!')
                
                // Use window.location for redirect
                if (redirectPath) {
                    window.location.href = redirectPath
                } else {
                    window.location.href = '/'
                }
                return // Don't continue after redirect
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Authentication failed')
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }))
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center px-4 py-8">
            <div className="max-w-md w-full space-y-6 sm:space-y-8">
                {/* Header */}
                <div className="text-center">
                    <div className="flex justify-center">
                        <img 
                            src="/Nexuslogo.png" 
                            alt="Nexus Logo" 
                            className="h-16 sm:h-20 w-auto"
                        />
                    </div>
                    <h1 className="mt-4 sm:mt-6 text-2xl sm:text-3xl font-bold text-gray-900">
                        Nexus Impacts AI
                    </h1>
                    <p className="mt-2 text-sm text-gray-600 px-2">
                        AI-powered impact tracking for nonprofits
                    </p>
                </div>

                {/* Form */}
                <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 space-y-4 sm:space-y-6">
                    {/* Tab Buttons */}
                    <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-lg">
                        <button
                            onClick={() => setIsSignUp(false)}
                            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${!isSignUp
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => setIsSignUp(true)}
                            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${isSignUp
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Sign Up
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                    placeholder="Enter your full name"
                                    required
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                placeholder="Enter your password"
                                required
                            />
                        </div>

                        {isSignUp && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                    placeholder="Confirm your password"
                                    required
                                />
                            </div>
                        )}

                        {isSignUp && !isFromInvite && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Organization Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="organization"
                                    value={formData.organization}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                    placeholder="Your organization name"
                                    required
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    This will be your organization's public page name
                                </p>
                            </div>
                        )}

                        {isSignUp && isFromInvite && (
                            <div className="p-3 bg-primary-50 rounded-lg border border-primary-100">
                                <p className="text-sm text-primary-700">
                                    <strong>Signing up to join a team</strong><br />
                                    <span className="text-primary-600">You'll be added to the organization that invited you. You can create your own organization later from Account Settings if needed.</span>
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary-500 text-white py-2.5 px-4 rounded-lg hover:bg-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                        >
                            {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
                        </button>
                    </form>

                    <div className="text-center text-xs sm:text-sm text-gray-600 px-2">
                        {isSignUp ? (
                            <p>
                                Already have an account?{' '}
                                <button
                                    onClick={() => setIsSignUp(false)}
                                    className="text-primary-500 hover:text-primary-700 font-medium"
                                >
                                    Sign in
                                </button>
                            </p>
                        ) : (
                            <p>
                                Don't have an account?{' '}
                                <button
                                    onClick={() => setIsSignUp(true)}
                                    className="text-primary-500 hover:text-primary-700 font-medium"
                                >
                                    Sign up
                                </button>
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-gray-500 px-4">
                    <p>
                        Secure authentication powered by Supabase
                    </p>
                </div>
            </div>
        </div>
    )
} 