const COLOR_PALETTE = [
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
    '#22c55e',
    '#eab308',
    '#64748b',
]

export function getKPIColor(_category: string, index: number): string {
    return COLOR_PALETTE[index % COLOR_PALETTE.length]
}
