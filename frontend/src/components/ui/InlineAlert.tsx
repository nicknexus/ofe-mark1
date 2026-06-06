import React from 'react'
import { AlertTriangle, Info, CheckCircle2, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export type InlineAlertTone = 'info' | 'success' | 'warning' | 'error'

const config: Record<InlineAlertTone, { wrap: string; icon: LucideIcon }> = {
 info: { wrap: 'bg-evidence-50 text-evidence-700 border-evidence-200', icon: Info },
 success: { wrap: 'bg-impact-50 text-impact-700 border-impact-200', icon: CheckCircle2 },
 warning: { wrap: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle },
 error: { wrap: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
}

export interface InlineAlertProps {
 tone?: InlineAlertTone
 title?: string
 children?: React.ReactNode
 className?: string
}

/**
 * Master inline banner for page/section-level messages (load errors, read-only
 * notices, warnings). Use toasts for transient action feedback instead.
 */
export function InlineAlert({ tone = 'info', title, children, className }: InlineAlertProps) {
 const { wrap, icon: Icon } = config[tone]
 return (
 <div className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm', wrap, className)}>
 <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
 <div className="min-w-0">
 {title && <p className="font-semibold">{title}</p>}
 {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
 </div>
 </div>
 )
}

export default InlineAlert
