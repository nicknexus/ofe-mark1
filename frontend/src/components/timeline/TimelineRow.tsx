import React from 'react'
import { motion } from 'framer-motion'
import { Badge } from '../ui'
import { ConnectionStatus } from '../../utils/timeline'
import { rowEntrance } from './motion'

export interface TimelineRowProps {
  leading: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  metric: React.ReactNode
  whereWhen: { location: string; date: string }
  uploadedBy: string
  connectionSummary: React.ReactNode
  status: ConnectionStatus
  onClick: () => void
  actions?: React.ReactNode
  /** Position in the list, used to cap the entrance stagger. */
  index?: number
}

/** Column headers matching the row grid below. Rendered once per list. */
export function TimelineRowHeader({ kindLabel }: { kindLabel: string }) {
  return (
    <div className="px-4 md:px-6 py-3 bg-gray-50/50 border-b border-gray-100 grid grid-cols-12 gap-3 md:gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
      <div className="col-span-8 md:col-span-3">{kindLabel}</div>
      <div className="hidden md:block md:col-span-2">Metric</div>
      <div className="hidden md:block md:col-span-2">Where &amp; When</div>
      <div className="hidden md:block md:col-span-1">By</div>
      <div className="hidden md:block md:col-span-2">Connections</div>
      <div className="col-span-4 md:col-span-2">Status</div>
    </div>
  )
}

/** Shared table-style row for the Claims and Evidence views. */
export default function TimelineRow({
  leading,
  title,
  subtitle,
  metric,
  whereWhen,
  uploadedBy,
  connectionSummary,
  status,
  onClick,
  actions,
  index = 0,
}: TimelineRowProps) {
  const entrance = rowEntrance(index)

  return (
    <motion.div
      initial={entrance.initial}
      animate={entrance.animate}
      className="px-4 md:px-6 py-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer group grid grid-cols-12 gap-3 md:gap-4 items-center"
      onClick={onClick}
    >
      {/* Item (mobile also stacks the metric + date beneath the title) */}
      <div className="col-span-8 md:col-span-3 min-w-0 flex items-center gap-3">
        <div className="flex-shrink-0">{leading}</div>
        <div className="min-w-0">
          <div className="font-medium text-gray-800 truncate">{title}</div>
          {subtitle && <div className="text-sm text-gray-500 truncate mt-0.5">{subtitle}</div>}
          <div className="mt-1 flex items-center gap-2 md:hidden">
            {metric}
            <span className="text-[11px] text-gray-400 whitespace-nowrap">{whereWhen.date}</span>
          </div>
        </div>
      </div>

      {/* Metric */}
      <div className="hidden md:block md:col-span-2 min-w-0">{metric}</div>

      {/* Where & When */}
      <div className="hidden md:block md:col-span-2 min-w-0">
        <div className="text-xs text-gray-700 truncate">{whereWhen.location}</div>
        <div className="text-xs text-gray-500 whitespace-nowrap">{whereWhen.date}</div>
      </div>

      {/* Uploaded by */}
      <div className="hidden md:block md:col-span-1 text-xs text-gray-500 truncate">{uploadedBy}</div>

      {/* Connections */}
      <div className="hidden md:block md:col-span-2 min-w-0">
        {typeof connectionSummary === 'string'
          ? <span className="app-chip text-xs">{connectionSummary}</span>
          : connectionSummary}
      </div>

      {/* Status + actions */}
      <div className="col-span-4 md:col-span-2 flex items-center justify-between gap-2">
        <Badge tone={status === 'connected' ? 'impact' : 'danger'}>
          {status === 'connected' ? 'Connected' : 'Not connected'}
        </Badge>
        {actions && (
          <div className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            {actions}
          </div>
        )}
      </div>
    </motion.div>
  )
}
