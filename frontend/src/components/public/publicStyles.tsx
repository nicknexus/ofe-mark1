import React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Shared visual tokens for ALL public-facing pages.
//
// We anchor every public page on the same look established by the embed
// widget + the public org dashboard:
//
//   • A solid white base with a single radial brand wash (no glassmorphism,
//     no green ambient bleed-through from the app shell).
//   • White solid cards with a slightly darker border (gray-200/80) and a
//     two-layer slate shadow that "pops" without lifting on hover.
//   • White section icon chips with a subtle inset border so the brand-tinted
//     icon inside reads as the focal point.
//   • Count badges + active filter rings derived from the org's brand color.
//
// Importing pages should NOT redeclare these classes — keeping everything in
// one place is what makes "restyle every page like the widget" actually
// possible across a 9k-line surface area.
// ─────────────────────────────────────────────────────────────────────────────

// Resolve a usable brand color even when org metadata hasn't loaded yet.
export const DEFAULT_PUBLIC_BRAND = '#c0dfa1'

/** Solid white base + a single brand radial wash, identical to the org page. */
export function PublicPageBackground({ brandColor }: { brandColor?: string | null }) {
    const brand = brandColor || DEFAULT_PUBLIC_BRAND
    return (
        <>
            <div className="fixed inset-0 pointer-events-none bg-white" />
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse 55% 60% at 28% 55%, ${brand}1A 0%, ${brand}30 40%, ${brand}55 80%)`,
                }}
            />
        </>
    )
}

/** Solid white card with the "widget pop" shadow stack and a hover ramp. */
export const PUBLIC_CARD_CLASS =
    'bg-white border border-gray-200/80 shadow-[0_2px_8px_-1px_rgba(15,23,42,0.10),0_4px_16px_-4px_rgba(15,23,42,0.10)] hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.14),0_6px_20px_-6px_rgba(15,23,42,0.14)] hover:border-gray-300 transition-all'

/** Large panel: `rounded-2xl` + widget card token. Use for top-level sections. */
export const PUBLIC_PANEL_CLASS = `rounded-2xl ${PUBLIC_CARD_CLASS}`

/** Small tile: `rounded-xl` + widget card token. Use for tiles inside a panel. */
export const PUBLIC_TILE_CLASS = `rounded-xl ${PUBLIC_CARD_CLASS}`

/**
 * Static panel — same widget shadow stack but without the hover ramp.
 * Use for non-interactive section containers (e.g. KPI grids, info panels)
 * where the hover lift would be misleading.
 */
export const PUBLIC_PANEL_STATIC_CLASS =
    'rounded-2xl bg-white border border-gray-200/80 shadow-[0_2px_8px_-1px_rgba(15,23,42,0.10),0_4px_16px_-4px_rgba(15,23,42,0.10)]'

/** Header bar matching the public org dashboard. */
export const PUBLIC_HEADER_CLASS =
    'flex-shrink-0 bg-white border-b border-gray-100 shadow-sm z-50 relative'

/** White icon chip used next to section titles (e.g. Metrics, Evidence). */
export const PUBLIC_SECTION_CHIP_STYLE: React.CSSProperties = {
    backgroundColor: '#ffffff',
    boxShadow:
        '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)',
}

/** Brand-colored icon (used inside section chips, count badges, big numbers). */
export function brandIconStyle(brandColor: string): React.CSSProperties {
    return { color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }
}

/** Brand-tinted count / status badge sitting next to a section title. */
export function publicCountBadgeStyle(brandColor: string): React.CSSProperties {
    return {
        backgroundColor: `${brandColor}15`,
        border: `1px solid ${brandColor}25`,
    }
}

/**
 * Filter pill border + ring.
 * Pass `active = true` while the filter has a value to switch to a brand
 * border + soft brand ring; otherwise renders the neutral default.
 */
export function publicActiveFilterStyle(
    brandColor: string,
    active: boolean
): React.CSSProperties {
    return active
        ? {
              border: `1.5px solid ${brandColor}`,
              boxShadow: `0 1px 2px rgba(15,23,42,0.06), 0 0 0 3px ${brandColor}20`,
          }
        : {
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
          }
}
