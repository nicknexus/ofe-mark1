import React from 'react'
import type { LucideProps } from 'lucide-react'

/**
 * "IC" (Impact Claim) monogram rendered as a lucide-compatible icon so it can
 * drop into any slot that expects a LucideIcon (e.g. ModalHeader's accent tile)
 * in place of the old chart glyph. Inherits size/color via `currentColor`.
 */
export const ImpactClaimGlyph = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ className }, ref) => (
    <svg ref={ref} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <text
        x="12"
        y="13"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="11"
        fontWeight="700"
        letterSpacing="-0.5"
        fill="currentColor"
      >
        IC
      </text>
    </svg>
  )
)

ImpactClaimGlyph.displayName = 'ImpactClaimGlyph'

/**
 * Vibrant "IC" tile used as the leading glyph for impact claims across the
 * Timeline. Deep sage gradient + white monogram so it pops against the light
 * list while staying inside the brand palette.
 */
export function ImpactClaimBadge({
  className = 'w-9 h-9',
  textClassName = 'text-[11px]',
}: {
  className?: string
  textClassName?: string
}) {
  return (
    <div
      className={`${className} rounded-xl bg-gradient-to-br from-primary-200 to-primary-400 flex items-center justify-center flex-shrink-0 shadow-sm ring-1 ring-primary-500/30`}
    >
      <span className={`${textClassName} font-extrabold tracking-tight text-primary-900`}>IC</span>
    </div>
  )
}

export default ImpactClaimGlyph
