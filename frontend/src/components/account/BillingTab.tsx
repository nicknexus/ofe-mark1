import React, { useState } from 'react'
import { CreditCard, ExternalLink } from 'lucide-react'
import { notify } from '../../lib/notify'
import { SubscriptionService } from '../../services/subscription'
import type { BillingTabProps } from './accountTypes'
import { Spinner } from '../ui'

export function BillingTab({ subscriptionStatus }: BillingTabProps) {
 const [loading, setLoading] = useState(false)

 const handleOpenPortal = async () => {
 setLoading(true)
 try {
 const { url } = await SubscriptionService.createPortalSession()
 window.open(url, '_blank')
 } catch (error) {
 notify.error(error instanceof Error ? error.message : 'Failed to open billing portal')
 } finally {
 setLoading(false)
 }
 }

 const plan = (subscriptionStatus?.subscription?.plan_tier as string) || 'free'
 const status = (subscriptionStatus?.subscription?.status as string) || 'none'

 return (
 <div className="app-card p-6">
 <div className="flex items-center gap-3 mb-6">
 <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
 <CreditCard className="w-5 h-5 text-primary-600" />
 </div>
 <div>
 <h2 className="text-lg font-semibold text-gray-900">Billing & Subscription</h2>
 <p className="text-sm text-gray-500">Manage your plan, payment methods, and invoices</p>
 </div>
 </div>

 <div className="bg-gray-50 rounded-xl p-4 mb-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-medium text-gray-500">Current Plan</p>
 <p className="text-lg font-bold text-gray-900 capitalize mt-0.5">{plan === 'none' ? 'Free' : plan}</p>
 </div>
 <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status === 'active' ? 'bg-impact-100 text-impact-700' :
 status === 'trial' ? 'app-icon-tile app-icon-tile-accent' :
 status === 'canceled' ? 'bg-red-100 text-red-700' :
 'bg-gray-100 text-gray-600'
 }`}>
 {status === 'active' ? 'Active' :
 status === 'trial' ? 'Trial' :
 status === 'canceled' ? 'Canceled' :
 'Inactive'}
 </span>
 </div>
 </div>

 <p className="text-sm text-gray-600 mb-4">
 Open the Stripe billing portal to manage your subscription, update payment methods, view past invoices, or cancel your plan.
 </p>

 <button
 onClick={handleOpenPortal}
 disabled={loading}
 className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
 >
 {loading ? (
 <Spinner className="w-4 h-4" />
 ) : (
 <ExternalLink className="w-4 h-4" />
 )}
 {loading ? 'Opening...' : 'Open Billing Portal'}
 </button>
 </div>
 )
}
