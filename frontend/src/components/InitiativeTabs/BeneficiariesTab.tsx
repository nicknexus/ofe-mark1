import React from 'react'
import { Users } from 'lucide-react'
import BeneficiaryManager from '../BeneficiaryManager'

interface BeneficiariesTabProps {
    initiativeId: string
    onRefresh?: () => void
}

export default function BeneficiariesTab({ initiativeId, onRefresh }: BeneficiariesTabProps) {
    return (
        <div className="h-[calc(100vh-64px)] overflow-hidden">
            <div className="h-full w-full px-4 sm:px-6 py-6 space-y-6 overflow-y-auto">
                <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                    <BeneficiaryManager
                        initiativeId={initiativeId}
                        onRefresh={onRefresh}
                    />
                </div>
            </div>
        </div>
    )
}
