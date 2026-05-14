export const METRIC_COLOR_PALETTE = [
    '#3b82f6',
    '#10b981',
    '#8b5cf6',
    '#f59e0b',
    '#ef4444',
    '#06b6d4',
    '#ec4899',
    '#84cc16',
    '#f97316',
    '#6366f1',
    '#14b8a6',
    '#a855f7',
]

export function getMetricColor(index: number): string {
    return METRIC_COLOR_PALETTE[index % METRIC_COLOR_PALETTE.length]
}

export const CATEGORY_COLORS = {
    input: '#3b82f6',
    output: '#10b981',
    impact: '#8b5cf6',
}

export function generateMetricSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
}
