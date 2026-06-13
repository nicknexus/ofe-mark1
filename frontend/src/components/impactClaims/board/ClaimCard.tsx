import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Copy, Trash2, Calendar, MapPin, Users, Tag, Plus, Pencil } from 'lucide-react'
import { KPI, Location, BeneficiaryGroup } from '../../../types'
import { ClaimDraft } from '../types'
import { validateClaim } from '../utils/claimValidation'
import { GroupPalette } from '../../evidence/utils/groupPalette'

interface ClaimCardProps {
  claim: ClaimDraft
  kpi: KPI
  locations: Location[]
  beneficiaryGroups: BeneficiaryGroup[]
  palette: GroupPalette
  onEdit: () => void
  onDuplicate: () => void
  onRemove: () => void
  onInlineChange: (patch: Partial<ClaimDraft>) => void
}

function shortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function SetChip({
  Icon,
  palette,
  children,
}: {
  Icon: React.ComponentType<{ className?: string }>
  palette: GroupPalette
  children: React.ReactNode
}) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-white border ${palette.chipBorder} ${palette.chipText}`}>
      <Icon className="w-2.5 h-2.5 flex-shrink-0" />
      <span className="truncate max-w-[120px]">{children}</span>
    </span>
  )
}

function MissingChip({
  Icon,
  label,
  onClick,
}: {
  Icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-md border border-dashed border-gray-300 text-gray-500 bg-white/70 hover:border-gray-400 hover:text-gray-700 transition-colors"
    >
      <Plus className="w-2.5 h-2.5 flex-shrink-0" />
      <Icon className="w-2.5 h-2.5 flex-shrink-0" />
      <span>{label}</span>
    </button>
  )
}

export default function ClaimCard({
  claim,
  kpi,
  locations,
  beneficiaryGroups,
  palette,
  onEdit,
  onDuplicate,
  onRemove,
  onInlineChange,
}: ClaimCardProps) {
  const validation = validateClaim(claim)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: claim.id,
    data: { claimId: claim.id, columnId: claim.columnId },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const locationName = locations.find((l) => l.id === claim.location_id)?.name
  const bgroupCount = claim.beneficiary_group_ids.length

  const dateLabel = claim.date_range_start && claim.date_range_end
    ? `${shortDate(claim.date_range_start)} → ${shortDate(claim.date_range_end)}`
    : claim.date_represented
    ? shortDate(claim.date_represented)
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onEdit}
      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer group"
    >
      {/* Value + drag + actions */}
      <div className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-1">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 touch-none"
          tabIndex={-1}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <input
            type="number"
            value={claim.value}
            min={0}
            step={kpi.metric_type === 'percentage' ? 0.01 : 1}
            placeholder="0"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const raw = e.target.value
              onInlineChange({ value: raw === '' ? '' : parseFloat(raw) })
            }}
            className="w-20 text-lg font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5 outline-none hover:border-gray-300 focus:border-primary-400 focus:bg-white focus:ring-1 focus:ring-primary-100 transition-colors min-w-0"
          />
          {kpi.unit_of_measurement && (
            <span className="text-[10px] text-gray-400 flex-shrink-0 truncate max-w-[36px]">{kpi.unit_of_measurement}</span>
          )}
        </div>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            title="Edit"
            className="p-1 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate() }}
            title="Duplicate"
            className="p-1 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove() }}
            title="Remove"
            className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Label — inline editable */}
      <div className="px-2.5 pb-1.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={claim.label}
          placeholder="Label…"
          onChange={(e) => onInlineChange({ label: e.target.value })}
          className="w-full text-xs font-medium text-gray-700 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none hover:border-gray-300 focus:border-primary-400 focus:bg-white focus:ring-1 focus:ring-primary-100 transition-colors"
        />
      </div>

      {/* Status chips */}
      <div className="px-2.5 pb-2.5 flex flex-wrap gap-1">
        {dateLabel ? (
          <SetChip Icon={Calendar} palette={palette}>{dateLabel}</SetChip>
        ) : (
          <MissingChip Icon={Calendar} label="date" onClick={onEdit} />
        )}
        {locationName ? (
          <SetChip Icon={MapPin} palette={palette}>{locationName}</SetChip>
        ) : (
          <MissingChip Icon={MapPin} label="location" onClick={onEdit} />
        )}
        {bgroupCount > 0 && (
          <SetChip Icon={Users} palette={palette}>
            {bgroupCount} group{bgroupCount !== 1 ? 's' : ''}
          </SetChip>
        )}
        {claim.tag_id && (
          <SetChip Icon={Tag} palette={palette}>tag</SetChip>
        )}
      </div>

      {/* Validation indicator */}
      <div className={`mx-2.5 mb-2.5 px-2 py-0.5 rounded-lg flex items-center gap-1 ${validation.ready ? 'bg-green-50' : 'bg-amber-50'}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${validation.ready ? 'bg-green-500' : 'bg-amber-400'}`} />
        <span className={`text-[10px] font-medium truncate ${validation.ready ? 'text-green-600' : 'text-amber-600'}`}>
          {validation.ready ? 'Ready' : `${validation.missing.length} left`}
        </span>
      </div>
    </div>
  )
}
