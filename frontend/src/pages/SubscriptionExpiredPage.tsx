import React, { useState, useEffect } from 'react'
import { AlertCircle, CreditCard, LogOut, Clock, ArrowRight, Users, Mail } from 'lucide-react'
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

    if (checkingPermissions) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        )
    }

    const { title, subtitle, icon: Icon } = getMessage()

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center px-4 py-8">
            <div className="max-w-lg w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <img 
                            src="/Nexuslogo.png" 
                            alt="Nexus Impacts AI" 
                            className="h-20 w-auto opacity-50"
                        />
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Icon className="w-8 h-8 text-amber-600" />
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        {title}
                    </h1>

                    <p className="text-gray-600 mb-8">
                        {subtitle}
                    </p>

                    {/* Content varies based on whether user is shared member or owner */}
                    {isSharedMember ? (
                        <>
                            {/* Shared member - contact owner message */}
                            <div className="bg-purple-50 rounded-xl p-5 mb-6 text-left">
                                <div className="flex items-center gap-2 mb-3">
                                    <Mail className="w-5 h-5 text-purple-600" />
                                    <h3 className="font-medium text-purple-800">Contact Your Organization Owner</h3>
                                </div>
                                <p className="text-sm text-purple-700">
                                    Your access is managed by your organization owner. Please contact them to restore access to the organization's data.
                                </p>
                            </div>

                            {/* Action Buttons for shared member */}
                            <div className="space-y-3">
                                <button
                                    onClick={handleSignOut}
                                    className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-200 transition-all font-medium flex items-center justify-center gap-2"
                                >
                                    <LogOut className="w-5 h-5" />
                                    Sign Out
                                </button>
                            </div>

                            {/* Help text for shared member */}
                            <p className="mt-6 text-xs text-gray-500">
                                Once your organization owner renews their subscription, you'll automatically regain access.
                            </p>
                        </>
                    ) : (
                        <>
                            {/* Owner - show subscription options */}
                            <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left">
                                <h3 className="font-medium text-gray-700 mb-3">Starter Plan - $2/day (billed $56 every 4 weeks)</h3>
                                <ul className="space-y-2 text-sm text-gray-600">
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                        2 initiatives included
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                        Full KPI tracking & analytics
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                        Evidence management
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                        Public impact reports
                                    </li>
                                </ul>
                            </div>

                            {/* Action Buttons for owner */}
                            <div className="space-y-3">
                                <button
                                    onClick={handleSubscribe}
                                    disabled={subscribing}
                                    className="w-full bg-primary-500 text-white py-3.5 px-6 rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
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
                                    className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-200 transition-all font-medium flex items-center justify-center gap-2"
                                >
                                    <LogOut className="w-5 h-5" />
                                    Sign Out
                                </button>
                            </div>

                            {/* Help text for owner */}
                            <p className="mt-6 text-xs text-gray-500">
                                Your data is safely stored. Subscribe anytime to pick up where you left off.
                            </p>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center mt-6 text-xs text-gray-500">
                    <p>Need help? Contact support@nexusimpacts.com</p>
                </div>
            </div>
        </div>
    )
}

