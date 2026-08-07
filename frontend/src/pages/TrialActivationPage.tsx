import React, { useState } from 'react'
import { Sparkles, CheckCircle2, ArrowRight, Ticket, CreditCard } from 'lucide-react'
import { SubscriptionService } from '../services/subscription'
import { AuthService } from '../services/auth'
import MarketingPageShell, { MarketingLogoHeader } from '../components/MarketingPageShell'
import toast from 'react-hot-toast'
import { readPendingPlan, clearPendingPlan, type PendingTier } from '../utils/pendingPlan'

interface Props {
    // Kept name for App.tsx compatibility — fires after the free plan is active.
    onTrialStarted: () => void
}

const PLAN_INFO: Record<PendingTier, { name: string; monthly: string; annual: string; features: string[] }> = {
    growth: {
        name: 'Growth',
        monthly: '$75 / month',
        annual: '$750 / year',
        features: ['10 initiatives', '10 team members', '15 locations', '300 GB storage', 'Unlimited AI reports', 'Tags & beneficiary groups'],
    },
    pro: {
        name: 'Pro',
        monthly: '$240 / month',
        annual: '$2,400 / year',
        features: ['25 initiatives', '20 team members', '30 locations', '1 TB storage', 'Unlimited AI reports', 'Advanced / white-label widgets'],
    },
}

export default function TrialActivationPage({ onTrialStarted }: Props) {
    const [loading, setLoading] = useState(false)
    const [subscribing, setSubscribing] = useState(false)
    const [showAccessCode, setShowAccessCode] = useState(false)
    const [accessCode, setAccessCode] = useState('')
    const [redeemingCode, setRedeemingCode] = useState(false)
    const [pendingPlan] = useState(readPendingPlan)

    const handlePayNow = async () => {
        if (!pendingPlan) return
        setSubscribing(true)
        try {
            const { url } = await SubscriptionService.createCheckoutSession({
                tier: pendingPlan.tier,
                interval: pendingPlan.interval,
            })
            if (url) window.location.href = url
            else toast.error('Failed to start checkout')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to start checkout')
            setSubscribing(false)
        }
    }

    const handleStartFree = async () => {
        setLoading(true)
        try {
            const result = await SubscriptionService.activateFree()
            clearPendingPlan()
            toast.success(result.message || 'Your free plan is active. Welcome aboard!')
            onTrialStarted()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to activate free plan')
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

    const freeFeatures = [
        '1 initiative',
        '2 team members',
        '3 locations',
        '25 GB storage',
        '1 AI summary report / day',
        'Public impact page + Explore listing',
    ]

    // If the user picked a paid plan on the landing page, show that plan's
    // "pay now" screen with a small "start free instead" opt-out.
    if (pendingPlan) {
        const info = PLAN_INFO[pendingPlan.tier]
        const price = pendingPlan.interval === 'annual' ? info.annual : info.monthly
        return (
            <MarketingPageShell contentClassName="max-w-lg w-full">
                <div className="text-center mb-8">
                    <MarketingLogoHeader />
                    <h2 className="text-lg font-medium text-muted-foreground">You're almost in</h2>
                    <h1 className="text-2xl font-semibold text-foreground mt-1">Subscribe to {info.name}</h1>
                    <p className="text-muted-foreground mt-2 text-sm">Complete your subscription to unlock {info.name}.</p>
                </div>

                <div className="glass-card p-6 text-center flex flex-col">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary-500/30 border border-primary-500/40">
                        <CreditCard className="w-7 h-7 text-primary-500" />
                    </div>

                    <h2 className="text-xl font-semibold text-foreground mb-1">{info.name} plan</h2>
                    <p className="text-muted-foreground text-sm mb-4">{price}</p>

                    <div className="bg-white/40 backdrop-blur rounded-xl border border-white/60 p-4 mb-4 flex-1">
                        <ul className="space-y-2 text-left">
                            {info.features.map((feature) => (
                                <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
                                    <span>{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <button
                        onClick={handlePayNow}
                        disabled={subscribing || loading}
                        className="w-full bg-primary-500 text-gray-800 py-3 px-6 rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
                    >
                        {subscribing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Redirecting to checkout...
                            </>
                        ) : (
                            <>
                                Pay now
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>

                    {/* Small opt-out to the free plan */}
                    <button
                        onClick={handleStartFree}
                        disabled={loading || subscribing}
                        className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Setting up...' : 'Not Ready? Start with the free plan instead'}
                    </button>
                </div>

                <div className="text-center mt-6">
                    <button onClick={handleSignOut} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        Sign out and use a different account
                    </button>
                </div>
            </MarketingPageShell>
        )
    }

    return (
        <MarketingPageShell contentClassName="max-w-lg w-full">
            {/* Logo - public style */}
            <div className="text-center mb-8">
                <MarketingLogoHeader />
                <h2 className="text-lg font-medium text-muted-foreground">Welcome to</h2>
                <h1 className="text-2xl font-semibold text-foreground mt-1">Nexus Impacts AI</h1>
                <p className="text-muted-foreground mt-2 text-sm">Get your first impact page live — free, forever.</p>
            </div>

            {/* Free Plan Card */}
            <div className="glass-card p-6 text-center flex flex-col">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-primary-500/30 border border-primary-500/40">
                    <Sparkles className="w-7 h-7 text-primary-500" />
                </div>

                <h2 className="text-xl font-semibold text-foreground mb-1">Free plan</h2>
                <p className="text-muted-foreground text-sm mb-4">
                    $0 forever. No credit card required.
                </p>

                <div className="bg-white/40 backdrop-blur rounded-xl border border-white/60 p-4 mb-4 flex-1">
                    <ul className="space-y-2 text-left">
                        {freeFeatures.map((feature) => (
                            <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
                                <span>{feature}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <button
                    onClick={handleStartFree}
                    disabled={loading || redeemingCode}
                    className="w-full bg-primary-500 text-gray-800 py-3 px-6 rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Setting up...
                        </>
                    ) : (
                        <>
                            Get started free
                            <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>

                <p className="text-xs text-muted-foreground mt-3">
                    Need more? Upgrade to Growth or Pro anytime from Settings → Billing.
                </p>
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
        </MarketingPageShell>
    )
}
