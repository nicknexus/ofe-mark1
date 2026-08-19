import React, { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { notify } from '../../lib/notify'
import { SubscriptionService } from '../../services/subscription'
import type { BillingTabProps } from './accountTypes'
import { Spinner } from '../ui'

// Self-serve upgrade tiers. Annual = 2 months free (10x monthly).
const UPGRADE_TIERS = [
 {
 tier: 'growth' as const,
 name: 'Growth',
 monthly: '$75/mo',
 annual: '$750/yr',
 blurb: '10 initiatives · 10 team · 15 locations · 300 GB · unlimited AI · tags & beneficiary groups',
 },
 {
 tier: 'pro' as const,
 name: 'Pro',
 monthly: '$240/mo',
 annual: '$2,400/yr',
 blurb: '25 initiatives · 20 team · 30 locations · 1 TB · unlimited AI · advanced widgets',
 },
]

export function BillingTab({ subscriptionStatus }: BillingTabProps) {
 const [loading, setLoading] = useState(false)
 const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')
 const [upgrading, setUpgrading] = useState<string | null>(null)

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

 const handleUpgrade = async (tier: 'growth' | 'pro') => {
 setUpgrading(tier)
 try {
 const { url } = await SubscriptionService.createCheckoutSession({ tier, interval })
 if (url) window.location.href = url
 else notify.error('Failed to start checkout')
 } catch (error) {
 notify.error(error instanceof Error ? error.message : 'Failed to start checkout')
 } finally {
 setUpgrading(null)
 }
 }

 const plan = (subscriptionStatus?.subscription?.plan_tier as string) || 'free'
 const status = (subscriptionStatus?.subscription?.status as string) || 'none'
 // Paid users manage their plan via the portal; free users see upgrade options.
 const isPaid = status === 'active' || status === 'past_due'

 return (
 <div className="app-card p-6">
 <div className="mb-6">
 <h2 className="text-base font-semibold text-gray-800">Plan</h2>
 <p className="text-sm text-secondary-500">Manage your subscription, payment methods, and invoices.</p>
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

 {/* Upgrade options for free users */}
 {!isPaid && (
 <div className="mb-6">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-semibold text-gray-900">Upgrade your plan</h3>
 <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
 <button
 onClick={() => setInterval('monthly')}
 className={`px-3 py-1 rounded-md transition-colors ${interval === 'monthly' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
 >
 Monthly
 </button>
 <button
 onClick={() => setInterval('annual')}
 className={`px-3 py-1 rounded-md transition-colors ${interval === 'annual' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
 >
 Annual <span className="text-impact-600">·2 months free</span>
 </button>
 </div>
 </div>
 <div className="grid sm:grid-cols-2 gap-3">
 {UPGRADE_TIERS.map(t => (
 <div key={t.tier} className="border border-gray-200 rounded-xl p-4 flex flex-col">
 <div className="flex items-baseline justify-between mb-1">
 <p className="text-base font-bold text-gray-900">{t.name}</p>
 <p className="text-sm font-semibold text-gray-900">{interval === 'annual' ? t.annual : t.monthly}</p>
 </div>
 <p className="text-xs text-gray-500 flex-1 mb-3">{t.blurb}</p>
 <button
 onClick={() => handleUpgrade(t.tier)}
 disabled={upgrading !== null}
 className="app-btn app-btn-primary w-full"
 >
 {upgrading === t.tier ? <Spinner className="w-4 h-4" /> : null}
 {upgrading === t.tier ? 'Opening...' : `Upgrade to ${t.name}`}
 </button>
 </div>
 ))}
 </div>
 </div>
 )}

 <p className="text-sm text-gray-600 mb-4">
 Open the Stripe billing portal to manage your subscription, update payment methods, view past invoices, or {isPaid ? 'change or cancel your plan' : 'redeem details'}.
 </p>

 <button
 onClick={handleOpenPortal}
 disabled={loading}
 className="app-btn app-btn-secondary"
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
