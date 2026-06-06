import React from 'react'
import { cn } from '../../lib/utils'

export type BadgeTone = 'neutral' | 'accent' | 'evidence' | 'impact' | 'warning' | 'danger'

const tones: Record<BadgeTone, string> = {
 neutral: 'bg-gray-100 text-secondary-600',
 accent: 'bg-primary-100 text-primary-800',
 evidence: 'bg-evidence-50 text-evidence-600',
 impact: 'bg-impact-50 text-impact-600',
 warning: 'bg-amber-50 text-amber-700',
 danger: 'bg-red-50 text-red-600',
}

export interface BadgeProps {
 tone?: BadgeTone
 className?: string
 children: React.ReactNode
}

/** Master pill/badge. Semantic tones map to theme colors (no raw blue/green). */
export function Badge({ tone = 'neutral', className, children }: BadgeProps) {
 return (
 <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', tones[tone], className)}>
 {children}
 </span>
 )
}

export default Badge
