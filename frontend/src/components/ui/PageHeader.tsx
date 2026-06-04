import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface PageHeaderProps {
 title: string
 subtitle?: string
 /** Optional leading icon (shown only when there is no back affordance). */
 icon?: LucideIcon
 /** Render a back button linking to this route. */
 backTo?: string
 /** Render a back button calling this handler (takes precedence over backTo). */
 onBack?: () => void
 /** Right-aligned actions (buttons, menus). */
 actions?: React.ReactNode
 className?: string
}

/**
 * Master page header for the authenticated tier. Standardizes the
 * back-link + icon + title + subtitle + actions row across every page.
 */
export function PageHeader({ title, subtitle, icon: Icon, backTo, onBack, actions, className }: PageHeaderProps) {
 const back = onBack ? (
 <button type="button" onClick={onBack} aria-label="Back" className="app-icon-tile mt-0.5 hover:bg-gray-200 transition-colors">
 <ArrowLeft className="w-5 h-5" />
 </button>
 ) : backTo ? (
 <Link to={backTo} aria-label="Back" className="app-icon-tile mt-0.5 hover:bg-gray-200 transition-colors">
 <ArrowLeft className="w-5 h-5" />
 </Link>
 ) : null

 return (
 <div className={cn('flex items-start justify-between gap-4 mb-6', className)}>
 <div className="flex items-start gap-3 min-w-0">
 {back}
 {Icon && !back && (
 <div className="app-icon-tile app-icon-tile-accent mt-0.5">
 <Icon className="w-5 h-5" />
 </div>
 )}
 <div className="min-w-0">
 <h1 className="app-page-title truncate">{title}</h1>
 {subtitle && <p className="app-page-subtitle">{subtitle}</p>}
 </div>
 </div>
 {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
 </div>
 )
}

export default PageHeader
