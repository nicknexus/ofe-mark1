import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  DndContext,
 DragEndEvent,
 DragOverlay,
 DragStartEvent,
 PointerSensor,
 useDraggable,
 useDroppable,
 useSensor,
 useSensors,
} from '@dnd-kit/core'
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
import { fadeUp, rowEntrance } from './motion'

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
 /** Opens the connect flow for an unlinked evidence record (claim optional, from drag-drop). */
 onConnectEvidence?: (evidence: TimelineEvidence, claimId?: string) => void
}

function EvidenceChipContent({ ev }: { ev: TimelineEvidence }) {
 const typeInfo = getEvidenceTypeInfo(ev.type)
 const bgColor = typeInfo.color.split(' ')[0]
 const Icon = TYPE_ICONS[ev.type] || FileText
 const thumbnailUrl = getEvidenceImageUrl(ev)

 return (
 <>
 {thumbnailUrl ? (
 <img src={thumbnailUrl} alt="" className="w-8 h-8 rounded-lg object-cover bg-gray-100 flex-shrink-0" loading="lazy" />
 ) : (
 <div className={`p-1.5 rounded-lg flex-shrink-0 ${bgColor}`}>
 <Icon className="w-3.5 h-3.5" />
 </div>
 )}
 <div className="min-w-0 flex-1">
 <p className="text-xs font-medium text-gray-800 truncate">{ev.title || 'Untitled Evidence'}</p>
 <p className="text-[11px] text-gray-500 truncate">{getEvidenceTypeInfo(ev.type).label}</p>
 </div>
 </>
 )
}

function EvidenceChip({ ev, onClick }: { ev: TimelineEvidence; onClick: () => void }) {
 return (
 <button
 onClick={onClick}
 className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors text-left"
 >
 <EvidenceChipContent ev={ev} />
 </button>
 )
}

/** Unlinked evidence chip that can be dragged onto a claim card to connect. */
function DraggableEvidenceChip({ ev, onClick, draggable }: { ev: TimelineEvidence; onClick: () => void; draggable: boolean }) {
 const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
 id: `evidence-${ev.id}`,
 data: { evidenceId: ev.id },
 disabled: !draggable,
 })

 return (
 <button
 ref={setNodeRef}
 {...attributes}
 {...listeners}
 onClick={onClick}
 className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors text-left ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-40' : ''}`}
 >
 <EvidenceChipContent ev={ev} />
 </button>
 )
}

function DroppableClaimCard({ claimId, active, children }: { claimId: string; active: boolean; children: React.ReactNode }) {
 const { setNodeRef, isOver } = useDroppable({ id: `claim-${claimId}`, data: { claimId } })
 return (
 <div
 ref={setNodeRef}
 className={`rounded-2xl transition-shadow ${active ? 'ring-2 ring-dashed ring-primary-400' : ''} ${isOver ? 'ring-2 ring-primary-500 shadow-card-hover' : ''}`}
 >
 {children}
 </div>
 )
}

/**
 * Claim-first connections map: every claim with its connected evidence
 * grouped beside it (evidence repeats under each claim it supports), claims
 * missing evidence flagged, and a distinct section for unconnected evidence.
 * Unlinked evidence can be dragged onto a claim (or use its Connect button)
 * to open the re-scope-and-connect flow.
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
 const evidenceById = useMemo(() => new Map(evidence.map(e => [e.id, e])), [evidence])
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

 const [draggingEvidenceId, setDraggingEvidenceId] = React.useState<string | null>(null)
 const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
 const canDrag = !!onConnectEvidence

 const handleDragStart = (event: DragStartEvent) => {
 setDraggingEvidenceId((event.active.data.current as any)?.evidenceId || null)
 }

 const handleDragEnd = (event: DragEndEvent) => {
 setDraggingEvidenceId(null)
 const evidenceId = (event.active.data.current as any)?.evidenceId
 const claimId = (event.over?.data.current as any)?.claimId
 if (evidenceId && claimId && onConnectEvidence) {
 const ev = evidenceById.get(evidenceId)
 if (ev) onConnectEvidence(ev, claimId)
 }
 }

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

 const draggingEvidence = draggingEvidenceId ? evidenceById.get(draggingEvidenceId) : null

 return (
 <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {visibleClaims.map((claim, claimIndex) => {
          const kpi = kpiById.get(claim.kpi_id)
 const connectedEvidence = evidenceByClaimId.get(claim.id!) || []
 const contributor = claim.user_id ? contributors[claim.user_id] : undefined
 const locationName = claim.location_id ? locationById.get(claim.location_id) : undefined
 const activityDate = claim.date_range_start && claim.date_range_end
 ? `${formatDate(claim.date_range_start)} – ${formatDate(claim.date_range_end)}`
 : formatDate(claim.date_represented)

          const entrance = rowEntrance(claimIndex)
          return (
            <motion.div key={claim.id} initial={entrance.initial} animate={entrance.animate}>
              <DroppableClaimCard claimId={claim.id!} active={!!draggingEvidenceId}>
              <AppCard padded>
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
 <p className="text-xs text-red-600">
 No evidence connected to this claim yet
 {canDrag && unlinkedEvidence.length > 0 ? ' — drag unconnected evidence here' : ''}
 </p>
 </div>
 )}
 </div>
 </div>
              </AppCard>
              </DroppableClaimCard>
            </motion.div>
          )
        })}

        {/* Unconnected evidence */}
        {unlinkedEvidence.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <AppCard padded>
 <div className="flex items-center gap-2 mb-3">
 <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
 <Unlink className="w-4 h-4 text-red-500" />
 </div>
 <div>
 <h3 className="text-sm font-semibold text-gray-800">Unconnected evidence</h3>
 <p className="text-xs text-gray-500">
 Evidence not currently supporting any claim
 {canDrag ? ' — drag onto a claim or use Connect' : ''}
 </p>
 </div>
 <Badge tone="danger" className="ml-auto">{unlinkedEvidence.length}</Badge>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
 {unlinkedEvidence.map(ev => (
 <div key={ev.id} className="flex items-center gap-2">
 <div className="flex-1 min-w-0">
 <DraggableEvidenceChip ev={ev} onClick={() => onOpenEvidence(ev)} draggable={canDrag} />
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
          </motion.div>
        )}
      </div>

 <DragOverlay>
 {draggingEvidence && (
 <div className="w-64 flex items-center gap-2.5 px-3 py-2 rounded-xl border border-primary-300 bg-white shadow-card-hover">
 <EvidenceChipContent ev={draggingEvidence} />
 </div>
 )}
 </DragOverlay>
 </DndContext>
 )
}
