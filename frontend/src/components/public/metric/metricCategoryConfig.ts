export type MetricCategoryVisual = { bg: string; text: string; gradient: string; accent: string }

export const metricCategoryConfig: Record<string, MetricCategoryVisual> = {
    impact: { bg: 'bg-purple-500', text: 'text-purple-600', gradient: 'from-purple-500 to-purple-600', accent: '#8b5cf6' },
    output: { bg: 'bg-accent', text: 'text-accent', gradient: 'from-accent to-primary-600', accent: '#c0dfa1' },
    input: { bg: 'bg-evidence-500', text: 'text-evidence-700', gradient: 'from-evidence-500 to-evidence-600', accent: '#82a3a1' },
}
