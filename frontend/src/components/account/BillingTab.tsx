import React, { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { notify } from '../../lib/notify'
import { SubscriptionService } from '../../services/subscription'
import type { BillingTabProps } from './accountTypes'
import { Badge, Spinner } from '../ui'

// Self-serve upgrade tiers. Annual = 2 months free (10x monthly).
const UPGRADE_TIERS = [
 {
 tier: 'growth' as const,
 name: 'Growth',
 monthly: '$75/mo',
 annual: '$750/yr',
 blurb: '10 programs · 10 team · 15 locations · 300 GB · unlimited AI · tags & beneficiary groups',
 },
 {
 tier: 'pro' as const,
 name: 'Pro',
 monthly: '$240/mo',
 annual: '$2,400/yr',
 blurb: '25 programs · 20 team · 30 locations · 1 TB · unlimited AI · advanced widgets',
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

 const plan = (subscriptionStatus?.subscription?.plan_tier as string) || 'none'
 const status = (subscriptionStatus?.subscription?.status as string) || 'none'
 const hasStripe = !!subscriptionStatus?.subscription?.stripe_subscription_id
 // Live Stripe subs (including trial) manage via the portal so we never open
 // a second Checkout and accidentally mint another trial.
 const isPaid = status === 'active' || status === 'past_due' || (status === 'trial' && hasStripe)
 const remainingDays = subscriptionStatus?.remainingTrialDays
 const planLabel = plan === 'none' || plan === 'free' ? (status === 'free' ? 'Free' : 'None') : plan
 const statusTone = status === 'active' ? 'impact' : status === 'trial' ? 'accent' : status === 'past_due' ? 'warning' : status === 'cancelled' || status === 'canceled' ? 'danger' : 'neutral'
 const statusLabel = status === 'active' ? 'Active' : status === 'trial' ? 'Trial' : status === 'past_due' ? 'Past due' : status === 'cancelled' || status === 'canceled' ? 'Canceled' : 'Inactive'
 const daysLeft = status === 'trial' && remainingDays != null
  ? remainingDays === 0
   ? 'Ends today'
   : remainingDays === 1
    ? '1 day left'
    : `${remainingDays} days left`
  : null

 return (
 <div className="app-card p-6">
 <div className="mb-6">
 <h2 className="app-card-title">Plan</h2>
 <p className="app-muted mt-1">Manage your subscription, payment methods, and invoices.</p>
 </div>

 <div className="app-card-muted p-4 mb-6">
 <div className="flex items-start justify-between gap-4">
 <div className="min-w-0">
 <p className="text-xs font-medium text-secondary-500">Current plan</p>
 <p className="text-lg font-semibold text-secondary-900 capitalize mt-0.5">{planLabel}</p>
 {daysLeft && (
  <p className="text-sm text-secondary-500 mt-1">{daysLeft}</p>
 )}
 </div>
 <Badge tone={statusTone} className="shrink-0">{statusLabel}</Badge>
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
