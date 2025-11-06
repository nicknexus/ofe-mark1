import React from 'react'
import { Users } from 'lucide-react'
import BeneficiaryManager from '../BeneficiaryManager'

interface BeneficiariesTabProps {
    initiativeId: string
    onRefresh?: () => void
}

export default function BeneficiariesTab({ initiativeId, onRefresh }: BeneficiariesTabProps) {
    return (
        <div className="h-[calc(100vh-64px)] bg-gradient-to-br from-slate-50 via-white to-purple-50/30 overflow-hidden">
            <div className="h-full w-full px-2 sm:px-4 py-4 space-y-6 overflow-y-auto">
                <BeneficiaryManager
                    initiativeId={initiativeId}
                    onRefresh={onRefresh}
                />
            </div>
        </div>
    )
}
