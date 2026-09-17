import React, { useState, useEffect } from 'react'
import { Plus, Search, X } from 'lucide-react'
import BeneficiaryManager from '../BeneficiaryManager'
import { useTeam } from '../../context/TeamContext'

interface BeneficiariesTabProps {
  initiativeId: string
  onRefresh?: () => void
  onStoryClick?: (storyId: string) => void
  onMetricClick?: (kpiId: string) => void
}

export default function BeneficiariesTab({ initiativeId, onRefresh, onStoryClick, onMetricClick }: BeneficiariesTabProps) {
  const { canAddBeneficiaries } = useTeam()
  const [searchQuery, setSearchQuery] = useState('')
  const [addSignal, setAddSignal] = useState(0)

  return (
    <div className="h-full overflow-hidden flex flex-col mobile-content-padding">
      <div className="px-4 sm:px-6 pt-2.5 pb-2 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
          <div className="relative flex-1 min-w-[140px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search groups"
              className="w-full h-8 pl-9 pr-8 bg-white border border-gray-200 rounded-full text-xs md:text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {canAddBeneficiaries && (
            <button
              type="button"
              onClick={() => setAddSignal(s => s + 1)}
              className="app-btn app-btn-sm app-btn-primary shadow-sm ml-auto flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add group</span>
              <span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 bg-gray-50 px-4 sm:px-6 pt-2.5 pb-4 overflow-y-auto min-h-0">
        <BeneficiaryManager
          initiativeId={initiativeId}
          onRefresh={onRefresh}
          onStoryClick={onStoryClick}
          onMetricClick={onMetricClick}
          searchQuery={searchQuery}
          addSignal={addSignal}
          hideHeader
        />
      </div>
    </div>
  )
}
