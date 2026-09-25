import { useState, useEffect } from 'react'
import { CreditCard, LogOut, Clock, Users, CheckCircle2, type LucideIcon } from 'lucide-react'
import { AuthService } from '../services/auth'
import { SubscriptionService } from '../services/subscription'
import { TeamService } from '../services/team'
import MarketingPageShell, { MarketingLogoHeader } from '../components/MarketingPageShell'
import { notify } from '../lib/notify'
import { PLAN_INFO } from './TrialActivationPage'
import { TRIAL_DURATION_DAYS } from '../config/trial'
import { useRecheckOnReturn } from '../hooks/useRecheckOnReturn'
import type { PendingTier } from '../utils/pendingPlan'

interface Props {
    reason: string
    remainingDays?: number | null
    /** True when this account has never started a trial (they get one at checkout). */
    trialAvailable?: boolean
    /** Re-read subscription status (after returning from Stripe). */
    onRecheck: () => void
}

type Variant = 'trial_ended' | 'subscription_ended' | 'payment_failed'

function variantFor(reason: string): Variant {
    switch (reason) {
        case 'trial_payment_failed':
            return 'payment_failed'
        case 'subscription_ended':
        case 'subscription_cancelled':
        case 'payment_past_due':
            return 'subscription_ended'
        default:
            return 'trial_ended'
    }
}

const COPY: Record<Variant, { title: string; subtitle: string; icon: LucideIcon }> = {
    trial_ended: {
        title: 'Your free trial has ended',
        subtitle: 'Pick a plan to keep going. Your programs and data are saved.',
        icon: Clock,
    },
    subscription_ended: {
        title: 'Your subscription has ended',
        subtitle: 'Sign back up to pick up right where you left off. Your data is saved.',
        icon: CreditCard,
    },
    payment_failed: {
        title: 'Your trial has ended',
        subtitle: "We couldn't charge your card. Update it to keep going. Your data is saved.",
        icon: CreditCard,
    },
}

export default function SubscriptionExpiredPage({ reason, trialAvailable, onRecheck }: Props) {
    const [busy, setBusy] = useState<string | null>(null)
    const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')
    const [isSharedMember, setIsSharedMember] = useState(false)
    const [checkingPermissions, setCheckingPermissions] = useState(true)

    useRecheckOnReturn(onRecheck)

    useEffect(() => {
        TeamService.getPermissions()
            .then((permissions) => setIsSharedMember(permissions.isSharedMember))
            .catch(() => setIsSharedMember(false))
            .finally(() => setCheckingPermissions(false))
    }, [])

    const handleSignOut = async () => {
        await AuthService.signOut()
        window.location.reload()
    }

    const handleSubscribe = async (tier: PendingTier) => {
        setBusy(tier)
        try {
            await SubscriptionService.startCheckout(tier, interval)
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "Couldn't open checkout. Please try again.")
            setBusy(null)
        }
    }

    const handleUpdateCard = async () => {
        setBusy('portal')
        try {
            const { url } = await SubscriptionService.createPortalSession()
            window.location.href = url
        } catch (error) {
            notify.error(error instanceof Error ? error.message : "Couldn't open billing. Please try again.")
            setBusy(null)
        }
    }

    if (checkingPermissions) {
        return (
            <MarketingPageShell contentClassName="max-w-md w-full">
                <div className="glass-card p-12 rounded-3xl text-center max-w-md">
                    <div className="w-12 h-12 mb-4 mx-auto">
                        <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mb-3">
                        <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '600ms' }} />
                        <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '600ms' }} />
                        <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '600ms' }} />
                    </div>
                    <p className="text-muted-foreground text-sm font-medium">Loading...</p>
                </div>
            </MarketingPageShell>
        )
    }

    if (isSharedMember) {
        return (
            <MarketingPageShell contentClassName="max-w-lg w-full">
                <div className="text-center mb-8">
                    <MarketingLogoHeader />
                </div>
                <div className="glass-card p-8 text-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary-500/40 shadow-md bg-primary-500/30">
                        <Users className="w-8 h-8 text-gray-800" />
                    </div>
                    <h1 className="text-2xl font-semibold text-foreground mb-2">Your organization's plan has ended</h1>
                    <p className="text-muted-foreground mb-8">
                        Ask your organization owner to renew. You'll get access back automatically as soon as they do.
                    </p>
                    <button
                        onClick={handleSignOut}
                        className="w-full bg-primary-500 text-gray-800 py-3 px-6 rounded-xl hover:bg-primary-600 transition-all font-medium flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign out
                    </button>
                </div>
                <div className="text-center mt-6 text-xs text-muted-foreground">
                    <p>Need help? Contact support@nexusimpacts.com</p>
                </div>
            </MarketingPageShell>
        )
    }

    const variant = variantFor(reason)
    const { title, subtitle, icon: Icon } = COPY[variant]

    return (
        <MarketingPageShell contentClassName="max-w-2xl w-full">
            <div className="text-center mb-8">
                <MarketingLogoHeader />
            </div>

            <div className="glass-card p-8 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary-500/40 shadow-md bg-primary-500/30">
                    <Icon className="w-8 h-8 text-gray-800" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground mb-2">{title}</h1>
                <p className="text-muted-foreground mb-8">{subtitle}</p>

                {variant === 'payment_failed' ? (
                    <button
                        onClick={handleUpdateCard}
                        disabled={!!busy}
                        className="w-full bg-primary-500 text-gray-800 py-3.5 px-6 rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
                    >
                        <CreditCard className="w-5 h-5" />
                        {busy === 'portal' ? 'Opening billing...' : 'Update payment method'}
                    </button>
                ) : (
                    <>
                        <div className="flex justify-center mb-5">
                            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/50 border border-white/60">
                                {(['monthly', 'annual'] as const).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setInterval(value)}
                                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                            interval === value ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'
                                        }`}
                                    >
                                        {value === 'monthly' ? 'Monthly' : (
                                            <>Annual <span className="text-xs text-primary-600">2 months free</span></>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4 text-left">
                            {(['growth', 'pro'] as PendingTier[]).map((tier) => {
                                const info = PLAN_INFO[tier]
                                return (
                                    <div key={tier} className="bg-white/40 backdrop-blur rounded-xl border border-white/60 p-5 flex flex-col">
                                        <h2 className="text-lg font-semibold text-foreground">{info.name}</h2>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            {interval === 'annual' ? info.annual : info.monthly}
                                        </p>
                                        <ul className="space-y-1.5 mb-4 flex-1">
                                            {info.features.slice(0, 4).map((feature) => (
                                                <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <CheckCircle2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                        <button
                                            onClick={() => handleSubscribe(tier)}
                                            disabled={!!busy}
                                            className="w-full bg-primary-500 text-gray-800 py-3 px-6 rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
                                        >
                                            {busy === tier
                                                ? 'Opening checkout...'
                                                : variant === 'subscription_ended'
                                                    ? `Sign back up for ${info.name}`
                                                    : `Choose ${info.name}`}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>

                        <p className="mt-4 text-xs text-muted-foreground">
                            {trialAvailable
                                ? `Includes a ${TRIAL_DURATION_DAYS}-day free trial. A card is required and you can cancel any time.`
                                : 'Billing starts today. Cancel any time.'}{' '}
                            Have a promo code? Enter it at checkout.
                        </p>
                    </>
                )}

                <button
                    onClick={handleSignOut}
                    className="w-full mt-4 bg-white/60 text-foreground py-3 px-6 rounded-xl border border-primary-500/30 hover:bg-primary-500/15 transition-all font-medium flex items-center justify-center gap-2"
                >
                    <LogOut className="w-5 h-5" />
                    Sign out
                </button>
            </div>

            <div className="text-center mt-6 text-xs text-muted-foreground">
                <p>Need help? Contact support@nexusimpacts.com</p>
            </div>
        </MarketingPageShell>
    )
}
