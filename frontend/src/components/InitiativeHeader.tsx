import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Target, Plus, Upload } from 'lucide-react'
import { Initiative } from '../types'

interface InitiativeHeaderProps {
    initiative: Initiative
    kpisCount: number
    onEvidenceClick?: () => void
    onAddKPIClick?: () => void
    showEvidenceButton?: boolean
    showAddKPIButton?: boolean
    addKPIButtonText?: string
}

export default function InitiativeHeader({
    initiative,
    kpisCount,
    onEvidenceClick,
    onAddKPIClick,
    showEvidenceButton = true,
    showAddKPIButton = true,
    addKPIButtonText
}: InitiativeHeaderProps) {
    return (
        <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-gray-200/60">
            <div className="w-full px-4 sm:px-6">
                <div className="flex items-center justify-between h-16 sm:h-18">
                    <div className="flex items-center space-x-4">
                        <Link
                            to="/"
                            className="group flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100/70 hover:bg-gray-200/70 transition-all duration-200 hover:scale-105"
                            title="Back to Dashboard"
                        >
                            <ArrowLeft className="w-4 h-4 text-gray-600 group-hover:text-gray-900 transition-colors" />
                        </Link>
                        <div className="flex-1">
                            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                {initiative.title}
                            </h1>
                            <p className="text-gray-500 text-sm mt-0.5 max-w-2xl line-clamp-1">
                                {initiative.description}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Link
                            to="/"
                            className="group flex items-center space-x-2 px-3 py-2 bg-blue-100/70 hover:bg-blue-200/70 border border-blue-200/60 hover:border-blue-300/60 rounded-lg text-xs font-medium text-blue-700 hover:text-blue-900 transition-all duration-200 hover:shadow-sm hover:scale-[1.02]"
                            title="View All Initiatives"
                        >
                            <Target className="w-3 h-3" />
                            <span className="hidden sm:inline">Initiatives</span>
                        </Link>
                        {showEvidenceButton && kpisCount > 0 && (
                            <button
                                onClick={onEvidenceClick}
                                className="group flex items-center space-x-1.5 px-3 py-2 bg-white/80 hover:bg-white border border-gray-200/60 hover:border-gray-300/60 rounded-lg text-xs font-medium text-gray-700 hover:text-gray-900 transition-all duration-200 hover:shadow-sm hover:scale-[1.02]"
                            >
                                <Upload className="w-3 h-3 group-hover:scale-110 transition-transform" />
                                <span className="hidden sm:inline">Evidence</span>
                            </button>
                        )}
                        {showAddKPIButton && (
                            <button
                                onClick={onAddKPIClick}
                                className="flex items-center space-x-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors duration-200"
                            >
                                <Plus className="w-4 h-4" />
                                <span>{addKPIButtonText || (kpisCount === 0 ? 'Add First KPI' : 'Add KPI')}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
