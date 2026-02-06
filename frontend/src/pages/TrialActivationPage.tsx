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
        '3 initiatives included',
        'Full KPI tracking & analytics',
        'Evidence management',
        'Public impact reports',
        'Story collection',
        'All integrations'
    ]

    const starterFeatures = [
        '3 initiatives included',
        'Full KPI tracking & analytics',
        'Evidence management',
        'Public impact reports',
        'Story collection',
        'All integrations'
    ]

    const brandColor = '#c0dfa1'

    return (
        <div className="min-h-screen font-figtree relative">
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(ellipse 80% 50% at 20% 40%, ${brandColor}90, transparent 60%),
                        radial-gradient(ellipse 60% 80% at 80% 20%, ${brandColor}70, transparent 55%),
                        radial-gradient(ellipse 50% 60% at 60% 80%, ${brandColor}60, transparent 55%),
                        linear-gradient(180deg, white 0%, #fafafa 100%)
                    `
                }}
            />
            <div className="relative z-10 flex items-center justify-center px-4 py-8 min-h-screen">
                <div className="max-w-4xl w-full">
                    {/* Logo - public style */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center items-center gap-2 mb-4">
                            <div className="w-10 h-10 rounded-lg overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-xl font-newsreader font-extralight text-foreground">Nexus Impacts</span>
                        </div>
                        <h2 className="text-lg font-medium text-muted-foreground">Welcome to</h2>
                        <h1 className="text-2xl font-semibold text-foreground mt-1">Nexus Impacts AI</h1>
                        <p className="text-muted-foreground mt-2 text-sm">Choose how you'd like to get started</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Trial Card */}
                        <div className="glass-card p-6 text-center flex flex-col">
                            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary-500/30 border border-primary-500/40">
                                <Sparkles className="w-7 h-7 text-primary-500" />
                            </div>

                            <h2 className="text-xl font-semibold text-foreground mb-1">Free Trial</h2>
                            <p className="text-muted-foreground text-sm mb-4">
                                Full access for 30 days.<br />No credit card required.
                            </p>

                            <div className="bg-white/40 backdrop-blur rounded-xl border border-white/60 p-4 mb-4 flex-1">
                                <div className="flex items-center justify-center gap-2 text-foreground mb-3">
                                    <Clock className="w-5 h-5 text-primary-500" />
                                    <span className="font-semibold">30 Days Free</span>
                                </div>
                                <ul className="space-y-2 text-left">
                                    {trialFeatures.map((feature) => (
                                        <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button
                                onClick={handleStartTrial}
                                disabled={loading || redeemingCode || subscribing}
                                className="w-full bg-primary-500 text-gray-800 py-3 px-6 rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
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
                        <div className="glass-card p-6 text-center flex flex-col relative border-primary-500/40">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary-500 text-gray-800 text-xs font-semibold px-3 py-1 rounded-full">
                                RECOMMENDED
                            </div>
                            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary-500/30 border border-primary-500/40">
                                <Zap className="w-7 h-7 text-primary-500" />
                            </div>

                            <h2 className="text-xl font-semibold text-foreground mb-1">Starter Plan</h2>
                            <div className="mb-4">
                                <div className="flex items-baseline justify-center gap-1">
                                    <span className="text-3xl font-bold text-foreground">$2</span>
                                    <span className="text-muted-foreground">/day</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Billed $56 every 4 weeks</p>
                            </div>

                            <div className="bg-white/40 backdrop-blur rounded-xl border border-white/60 p-4 mb-4 flex-1">
                                <div className="flex items-center justify-center gap-2 text-foreground mb-3">
                                    <CreditCard className="w-5 h-5 text-primary-500" />
                                    <span className="font-semibold">Full Access</span>
                                </div>
                                <ul className="space-y-2 text-left">
                                    {starterFeatures.map((feature) => (
                                        <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

<button
                            onClick={handleSubscribe}
                            disabled={subscribing || loading || redeemingCode}
                            className="w-full bg-primary-500 text-gray-800 py-3 px-6 rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
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

                    <div className="mt-6 glass-card p-4 text-center">
                        {!showAccessCode ? (
                            <button
                                onClick={() => setShowAccessCode(true)}
                                className="text-sm text-primary-500 hover:text-primary-500/90 transition-colors flex items-center gap-1.5 mx-auto font-medium"
                            >
                                <Ticket className="w-4 h-4" />
                                Have an access code?
                            </button>
                        ) : (
                            <form onSubmit={handleRedeemCode} className="space-y-3 max-w-md mx-auto">
                                <div className="text-sm font-medium text-foreground text-left">Enter access code</div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={accessCode}
                                        onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                                        placeholder="ENTER CODE"
                                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 focus:outline-none uppercase tracking-wider font-mono bg-white/80"
                                        disabled={redeemingCode}
                                    />
                                    <button
                                        type="submit"
                                        disabled={redeemingCode || loading || !accessCode.trim()}
                                        className="px-4 py-2.5 bg-primary-500 text-gray-800 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {redeemingCode ? 'Redeeming...' : 'Redeem'}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setShowAccessCode(false); setAccessCode('') }}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Cancel
                                </button>
                            </form>
                        )}
                    </div>

                    <p className="mt-4 text-xs text-muted-foreground text-center">
                        By continuing, you agree to our Terms of Service
                    </p>
                    <div className="text-center mt-4">
                        <button onClick={handleSignOut} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                            Sign out and use a different account
                        </button>
                    </div>
                    <div className="text-center mt-6 text-xs text-muted-foreground">
                        <p>Questions? Contact support@nexusimpacts.com</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

