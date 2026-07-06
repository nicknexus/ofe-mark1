import React, { useState, useEffect } from 'react'
import { AlertCircle, CreditCard, LogOut, Clock, ArrowRight, Users, Mail, Ticket } from 'lucide-react'
import { AuthService } from '../services/auth'
import { SubscriptionService } from '../services/subscription'
import { TeamService } from '../services/team'
import MarketingPageShell, { MarketingLogoHeader } from '../components/MarketingPageShell'
import toast from 'react-hot-toast'

interface Props {
    reason: string
    remainingDays?: number | null
}

export default function SubscriptionExpiredPage({ reason }: Props) {
    const [subscribing, setSubscribing] = useState(false)
    const [isSharedMember, setIsSharedMember] = useState(false)
    const [checkingPermissions, setCheckingPermissions] = useState(true)
    const [showAccessCode, setShowAccessCode] = useState(false)
    const [accessCode, setAccessCode] = useState('')
    const [redeemingCode, setRedeemingCode] = useState(false)

    useEffect(() => {
        const checkPermissions = async () => {
            try {
                const permissions = await TeamService.getPermissions()
                setIsSharedMember(permissions.isSharedMember)
            } catch (error) {
                console.error('Error checking permissions:', error)
            } finally {
                setCheckingPermissions(false)
            }
        }
        checkPermissions()
    }, [])

    const handleSignOut = async () => {
        await AuthService.signOut()
        window.location.reload()
    }

    const handleManageBilling = async () => {
        setSubscribing(true)
        try {
            const { url } = await SubscriptionService.createPortalSession()
            if (url) {
                window.location.href = url
            } else {
                toast.error('Failed to open billing portal')
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to open billing portal')
        } finally {
            setSubscribing(false)
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
            await SubscriptionService.redeemCode(accessCode.trim())
            toast.success('Access code redeemed! Reloading...')
            window.location.reload()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Invalid access code')
        } finally {
            setRedeemingCode(false)
        }
    }

    const getMessage = () => {
        // For shared members, show different message
        if (isSharedMember) {
            return {
                title: 'Organization Access Unavailable',
                subtitle: 'The organization subscription is no longer active',
                icon: Users
            }
        }

        switch (reason) {
            case 'payment_past_due':
                return {
                    title: 'Payment Issue',
                    subtitle: 'Update your payment method to keep your paid plan',
                    icon: CreditCard
                }
            default:
                return {
                    title: 'Billing Needs Attention',
                    subtitle: 'Update your billing to restore your paid plan, or continue on the free plan',
                    icon: CreditCard
                }
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

    const { title, subtitle, icon: Icon } = getMessage()

    return (
        <MarketingPageShell contentClassName="max-w-lg w-full">
                    {/* Logo - public style */}
                    <div className="text-center mb-8">
                        <MarketingLogoHeader />
                    </div>

                    {/* Main Card - glass style */}
                    <div className="glass-card p-8 text-center">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary-500/40 shadow-md bg-primary-500/30">
                            <Icon className="w-8 h-8 text-gray-800" />
                        </div>

                        <h1 className="text-2xl font-semibold text-foreground mb-2">
                            {title}
                        </h1>

                        <p className="text-muted-foreground mb-8">
                            {subtitle}
                        </p>

                        {isSharedMember ? (
                            <>
                                <div className="bg-white/40 backdrop-blur rounded-xl border border-white/60 p-5 mb-6 text-left">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Mail className="w-5 h-5 text-purple-600" />
                                        <h3 className="font-medium text-foreground">Contact Your Organization Owner</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Your access is managed by your organization owner. Please contact them to restore access to the organization's data.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full bg-primary-500 text-gray-800 py-3 px-6 rounded-xl hover:bg-primary-600 transition-all font-medium flex items-center justify-center gap-2"
                                    >
                                        <LogOut className="w-5 h-5" />
                                        Sign Out
                                    </button>
                                </div>

                                <p className="mt-6 text-xs text-muted-foreground">
                                    Once your organization owner renews their subscription, you'll automatically regain access.
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="bg-white/40 backdrop-blur rounded-xl border border-white/60 p-5 mb-6 text-left">
                                    <p className="text-sm text-muted-foreground">
                                        There's a problem with your subscription's billing. Update your payment
                                        method to restore your paid plan. Your data is safe, and you can always
                                        continue on the free plan.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={handleManageBilling}
                                        disabled={subscribing}
                                        className="w-full bg-primary-500 text-gray-800 py-3.5 px-6 rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
                                    >
                                        {subscribing ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Loading...
                                            </>
                                        ) : (
                                            <>
                                                <CreditCard className="w-5 h-5" />
                                                Update payment method
                                                <ArrowRight className="w-5 h-5" />
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={handleSignOut}
                                        className="w-full bg-white/60 text-foreground py-3 px-6 rounded-xl border border-primary-500/30 hover:bg-primary-500/15 hover:border-primary-500/40 transition-all font-medium flex items-center justify-center gap-2"
                                    >
                                        <LogOut className="w-5 h-5" />
                                        Sign Out
                                    </button>
                                </div>

                                <div className="mt-6 bg-white/40 backdrop-blur rounded-xl border border-white/60 p-4 text-center">
                                    {!showAccessCode ? (
                                        <button
                                            onClick={() => setShowAccessCode(true)}
                                            className="text-sm text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1.5 mx-auto font-medium"
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
                                                    disabled={redeemingCode || !accessCode.trim()}
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

                                <p className="mt-6 text-xs text-muted-foreground">
                                    Your data is safely stored. Subscribe anytime to pick up where you left off.
                                </p>
                            </>
                        )}
                    </div>

                    <div className="text-center mt-6 text-xs text-muted-foreground">
                        <p>Need help? Contact support@nexusimpacts.com</p>
                    </div>
        </MarketingPageShell>
    )
}
