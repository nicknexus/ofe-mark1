import React, { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { KPI, Location, BeneficiaryGroup } from '../../../types'
import { ClaimDraft } from '../types'
import { useClaimBatchState } from '../hooks/useClaimBatchState'
import { validateClaim } from '../utils/claimValidation'
import { apiService } from '../../../services/api'
import { notify } from '../../../lib/notify'
import ClaimColumn from './ClaimColumn'
import ClaimEditorDrawer from './ClaimEditorDrawer'
import KPIPickerPopover from './KPIPickerPopover'
import DragOverlayCard from './DragOverlayCard'

interface ClaimBoardProps {
  initiativeId: string
  preSelectedKPI?: KPI
  allKPIs: KPI[]
  locations: Location[]
  beneficiaryGroups: BeneficiaryGroup[]
  onCreated?: (newUpdates?: any[]) => void
  onClose: () => void
}

export default function ClaimBoard({
  initiativeId,
  preSelectedKPI,
  allKPIs,
  locations,
  beneficiaryGroups,
  onCreated,
  onClose,
}: ClaimBoardProps) {
  const { state, dispatch, claimsByColumn } = useClaimBatchState(preSelectedKPI)
  const [activeClaim, setActiveClaim] = useState<ClaimDraft | null>(null)
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const allClaims = state.claims
  const allValid = allClaims.length > 0 && allClaims.every((c) => validateClaim(c).ready)
  const invalidCount = allClaims.filter((c) => !validateClaim(c).ready).length

  const editingClaim = editingClaimId ? state.claims.find((c) => c.id === editingClaimId) ?? null : null
  const editingColumn = editingClaim ? state.columns.find((c) => c.id === editingClaim.columnId) : null

  function handleDragStart(e: DragStartEvent) {
    const claimId = e.active.data.current?.claimId as string | undefined
    if (claimId) setActiveClaim(state.claims.find((c) => c.id === claimId) ?? null)
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const claimId = active.data.current?.claimId as string | undefined
    if (!claimId) return

    const overColumnId = over.data.current?.columnId as string | undefined
    const overClaimId = over.data.current?.claimId as string | undefined

    const claim = state.claims.find((c) => c.id === claimId)
    if (!claim) return

    if (overColumnId && overColumnId !== claim.columnId) {
      dispatch({ type: 'moveClaim', claimId, targetColumnId: overColumnId })
    }
    if (overClaimId) {
      const overClaim = state.claims.find((c) => c.id === overClaimId)
      if (overClaim && overClaim.columnId !== claim.columnId) {
        dispatch({ type: 'moveClaim', claimId, targetColumnId: overClaim.columnId })
      }
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    setActiveClaim(null)
    if (!over) return
    const claimId = active.data.current?.claimId as string | undefined
    if (!claimId) return
    const overClaimId = over.data.current?.claimId as string | undefined
    if (overClaimId && overClaimId !== claimId) {
      const claim = state.claims.find((c) => c.id === claimId)
      const overClaim = state.claims.find((c) => c.id === overClaimId)
      if (claim && overClaim && claim.columnId === overClaim.columnId) {
        dispatch({ type: 'reorderClaim', claimId, afterClaimId: overClaimId })
      }
    }
  }

  async function handleSubmit() {
    if (!allValid) return
    setSubmitting(true)
    const total = allClaims.length
    setProgress({ done: 0, total })

    // One batched request for the whole board. The backend authorizes once per
    // KPI and bulk-inserts, so there's no per-claim HTTP round trip and no
    // parallel burst of writes (which used to drop claims via ENOTFOUND).
    const payload = allClaims.map((claim) => ({
      kpi_id: claim.columnId,
      value: Number(claim.value),
      date_represented: claim.date_represented,
      date_range_start: claim.date_range_start,
      date_range_end: claim.date_range_end,
      label: claim.label,
      note: claim.note || undefined,
      location_id: claim.location_id || undefined,
      beneficiary_group_ids: claim.beneficiary_group_ids,
      tag_id: claim.tag_id,
    }))

    try {
      const results = await apiService.createKPIUpdatesBatch(payload as any)
      const created = results.map((r) => {
        const col = state.columns.find((c) => c.id === r.kpi_id)
        return { ...r, kpi_title: col?.kpi.title, kpi_unit: col?.kpi.unit_of_measurement }
      })
      setProgress({ done: total, total })
      setSubmitting(false)
      notify.success(`${total} impact claim${total !== 1 ? 's' : ''} added!`)
      onCreated?.(created)
      onClose()
    } catch (err) {
      setSubmitting(false)
      notify.error((err as Error)?.message || 'Failed to add impact claims. Please try again.')
    }
  }

  const activeDragKPI = activeClaim
    ? state.columns.find((c) => c.id === activeClaim.columnId)?.kpi
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveClaim(null)}
    >
      <div className="flex flex-col h-full">

        {/* Scrollable kanban area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-x-auto overflow-y-hidden">
            <div
              className="flex gap-4 p-4 h-full"
              style={{ minWidth: 'max-content' }}
            >
              {state.columns.map((col, idx) => (
                <ClaimColumn
                  key={col.id}
                  column={col}
                  claims={claimsByColumn(col.id)}
                  columnIndex={idx}
                  locations={locations}
                  beneficiaryGroups={beneficiaryGroups}
                  onAddClaim={() => dispatch({ type: 'addClaim', columnId: col.id })}
                  onEditClaim={setEditingClaimId}
                  onDuplicateClaim={(claimId) =>
                    dispatch({ type: 'addClaim', columnId: col.id, cloneFromId: claimId })
                  }
                  onUpdateClaim={(claimId, patch) =>
                    dispatch({ type: 'updateClaim', claimId, patch })
                  }
                  onRemoveClaim={(claimId) => dispatch({ type: 'removeClaim', claimId })}
                  onRemoveColumn={() => dispatch({ type: 'removeColumn', columnId: col.id })}
                  isOnlyColumn={state.columns.length === 1}
                />
              ))}

              {/* Add column button */}
              <div className="flex-shrink-0 self-start pt-0">
                <KPIPickerPopover
                  allKPIs={allKPIs}
                  usedKPIIds={state.columns.map((c) => c.id)}
                  onPick={(kpi) => dispatch({ type: 'addColumn', kpi })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit bar */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white">
          {/* Indeterminate progress bar — visible only while submitting */}
          <div className="relative h-1 bg-gray-100 overflow-hidden">
            {submitting && <div className="animate-indeterminate-bar bg-primary-500" />}
          </div>
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              {allClaims.length === 0 ? (
                'Add a metric column to get started'
              ) : submitting ? (
                `Submitting ${progress.total} claim${progress.total !== 1 ? 's' : ''}…`
              ) : !allValid ? (
                <span className="text-amber-600">
                  {invalidCount} claim{invalidCount !== 1 ? 's' : ''} still need info
                </span>
              ) : (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {allClaims.length} claim{allClaims.length !== 1 ? 's' : ''} ready
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} disabled={submitting} className="app-btn app-btn-secondary app-btn-sm">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!allValid || submitting || allClaims.length === 0}
                className="app-btn app-btn-primary app-btn-sm"
              >
                {submitting ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Submitting…</>
                ) : (
                  `Submit ${allClaims.length > 0 ? allClaims.length : ''} Claim${allClaims.length !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Claim editor drawer */}
      {editingClaim && editingColumn && (
        <ClaimEditorDrawer
          claim={editingClaim}
          kpi={editingColumn.kpi}
          locations={locations}
          beneficiaryGroups={beneficiaryGroups}
          onSave={(patch) => dispatch({ type: 'updateClaim', claimId: editingClaim.id, patch })}
          onClose={() => setEditingClaimId(null)}
        />
      )}

      <DragOverlay dropAnimation={null}>
        {activeClaim && activeDragKPI ? (
          <DragOverlayCard claim={activeClaim} unit={activeDragKPI.unit_of_measurement} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
