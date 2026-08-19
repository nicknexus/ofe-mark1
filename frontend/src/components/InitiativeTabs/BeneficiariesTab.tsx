import React from 'react'
import BeneficiaryManager from '../BeneficiaryManager'

interface BeneficiariesTabProps {
  initiativeId: string
  onRefresh?: () => void
  onStoryClick?: (storyId: string) => void
  onMetricClick?: (kpiId: string) => void
}

export default function BeneficiariesTab({ initiativeId, onRefresh, onStoryClick, onMetricClick }: BeneficiariesTabProps) {
  return (
    <div className="h-screen overflow-hidden flex flex-col mobile-content-padding">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 leading-tight tracking-tight">Beneficiaries</h2>
          <p className="text-sm text-gray-500 mt-1 hidden sm:block">Track who your program serves</p>
        </div>
      </div>
      <div className="flex-1 bg-gray-50 px-4 sm:px-6 py-4 overflow-y-auto min-h-0">
        <BeneficiaryManager
          initiativeId={initiativeId}
          onRefresh={onRefresh}
          onStoryClick={onStoryClick}
          onMetricClick={onMetricClick}
        />
      </div>
    </div>
  )
}
