import { useState } from 'react'
import { X, Check, Sparkles } from 'lucide-react'
import ModalFrame from './ModalFrame'
import { notify } from '../lib/notify'
import { SubscriptionService } from '../services/subscription'
import { Spinner } from './ui'

interface UpgradeModalProps {
    isOpen: boolean
    onClose: () => void
    /** Short context line, e.g. "Metric tags are available on Growth and Pro." */
    subtitle?: string
    title?: string
}

const TIERS = [
    {
        tier: 'growth' as const,
        name: 'Growth',
        monthly: 75,
        annual: 750,
        popular: true,
        features: [
            '10 programs',
            '10 team members',
            '15 locations',
            '300 GB storage',
            'Unlimited AI reports',
            'Tags & beneficiary groups',
        ],
    },
    {
        tier: 'pro' as const,
        name: 'Pro',
        monthly: 240,
        annual: 2400,
        popular: false,
        features: [
            '25 programs',
            '20 team members',
            '30 locations',
            '1 TB storage',
            'Unlimited AI reports',
            'Advanced / white-label widgets',
        ],
    },
]

/**
 * Upgrade prompt shown when a Free-plan user hits a paywalled feature or limit.
 * Shows Growth + Pro side by side with a monthly/annual toggle and starts Stripe
 * Checkout directly for the chosen tier.
 */
export default function UpgradeModal({ isOpen, onClose, subtitle, title }: UpgradeModalProps) {
    const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly')
    const [loadingTier, setLoadingTier] = useState<string | null>(null)

    if (!isOpen) return null

    const handleUpgrade = async (tier: 'growth' | 'pro') => {
        setLoadingTier(tier)
        try {
            const { url } = await SubscriptionService.createCheckoutSession({ tier, interval })
            if (url) window.location.href = url
            else notify.error('Failed to start checkout')
        } catch (error) {
            notify.error(error instanceof Error ? error.message : 'Failed to start checkout')
            setLoadingTier(null)
        }
    }

    return (
        <ModalFrame zIndexClass="z-[70]" panelClassName="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-app-modal">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-primary-50 to-emerald-50 p-6 text-center border-b border-primary-100">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 app-btn app-btn-icon app-btn-ghost"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <Sparkles className="w-7 h-7 text-primary-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">{title || 'Upgrade your plan'}</h2>
                {subtitle && <p className="text-gray-600 text-sm">{subtitle}</p>}

                {/* Billing toggle */}
                <div className="inline-flex mt-4 rounded-lg bg-white/70 p-0.5 text-xs font-medium shadow-sm">
                    <button
                        onClick={() => setInterval('monthly')}
                        className={`px-4 py-1.5 rounded-md transition-colors ${interval === 'monthly' ? 'bg-primary-600 text-white' : 'text-gray-600'}`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setInterval('annual')}
                        className={`px-4 py-1.5 rounded-md transition-colors ${interval === 'annual' ? 'bg-primary-600 text-white' : 'text-gray-600'}`}
                    >
                        Annual · 2 months free
                    </button>
                </div>
            </div>

            {/* Tier cards */}
            <div className="p-6 grid sm:grid-cols-2 gap-4">
                {TIERS.map((t) => (
                    <div
                        key={t.tier}
                        className={`relative rounded-xl border p-5 flex flex-col ${t.popular ? 'border-primary-300 ring-1 ring-primary-200' : 'border-gray-200'}`}
                    >
                        {t.popular && (
                            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                                MOST POPULAR
                            </div>
                        )}
                        <div className="flex items-baseline justify-between mb-3">
                            <p className="text-lg font-bold text-gray-900">{t.name}</p>
                            <p className="text-right">
                                <span className="text-2xl font-bold text-gray-900">
                                    ${interval === 'annual' ? t.annual.toLocaleString() : t.monthly}
                                </span>
                                <span className="text-sm text-gray-500">/{interval === 'annual' ? 'yr' : 'mo'}</span>
                            </p>
                        </div>
                        <ul className="space-y-2 flex-1 mb-4">
                            {t.features.map((f) => (
                                <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                                    <Check className="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
                                    <span>{f}</span>
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={() => handleUpgrade(t.tier)}
                            disabled={loadingTier !== null}
                            className={`w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${t.popular ? 'bg-primary-600 hover:bg-primary-700 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'}`}
                        >
                            {loadingTier === t.tier ? <Spinner className="w-4 h-4" /> : null}
                            {loadingTier === t.tier ? 'Opening...' : `Upgrade to ${t.name}`}
                        </button>
                    </div>
                ))}
            </div>

            <div className="px-6 pb-6 -mt-2 text-center">
                <button
                    onClick={onClose}
                    className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                    Maybe later
                </button>
            </div>
        </ModalFrame>
    )
}
