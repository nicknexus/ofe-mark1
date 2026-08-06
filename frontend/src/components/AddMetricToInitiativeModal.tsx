import React, { useState } from 'react'
import { BarChart3, Check, ChevronRight, Layers } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from './ModalFrame'
import { Initiative } from '../types'
import { truncateText } from '../utils'

interface AddMetricToInitiativeModalProps {
  isOpen: boolean
  onClose: () => void
  /** Metric being placed — named in the header so the choice has context. */
  metricTitle: string
  initiatives: Initiative[]
  /** Initiative ids that already carry this metric; shown but not selectable. */
  attachedInitiativeIds: string[]
  onSelect: (initiativeId: string) => Promise<void>
  orgLogoUrl?: string | null
}

/**
 * Initiative picker for adding an org-global metric.
 *
 * Deliberately reuses the dashboard initiative-card look — same tile, title,
 * description and hover treatment — so choosing an initiative here feels like
 * the same object you clicked on the dashboard, not a generic list row.
 *
 * Initiatives that already have the metric stay visible and marked rather than
 * being hidden, so the list always reads as the org's full set.
 */
export default function AddMetricToInitiativeModal({
  isOpen,
  onClose,
  metricTitle,
  initiatives,
  attachedInitiativeIds,
  onSelect,
  orgLogoUrl,
}: AddMetricToInitiativeModalProps) {
  const [pending, setPending] = useState<string | null>(null)

  if (!isOpen) return null

  const attached = new Set(attachedInitiativeIds)

  const handleSelect = async (initiativeId: string) => {
    setPending(initiativeId)
    try {
      await onSelect(initiativeId)
    } finally {
      setPending(null)
    }
  }

  return (
    <ModalFrame zIndexClass="z-[70]" size="md">
      <ModalHeader
        icon={Layers}
        title="Add to initiative"
        subtitle={`Choose where "${metricTitle}" should be tracked`}
        onClose={onClose}
      />

      <ModalBody rail>
        {initiatives.length === 0 ? (
          <div className="text-center py-10">
            <div className="app-icon-tile app-icon-tile-accent mx-auto mb-3">
              <BarChart3 className="w-5 h-5" />
            </div>
            <p className="text-sm text-gray-500">
              You don't have any initiatives yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {initiatives.map(initiative => {
              const isAttached = attached.has(initiative.id!)
              const isPending = pending === initiative.id

              return (
                <button
                  key={initiative.id}
                  type="button"
                  disabled={isAttached || pending !== null}
                  onClick={() => handleSelect(initiative.id!)}
                  className={`group relative h-full text-left bg-white rounded-2xl border shadow-card transition-all duration-200 ${
                    isAttached
                      ? 'border-gray-200/70 opacity-60 cursor-default'
                      : 'border-gray-200/70 hover:border-primary-300/70 hover:shadow-card-hover hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0'
                  }`}
                >
                  <div className="p-4 h-full flex flex-col gap-2.5">
                    <div className="flex items-start gap-3 pr-6">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white ring-1 ring-gray-100 overflow-hidden">
                        <img
                          src={orgLogoUrl || '/Nexuslogo.png'}
                          alt=""
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            ;(e.currentTarget as HTMLImageElement).src = '/Nexuslogo.png'
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className="text-sm font-semibold leading-snug line-clamp-1 text-gray-900"
                          title={initiative.title}
                        >
                          {initiative.title}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {truncateText(initiative.description, 110)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 mt-auto pt-2.5 border-t border-gray-100">
                      {isAttached ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
                          <Check className="w-3.5 h-3.5" />
                          Already added
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 group-hover:text-primary-700 transition-colors">
                          <BarChart3 className="w-3.5 h-3.5" />
                          {isPending ? 'Adding…' : 'Add this metric'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="absolute top-3 right-3">
                    {isAttached ? (
                      <Check className="w-4 h-4 text-gray-300" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <button type="button" onClick={onClose} className="app-btn app-btn-secondary">
          Cancel
        </button>
      </ModalFooter>
    </ModalFrame>
  )
}
