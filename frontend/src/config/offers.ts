export interface OfferConfig {
    slug: string
    orgName: string
    priceId: string
    planTier: 'starter' | 'professional' | 'enterprise'
    dailyRate: string
    billingLabel: string
    billingCycleNote: string
    features: string[]
}

// To add a new offer:
// 1. Create a recurring Price in Stripe Dashboard (Products → Add Price)
// 2. Copy the price ID (starts with price_)
// 3. Add a new entry below with a URL-friendly slug
// 4. Send the link: https://yourapp.com/offer/<slug>

export const OFFERS: Record<string, OfferConfig> = {
    'haiti-empowered': {
        slug: 'haiti-empowered',
        orgName: 'Haiti Empowered Inc.',
        priceId: 'price_1T8mDoIPtCmqEbDekSoqVgo3',
        planTier: 'starter',
        dailyRate: '$2',
        billingLabel: '$364 every 26 weeks',
        billingCycleNote: '$364 billed every 26 weeks',
        features: [
            'Up to 3 initiatives',
            'Full KPI tracking & analytics',
            'Evidence management',
            'Public impact reports',
            'Story collection',
            'All integrations',
        ],
    },
}
