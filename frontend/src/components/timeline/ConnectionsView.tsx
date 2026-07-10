import React, { useMemo } from 'react'
import { Link2, Unlink, AlertCircle, FileText, Camera, MessageSquare, DollarSign, BarChart3 } from 'lucide-react'
import { AppCard, Badge, EmptyState } from '../ui'
import { KPI, Location, TimelineClaim, TimelineContributor, TimelineEvidence } from '../../types'
import { formatDate, getEvidenceTypeInfo } from '../../utils'
import {
 TimelineFilters,
 filterClaims,
 filterEvidence,
 getEvidenceImageUrl,
 hasActiveFilters,
 sortByUploadDate,
} from '../../utils/timeline'

const TYPE_ICONS = {
 visual_proof: Camera,
 documentation: FileText,
 testimony: MessageSquare,
 financials: DollarSign,
} as const

interface ConnectionsViewProps {
 claims: TimelineClaim[]
 evidence: TimelineEvidence[]
 kpis: KPI[]
 locations: Location[]
 contributors: Record<string, TimelineContributor>
 filters: TimelineFilters
 onOpenClaim: (claim: TimelineClaim, kpi: KPI | undefined) => void
 onOpenEvidence: (evidence: TimelineEvidence) => void
 /** Phase 3: opens the connect flow for an unlinked evidence record. */
 onConnectEvidence?: (evidence: TimelineEvidence) => void
}

function EvidenceChip({ ev, onClick }: { ev: TimelineEvidence; onClick: () => void }) {
 const typeInfo = getEvidenceTypeInfo(ev.type)
 const bgColor = typeInfo.color.split(' ')[0]
 const Icon = TYPE_ICONS[ev.type] || FileText
 const thumbnailUrl = getEvidenceImageUrl(ev)

 return (
 <button
 onClick={onClick}
 className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors text-left"
 >
 {thumbnailUrl ? (
 <img src={thumbnailUrl} alt="" className="w-8 h-8 rounded-lg object-cover bg-gray-100 flex-shrink-0" loading="lazy" />
 ) : (
 <div className={`p-1.5 rounded-lg flex-shrink-0 ${bgColor}`}>
 <Icon className="w-3.5 h-3.5" />
 </div>
 )}
 <div className="min-w-0 flex-1">
 <p className="text-xs font-medium text-gray-800 truncate">{ev.title || 'Untitled Evidence'}</p>
 <p className="text-[11px] text-gray-500 truncate">{typeInfo.label}</p>
 </div>
 </button>
 )
}

/**
 * Claim-first connections map: every claim with its connected evidence
 * grouped beside it (evidence repeats under each claim it supports), claims
 * missing evidence flagged, and a distinct section for unconnected evidence.
 */
export default function ConnectionsView({
 claims,
 evidence,
 kpis,
 locations,
 contributors,
 filters,
 onOpenClaim,
 onOpenEvidence,
 onConnectEvidence,
}: ConnectionsViewProps) {
 const kpiById = useMemo(() => new Map(kpis.map(k => [k.id, k])), [kpis])
 const locationById = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations])
 const evidenceByClaimId = useMemo(() => {
 const map = new Map<string, TimelineEvidence[]>()
 for (const ev of evidence) {
 for (const claimId of ev.kpi_update_ids || []) {
 const list = map.get(claimId) || []
 list.push(ev)
 map.set(claimId, list)
 }
 }
 return map
 }, [evidence])

 const visibleClaims = useMemo(
 () => sortByUploadDate(filterClaims(claims, filters)),
 [claims, filters]
 )
 const unlinkedEvidence = useMemo(
 () => sortByUploadDate(filterEvidence(evidence, filters)).filter(ev => ev.claim_count === 0),
 [evidence, filters]
 )

 if (visibleClaims.length === 0 && unlinkedEvidence.length === 0) {
 return (
 <div className="app-card md:p-8">
 <EmptyState
 icon={Link2}
 title="No connections to show"
 description={
 hasActiveFilters(filters)
 ? 'Try adjusting your filters or search query'
 : 'Add claims and evidence to see how they connect'
 }
 />
 </div>
 )
 }

 return (
 <div className="space-y-4">
 {visibleClaims.map(claim => {
 const kpi = kpiById.get(claim.kpi_id)
 const connectedEvidence = evidenceByClaimId.get(claim.id!) || []
 const contributor = claim.user_id ? contributors[claim.user_id] : undefined
 const locationName = claim.location_id ? locationById.get(claim.location_id) : undefined
 const activityDate = claim.date_range_start && claim.date_range_end
 ? `${formatDate(claim.date_range_start)} – ${formatDate(claim.date_range_end)}`
 : formatDate(claim.date_represented)

 return (
 <AppCard key={claim.id} padded>
 <div className="flex flex-col md:flex-row md:items-stretch gap-4">
 {/* Claim (left) */}
 <button
 onClick={() => onOpenClaim(claim, kpi)}
 className="flex-1 min-w-0 text-left rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors p-4"
 >
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-xl bg-primary-100 flex-shrink-0">
 <BarChart3 className="w-4 h-4 text-primary-800" />
 </div>
 <div className="min-w-0">
 <p className="font-medium text-gray-800 truncate">
 <span className="text-base font-semibold text-gray-900 mr-1.5">{claim.value}</span>
 {kpi?.title || 'Unknown metric'}
 </p>
 <p className="text-xs text-gray-500 truncate mt-0.5">
 {[locationName, activityDate, contributor?.name || contributor?.email]
 .filter(Boolean)
 .join(' · ')}
 </p>
 </div>
 </div>
 </button>

 {/* Link indicator */}
 <div className="hidden md:flex items-center justify-center flex-shrink-0 w-12">
 <div className={`w-9 h-9 rounded-full flex items-center justify-center ${connectedEvidence.length > 0 ? 'bg-impact-50' : 'bg-red-50'}`}>
 {connectedEvidence.length > 0
 ? <Link2 className="w-4 h-4 text-impact-500" />
 : <Unlink className="w-4 h-4 text-red-500" />}
 </div>
 </div>

 {/* Evidence (right) */}
 <div className="flex-1 min-w-0">
 {connectedEvidence.length > 0 ? (
 <div className="space-y-1.5">
 <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
 Evidence ({connectedEvidence.length})
 </p>
 {connectedEvidence.map(ev => (
 <EvidenceChip key={ev.id} ev={ev} onClick={() => onOpenEvidence(ev)} />
 ))}
 </div>
 ) : (
 <div className="h-full flex items-center gap-2 rounded-xl border border-dashed border-red-200 bg-red-50/40 px-4 py-3">
 <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
 <p className="text-xs text-red-600">No evidence connected to this claim yet</p>
 </div>
 )}
 </div>
 </div>
 </AppCard>
 )
 })}

 {/* Unconnected evidence */}
 {unlinkedEvidence.length > 0 && (
 <AppCard padded>
 <div className="flex items-center gap-2 mb-3">
 <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
 <Unlink className="w-4 h-4 text-red-500" />
 </div>
 <div>
 <h3 className="text-sm font-semibold text-gray-800">Unconnected evidence</h3>
 <p className="text-xs text-gray-500">Evidence not currently supporting any claim</p>
 </div>
 <Badge tone="danger" className="ml-auto">{unlinkedEvidence.length}</Badge>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
 {unlinkedEvidence.map(ev => (
 <div key={ev.id} className="flex items-center gap-2">
 <div className="flex-1 min-w-0">
 <EvidenceChip ev={ev} onClick={() => onOpenEvidence(ev)} />
 </div>
 {onConnectEvidence && (
 <button
 onClick={() => onConnectEvidence(ev)}
 className="app-btn app-btn-secondary app-btn-sm flex-shrink-0"
 >
 <Link2 className="w-3.5 h-3.5" />
 <span>Connect</span>
 </button>
 )}
 </div>
 ))}
 </div>
 </AppCard>
 )}
 </div>
 )
}
