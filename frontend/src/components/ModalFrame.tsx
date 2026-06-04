import React, { useEffect } from 'react'
import { X, type LucideIcon } from 'lucide-react'
import { cn } from '../lib/utils'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

interface ModalFrameProps {
 children: React.ReactNode
 zIndexClass?: string
 backdropClassName?: string
 /** Escape hatch: full control of the panel classes (overrides `size`). */
 panelClassName?: string
 /** Master width preset. Drives the panel when `panelClassName` is omitted. */
 size?: ModalSize
 /** Padding on overlay (e.g. p-0 md:p-4 for full-bleed mobile) */
 paddingClassName?: string
 animate?: boolean
}

// Roomier scale so modals breathe (SaaS standard).
const sizeMaxW: Record<ModalSize, string> = {
 sm: 'max-w-md',
 md: 'max-w-2xl',
 lg: 'max-w-4xl',
 xl: 'max-w-5xl',
 '2xl': 'max-w-6xl',
 full: 'max-w-[1500px]',
}

/** Standard master panel chrome (rounded, bordered, app-modal shadow, column scroll). */
const PANEL_BASE =
 'bg-white rounded-xl border border-gray-200 w-full max-h-[90vh] overflow-hidden shadow-app-modal flex flex-col'

export default function ModalFrame({
 children,
 zIndexClass = 'z-[80]',
 backdropClassName = 'bg-gray-900/40 backdrop-blur-sm',
 panelClassName,
 size = 'md',
 paddingClassName = 'p-4',
 animate = true,
}: ModalFrameProps) {
 useEffect(() => {
 const prev = document.body.style.overflow
 document.body.style.overflow = 'hidden'
 return () => { document.body.style.overflow = prev }
 }, [])

 const panel = panelClassName ?? cn(PANEL_BASE, sizeMaxW[size])

 return (
 <div className={cn('fixed inset-0 flex items-center justify-center', paddingClassName, zIndexClass, backdropClassName, animate && 'animate-fade-in')}>
 <div className={cn(panel, animate && 'animate-slide-up-fast')}>
 {children}
 </div>
 </div>
 )
}

/* ----------------------------------------------------------------------------
 * Composable master modal sections. Use these inside <ModalFrame> for a
 * consistent header / scrollable body / footer across every dialog.
 * -------------------------------------------------------------------------- */

interface ModalHeaderProps {
 title: React.ReactNode
 subtitle?: React.ReactNode
 /** Leading icon, rendered in an accent tile. */
 icon?: LucideIcon
 onClose?: () => void
 /** Extra controls rendered left of the close button. */
 actions?: React.ReactNode
 className?: string
}

export function ModalHeader({ title, subtitle, icon: Icon, onClose, actions, className }: ModalHeaderProps) {
 return (
 <div className={cn('app-modal-header', className)}>
 <div className="flex items-start gap-3 min-w-0">
 {Icon && (
 <div className="app-icon-tile app-icon-tile-accent mt-0.5">
 <Icon className="w-5 h-5" />
 </div>
 )}
 <div className="min-w-0">
 {typeof title === 'string' ? <h2 className="app-modal-title truncate">{title}</h2> : title}
 {subtitle && (typeof subtitle === 'string' ? <p className="app-modal-subtitle">{subtitle}</p> : subtitle)}
 </div>
 </div>
 <div className="flex items-center gap-1.5 flex-shrink-0">
 {actions}
 {onClose && (
 <button
 type="button"
 onClick={onClose}
 aria-label="Close"
 className="app-btn-icon -mr-1.5 rounded-lg text-secondary-500 hover:bg-gray-100 hover:text-secondary-900 transition-colors flex items-center justify-center"
 >
 <X className="w-5 h-5" />
 </button>
 )}
 </div>
 </div>
 )
}

interface ModalBodyProps {
 children: React.ReactNode
 /** Constrain content to a centered rail (good for forms in wide panels). */
 rail?: boolean
 className?: string
}

export function ModalBody({ children, rail = false, className }: ModalBodyProps) {
 return (
 <div className={cn('app-modal-body', className)}>
 {rail ? <div className="app-modal-rail">{children}</div> : children}
 </div>
 )
}

export function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
 return <div className={cn('app-modal-footer', className)}>{children}</div>
}

/* Field grid for detail/preview modals — clean label/value info display. */
export function ModalFieldGrid({ children, className }: { children: React.ReactNode; className?: string }) {
 return <dl className={cn('app-field-grid', className)}>{children}</dl>
}

export function ModalField({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
 return (
 <div className={cn('min-w-0', className)}>
 <dt className="app-field-label">{label}</dt>
 <dd className="app-field-value">{children}</dd>
 </div>
 )
}
