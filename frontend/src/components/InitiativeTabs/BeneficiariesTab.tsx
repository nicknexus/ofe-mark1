import React from 'react'
import { Users } from 'lucide-react'
import BeneficiaryManager from '../BeneficiaryManager'

interface BeneficiariesTabProps {
    initiativeId: string
    onRefresh?: () => void
    onStoryClick?: (storyId: string) => void
    onMetricClick?: (kpiId: string) => void
}

export default function BeneficiariesTab({ initiativeId, onRefresh, onStoryClick, onMetricClick }: BeneficiariesTabProps) {
    return (
        <div className="h-screen overflow-hidden">
            <div className="h-full w-full px-4 sm:px-6 py-6 space-y-6 overflow-y-auto">
                <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                    <BeneficiaryManager
                        initiativeId={initiativeId}
                        onRefresh={onRefresh}
                        onStoryClick={onStoryClick}
                        onMetricClick={onMetricClick}
                    />
                </div>
            </div>
        </div>
    )
}
