import React from 'react'
import { GripVertical } from 'lucide-react'
import { ClaimDraft } from '../types'

interface DragOverlayCardProps {
  claim: ClaimDraft
  unit: string
}

export default function DragOverlayCard({ claim, unit }: DragOverlayCardProps) {
  return (
    <div className="w-64 bg-white border border-gray-300 rounded-lg shadow-xl p-3 opacity-90 rotate-2">
      <div className="flex items-center gap-2">
        <GripVertical className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span className="text-base font-bold text-gray-900">
          {claim.value !== '' ? Number(claim.value).toLocaleString() : '—'}
        </span>
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
      {claim.label && (
        <p className="text-xs text-gray-500 mt-1 truncate pl-5">{claim.label}</p>
      )}
    </div>
  )
}
