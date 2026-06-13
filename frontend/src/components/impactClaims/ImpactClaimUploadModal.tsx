import React, { useState, useLayoutEffect } from 'react'
import { X, FileText, Layers } from 'lucide-react'
import { KPI } from '../../types'
import { useInitiativeData } from '../evidence/hooks/useInitiativeData'
import { isAdvancedImpactClaimEnabled } from '../../config/featureFlags'
import AddKPIUpdateModal from '../AddKPIUpdateModal'
import AddKPIUpdateModalWithMetricSelection from '../AddKPIUpdateModalWithMetricSelection'
import ClaimBoard from './board/ClaimBoard'
import { CreateKPIUpdateForm } from '../../types'

interface ImpactClaimUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (newUpdates?: any[]) => void
  initiativeId: string
  preSelectedKPI?: KPI
  /** For simple mode when no KPI pre-selected */
  availableKPIs?: KPI[]
  /** Called by simple mode (with-metric-selection path) */
  onSimpleSubmit?: (data: CreateKPIUpdateForm, kpiId: string) => Promise<void>
  /** Called by simple mode (single KPI path) */
  onSimpleSubmitSingle?: (data: CreateKPIUpdateForm) => Promise<void>
}

type ClaimMode = 'choose' | 'simple' | 'advanced'

export default function ImpactClaimUploadModal(props: ImpactClaimUploadModalProps) {
  const advancedEnabled = isAdvancedImpactClaimEnabled()
  const [mode, setMode] = useState<ClaimMode>(() => (advancedEnabled ? 'choose' : 'simple'))

  // Reset when closed so the next open doesn't flash the previous mode (advanced/simple).
  useLayoutEffect(() => {
    if (!props.isOpen) {
      setMode(advancedEnabled ? 'choose' : 'simple')
    }
  }, [props.isOpen, advancedEnabled])

  if (!props.isOpen) return null

  if (mode === 'choose') {
    return (
      <ClaimModeChooser
        onClose={props.onClose}
        onPick={setMode}
      />
    )
  }

  if (mode === 'simple') {
    return <SimpleClaimFallback {...props} />
  }

  return <AdvancedClaimModal {...props} />
}

function ClaimModeChooser({
  onClose,
  onPick,
}: {
  onClose: () => void
  onPick: (mode: 'simple' | 'advanced') => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 z-[70]">
      <div className="app-card-elevated w-full max-w-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/80">
          <div>
            <h2 className="text-base font-semibold text-gray-900">How do you want to add impact claims?</h2>
            <p className="text-xs text-gray-500 mt-0.5">Pick the flow that matches what you're adding.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => onPick('simple')}
            className="group text-left p-5 rounded-xl border border-gray-200 hover:border-primary-400 hover:bg-primary-50/30 transition-all flex flex-col gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center group-hover:bg-primary-100 group-hover:border-primary-200 transition-colors">
              <FileText className="w-5 h-5 text-gray-700 group-hover:text-primary-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Simple</h3>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">Classic</span>
              </div>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                One claim at a time. A quick guided form to enter a single measurement.
              </p>
            </div>
          </button>

          <button
            onClick={() => onPick('advanced')}
            className="group text-left p-5 rounded-xl border border-gray-200 hover:border-primary-400 hover:bg-primary-50/30 transition-all flex flex-col gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center group-hover:bg-primary-100 group-hover:border-primary-200 transition-colors">
              <Layers className="w-5 h-5 text-gray-700 group-hover:text-primary-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Advanced</h3>
                <span className="text-xs font-medium text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded">New</span>
              </div>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Batch add many claims at once. Each metric gets its own column — add, duplicate, and organise claims across metrics.
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

function SimpleClaimFallback({
  isOpen,
  onClose,
  onCreated,
  initiativeId,
  preSelectedKPI,
  availableKPIs,
  onSimpleSubmit,
  onSimpleSubmitSingle,
}: ImpactClaimUploadModalProps) {
  if (preSelectedKPI && onSimpleSubmitSingle) {
    return (
      <AddKPIUpdateModal
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={async (data) => {
          await onSimpleSubmitSingle(data)
          onCreated?.()
        }}
        kpiTitle={preSelectedKPI.title}
        kpiId={preSelectedKPI.id!}
        metricType={preSelectedKPI.metric_type ?? 'number'}
        unitOfMeasurement={preSelectedKPI.unit_of_measurement ?? ''}
        initiativeId={initiativeId}
        kpiTagIds={(preSelectedKPI as any).tag_ids ?? []}
      />
    )
  }

  if (availableKPIs && onSimpleSubmit) {
    return (
      <AddKPIUpdateModalWithMetricSelection
        isOpen={isOpen}
        onClose={onClose}
        onSubmit={async (data, kpiId) => {
          await onSimpleSubmit(data, kpiId)
          onCreated?.()
        }}
        availableKPIs={availableKPIs}
        initiativeId={initiativeId}
      />
    )
  }

  return null
}

function AdvancedClaimModal({
  isOpen,
  onClose,
  onCreated,
  initiativeId,
  preSelectedKPI,
}: ImpactClaimUploadModalProps) {
  const { kpis, locations, beneficiaryGroups } = useInitiativeData(initiativeId, isOpen)

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-[70]">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-7xl h-[90vh] overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200/80 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Add Impact Claims</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Each column is a metric — add claims, set details, then submit all at once.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Board */}
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
