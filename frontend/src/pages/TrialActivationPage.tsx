import { useState } from 'react'
import { CheckCircle2, ArrowRight, CreditCard } from 'lucide-react'
import { SubscriptionService } from '../services/subscription'
import { AuthService } from '../services/auth'
import MarketingPageShell, { MarketingLogoHeader } from '../components/MarketingPageShell'
import { notify } from '../lib/notify'
import { readPendingPlan, writePendingPlan, type PendingTier } from '../utils/pendingPlan'
import { TRIAL_DURATION_DAYS } from '../config/trial'
import { useRecheckOnReturn } from '../hooks/useRecheckOnReturn'

interface Props {
    /** Re-read subscription status (after returning from Stripe Checkout). */
    onRecheck: () => void
    trialDurationDays?: number
}

export const PLAN_INFO: Record<PendingTier, { name: string; monthly: string; annual: string; features: string[] }> = {
    growth: {
        name: 'Growth',
        monthly: '$75 / month',
        annual: '$750 / year',
        features: ['10 programs', '10 team members', '15 locations', '300 GB storage', 'Unlimited AI reports', 'Tags and beneficiary groups'],
    },
    pro: {
        name: 'Pro',
        monthly: '$240 / month',
        annual: '$2,400 / year',
        features: ['25 programs', '20 team members', '30 locations', '1 TB storage', 'Unlimited AI reports', 'Advanced / white-label widgets'],
    },
}

export default function TrialActivationPage({ onRecheck, trialDurationDays }: Props) {
    const pending = readPendingPlan()
    const days = trialDurationDays || TRIAL_DURATION_DAYS
    const [interval, setInterval] = useState<'monthly' | 'annual'>(pending?.interval || 'monthly')
    const [selected, setSelected] = useState<PendingTier>(pending?.tier || 'growth')
    const [subscribing, setSubscribing] = useState(false)

    // Stripe Checkout opens outside the installed app on iOS; when the user
    // comes back, pick up the new subscription without a manual reload.
    useRecheckOnReturn(onRecheck)

    const handleStartTrial = async (tier: PendingTier) => {
        setSelected(tier)
        writePendingPlan({ tier, interval })
        setSubscribing(true)
        try {
            await SubscriptionService.startCheckout(tier, interval)
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "Couldn't open checkout. Please try again.")
            setSubscribing(false)
        }
    }

    const handleSignOut = async () => {
        await AuthService.signOut()
        window.location.reload()
    }

    return (
        <MarketingPageShell contentClassName="max-w-3xl w-full">
            <div className="text-center mb-8">
                <MarketingLogoHeader />
                <h2 className="text-lg font-medium text-muted-foreground">Welcome to</h2>
                <h1 className="text-2xl font-semibold text-foreground mt-1">Nexus Impacts AI</h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    Pick a plan to start your {days}-day free trial. A card is required. You won't be charged until the trial ends, and you can cancel any time before then.
                </p>
            </div>

            <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/50 border border-white/60">
                    <button
                        type="button"
                        onClick={() => setInterval('monthly')}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            interval === 'monthly' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'
                        }`}
                    >
                        Monthly
                    </button>
                    <button
                        type="button"
                        onClick={() => setInterval('annual')}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            interval === 'annual' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'
                        }`}
                    >
                        Annual <span className="text-xs text-primary-600">2 months free</span>
                    </button>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
                {(['growth', 'pro'] as PendingTier[]).map((tier) => {
                    const info = PLAN_INFO[tier]
                    const price = interval === 'annual' ? info.annual : info.monthly
                    const highlighted = selected === tier
                    return (
                        <div
                            key={tier}
                            className={`glass-card p-6 text-center flex flex-col ${highlighted ? 'ring-2 ring-primary-500' : ''}`}
                        >
                            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-primary-500/30 border border-primary-500/40">
                                <CreditCard className="w-6 h-6 text-primary-500" />
                            </div>
                            <h2 className="text-xl font-semibold text-foreground mb-1">{info.name}</h2>
                            <p className="text-muted-foreground text-sm mb-4">{price} after trial</p>
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
                                onClick={() => handleStartTrial(tier)}
                                disabled={subscribing}
                                className="w-full bg-primary-500 text-gray-800 py-3 px-6 rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
                            >
                                {subscribing && selected === tier ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Redirecting to checkout...
                                    </>
                                ) : (
                                    <>
                                        Start my {days}-day free trial
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </div>
                    )
                })}
            </div>

            <p className="mt-4 text-xs text-muted-foreground text-center">
                Have a promo code? Enter it on the checkout page. By continuing, you agree to our Terms of Service.
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
