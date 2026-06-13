import React, { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Trash2, Plus, Target } from 'lucide-react'
import { KPI, Location, BeneficiaryGroup } from '../../../types'
import { ClaimDraft } from '../types'
import { validateClaim } from '../utils/claimValidation'
import { paletteFor } from '../../evidence/utils/groupPalette'
import ClaimCard from './ClaimCard'

const CATEGORY_LABELS: Record<string, string> = {
  input: 'Input',
  output: 'Output',
  impact: 'Impact',
}

interface ClaimColumnProps {
  column: { id: string; kpi: KPI }
  claims: ClaimDraft[]
  columnIndex: number
  locations: Location[]
  beneficiaryGroups: BeneficiaryGroup[]
  onAddClaim: () => void
  onEditClaim: (claimId: string) => void
  onDuplicateClaim: (claimId: string) => void
  onUpdateClaim: (claimId: string, patch: Partial<ClaimDraft>) => void
  onRemoveClaim: (claimId: string) => void
  onRemoveColumn: () => void
  isOnlyColumn: boolean
}

export default function ClaimColumn({
  column,
  claims,
  columnIndex,
  locations,
  beneficiaryGroups,
  onAddClaim,
  onEditClaim,
  onDuplicateClaim,
  onUpdateClaim,
  onRemoveClaim,
  onRemoveColumn,
  isOnlyColumn,
}: ClaimColumnProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const palette = paletteFor(columnIndex)
  const kpi = column.kpi

  const { setNodeRef, isOver } = useDroppable({
    id: `col-${column.id}`,
    data: { columnId: column.id },
  })

  const total = claims.reduce((sum, c) => sum + (c.value !== '' ? Number(c.value) : 0), 0)
  const readyCount = claims.filter((c) => validateClaim(c).ready).length

  function handleDeleteClick() {
    if (claims.length === 0) {
      onRemoveColumn()
    } else {
      setConfirmDelete(true)
    }
  }

  return (
    <div
      className={`w-72 flex-shrink-0 flex flex-col bg-white border rounded-xl overflow-hidden transition-all h-full ${
        isOver
          ? `border-gray-300 ring-2 ${palette.ring} shadow-md`
          : 'border-gray-200/80 shadow-sm'
      }`}
    >
      {/* Top palette bar */}
      <div className={`h-[3px] w-full flex-shrink-0 ${palette.barBg}`} aria-hidden />

      {/* Header */}
      <div className="px-3.5 pt-3 pb-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <Target className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                {/* Title: wraps to 2 lines max, then truncates */}
                <h3
                  className="text-sm font-semibold text-gray-900 leading-snug"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                  title={kpi.title}
                >
                  {kpi.title}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {kpi.category && (
                    <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                      {CATEGORY_LABELS[kpi.category] ?? kpi.category}
                    </span>
                  )}
                  {kpi.unit_of_measurement && (
                    <span className="text-[10px] text-gray-400">{kpi.unit_of_measurement}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {!isOnlyColumn && (
            <button
              onClick={handleDeleteClick}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0 mt-0.5"
              title="Remove metric column"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tally */}
        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-gray-900">{total.toLocaleString()}</span>
            {kpi.metric_type !== 'percentage' && kpi.unit_of_measurement && (
              <span className="text-xs text-gray-400">{kpi.unit_of_measurement}</span>
            )}
            {kpi.metric_type === 'percentage' && (
              <span className="text-xs text-gray-400">%</span>
            )}
          </div>
          <span className="text-xs text-gray-400">
            {readyCount}/{claims.length} ready
          </span>
        </div>
      </div>

      {/* Delete confirm inline */}
      {confirmDelete && (
        <div className="px-3.5 py-3 bg-red-50 border-b border-red-100 flex-shrink-0">
          <p className="text-xs font-medium text-red-700 mb-2">
            Remove this column and its {claims.length} claim{claims.length !== 1 ? 's' : ''}?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { onRemoveColumn(); setConfirmDelete(false) }}
              className="text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg transition-colors"
            >
              Remove
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs font-medium text-gray-600 hover:text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Claims list — scrollable */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0 transition-colors ${
          isOver ? 'bg-gray-50/70' : ''
        }`}
      >
        <SortableContext items={claims.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {claims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              kpi={kpi}
              locations={locations}
              beneficiaryGroups={beneficiaryGroups}
              palette={palette}
              onEdit={() => onEditClaim(claim.id)}
              onDuplicate={() => onDuplicateClaim(claim.id)}
              onRemove={() => onRemoveClaim(claim.id)}
              onInlineChange={(patch) => onUpdateClaim(claim.id, patch)}
            />
          ))}
        </SortableContext>

        {claims.length === 0 && (
          <div className={`flex items-center justify-center rounded-xl border-2 border-dashed transition-colors min-h-[80px] ${
            isOver ? 'border-gray-400 bg-gray-100' : 'border-gray-200 bg-gray-50/30'
          }`}>
            <p className="text-xs text-gray-400">Drop claims here</p>
          </div>
        )}
      </div>

      {/* Add claim button */}
      <div className="px-3 pb-3 pt-1 flex-shrink-0">
        <button
          onClick={onAddClaim}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/30 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add claim
        </button>
      </div>
    </div>
  )
}
