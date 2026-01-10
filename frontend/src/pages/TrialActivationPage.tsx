import React, { useState } from 'react'
import { Sparkles, Clock, CheckCircle2, ArrowRight, Ticket, CreditCard, Zap } from 'lucide-react'
import { SubscriptionService } from '../services/subscription'
import { AuthService } from '../services/auth'
import toast from 'react-hot-toast'

interface Props {
    onTrialStarted: () => void
}

export default function TrialActivationPage({ onTrialStarted }: Props) {
    const [loading, setLoading] = useState(false)
    const [subscribing, setSubscribing] = useState(false)
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

    const handleSubscribe = async () => {
        setSubscribing(true)
        try {
            const { url } = await SubscriptionService.createCheckoutSession()
            if (url) {
                window.location.href = url
            } else {
                toast.error('Failed to create checkout session')
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to start checkout')
        } finally {
            setSubscribing(false)
        }
    }

    const handleSignOut = async () => {
        await AuthService.signOut()
        window.location.reload()
    }

    const trialFeatures = [
        'Unlimited initiatives',
        'Full KPI tracking & analytics',
        'Evidence management',
        'Public impact reports',
        'Story collection',
        'All integrations'
    ]

    const starterFeatures = [
        '2 initiatives included',
        'Full KPI tracking & analytics',
        'Evidence management',
        'Public impact reports',
        'Story collection',
        'All integrations'
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center px-4 py-8">
            <div className="max-w-4xl w-full">
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
                    <p className="text-gray-500 mt-2">Choose how you'd like to get started</p>
                </div>

                {/* Two Cards Side by Side */}
                <div className="grid md:grid-cols-2 gap-6">
                    {/* Trial Card */}
                    <div className="bg-white rounded-2xl shadow-xl p-6 text-center flex flex-col">
                        <div className="w-14 h-14 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Sparkles className="w-7 h-7 text-primary-600" />
                        </div>

                        <h2 className="text-xl font-bold text-gray-900 mb-1">
                            Free Trial
                        </h2>

                        <p className="text-gray-600 text-sm mb-4">
                            Full access for 30 days.<br />
                            No credit card required.
                        </p>

                        {/* Trial Info Box */}
                        <div className="bg-gradient-to-br from-primary-50 to-white rounded-xl p-4 mb-4 border border-primary-100 flex-1">
                            <div className="flex items-center justify-center gap-2 text-primary-700 mb-3">
                                <Clock className="w-5 h-5" />
                                <span className="font-semibold">30 Days Free</span>
                            </div>

                            <ul className="space-y-2 text-left">
                                {trialFeatures.map((feature) => (
                                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* CTA Button */}
                        <button
                            onClick={handleStartTrial}
                            disabled={loading || redeemingCode || subscribing}
                            className="w-full bg-primary-500 text-white py-3 px-6 rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Activating...
                                </>
                            ) : (
                                <>
                                    Start Free Trial
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>

                    {/* Paid Plan Card */}
                    <div className="bg-white rounded-2xl shadow-xl p-6 text-center flex flex-col border-2 border-emerald-200 relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                            RECOMMENDED
                        </div>
                        
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Zap className="w-7 h-7 text-emerald-600" />
                        </div>

                        <h2 className="text-xl font-bold text-gray-900 mb-1">
                            Starter Plan
                        </h2>

                        <div className="mb-4">
                            <div className="flex items-baseline justify-center gap-1">
                                <span className="text-3xl font-bold text-gray-900">$2</span>
                                <span className="text-gray-500">/day</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Billed $56 every 4 weeks</p>
                        </div>

                        {/* Plan Info Box */}
                        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-4 mb-4 border border-emerald-100 flex-1">
                            <div className="flex items-center justify-center gap-2 text-emerald-700 mb-3">
                                <CreditCard className="w-5 h-5" />
                                <span className="font-semibold">Full Access</span>
                            </div>

                            <ul className="space-y-2 text-left">
                                {starterFeatures.map((feature) => (
                                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Subscribe Button */}
                        <button
                            onClick={handleSubscribe}
                            disabled={subscribing || loading || redeemingCode}
                            className="w-full bg-emerald-500 text-white py-3 px-6 rounded-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                        >
                            {subscribing ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    Subscribe Now
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Access Code Section */}
                <div className="mt-6 bg-white rounded-xl shadow-lg p-4 text-center">
                    {!showAccessCode ? (
                        <button
                            onClick={() => setShowAccessCode(true)}
                            className="text-sm text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1.5 mx-auto"
                        >
                            <Ticket className="w-4 h-4" />
                            Have an access code?
                        </button>
                    ) : (
                        <form onSubmit={handleRedeemCode} className="space-y-3 max-w-md mx-auto">
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

                <p className="mt-4 text-xs text-gray-500 text-center">
                    By continuing, you agree to our Terms of Service
                </p>

                {/* Sign out link */}
                <div className="text-center mt-4">
                    <button
                        onClick={handleSignOut}
                        className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        Sign out and use a different account
                    </button>
                </div>

                {/* Footer */}
                <div className="text-center mt-6 text-xs text-gray-500">
                    <p>Questions? Contact support@nexusimpacts.com</p>
                </div>
            </div>
        </div>
    )
}

