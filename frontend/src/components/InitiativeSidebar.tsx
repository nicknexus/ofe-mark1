import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    Home,
    BarChart3,
    MapPin,
    Users,
    ArrowLeft,
    BookOpen,
    Sparkles,
    FileText,
    Settings,
    LogOut,
    User as UserIcon
} from 'lucide-react'
import { User } from '../types'

interface InitiativeSidebarProps {
    activeTab: string
    onTabChange: (tab: string) => void
    initiativeTitle: string
    initiativeId: string
    initiativeSlug?: string
    user: User
    onSignOut: () => void
}

export default function InitiativeSidebar({
    activeTab,
    onTabChange,
    initiativeTitle,
    initiativeId,
    initiativeSlug,
    user,
    onSignOut
}: InitiativeSidebarProps) {
    const navigate = useNavigate()
    const [settingsOpen, setSettingsOpen] = useState(false)
    const settingsRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
                setSettingsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])
    const tabs = [
        {
            id: 'home',
            label: 'Home',
            icon: Home,
            description: 'Overview',
            tutorialId: 'home-tab'
        },
        {
            id: 'metrics',
            label: 'Metrics',
            icon: BarChart3,
            description: 'Track metrics',
            tutorialId: 'metrics-tab'
        },
        {
            id: 'evidence',
            label: 'Evidence',
            icon: FileText,
            description: 'Evidence Library',
            tutorialId: 'evidence-tab'
        },
        {
            id: 'location',
            label: 'Location',
            icon: MapPin,
            description: 'Locations',
            tutorialId: 'locations-tab'
        },
        {
            id: 'beneficiaries',
            label: 'Beneficiaries',
            icon: Users,
            description: 'People Management',
            tutorialId: undefined
        },
        {
            id: 'stories',
            label: 'Stories',
            icon: BookOpen,
            description: 'Impact Stories',
            tutorialId: undefined
        },
        {
            id: 'report',
            label: 'AI Report',
            icon: Sparkles,
            description: 'Generate Impact Report',
            tutorialId: undefined
        }
    ]

    return (
        <div className="fixed left-0 top-0 w-56 h-screen bg-white border-r border-gray-100 shadow-bubble-sm flex flex-col z-30">
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
                <div className="flex items-center space-x-2 mb-3">
                    <div className="icon-bubble-sm">
                        <img src="/Nexuslogo.png" alt="Nexus Logo" className="w-5 h-5 object-contain" />
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
                                data-tutorial={tab.tutorialId}
                                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 border-2 ${isActive
                                    ? 'border-primary-500 bg-white shadow-bubble-sm text-gray-700'
                                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-gray-100' : 'bg-gray-100'}`}>
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
            <div className="p-3 border-t border-gray-100 space-y-2">
                {/* Settings Gear Icon */}
                <div className="relative" ref={settingsRef}>
                    <button
                        onClick={() => setSettingsOpen(!settingsOpen)}
                        className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                    >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                            <Settings className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">Settings</div>
                        </div>
                    </button>

                    {/* Dropdown Menu */}
                    {settingsOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-full bg-white rounded-xl shadow-bubble-lg border border-gray-100 overflow-hidden">
                            <button
                                onClick={() => {
                                    navigate('/account')
                                    setSettingsOpen(false)
                                }}
                                className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <UserIcon className="w-4 h-4" />
                                <span>Account</span>
                            </button>
                            <button
                                onClick={() => {
                                    onSignOut()
                                    setSettingsOpen(false)
                                }}
                                className="w-full flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
