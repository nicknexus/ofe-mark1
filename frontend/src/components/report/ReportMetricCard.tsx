import React from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeUp } from '../timeline/motion'

export const REPORT_METRIC_CARD_H = 'h-[112px]'

export interface ReportMetricCardProps {
  title: string
  color: string
  total?: number
  unit?: string
  metricType?: string
  selected?: boolean
  selectable?: boolean
  onToggle?: () => void
  /** Open metric detail — same hover/affordance as the Metrics tab cards. */
  onClick?: () => void
  /** Wrap in motion fade-up (for staggered grids). */
  animate?: boolean
}

/** Metrics-tab-style card for report builder select + review steps. */
export default function ReportMetricCard({
  title,
  color,
  total,
  unit,
  metricType,
  selected = false,
  selectable = false,
  onToggle,
  onClick,
  animate = false,
}: ReportMetricCardProps) {
  const isPct = metricType === 'percentage'
  const hasValue = typeof total === 'number'
  const interactiveSelect = selectable && onToggle
  const interactiveOpen = !interactiveSelect && !!onClick

  const card = (
    <div
      role={interactiveSelect || interactiveOpen ? 'button' : undefined}
      tabIndex={interactiveSelect || interactiveOpen ? 0 : undefined}
      onClick={interactiveSelect ? onToggle : interactiveOpen ? onClick : undefined}
      onKeyDown={
        interactiveSelect || interactiveOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (interactiveSelect) onToggle?.()
                else onClick?.()
              }
            }
          : undefined
      }
      className={`relative bg-white rounded-2xl border shadow-card p-4 h-full flex flex-col transition-all duration-200 ${
        interactiveSelect || interactiveOpen ? 'cursor-pointer group' : ''
      } ${
        selected
          ? 'border-primary-400 bg-primary-50/40 ring-2 ring-primary-200 shadow-card-hover'
          : interactiveSelect || interactiveOpen
            ? 'border-gray-200/70 hover:shadow-card-hover hover:border-primary-300/70 hover:-translate-y-0.5'
            : 'border-gray-200/70'
      }`}
    >
      {(interactiveOpen || (selectable && selected)) && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5">
          {selectable && selected && (
            <span className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </span>
          )}
          {interactiveOpen && (
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
          )}
        </div>
      )}

      <div className={`flex items-start gap-2 ${interactiveOpen || selectable ? 'pr-8' : ''} mb-3`}>
        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: color }} />
        <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2" title={title}>
          {title}
        </p>
      </div>

      {hasValue && (
        <div className="flex items-baseline gap-1.5 mt-auto">
          <span className="text-2xl font-semibold text-gray-900 tabular-nums">
            {isPct ? `${Math.round(total)}%` : total.toLocaleString()}
          </span>
          {!isPct && unit && <span className="text-xs text-gray-400 truncate">{unit}</span>}
        </div>
      )}

      {!hasValue && selectable && (
        <p className="text-xs text-gray-400 mt-auto">Included when selected</p>
      )}
    </div>
  )

  const inner = <div className={REPORT_METRIC_CARD_H}>{card}</div>

  if (animate) {
    return <motion.div variants={fadeUp}>{inner}</motion.div>
  }

  return inner
}
