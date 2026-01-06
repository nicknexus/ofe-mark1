import React, { useState } from 'react'
import { Sparkles, Clock, CheckCircle2, ArrowRight, Ticket } from 'lucide-react'
import { SubscriptionService } from '../services/subscription'
import { AuthService } from '../services/auth'
import toast from 'react-hot-toast'

interface Props {
    onTrialStarted: () => void
}

export default function TrialActivationPage({ onTrialStarted }: Props) {
    const [loading, setLoading] = useState(false)
    const [showAccessCode, setShowAccessCode] = useState(false)
    const [accessCode, setAccessCode] = useState('')
    const [redeemingCode, setRedeemingCode] = useState(false)

    const handleStartTrial = async () => {
        setLoading(true)
        try {
            const result = await SubscriptionService.startTrial()
            toast.success(result.message || 'Trial activated! You have 30 days of full access.')
            onTrialStarted()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to start trial')
        } finally {
            setLoading(false)
        }
    }

    const handleRedeemCode = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!accessCode.trim()) {
            toast.error('Please enter an access code')
            return
        }

        setRedeemingCode(true)
        try {
            const result = await SubscriptionService.redeemCode(accessCode.trim())
            toast.success(result.message || `Access code redeemed! You have ${result.daysGranted} days of full access.`)
            onTrialStarted()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Invalid access code')
        } finally {
            setRedeemingCode(false)
        }
    }

    const handleSignOut = async () => {
        await AuthService.signOut()
        window.location.reload()
    }

    const features = [
        'Unlimited initiatives',
        'Full KPI tracking & analytics',
        'Evidence management',
        'Public impact reports',
        'Story collection',
        'All integrations'
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center px-4 py-8">
            <div className="max-w-lg w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <img 
                            src="/Nexuslogo.png" 
                            alt="Nexus Impacts AI" 
                            className="h-20 w-auto"
                        />
                    </div>
                    <h2 className="text-lg font-medium text-gray-600">Welcome to</h2>
                    <h1 className="text-2xl font-bold text-gray-900">Nexus Impacts AI</h1>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="w-8 h-8 text-primary-600" />
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Start Your Free Trial
                    </h2>

                    <p className="text-gray-600 mb-6">
                        Get full access to all features for 30 days.<br />
                        No credit card required.
                    </p>

                    {/* Trial Info Box */}
                    <div className="bg-gradient-to-br from-primary-50 to-white rounded-xl p-5 mb-6 border border-primary-100">
                        <div className="flex items-center justify-center gap-2 text-primary-700 mb-4">
                            <Clock className="w-5 h-5" />
                            <span className="font-semibold text-lg">30 Days Free</span>
                        </div>

                        <ul className="space-y-2.5 text-left">
                            {features.map((feature) => (
                                <li key={feature} className="flex items-center gap-3 text-sm text-gray-700">
                                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={handleStartTrial}
                        disabled={loading || redeemingCode}
                        className="w-full bg-primary-500 text-white py-3.5 px-6 rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Activating...
                            </>
                        ) : (
                            <>
                                Activate Free Trial
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>

                    {/* Access Code Section */}
                    <div className="mt-6 pt-6 border-t border-gray-100">
                        {!showAccessCode ? (
                            <button
                                onClick={() => setShowAccessCode(true)}
                                className="text-sm text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1.5 mx-auto"
                            >
                                <Ticket className="w-4 h-4" />
                                Have an access code?
                            </button>
                        ) : (
                            <form onSubmit={handleRedeemCode} className="space-y-3">
                                <div className="text-sm font-medium text-gray-700 text-left">Enter access code</div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={accessCode}
                                        onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                        placeholder="ENTER CODE"
                                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none uppercase tracking-wider font-mono"
                                        disabled={redeemingCode}
                                    />
                                    <button
                                        type="submit"
                                        disabled={redeemingCode || loading || !accessCode.trim()}
                                        className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {redeemingCode ? 'Redeeming...' : 'Redeem'}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAccessCode(false)
                                        setAccessCode('')
                                    }}
                                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                >
                                    Cancel
                                </button>
                            </form>
                        )}
                    </div>

                    <p className="mt-4 text-xs text-gray-500">
                        By starting your trial, you agree to our Terms of Service
                    </p>

                    {/* Sign out link */}
                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <button
                            onClick={handleSignOut}
                            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            Sign out and use a different account
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center mt-6 text-xs text-gray-500">
                    <p>Questions? Contact support@nexusimpacts.com</p>
                </div>
            </div>
        </div>
    )
}

