import React from 'react'
import { motion } from 'framer-motion'
import { Badge } from '../ui'
import { getStatusStyle, LogStatus } from './statusStyles'
import { rowEntrance } from './motion'

export type RowLayout = 'claim' | 'evidence'

export interface TimelineRowProps {
  leading?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  metric: React.ReactNode
  whereWhen: { location: string; date: string }
  uploadedBy: string
  connectionSummary: React.ReactNode
  status: LogStatus
  onClick: () => void
  actions?: React.ReactNode
  /** Position in the list, used to cap the entrance stagger. */
  index?: number
  /** Column preset. Claims lead with just a number so their first column is
   * narrower, giving the data columns most of the width; evidence needs more
   * room for the title. */
  layout?: RowLayout
}

/** Desktop column spans per layout (mobile stays 8/4 for item/status). */
const COLS: Record<RowLayout, { item: string; metric: string; where: string; by: string; conn: string; status: string }> = {
  claim: {
    item: 'md:col-span-2',
    metric: 'md:col-span-2',
    where: 'md:col-span-3',
    by: 'md:col-span-1',
    conn: 'md:col-span-2',
    status: 'md:col-span-2',
  },
  evidence: {
    item: 'md:col-span-3',
    metric: 'md:col-span-2',
    where: 'md:col-span-2',
    by: 'md:col-span-1',
    conn: 'md:col-span-2',
    status: 'md:col-span-2',
  },
}

/** Column headers matching the row grid below. Rendered once per list. */
export function TimelineRowHeader({ kindLabel, layout = 'evidence' }: { kindLabel: string; layout?: RowLayout }) {
  const c = COLS[layout]
  return (
    <div className="px-4 md:px-6 py-3 bg-gray-50/50 border-b border-gray-100 grid grid-cols-12 gap-3 md:gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
      <div className={`col-span-8 ${c.item}`}>{kindLabel}</div>
      <div className={`hidden md:block ${c.metric}`}>Metric</div>
      <div className={`hidden md:block ${c.where}`}>Where &amp; When</div>
      <div className={`hidden md:block ${c.by}`}>By</div>
      <div className={`hidden md:block ${c.conn}`}>Connections</div>
      <div className={`col-span-4 ${c.status}`}>Status</div>
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
  layout = 'evidence',
}: TimelineRowProps) {
  const entrance = rowEntrance(index)
  const c = COLS[layout]
  const style = getStatusStyle(status)
  const StatusIcon = style.icon

  return (
    <motion.div
      initial={entrance.initial}
      animate={entrance.animate}
      className={`px-4 md:px-6 py-4 ${style.row} ${style.rowHover} transition-colors duration-200 cursor-pointer group grid grid-cols-12 gap-3 md:gap-4 items-center`}
      onClick={onClick}
    >
      {/* Item (mobile also stacks the metric + date beneath the title) */}
      <div className={`col-span-8 ${c.item} min-w-0 flex items-center gap-3`}>
        {leading != null && <div className="flex-shrink-0">{leading}</div>}
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
      <div className={`hidden md:block ${c.metric} min-w-0`}>{metric}</div>

      {/* Where & When */}
      <div className={`hidden md:block ${c.where} min-w-0`}>
        <div className="text-xs text-gray-700 truncate">{whereWhen.location}</div>
        <div className="text-xs text-gray-500 whitespace-nowrap">{whereWhen.date}</div>
      </div>

      {/* Uploaded by */}
      <div className={`hidden md:block ${c.by} text-xs text-gray-500 truncate`}>{uploadedBy}</div>

      {/* Connections */}
      <div className={`hidden md:block ${c.conn} min-w-0`}>
        {typeof connectionSummary === 'string'
          ? <span className="app-chip text-xs">{connectionSummary}</span>
          : connectionSummary}
      </div>

      {/* Status + actions */}
      <div className={`col-span-4 ${c.status} flex items-center justify-between gap-2`}>
        <Badge tone={style.tone} className={style.badge}>
          <StatusIcon className={`w-3.5 h-3.5 ${style.badge ? style.accent : ''}`} />
          {style.label}
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
