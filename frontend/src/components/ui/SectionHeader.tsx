import React from 'react'
import { cn } from '../../lib/utils'

export interface SectionHeaderProps {
 title: string
 /** Optional count chip next to the title. */
 count?: number
 /** Right-aligned actions. */
 actions?: React.ReactNode
 className?: string
}

/**
 * Master section header for groups of content within a page (e.g. "Evidence",
 * "Stories"). Uses the uppercase tracked label style.
 */
export function SectionHeader({ title, count, actions, className }: SectionHeaderProps) {
 return (
 <div className={cn('flex items-center justify-between gap-3 mb-3', className)}>
 <div className="flex items-center gap-2 min-w-0">
 <h2 className="app-section-title">{title}</h2>
 {typeof count === 'number' && <span className="app-chip">{count}</span>}
 </div>
 {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
 </div>
 )
}

export default SectionHeader
