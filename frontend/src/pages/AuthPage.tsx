import React, { useState } from 'react'
import { Target, Mail, Lock, User } from 'lucide-react'
import { AuthService } from '../services/auth'
import toast from 'react-hot-toast'

export default function AuthPage() {
    const [isSignUp, setIsSignUp] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        organization: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (isSignUp) {
                await AuthService.signUp(formData.email, formData.password)

                // Update profile with additional info
                if (formData.name || formData.organization) {
                    await AuthService.updateProfile({
                        name: formData.name,
                        organization: formData.organization
                    })
                }

                toast.success('Account created! Please check your email to verify.')
            } else {
                await AuthService.signIn(formData.email, formData.password)
                toast.success('Welcome back!')
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
        <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center px-4">
            <div className="max-w-md w-full space-y-8">
                {/* Header */}
                <div className="text-center">
                    <div className="flex justify-center">
                        <div className="w-16 h-16 bg-primary-500 rounded-xl flex items-center justify-center">
                            <Target className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <h1 className="mt-6 text-3xl font-bold text-gray-900">
                        Opportunity of Evidence
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Expert-level system for charity impact tracking
                    </p>
                </div>

                {/* Form */}
                <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-900 text-center">
                            {isSignUp ? 'Create Account' : 'Sign In'}
                        </h2>
                        <p className="mt-2 text-sm text-gray-600 text-center">
                            {isSignUp
                                ? 'Start tracking your impact today'
                                : 'Continue your impact journey'
                            }
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignUp && (
                            <>
                                <div>
                                    <label className="label">
                                        <User className="w-4 h-4 inline mr-2" />
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="input-field"
                                        placeholder="Enter your full name"
                                    />
                                </div>

                                <div>
                                    <label className="label">
                                        <Target className="w-4 h-4 inline mr-2" />
                                        Organization
                                    </label>
                                    <input
                                        type="text"
                                        name="organization"
                                        value={formData.organization}
                                        onChange={handleInputChange}
                                        className="input-field"
                                        placeholder="Your charity or organization"
                                    />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="label">
                                <Mail className="w-4 h-4 inline mr-2" />
                                Email Address
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className="input-field"
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        <div>
                            <label className="label">
                                <Lock className="w-4 h-4 inline mr-2" />
                                Password
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                className="input-field"
                                placeholder="Enter your password"
                                required
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full"
                        >
                            {loading
                                ? 'Please wait...'
                                : isSignUp
                                    ? 'Create Account'
                                    : 'Sign In'
                            }
                        </button>
                    </form>

                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                            {isSignUp
                                ? 'Already have an account? Sign in'
                                : "Don't have an account? Sign up"
                            }
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-gray-500">
                    <p>Track • Verify • Showcase your charity's impact</p>
                </div>
            </div>
        </div>
    )
} 