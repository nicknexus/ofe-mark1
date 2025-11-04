import React from 'react'
import { Link } from 'react-router-dom'
import {
    Home,
    BarChart3,
    MapPin,
    Users,
    ArrowLeft,
    Target
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
            description: 'Overview & KPIs'
        },
        {
            id: 'metrics',
            label: 'Metrics',
            icon: BarChart3,
            description: 'Analytics & Charts'
        },
        {
            id: 'location',
            label: 'Location',
            icon: MapPin,
            description: 'Geographic Data'
        },
        {
            id: 'beneficiaries',
            label: 'Beneficiaries',
            icon: Users,
            description: 'People Management'
        }
    ]

    return (
        <div className="fixed left-0 top-16 w-56 h-[calc(100vh-64px)] bg-white border-r border-gray-200 flex flex-col z-30">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center space-x-2 mb-3">
                    <div className="p-1.5 bg-primary-100 rounded-lg">
                        <Target className="w-4 h-4 text-primary-600" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-900 truncate">
                            {initiativeTitle}
                        </h2>
                        <p className="text-sm text-gray-500">Initiative Details</p>
                    </div>
                </div>

                {/* Back to Dashboard */}
                <Link
                    to="/"
                    className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Dashboard</span>
                </Link>
            </div>

            {/* Navigation Tabs */}
            <div className="flex-1 p-3">
                <nav className="space-y-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id

                        return (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-left transition-all duration-200 ${isActive
                                    ? 'bg-primary-50 border border-primary-200 text-primary-700'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{tab.label}</div>
                                    <div className="text-xs text-gray-500">{tab.description}</div>
                                </div>
                            </button>
                        )
                    })}
                </nav>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 text-center">
                    {initiativeSlug ? (
                        <span className="font-mono">{initiativeSlug}</span>
                    ) : (
                        <span>ID: {initiativeId.slice(0, 8)}...</span>
                    )}
                </div>
            </div>
        </div>
    )
}
