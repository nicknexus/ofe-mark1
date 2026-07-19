// Brand theming for the report canvas. Everything derives from the charity's
// brand colour so the whole document adapts to their identity.

// Default Nexus brand green — fallback when a charity hasn't set a colour.
export const DEFAULT_BRAND = '#608341'

// Parse a #RGB or #RRGGBB string. Returns the default green's components for
// anything unparsable so styling never breaks.
export function hexToRgb(hex?: string | null): { r: number; g: number; b: number } {
    const fallback = { r: 96, g: 131, b: 65 }
    if (!hex) return fallback
    let h = hex.trim().replace('#', '')
    if (h.length === 3) h = h.split('').map(c => c + c).join('')
    if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return fallback
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
    }
}

export interface BrandTheme {
    brand: string
    rgba: (alpha: number) => string
    /** Very light wash for section backgrounds */
    softBg: string
    /** Slightly stronger tint for icon chips and chart tracks */
    tintBg: string
    /** Tinted border for cards */
    border: string
    /** Darkened brand for text on light backgrounds (keeps contrast for light brand colours) */
    ink: string
    /** Darker shade of the brand for gradient ends */
    shade: string
}

export function buildTheme(brandColor?: string | null): BrandTheme {
    const { r, g, b } = hexToRgb(brandColor || DEFAULT_BRAND)
    const rgba = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`
    const darken = (v: number, f: number) => Math.round(v * f)
    return {
        brand: `rgb(${r}, ${g}, ${b})`,
        rgba,
        softBg: rgba(0.05),
        tintBg: rgba(0.12),
        border: rgba(0.22),
        ink: `rgb(${darken(r, 0.72)}, ${darken(g, 0.72)}, ${darken(b, 0.72)})`,
        shade: `rgb(${darken(r, 0.6)}, ${darken(g, 0.6)}, ${darken(b, 0.6)})`
    }
}

export function formatReportDate(dateStr?: string): string {
    if (!dateStr) return ''
    try {
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return dateStr
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
        return dateStr
    }
}
