import React from 'react'
import { Package } from 'lucide-react'
import { Badge } from '../ui'
import { ConnectionStatus, GroupPosition } from '../../utils/timeline'

export interface TimelineRowProps {
 leading: React.ReactNode
 title: React.ReactNode
 subtitle?: React.ReactNode
 whereWhen: { location: string; date: string }
 uploadedBy: string
 connectionSummary: string
 status: ConnectionStatus
 groupPosition: GroupPosition
 onClick: () => void
 actions?: React.ReactNode
}

/** Column headers matching the row grid below. Rendered once per list. */
export function TimelineRowHeader({ kindLabel }: { kindLabel: string }) {
 return (
 <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100 grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
 <div className="col-span-4">{kindLabel}</div>
 <div className="col-span-2">Where &amp; When</div>
 <div className="col-span-2">Uploaded by</div>
 <div className="col-span-2">Connections</div>
 <div className="col-span-2">Status</div>
 </div>
 )
}

/** Group banner shown above rows detected as one batch ("package") upload. */
export function TimelinePackageHeader({ count }: { count: number }) {
 return (
 <div className="px-6 py-2 bg-impact-50/50 border-b border-gray-100 flex items-center gap-2">
 <div className="w-6 h-6 rounded-full bg-impact-100 flex items-center justify-center">
 <Package className="w-3.5 h-3.5 text-impact-600" />
 </div>
 <span className="text-xs font-medium text-impact-600">Package upload · {count} items</span>
 </div>
 )
}

/**
 * Shared table-style row for the Claims and Evidence views. Grouped rows get
 * a vertical connector in the leading gutter (mockup's package styling).
 */
export default function TimelineRow({
 leading,
 title,
 subtitle,
 whereWhen,
 uploadedBy,
 connectionSummary,
 status,
 groupPosition,
 onClick,
 actions,
}: TimelineRowProps) {
 const inGroup = groupPosition !== 'single'

 return (
 <div
 className="px-6 py-4 hover:bg-gray-50/50 transition-all duration-200 cursor-pointer group grid grid-cols-12 gap-4 items-center"
 onClick={onClick}
 >
 {/* Item + package connector */}
 <div className="col-span-4 min-w-0 flex items-center gap-3 relative">
 {inGroup && (
 <div className="absolute -left-4 top-0 bottom-0 flex flex-col items-center w-2">
 {groupPosition !== 'first' && <div className="w-px flex-1 bg-impact-200" />}
 <div className="w-1.5 h-1.5 rounded-full bg-impact-500 my-0.5" />
 {groupPosition !== 'last' && <div className="w-px flex-1 bg-impact-200" />}
 </div>
 )}
 <div className="flex-shrink-0">{leading}</div>
 <div className="min-w-0">
 <div className="font-medium text-gray-800 truncate">{title}</div>
 {subtitle && <div className="text-sm text-gray-500 truncate mt-0.5">{subtitle}</div>}
 </div>
 </div>

 {/* Where & When */}
 <div className="col-span-2 min-w-0">
 <div className="text-xs text-gray-700 truncate">{whereWhen.location}</div>
 <div className="text-xs text-gray-500 whitespace-nowrap">{whereWhen.date}</div>
 </div>

 {/* Uploaded by */}
 <div className="col-span-2 text-xs text-gray-500 truncate">{uploadedBy}</div>

 {/* Connections */}
 <div className="col-span-2">
 <span className="app-chip text-xs">{connectionSummary}</span>
 </div>

 {/* Status + actions */}
 <div className="col-span-2 flex items-center justify-between gap-2">
 <Badge tone={status === 'connected' ? 'impact' : 'danger'}>
 {status === 'connected' ? 'Connected' : 'Not connected'}
 </Badge>
 {actions && (
 <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
 {actions}
 </div>
 )}
 </div>
 </div>
 )
}
