import React from 'react'
import { Link } from 'react-router-dom'
import {
    Home,
    BarChart3,
    MapPin,
    Users,
    ArrowLeft,
    Target,
    BookOpen,
    Sparkles,
    FileText
} from 'lucide-react'

interface InitiativeSidebarProps {
    activeTab: string
    onTabChange: (tab: string) => void
    initiativeTitle: string
    initiativeId: string
    initiativeSlug?: string
}

export default function InitiativeSidebar({
    activeTab,
    onTabChange,
    initiativeTitle,
    initiativeId,
    initiativeSlug
}: InitiativeSidebarProps) {
    const tabs = [
        {
            id: 'home',
            label: 'Home',
            icon: Home,
            description: 'Overview'
        },
        {
            id: 'metrics',
            label: 'Metrics',
            icon: BarChart3,
            description: 'Track metrics'
        },
        {
            id: 'evidence',
            label: 'Evidence',
            icon: FileText,
            description: 'Evidence Library'
        },
        {
            id: 'location',
            label: 'Location',
            icon: MapPin,
            description: 'Locations'
        },
        {
            id: 'beneficiaries',
            label: 'Beneficiaries',
            icon: Users,
            description: 'People Management'
        },
        {
            id: 'stories',
            label: 'Stories',
            icon: BookOpen,
            description: 'Impact Stories'
        },
        {
            id: 'report',
            label: 'AI Report',
            icon: Sparkles,
            description: 'Generate Impact Report'
        }
    ]

    return (
        <div className="fixed left-0 top-16 w-56 h-[calc(100vh-64px)] bg-white border-r border-gray-100 shadow-bubble-sm flex flex-col z-30">
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex items-center space-x-2 mb-3">
                    <div className="icon-bubble-sm">
                        <Target className="w-4 h-4 text-primary-500" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-800 truncate">
                            {initiativeTitle}
                        </h2>
                        <p className="text-xs text-gray-400">Initiative Details</p>
                    </div>
                </div>

                {/* Back to Dashboard */}
                <Link
                    to="/"
                    className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Dashboard</span>
                </Link>
            </div>

            {/* Navigation Tabs */}
            <div className="flex-1 p-3 overflow-y-auto">
                <nav className="space-y-1.5">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id

                        return (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${isActive
                                    ? 'bg-primary-50 shadow-bubble-sm text-primary-700'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-primary-100' : 'bg-gray-100'}`}>
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary-500' : 'text-gray-400'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{tab.label}</div>
                                    <div className="text-xs text-gray-400">{tab.description}</div>
                                </div>
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100">
                <div className="text-xs text-gray-400 text-center">
                    {initiativeSlug ? (
                        <span className="font-mono bg-gray-50 px-2 py-1 rounded-lg">{initiativeSlug}</span>
                    ) : (
                        <span>ID: {initiativeId.slice(0, 8)}...</span>
                    )}
                </div>
            </div>
        </div>
    )
}
