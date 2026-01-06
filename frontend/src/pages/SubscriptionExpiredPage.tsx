import React from 'react'
import { AlertCircle, CreditCard, LogOut, Clock, ArrowRight } from 'lucide-react'
import { AuthService } from '../services/auth'

interface Props {
    reason: string
    remainingDays?: number | null
}

export default function SubscriptionExpiredPage({ reason }: Props) {
    const handleSignOut = async () => {
        await AuthService.signOut()
        window.location.reload()
    }

    const handleSubscribe = () => {
        // Future: Navigate to Stripe checkout
        // For now, show a message
        alert('Subscription coming soon! Contact support@nexusimpacts.com for early access.')
    }

    const getMessage = () => {
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

                    {/* What you're missing */}
                    <div className="bg-gray-50 rounded-xl p-5 mb-6 text-left">
                        <h3 className="font-medium text-gray-700 mb-3">What you'll get with a subscription:</h3>
                        <ul className="space-y-2 text-sm text-gray-600">
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                Unlimited initiatives & KPIs
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                Full evidence management
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                Public impact reports
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full" />
                                Priority support
                            </li>
                        </ul>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        <button
                            onClick={handleSubscribe}
                            className="w-full bg-primary-500 text-white py-3.5 px-6 rounded-xl hover:bg-primary-600 transition-all font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
                        >
                            <CreditCard className="w-5 h-5" />
                            Subscribe Now
                            <ArrowRight className="w-5 h-5" />
                        </button>

                        <button
                            onClick={handleSignOut}
                            className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-200 transition-all font-medium flex items-center justify-center gap-2"
                        >
                            <LogOut className="w-5 h-5" />
                            Sign Out
                        </button>
                    </div>

                    {/* Help text */}
                    <p className="mt-6 text-xs text-gray-500">
                        Your data is safely stored. Subscribe anytime to pick up where you left off.
                    </p>
                </div>

                {/* Footer */}
                <div className="text-center mt-6 text-xs text-gray-500">
                    <p>Need help? Contact support@nexusimpacts.com</p>
                </div>
            </div>
        </div>
    )
}

