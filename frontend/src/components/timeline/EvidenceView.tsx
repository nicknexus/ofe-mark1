import React, { useMemo } from 'react'
import { FileText, Camera, MessageSquare, DollarSign } from 'lucide-react'
import { EmptyState } from '../ui'
import { Location, TimelineContributor, TimelineEvidence } from '../../types'
import { formatDate, getEvidenceTypeInfo } from '../../utils'
import {
 TimelineFilters,
 deriveEvidenceStatus,
 filterEvidence,
 getEvidenceImageUrl,
 groupPackages,
 groupPositionFor,
 hasActiveFilters,
 sortByUploadDate,
} from '../../utils/timeline'
import TimelineRow, { TimelineRowHeader, TimelinePackageHeader } from './TimelineRow'

const TYPE_ICONS = {
 visual_proof: Camera,
 documentation: FileText,
 testimony: MessageSquare,
 financials: DollarSign,
} as const

interface EvidenceViewProps {
 evidence: TimelineEvidence[]
 locations: Location[]
 contributors: Record<string, TimelineContributor>
 filters: TimelineFilters
 onOpenEvidence: (evidence: TimelineEvidence) => void
}

/** All evidence in the initiative, newest upload first. */
export default function EvidenceView({ evidence, locations, contributors, filters, onOpenEvidence }: EvidenceViewProps) {
 const locationById = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations])

 const groups = useMemo(
 () => groupPackages(sortByUploadDate(filterEvidence(evidence, filters))),
 [evidence, filters]
 )

 if (groups.length === 0) {
 return (
 <div className="app-card md:p-8">
 <EmptyState
 icon={FileText}
 title="No evidence found"
 description={
 hasActiveFilters(filters)
 ? 'Try adjusting your filters or search query'
 : 'Upload your first evidence to support your impact claims'
 }
 />
 </div>
 )
 }

 return (
 <div className="app-card overflow-hidden">
 <TimelineRowHeader kindLabel="Evidence" />
 <div className="divide-y divide-gray-100">
 {groups.map((group, groupIndex) => (
 <React.Fragment key={group.items[0].id || groupIndex}>
 {group.isPackage && <TimelinePackageHeader count={group.items.length} />}
 {group.items.map((ev, index) => {
 const typeInfo = getEvidenceTypeInfo(ev.type)
 const bgColor = typeInfo.color.split(' ')[0]
 const Icon = TYPE_ICONS[ev.type] || FileText
 const thumbnailUrl = getEvidenceImageUrl(ev)

 const locationIds = ev.location_ids || (ev.location_id ? [ev.location_id] : [])
 const locationNames = locationIds
 .map(id => locationById.get(id))
 .filter(Boolean)
 const locationLabel = locationNames.length === 0
 ? '—'
 : locationNames.length === 1
 ? locationNames[0]!
 : `${locationNames.length} locations`

 const contributor = ev.user_id ? contributors[ev.user_id] : undefined
 const activityDate = ev.date_range_start && ev.date_range_end
 ? `${formatDate(ev.date_range_start)} – ${formatDate(ev.date_range_end)}`
 : formatDate(ev.date_represented)
 const count = ev.claim_count

 return (
 <TimelineRow
 key={ev.id}
 leading={
 thumbnailUrl ? (
 <img
 src={thumbnailUrl}
 alt=""
 className="w-10 h-10 rounded-xl object-cover bg-gray-100"
 loading="lazy"
 />
 ) : (
 <div className={`p-2 rounded-xl ${bgColor}`}>
 <Icon className="w-4 h-4" />
 </div>
 )
 }
 title={ev.title || 'Untitled Evidence'}
 subtitle={typeInfo.label}
 whereWhen={{ location: locationLabel, date: activityDate }}
 uploadedBy={contributor?.name || contributor?.email || '—'}
 connectionSummary={`${count} ${count === 1 ? 'claim' : 'claims'}`}
 status={deriveEvidenceStatus(ev)}
 groupPosition={group.isPackage ? groupPositionFor(index, group.items.length) : 'single'}
 onClick={() => onOpenEvidence(ev)}
 />
 )
 })}
 </React.Fragment>
 ))}
 </div>
 </div>
 )
}
