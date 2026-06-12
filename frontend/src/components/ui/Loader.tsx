import React from 'react'
import { cn } from '../../lib/utils'

/** Simple circle spinner. Size via className (e.g. w-7 h-7). Style: index.css `.app-spinner`. */
export function Spinner({ className }: { className?: string }) {
 return <div className={cn('app-spinner', className)} role="status" aria-label="Loading" />
}

/**
 * Section-level loader. Use INSIDE a section/card that keeps its surrounding
 * chrome (so a refetch doesn't blank the whole screen).
 */
export function SectionLoader({ label, className }: { label?: string; className?: string }) {
 return (
 <div className={cn('flex flex-col items-center justify-center py-12 gap-3', className)}>
 <Spinner className="w-7 h-7" />
 {label && <p className="text-sm text-secondary-500">{label}</p>}
 </div>
 )
}

/** Full page/route loader (initial load only). */
export function PageLoader({ label }: { label?: string }) {
 return (
 <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
 <Spinner className="w-9 h-9" />
 {label && <p className="text-sm text-secondary-500">{label}</p>}
 </div>
 )
}

export default SectionLoader
