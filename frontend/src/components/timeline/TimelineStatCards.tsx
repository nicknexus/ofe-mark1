import React from 'react'
import { motion } from 'framer-motion'
import { UploadCloud, Link2, Unlink } from 'lucide-react'
import { TimelineStats } from '../../types'
import { ConnectionStatus } from '../../utils/timeline'
import { staggerContainer, fadeUp } from './motion'

interface TimelineStatCardsProps {
  stats: TimelineStats
  activeStatus: ConnectionStatus | null
  onStatusClick: (status: ConnectionStatus | null) => void
}

/**
 * Compact headline counters for the Timeline, rendered as a light chip strip
 * so they summarise state without competing with the claims/evidence list —
 * which is the real focus of the page. Connected / Not connected chips double
 * as one-click status filters.
 */
export default function TimelineStatCards({ stats, activeStatus, onStatusClick }: TimelineStatCardsProps) {
  const chips: Array<{
    key: string
    label: string
    value: number
    icon: typeof UploadCloud
    iconClass: string
    activeClass: string
    status: ConnectionStatus | null
  }> = [
    {
      key: 'total',
      label: 'Total',
      value: stats.total,
      icon: UploadCloud,
      iconClass: 'text-primary-600',
      activeClass: '',
      status: null,
    },
    {
      key: 'connected',
      label: 'Connected',
      value: stats.connected,
      icon: Link2,
      iconClass: 'text-impact-500',
      activeClass: 'border-impact-300 bg-impact-50 ring-1 ring-impact-400',
      status: 'connected',
    },
    {
      key: 'not_connected',
      label: 'Not connected',
      value: stats.not_connected,
      icon: Unlink,
      iconClass: 'text-red-500',
      activeClass: 'border-red-300 bg-red-50 ring-1 ring-red-400',
      status: 'not_connected',
    },
  ]

  return (
    <motion.div
      className="flex flex-wrap items-center gap-2"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {chips.map(chip => {
        const isActive = chip.status !== null && activeStatus === chip.status
        const isClickable = chip.status !== null
        return (
          <motion.button
            key={chip.key}
            type="button"
            variants={fadeUp}
            whileHover={isClickable ? { y: -2 } : undefined}
            whileTap={isClickable ? { scale: 0.97 } : undefined}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            onClick={() => isClickable && onStatusClick(isActive ? null : chip.status)}
            className={`inline-flex items-center gap-2 h-9 pl-2.5 pr-3.5 rounded-full border transition-colors ${isClickable ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'} ${isActive ? chip.activeClass : 'border-gray-200 bg-white'}`}
          >
            <chip.icon className={`w-4 h-4 flex-shrink-0 ${chip.iconClass}`} />
            <span className="text-sm font-semibold text-gray-800 tabular-nums">{chip.value}</span>
            <span className="text-sm text-gray-500">{chip.label}</span>
          </motion.button>
        )
      })}
    </motion.div>
  )
}
