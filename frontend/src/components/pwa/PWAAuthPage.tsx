import React, { useState } from 'react'
import { AuthService } from '../../services/auth'
import toast from 'react-hot-toast'

interface PWAAuthPageProps {
    onAuthSuccess: () => void
}

export default function PWAAuthPage({ onAuthSuccess }: PWAAuthPageProps) {
    const [isSignUp, setIsSignUp] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        organization: '',
    })

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

                if (!formData.organization || formData.organization.trim() === '') {
                    toast.error('Organization name is required')
                    setLoading(false)
                    return
                }

                await AuthService.signUp(
                    formData.email,
                    formData.password,
                    formData.name,
                    formData.organization
                )

                toast.success('Account created!')
                await new Promise((resolve) => setTimeout(resolve, 500))
                onAuthSuccess()
            } else {
                await AuthService.signIn(formData.email, formData.password)
                toast.success('Welcome back!')
                onAuthSuccess()
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Authentication failed')
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }))
    }

    return (
        <div
            className="min-h-screen flex flex-col bg-[#F9FAFB]"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            <div className="flex-1 flex flex-col justify-center px-6 py-8">
                {/* App Logo */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 shadow-lg">
                        <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Nexus Impacts</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {isSignUp ? 'Create your account' : 'Sign in to continue'}
                    </p>
                </div>

                {/* Toggle */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl mb-6 max-w-sm mx-auto w-full">
                    <button
                        type="button"
                        onClick={() => setIsSignUp(false)}
                        className={`py-2.5 text-sm font-medium rounded-lg transition-all ${
                            !isSignUp
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500'
                        }`}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsSignUp(true)}
                        className={`py-2.5 text-sm font-medium rounded-lg transition-all ${
                            isSignUp
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500'
                        }`}
                    >
                        Sign Up
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto w-full">
                    {isSignUp && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                                placeholder="Your full name"
                                required
                                autoComplete="name"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                            placeholder="you@example.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                            placeholder="••••••••"
                            required
                            autoComplete={isSignUp ? 'new-password' : 'current-password'}
                        />
                    </div>

                    {isSignUp && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                                    placeholder="••••••••"
                                    required
                                    autoComplete="new-password"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                                <input
                                    type="text"
                                    name="organization"
                                    value={formData.organization}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none"
                                    placeholder="Your organization"
                                    required
                                    autoComplete="organization"
                                />
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary-500 text-gray-800 py-3 rounded-xl font-semibold text-sm hover:bg-primary-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-4">
                    {isSignUp ? (
                        <>
                            Already have an account?{' '}
                            <button type="button" onClick={() => setIsSignUp(false)} className="text-primary-600 font-medium">
                                Sign in
                            </button>
                        </>
                    ) : (
                        <>
                            Don't have an account?{' '}
                            <button type="button" onClick={() => setIsSignUp(true)} className="text-primary-600 font-medium">
                                Sign up
                            </button>
                        </>
                    )}
                </p>
            </div>
        </div>
    )
}
