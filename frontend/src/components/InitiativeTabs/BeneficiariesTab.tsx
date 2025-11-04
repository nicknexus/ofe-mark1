import React from 'react'
import { Users } from 'lucide-react'
import BeneficiaryManager from '../BeneficiaryManager'

interface BeneficiariesTabProps {
    initiativeId: string
    onRefresh?: () => void
}

export default function BeneficiariesTab({ initiativeId, onRefresh }: BeneficiariesTabProps) {
    return (
        <div className="h-[calc(100vh-64px)] bg-gray-50 overflow-hidden">
            <div className="h-full p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="p-3 bg-purple-100 rounded-lg">
                                <Users className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Beneficiaries</h1>
                                <p className="text-gray-600">Manage and track the people impacted by your initiative</p>
                            </div>
                        </div>
                    </div>

                    {/* Beneficiaries Container */}
                    <BeneficiaryManager
                        initiativeId={initiativeId}
                        onRefresh={onRefresh}
                    />
                </div>
            </div>
        </div>
    )
}
