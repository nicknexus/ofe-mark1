import React, { useState } from 'react'
import {
    Camera,
    BookOpen,
    MapPin,
    BarChart3,
    ChevronRight,
    X,
    Zap
} from 'lucide-react'
import { Initiative } from '../../types'
import { useTeam } from '../../context/TeamContext'

type ActionType = 'evidence' | 'impact_claim' | 'story' | 'location'

interface MobileActionsTabProps {
    initiatives: Initiative[]
    onAction: (initiativeId: string, action: ActionType) => void
}

const actions = [
    {
        id: 'evidence' as ActionType,
        label: 'Add Evidence',
        description: 'Photos, documents, or recordings',
        icon: Camera,
        gradient: 'from-blue-500 to-blue-600',
        lightColor: 'bg-blue-50',
        textColor: 'text-blue-600',
    },
    {
        id: 'impact_claim' as ActionType,
        label: 'Add Impact Claim',
        description: 'Report metric data points',
        icon: BarChart3,
        gradient: 'from-purple-500 to-purple-600',
        lightColor: 'bg-purple-50',
        textColor: 'text-purple-600',
    },
    {
        id: 'story' as ActionType,
        label: 'Add Story',
        description: 'Impact stories & testimonials',
        icon: BookOpen,
        gradient: 'from-emerald-500 to-emerald-600',
        lightColor: 'bg-emerald-50',
        textColor: 'text-emerald-600',
    },
    {
        id: 'location' as ActionType,
        label: 'Add Location',
        description: 'Places where you operate',
        icon: MapPin,
        gradient: 'from-amber-500 to-amber-600',
        lightColor: 'bg-amber-50',
        textColor: 'text-amber-600',
    },
]

export default function MobileActionsTab({ initiatives, onAction }: MobileActionsTabProps) {
    const { organizationName } = useTeam()
    const [pendingAction, setPendingAction] = useState<ActionType | null>(null)

    const handleActionClick = (actionId: ActionType) => {
        if (initiatives.length === 0) return
        if (initiatives.length === 1) {
            onAction(initiatives[0].id!, actionId)
            return
        }
        setPendingAction(actionId)
    }

    const handleSelectInitiative = (initiative: Initiative) => {
        if (!pendingAction) return
        onAction(initiative.id!, pendingAction)
        setPendingAction(null)
    }

    const pendingActionMeta = pendingAction ? actions.find(a => a.id === pendingAction) : null

    return (
        <div className="min-h-screen">
            {/* Header */}
            <div className="px-5 pt-6 pb-4">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                        <img src="/Nexuslogo.png" alt="" className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-gray-900 truncate">
                            {organizationName || 'Your Organization'}
                        </h1>
                        <p className="text-xs text-gray-500">Quick Actions</p>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="px-5">
                {initiatives.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Zap className="w-8 h-8 text-primary-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Initiatives Yet</h3>
                        <p className="text-gray-500 text-sm px-6">
                            Create an initiative first to start adding data.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {actions.map((action) => {
                            const Icon = action.icon
                            return (
                                <button
                                    key={action.id}
                                    onClick={() => handleActionClick(action.id)}
                                    className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-[0.98] transition-all text-left"
                                >
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                        <Icon className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-900 text-[15px]">{action.label}</h3>
                                        <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                                </button>
                            )
                        })}
                    </div>
                )}

                {/* Stats strip */}
                {initiatives.length > 0 && (
                    <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Overview</p>
                        <div className="flex items-center justify-around">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-gray-900">{initiatives.length}</p>
                                <p className="text-xs text-gray-500 mt-0.5">Initiative{initiatives.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Initiative picker bottom sheet */}
            {pendingAction && pendingActionMeta && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={() => setPendingAction(null)}>
                    <div className="absolute inset-0 bg-black/30" />
                    <div
                        className="relative bg-white rounded-t-3xl w-full max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3" />
                        <div className="flex items-center justify-between px-5 pt-4 pb-3">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Select Initiative</h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Choose where to {pendingActionMeta.label.toLowerCase()}
                                </p>
                            </div>
                            <button
                                onClick={() => setPendingAction(null)}
                                className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-2">
                            {initiatives.map((initiative) => (
                                <button
                                    key={initiative.id}
                                    onClick={() => handleSelectInitiative(initiative)}
                                    className="w-full flex items-center gap-3 p-3.5 bg-gray-50 hover:bg-gray-100 active:bg-gray-100 rounded-xl text-left transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                                        <img src="/Nexuslogo.png" alt="" className="w-5 h-5 object-contain" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-gray-800 truncate">{initiative.title}</h3>
                                        {initiative.description && (
                                            <p className="text-xs text-gray-500 truncate mt-0.5">{initiative.description}</p>
                                        )}
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
