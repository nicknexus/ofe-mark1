import React, { useState } from 'react'
import { Plus, Calendar, ArrowLeft, FileText } from 'lucide-react'
import { formatDate } from '../utils'
import EasyEvidenceModal from './EasyEvidenceModal'
import { apiService } from '../services/api'
import { CreateEvidenceForm } from '../types'
import { useTeam } from '../context/TeamContext'

interface MobileMetricDetailProps {
    kpi: any
    kpiTotal: number
    kpiUpdates: any[]
    onBack: () => void
    onAddUpdate: () => void
    onDataPointClick: (update: any) => void
    initiativeId: string
}

export default function MobileMetricDetail({
    kpi,
    kpiTotal,
    kpiUpdates,
    onBack,
    onAddUpdate,
    onDataPointClick,
    initiativeId
}: MobileMetricDetailProps) {
    const { canAddImpactClaims } = useTeam()
    const [isEasyEvidenceOpen, setIsEasyEvidenceOpen] = useState(false)
    const [selectedClaim, setSelectedClaim] = useState<any>(null)

    const handleEvidenceSubmit = async (data: CreateEvidenceForm) => {
        await apiService.createEvidence(data)
    }

    const openEasyEvidence = (claim: any) => {
        setSelectedClaim(claim)
        setIsEasyEvidenceOpen(true)
    }

    return (
        <div className="h-screen overflow-hidden flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-4 py-4 flex-shrink-0">
                <div className="flex items-center gap-3 mb-3">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-700" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-semibold text-gray-800 truncate">{kpi.title}</h1>
                        <p className="text-xs text-gray-500">{kpi.category} metric</p>
                    </div>
                </div>
                
                {/* Total */}
                <div className="bg-gray-50 rounded-2xl p-4 text-center">
                    <div className="flex items-baseline justify-center gap-2">
                        <span className="text-4xl font-bold text-gray-900">{kpiTotal.toLocaleString()}</span>
                        <span className="text-base text-gray-500 font-medium">{kpi.unit_of_measurement}</span>
                    </div>
                    {kpi.target_value && (
                        <p className="text-xs text-gray-500 mt-1">
                            Target: {kpi.target_value.toLocaleString()} {kpi.unit_of_measurement}
                        </p>
                    )}
                </div>
            </div>

            {/* Impact Claims List */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 mobile-content-padding">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-semibold text-gray-800">
                        Impact Claims ({kpiUpdates.length})
                    </h2>
                    <button
                        onClick={onAddUpdate}
                        className="p-2.5 bg-primary-500 text-white rounded-xl shadow-lg active:scale-95 transition-transform"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                {kpiUpdates.length === 0 ? (
                    <div className="mobile-empty-state">
                        <div className="mobile-empty-icon">
                            <Plus className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="mobile-empty-title">No Impact Claims Yet</h3>
                        <p className="mobile-empty-text">{canAddImpactClaims ? 'Add your first impact claim to track progress' : 'No impact claims have been added yet'}</p>
                        {canAddImpactClaims && (
                            <button
                                onClick={onAddUpdate}
                                className="mt-6 inline-flex items-center space-x-2 px-5 py-3 bg-primary-500 text-white rounded-2xl text-sm font-semibold shadow-lg active:scale-95 transition-transform"
                            >
                                <Plus className="w-5 h-5" />
                                <span>Add Impact Claim</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {kpiUpdates.map((update) => (
                            <div
                                key={update.id}
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                            >
                                {/* Tappable main area */}
                                <div 
                                    onClick={() => onDataPointClick(update)}
                                    className="p-4 active:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <div className="flex items-baseline gap-2 mb-1">
                                                <span className="text-2xl font-bold text-primary-600">
                                                    {update.value?.toLocaleString()}
                                                </span>
                                                <span className="text-sm text-gray-500 font-medium">
                                                    {kpi.unit_of_measurement}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>
                                                    {update.date_range_start && update.date_range_end
                                                        ? `${formatDate(update.date_range_start)} - ${formatDate(update.date_range_end)}`
                                                        : formatDate(update.date_represented)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {update.notes && (
                                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                                            {update.notes}
                                        </p>
                                    )}
                                </div>
                                {/* Add Evidence button */}
                                <div className="px-4 pb-3 pt-0">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            openEasyEvidence(update)
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-evidence-50 text-evidence-600 rounded-xl text-sm font-medium border border-evidence-100 active:scale-[0.98] transition-transform"
                                    >
                                        <FileText className="w-4 h-4" />
                                        <span>Add Evidence</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Easy Evidence Modal */}
            {isEasyEvidenceOpen && selectedClaim && (
                <EasyEvidenceModal
                    isOpen={isEasyEvidenceOpen}
                    onClose={() => {
                        setIsEasyEvidenceOpen(false)
                        setSelectedClaim(null)
                    }}
                    onSubmit={handleEvidenceSubmit}
                    impactClaim={selectedClaim}
                    kpi={kpi}
                    initiativeId={initiativeId}
                />
            )}
        </div>
    )
}

