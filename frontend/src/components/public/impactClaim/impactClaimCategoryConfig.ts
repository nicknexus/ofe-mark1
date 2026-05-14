export type ImpactClaimCategoryVisual = {
    bg: string
    text: string
    accent: string
    badgeText: string
}

export const impactClaimCategoryConfig: Record<string, ImpactClaimCategoryVisual> = {
    impact: { bg: 'bg-purple-500', text: 'text-purple-600', accent: '#8b5cf6', badgeText: 'text-white' },
    output: { bg: 'bg-accent', text: 'text-accent', accent: '#c0dfa1', badgeText: 'text-gray-800' },
    input: { bg: 'bg-evidence-500', text: 'text-evidence-700', accent: '#82a3a1', badgeText: 'text-white' },
}
