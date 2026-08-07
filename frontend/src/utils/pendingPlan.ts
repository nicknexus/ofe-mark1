/**
 * The plan a visitor picked on the landing page, stashed before they sign up
 * and read back on the other side by TrialActivationPage.
 *
 * Writer (PricingSection) and reader (TrialActivationPage) live on opposite
 * sides of the signup boundary, so the key and shape are defined once here.
 */

export type PendingTier = 'growth' | 'pro'
export type PendingInterval = 'monthly' | 'annual'

export interface PendingPlan {
    tier: PendingTier
    interval: PendingInterval
}

const STORAGE_KEY = 'pendingPlan'

export function writePendingPlan(plan: PendingPlan): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
    } catch {
        // Storage blocked (private mode / cookie settings). Signup still works;
        // the user just lands on the free plan and can upgrade from there.
    }
}

export function readPendingPlan(): PendingPlan | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (parsed?.tier === 'growth' || parsed?.tier === 'pro') {
            return { tier: parsed.tier, interval: parsed.interval === 'annual' ? 'annual' : 'monthly' }
        }
    } catch { /* ignore malformed */ }
    return null
}

export function clearPendingPlan(): void {
    try {
        localStorage.removeItem(STORAGE_KEY)
    } catch { /* nothing to clear if storage is unavailable */ }
}
