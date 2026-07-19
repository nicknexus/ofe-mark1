import React, { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link2, AlertCircle, FileText, Camera, MessageSquare, DollarSign, Paperclip, ChevronDown, MapPin, Calendar, User, Clock } from 'lucide-react'
import { AppCard, EmptyState } from '../ui'
import { KPI, Location, TimelineClaim, TimelineContributor, TimelineEvidence } from '../../types'
import { formatDate, getEvidenceTypeInfo } from '../../utils'
import {
  TimelineFilters,
  filterClaims,
  getEvidenceImageUrl,
  hasActiveFilters,
  previewMatchingEvidence,
  sortByMode,
} from '../../utils/timeline'
import { rowEntrance, easeOut } from './motion'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'
import { getStatusStyle } from './statusStyles'

const TYPE_ICONS = {
  visual_proof: Camera,
  documentation: FileText,
  testimony: MessageSquare,
  financials: DollarSign,
} as const

/**
 * Shared geometry for the evidence column and the SVG connector. Evidence
 * rows are fixed-height and the list scroll-snaps in whole-row increments,
 * so the (at most) MAX_ROWS anchor points never move — the connection lines
 * are static while the rows scroll into the slots beneath them.
 */
const ROW_H = 64
const ROW_GAP = 8
const MAX_ROWS = 4
const CONNECTOR_W = 128
const NODE_R = 16
const HALO_R = 24
const slotCenter = (i: number) => i * (ROW_H + ROW_GAP) + ROW_H / 2
const columnHeight = (rows: number) => rows * ROW_H + (rows - 1) * ROW_GAP

const GRID_COLS = 'md:grid-cols-[minmax(0,0.75fr)_8rem_minmax(0,0.85fr)]'

/**
 * The claim → connection-node → evidence connector. A soft green concentric
 * node sits in the middle: the claim side runs a single line into it, then it
 * fans smooth curves out to each evidence slot. A claim without evidence gets a
 * single dashed red line from the node to the placeholder.
 */
function ConnectorLines({
  rows,
  empty,
  pendingSlots = [],
  pendingOnly,
}: {
  rows: number
  empty?: boolean
  /** Per visible slot: true when that row is evidence awaiting approval —
      its curve renders amber + dashed instead of the solid gradient. */
  pendingSlots?: boolean[]
  /** No real connections yet, only pending ones — the node goes amber. */
  pendingOnly?: boolean
}) {
  const height = columnHeight(Math.max(rows, 1))
  const midY = height / 2
  const cx = CONNECTOR_W / 2
  const startX = 2
  const endX = CONNECTOR_W - 2
  const leftEnd = cx - NODE_R
  const rightStart = cx + NODE_R
  const rightMid = (rightStart + endX) / 2
  const PENDING_STROKE = '#fbbf24' // amber-400

  return (
    <div className="relative" style={{ width: CONNECTOR_W, height }}>
      <svg
        width={CONNECTOR_W}
        height={height}
        viewBox={`0 0 ${CONNECTOR_W} ${height}`}
        fill="none"
        aria-hidden="true"
        className={empty ? 'text-red-300' : undefined}
      >
        {/* Claim (seafoam) → evidence (brand green) gradient across the whole
            lane; userSpaceOnUse so both segments pick up their position's hue. */}
        {!empty && (
          <defs>
            <linearGradient
              id="claim-evidence-lane"
              gradientUnits="userSpaceOnUse"
              x1="0" y1="0" x2={CONNECTOR_W} y2="0"
            >
              <stop offset="0%" stopColor="#AFD8DB" />
              <stop offset="100%" stopColor="#c0dfa1" />
            </linearGradient>
          </defs>
        )}

        {/* Claim → node. Amber + dashed while every connection is pending. */}
        <motion.path
          d={`M ${startX} ${midY} L ${leftEnd} ${midY}`}
          stroke={empty ? 'currentColor' : pendingOnly ? PENDING_STROKE : 'url(#claim-evidence-lane)'}
          strokeOpacity={empty ? 0.7 : pendingOnly ? 0.9 : 1}
          strokeWidth={2}
          strokeDasharray={pendingOnly ? '4 5' : undefined}
          strokeLinecap="round"
          initial={pendingOnly ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
          animate={pendingOnly ? { opacity: 1 } : { pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />

        {/* Node → evidence */}
        {empty ? (
          <motion.path
            d={`M ${rightStart} ${midY} L ${endX} ${midY}`}
            stroke="currentColor"
            strokeOpacity={0.8}
            strokeWidth={1.75}
            strokeDasharray="4 5"
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        ) : (
          Array.from({ length: rows }).map((_, i) => {
            const y = slotCenter(i)
            const isPending = !!pendingSlots[i]
            return (
              <motion.path
                key={i}
                d={`M ${rightStart} ${midY} C ${rightMid} ${midY}, ${rightMid} ${y}, ${endX} ${y}`}
                stroke={isPending ? PENDING_STROKE : 'url(#claim-evidence-lane)'}
                strokeOpacity={isPending ? 0.9 : 1}
                strokeWidth={2}
                strokeDasharray={isPending ? '4 5' : undefined}
                strokeLinecap="round"
                // pathLength animation rewrites stroke-dasharray, so pending
                // (dashed) curves fade in instead of drawing in.
                initial={isPending ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
                animate={isPending ? { opacity: 1 } : { pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 + i * 0.07 }}
              />
            )
          })
        )}
      </svg>

      {/* Central concentric connection node — pale halo + inner ring with the
          link glyph. Positioned with explicit left/top (no CSS translate)
          because framer-motion's scale writes an inline transform that would
          clobber a Tailwind -translate centering. */}
      <motion.span
        className={`absolute flex items-center justify-center rounded-full ${empty
          ? 'bg-red-50'
          : pendingOnly
            ? 'bg-amber-50'
            : 'bg-gradient-to-r from-claim-100 to-primary-100'}`}
        style={{ width: HALO_R * 2, height: HALO_R * 2, left: cx - HALO_R, top: midY - HALO_R, transformOrigin: 'center' }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.25, ease: easeOut, delay: 0.15 }}
      >
        <span
          className={`flex items-center justify-center rounded-full shadow-sm ${empty
            ? 'bg-white border border-red-200 text-red-400'
            : pendingOnly
              ? 'bg-white border border-amber-200 text-amber-500'
              : 'bg-gradient-to-r from-claim-400 to-primary-500 text-white'}`}
          style={{ width: NODE_R * 2, height: NODE_R * 2 }}
        >
          {pendingOnly && !empty
            ? <Clock className="w-4 h-4" strokeWidth={2.5} />
            : <Link2 className="w-4 h-4" strokeWidth={2.5} />}
        </span>
      </motion.span>
    </div>
  )
}

function EvidenceRow({ ev, onClick }: { ev: TimelineEvidence; onClick: () => void }) {
  const typeInfo = getEvidenceTypeInfo(ev.type)
  const Icon = TYPE_ICONS[ev.type] || FileText
  const thumbnailUrl = getEvidenceImageUrl(ev)
  const claimCount = (ev.kpi_update_ids || []).length
  const isPending = ev.approval_status === 'pending'

  return (
    <button
      onClick={onClick}
      style={{ height: ROW_H }}
      className={`w-full flex items-center gap-2.5 px-3 rounded-xl border transition-colors text-left snap-start mb-2 last:mb-0 ${isPending
        ? 'border-amber-200 bg-amber-50/60 hover:bg-amber-50'
        : 'border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200'
        }`}
    >
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0" loading="lazy" />
      ) : (
        <div className={`p-2 rounded-lg flex-shrink-0 ${typeInfo.color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-800 truncate">{ev.title || 'Untitled Evidence'}</p>
        <p className="text-[11px] text-gray-500 truncate">{typeInfo.label}</p>
      </div>
      {isPending ? (
        <span
          title="Awaiting admin approval — will connect to this claim once approved"
          className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-[10px] font-semibold text-amber-700"
        >
          <Clock className="w-3 h-3" />
          Needs approval
        </span>
      ) : claimCount > 1 && (
        <span
          title={`Also supports ${claimCount - 1} other claim${claimCount === 2 ? '' : 's'}`}
          className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500"
        >
          <Link2 className="w-3 h-3" />
          ×{claimCount}
        </span>
      )}
    </button>
  )
}

/**
 * Evidence side of one connection group. Shows up to MAX_ROWS rows; longer
 * lists scroll inside a fixed-height, scroll-snapped viewport so rows always
 * land exactly on the connector line anchors.
 */
function EvidenceColumn({ list, onOpen }: { list: TimelineEvidence[]; onOpen: (ev: TimelineEvidence) => void }) {
  const overflow = list.length > MAX_ROWS
  const height = columnHeight(Math.min(list.length, MAX_ROWS))
  const [atEnd, setAtEnd] = useState(!overflow)

  return (
    <div className="relative">
      <div
        style={{ height }}
        onScroll={overflow ? (e) => {
          const el = e.currentTarget
          setAtEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 4)
        } : undefined}
        className={overflow ? 'overflow-y-auto snap-y snap-mandatory overscroll-contain' : undefined}
      >
        {list.map(ev => (
          <EvidenceRow key={ev.id} ev={ev} onClick={() => onOpen(ev)} />
        ))}
      </div>
      {overflow && !atEnd && (
        <>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white to-transparent rounded-b-xl" />
          <div className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-800/80 text-white text-[10px] font-medium shadow-sm">
            <ChevronDown className="w-3 h-3" />
            {list.length - MAX_ROWS} more
          </div>
        </>
      )}
    </div>
  )
}

interface ConnectionsViewProps {
  claims: TimelineClaim[]
  evidence: TimelineEvidence[]
  kpis: KPI[]
  locations: Location[]
  contributors: Record<string, TimelineContributor>
  filters: TimelineFilters
  onOpenClaim: (claim: TimelineClaim, kpi: KPI | undefined) => void
  onOpenEvidence: (evidence: TimelineEvidence) => void
  /** Quick-upload new evidence scoped to this claim. */
  onAddEvidenceToClaim?: (claim: TimelineClaim, kpi: KPI | undefined) => void
  /** Attach an existing unconnected evidence record to this claim. */
  onConnectExistingToClaim?: (claim: TimelineClaim) => void
}

/**
 * Two-sided connections map (T-chart): impact claims on the left, their
 * supporting evidence on the right, joined by animated connector lines so
 * relationships read visually. Evidence repeats under each claim it supports
 * (with a ×N chip when it backs several claims). Pending evidence (review
 * gate) appears amber under the claims it WILL connect to on approval, with
 * dashed connector lines — click it to review/approve. Unconnected evidence
 * is intentionally not listed here — it lives in the Evidence view behind the
 * "Not connected" status filter, which scales past thousands of records.
 * Existing evidence can still be attached to a claim via "Add existing evidence".
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
  onAddEvidenceToClaim,
  onConnectExistingToClaim,
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

  // Review gate: pending evidence has no real links yet, but it should show
  // up under the claims it WILL connect to (amber + dashed) so admins can
  // review it in place. Same scope-matching preview the wizard uses.
  const pendingEvidence = useMemo(
    () => evidence.filter(ev => ev.approval_status === 'pending'),
    [evidence]
  )
  const pendingMatchesForClaim = (claim: TimelineClaim): TimelineEvidence[] => {
    if (pendingEvidence.length === 0 || !claim.location_id) return []
    return previewMatchingEvidence(pendingEvidence, {
      kpiId: claim.kpi_id,
      locationId: claim.location_id,
      tagId: (claim as any).tag_id ?? null,
      beneficiaryGroupIds: claim.beneficiary_group_ids || [],
      dateStart: claim.date_range_start || claim.date_represented || '',
      dateEnd: claim.date_range_end || claim.date_range_start || claim.date_represented || '',
    })
  }

  const visibleClaims = useMemo(
    () => sortByMode(filterClaims(claims, filters), filters.orderMode),
    [claims, filters]
  )

  if (visibleClaims.length === 0) {
    return (
      <div className="app-card md:p-8">
        <EmptyState
          icon={Link2}
          title="No connections to show"
          description={
            hasActiveFilters(filters)
              ? 'Try adjusting your filters or search query'
              : 'Add logs with claims and evidence to see how they connect'
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Column headers — the two sides of the chart */}
      <div className={`hidden md:grid ${GRID_COLS} px-4 sm:px-5`}>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Impact Claims ({visibleClaims.length})
        </p>
        <div />
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Supporting Evidence
        </p>
      </div>

      {visibleClaims.map((claim, claimIndex) => {
        const kpi = kpiById.get(claim.kpi_id)
        const connectedEvidence = evidenceByClaimId.get(claim.id!) || []
        // Pending evidence that will connect here on approval — shown amber,
        // after the real connections.
        const pendingMatches = pendingMatchesForClaim(claim)
        const evidenceRows = [...connectedEvidence, ...pendingMatches]
        const pendingSlots = evidenceRows.slice(0, MAX_ROWS).map(ev => ev.approval_status === 'pending')
        const pendingOnly = connectedEvidence.length === 0 && pendingMatches.length > 0
        const contributor = claim.user_id ? contributors[claim.user_id] : undefined
        const locationName = claim.location_id ? locationById.get(claim.location_id) : undefined
        // Same color coding as MetricChip / the Metrics dashboard cards
        const metricColor = kpi
          ? getKPIColor(kpi.category, Math.max(kpis.findIndex(k => k.id === kpi.id), 0))
          : '#9ca3af'
        const activityDate = claim.date_range_start && claim.date_range_end
          ? `${formatDate(claim.date_range_start)} – ${formatDate(claim.date_range_end)}`
          : formatDate(claim.date_represented)

        const claimStyle = getStatusStyle(
          connectedEvidence.length > 0 ? 'connected' : pendingOnly ? 'pending' : 'not_connected'
        )

        const entrance = rowEntrance(claimIndex)
        return (
          <motion.div key={claim.id} initial={entrance.initial} animate={entrance.animate}>
            <AppCard padded>
              <div className={`flex flex-col gap-3 md:grid ${GRID_COLS} md:items-center md:gap-0`}>
                {/* Claim (left) — actions live inside the card so its visual
                    center is exactly where the connector line originates */}
                <div className="min-w-0">
                  <p className="md:hidden text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Impact claim
                  </p>
                  <div className={`min-w-0 rounded-2xl border ${claimStyle.card} shadow-sm hover:shadow-card transition-all overflow-hidden`}>
                    {/* Metric band — names the metric across the whole card top */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/50 border-b border-black/5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: metricColor }} />
                      <p className="text-xs font-semibold text-gray-600 truncate">
                        {kpi?.title || 'Unknown metric'}
                      </p>
                    </div>

                    <button
                      onClick={() => onOpenClaim(claim, kpi)}
                      className="w-full text-left px-4 py-3.5"
                    >
                      <p className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-3xl font-semibold text-gray-900 tabular-nums leading-none">
                          {typeof claim.value === 'number' ? claim.value.toLocaleString() : claim.value}
                        </span>
                        {(kpi?.metric_type === 'percentage' ? '%' : kpi?.unit_of_measurement) && (
                          <span className="text-base font-medium text-gray-500">
                            {kpi?.metric_type === 'percentage' ? '%' : kpi?.unit_of_measurement}
                          </span>
                        )}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 mt-2.5">
                        {locationName && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 min-w-0">
                            <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{locationName}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          {activityDate}
                        </span>
                        {(contributor?.name || contributor?.email) && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500 min-w-0">
                            <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{contributor?.name || contributor?.email}</span>
                          </span>
                        )}
                      </div>
                    </button>

                    {(onAddEvidenceToClaim || onConnectExistingToClaim) && (
                      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-black/5 bg-white/40">
                        {onAddEvidenceToClaim && (
                          <button
                            onClick={() => onAddEvidenceToClaim(claim, kpi)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                          >
                            <Paperclip className="w-3.5 h-3.5" />
                            <span>Add evidence</span>
                          </button>
                        )}
                        {onConnectExistingToClaim && (
                          <button
                            onClick={() => onConnectExistingToClaim(claim)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>Connect existing evidence</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Connection lines (center, desktop only) */}
                <div className="hidden md:flex items-center justify-center">
                  <ConnectorLines
                    rows={Math.min(evidenceRows.length, MAX_ROWS)}
                    empty={evidenceRows.length === 0}
                    pendingSlots={pendingSlots}
                    pendingOnly={pendingOnly}
                  />
                </div>

                {/* Evidence (right) */}
                <div className="min-w-0">
                  <p className="md:hidden text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Evidence ({connectedEvidence.length}{pendingMatches.length > 0 ? ` · ${pendingMatches.length} pending` : ''})
                  </p>
                  {evidenceRows.length > 0 ? (
                    <EvidenceColumn list={evidenceRows} onOpen={onOpenEvidence} />
                  ) : (
                    <div
                      style={{ height: ROW_H }}
                      className="flex items-center gap-2 rounded-xl border border-dashed border-red-200 bg-red-50/40 px-4"
                    >
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-xs text-red-600">
                        No evidence connected to this claim yet
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </AppCard>
          </motion.div>
        )
      })}
    </div>
  )
}
