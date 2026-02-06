import React, { useState, useEffect } from 'react'
import { AlertCircle, CreditCard, LogOut, Clock, ArrowRight, Users, Mail, Ticket } from 'lucide-react'
import { AuthService } from '../services/auth'
import { SubscriptionService } from '../services/subscription'
import { TeamService } from '../services/team'
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
            case 'trial_expired':
                return {
                    title: 'Your Free Trial Has Ended',
                    subtitle: 'Subscribe to continue tracking your impact',
                    icon: Clock
                }
            case 'subscription_cancelled':
                return {
                    title: 'Subscription Cancelled',
                    subtitle: 'Your subscription has been cancelled',
                    icon: AlertCircle
                }
            case 'payment_past_due':
                return {
                    title: 'Payment Required',
                    subtitle: 'Please update your payment method to continue',
                    icon: CreditCard
                }
            case 'expired':
                return {
                    title: 'Subscription Expired',
                    subtitle: 'Subscribe to regain access to your data',
                    icon: AlertCircle
                }
            default:
                return {
                    title: 'Subscription Required',
                    subtitle: 'Subscribe to access all features',
                    icon: AlertCircle
                }
        }
    }

    const brandColor = '#c0dfa1'

    if (checkingPermissions) {
        return (
            <div className="min-h-screen font-figtree bg-background flex items-center justify-center px-4">
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
            </div>
        )
    }

    const { title, subtitle, icon: Icon } = getMessage()

    return (
        <div className="min-h-screen font-figtree relative">
            {/* Flowing gradient background - same as public initiative page */}
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
                <div className="max-w-lg w-full">
                    {/* Logo - public style */}
                    <div className="text-center mb-8">
                        <div className="flex justify-center items-center gap-2 mb-4">
                            <div className="w-10 h-10 rounded-lg overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-xl font-newsreader font-extralight text-foreground">Nexus Impacts</span>
                        </div>
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
                                    <h3 className="font-medium text-foreground mb-3">Starter Plan - $2/day (billed $56 every 4 weeks)</h3>
                                    <ul className="space-y-2 text-sm text-muted-foreground">
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                                            2 initiatives included
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                                            Full KPI tracking & analytics
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                                            Evidence management
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                                            Public impact reports
                                        </li>
                                    </ul>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={handleSubscribe}
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
                                                Subscribe Now - $2/day
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
                </div>
            </div>
        </div>
    )
}

