import React from 'react'
import { UploadCloud, Link2, Unlink } from 'lucide-react'
import { AppCard } from '../ui'
import { TimelineStats } from '../../types'
import { ConnectionStatus } from '../../utils/timeline'

interface TimelineStatCardsProps {
 stats: TimelineStats
 activeStatus: ConnectionStatus | null
 onStatusClick: (status: ConnectionStatus | null) => void
}

/**
 * Headline counters for the Timeline. Only the states derivable from the
 * current data model are rendered (connected / not connected); the grid is
 * sized for five cards so Suggested and Review can slot in when the review
 * workflow ships.
 */
export default function TimelineStatCards({ stats, activeStatus, onStatusClick }: TimelineStatCardsProps) {
 const cards: Array<{
 key: string
 label: string
 value: number
 icon: typeof UploadCloud
 iconClass: string
 tileClass: string
 status: ConnectionStatus | null
 }> = [
 {
 key: 'total',
 label: 'Total uploads',
 value: stats.total,
 icon: UploadCloud,
 iconClass: 'text-primary-500',
 tileClass: 'bg-primary-50',
 status: null,
 },
 {
 key: 'connected',
 label: 'Connected',
 value: stats.connected,
 icon: Link2,
 iconClass: 'text-impact-500',
 tileClass: 'bg-impact-50',
 status: 'connected',
 },
 {
 key: 'not_connected',
 label: 'Not connected',
 value: stats.not_connected,
 icon: Unlink,
 iconClass: 'text-red-500',
 tileClass: 'bg-red-50',
 status: 'not_connected',
 },
 ]

 return (
 <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
 {cards.map(card => {
 const isActive = card.status !== null && activeStatus === card.status
 return (
 <AppCard
 key={card.key}
 variant="interactive"
 padded
 className={`cursor-pointer ${isActive ? 'ring-2 ring-primary-500' : ''}`}
 onClick={() => onStatusClick(isActive ? null : card.status)}
 >
 <div className="flex items-center gap-3">
 <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${card.tileClass}`}>
 <card.icon className={`w-5 h-5 ${card.iconClass}`} />
 </div>
 <div className="min-w-0">
 <p className="text-xs text-gray-500 truncate">{card.label}</p>
 <p className="text-xl font-semibold text-gray-800">{card.value}</p>
 </div>
 </div>
 </AppCard>
 )
 })}
 </div>
 )
}
