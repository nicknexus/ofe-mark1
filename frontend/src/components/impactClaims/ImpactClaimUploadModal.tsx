import React from 'react'
import { X } from 'lucide-react'
import { KPI } from '../../types'
import { useInitiativeData } from '../evidence/hooks/useInitiativeData'
import ClaimBoard from './board/ClaimBoard'

interface ImpactClaimUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (newUpdates?: any[]) => void
  initiativeId: string
  preSelectedKPI?: KPI
}

/**
 * Advanced claim board: one column per metric, add many claims at once.
 * The guided single-claim path lives in `UploadWizard`; this is the bulk
 * tool it hands off to from its Simple / Advanced step.
 */
export default function ImpactClaimUploadModal({
  isOpen,
  onClose,
  onCreated,
  initiativeId,
  preSelectedKPI,
}: ImpactClaimUploadModalProps) {
  const { kpis, locations, beneficiaryGroups } = useInitiativeData(initiativeId, isOpen)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-[70]">
      <div className="bg-white rounded-xl shadow-app-modal flex flex-col w-full max-w-7xl h-[90vh] overflow-hidden border border-gray-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200/80 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add Impact Claims</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Each column is a metric. Add claims, set details, then submit all at once.
            </p>
          </div>
          <button
            onClick={onClose}
            className="app-btn app-btn-icon app-btn-ghost"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <ClaimBoard
            initiativeId={initiativeId}
            preSelectedKPI={preSelectedKPI}
            allKPIs={kpis}
            locations={locations}
            beneficiaryGroups={beneficiaryGroups}
            onCreated={onCreated}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  )
}
