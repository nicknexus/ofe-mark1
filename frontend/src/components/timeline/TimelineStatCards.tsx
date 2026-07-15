import React from 'react'
import { motion } from 'framer-motion'
import { UploadCloud, Link2, Unlink } from 'lucide-react'
import { TimelineStats } from '../../types'
import { ConnectionStatus } from '../../utils/timeline'

interface TimelineStatCardsProps {
  stats: TimelineStats
  activeStatus: ConnectionStatus | null
  onStatusClick: (status: ConnectionStatus | null) => void
}

/**
 * Connection-status filter, rendered as a small segmented pill (same styling as
 * the view switcher). Total clears the status filter; Connected / Not connected
 * scope to that state. Single-select with a sliding active indicator.
 */
export default function TimelineStatCards({ stats, activeStatus, onStatusClick }: TimelineStatCardsProps) {
  const segments: Array<{
    key: string
    label: string
    value: number
    icon: typeof UploadCloud
    iconClass: string
    status: ConnectionStatus | null
  }> = [
    { key: 'total', label: 'Total', value: stats.total, icon: UploadCloud, iconClass: 'text-primary-600', status: null },
    { key: 'connected', label: 'Connected', value: stats.connected, icon: Link2, iconClass: 'text-impact-500', status: 'connected' },
    { key: 'not_connected', label: 'Not connected', value: stats.not_connected, icon: Unlink, iconClass: 'text-red-500', status: 'not_connected' },
  ]

  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-gray-100 border border-gray-200 flex-shrink-0">
      {segments.map(seg => {
        const isActive = seg.status === null ? activeStatus === null : activeStatus === seg.status
        return (
          <button
            key={seg.key}
            type="button"
            onClick={() => onStatusClick(seg.status === null ? null : (isActive ? null : seg.status))}
            className={`relative px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {isActive && (
              <motion.div
                layoutId="timelineStatSeg"
                className="absolute inset-0 rounded-full bg-white shadow-card"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1">
              <seg.icon className={`w-3.5 h-3.5 flex-shrink-0 ${seg.iconClass}`} />
              <span className="tabular-nums font-semibold">{seg.value}</span>
              <span className="hidden sm:inline">{seg.label}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
