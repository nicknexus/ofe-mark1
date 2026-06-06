import React from 'react'
import { type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface EmptyStateProps {
 icon?: LucideIcon
 title: string
 description?: string
 /** Optional CTA (usually a <Button>). */
 action?: React.ReactNode
 className?: string
}

/**
 * Master empty state for the authenticated tier. Replaces per-page ad-hoc
 * empty blocks and the `.mobile-empty-*` duplication.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
 return (
 <div className={cn('app-empty', className)}>
 {Icon && (
 <div className="app-empty-icon">
 <Icon className="w-6 h-6" />
 </div>
 )}
 <h3 className="app-empty-title">{title}</h3>
 {description && <p className="app-empty-text">{description}</p>}
 {action && <div className="mt-4">{action}</div>}
 </div>
 )
}

export default EmptyState
