import React, { useState, useEffect } from 'react'
import { 
    Home, 
    FileText, 
    MapPin, 
    BookOpen, 
    User,
    ChevronLeft
} from 'lucide-react'
import { apiService } from '../services/api'
import { Initiative, User as UserType, SubscriptionStatus } from '../types'
import MobileDashboard from './mobile/MobileDashboard'
import MobileEvidenceTab from './mobile/MobileEvidenceTab'
import MobileLocationsTab from './mobile/MobileLocationsTab'
import MobileStoriesTab from './mobile/MobileStoriesTab'
import MobileAccountTab from './mobile/MobileAccountTab'

interface MobileAppProps {
    user: UserType
    subscriptionStatus: SubscriptionStatus | null
}

// Top level: home or account
// Inside initiative: evidence, locations, stories
type TopLevelView = 'home' | 'account'
type InitiativeTab = 'evidence' | 'locations' | 'stories'

export default function MobileApp({ user, subscriptionStatus }: MobileAppProps) {
    const [view, setView] = useState<TopLevelView>('home')
    const [initiatives, setInitiatives] = useState<Initiative[]>([])
    const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null)
    const [initiativeTab, setInitiativeTab] = useState<InitiativeTab>('evidence')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadInitiatives()
    }, [])

    const loadInitiatives = async () => {
        try {
            const data = await apiService.getInitiatives()
            setInitiatives(data)
        } catch (error) {
            console.error('Failed to load initiatives:', error)
        } finally {
            setLoading(false)
        }
    }

    // Enter an initiative
    const handleEnterInitiative = (initiative: Initiative) => {
        setSelectedInitiative(initiative)
        setInitiativeTab('evidence') // Default to evidence tab
    }

    // Exit back to home
    const handleExitInitiative = () => {
        setSelectedInitiative(null)
        setView('home')
    }

    // Show loading spinner while initial data loads
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F9FAFB' }}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600 text-sm">Loading...</p>
                </div>
            </div>
        )
    }

    // Inside an initiative - show initiative view with tabs
    if (selectedInitiative) {
        return (
            <div className="min-h-screen pb-20" style={{ backgroundColor: '#F9FAFB' }}>
                {/* Initiative Header */}
                <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-40">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExitInitiative}
                            className="p-2 -ml-2 text-gray-500 hover:text-gray-700"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="font-semibold text-gray-900 truncate">
                                {selectedInitiative.title}
                            </h1>
                            {selectedInitiative.description && (
                                <p className="text-xs text-gray-500 truncate">
                                    {selectedInitiative.description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Initiative Content */}
                <div className="flex-1">
                    {initiativeTab === 'evidence' && (
                        <MobileEvidenceTab 
                            initiativeId={selectedInitiative.id!}
                            onRefresh={() => {}}
                        />
                    )}
                    {initiativeTab === 'locations' && (
                        <MobileLocationsTab 
                            initiativeId={selectedInitiative.id!}
                        />
                    )}
                    {initiativeTab === 'stories' && (
                        <MobileStoriesTab 
                            initiativeId={selectedInitiative.id!}
                        />
                    )}
                </div>

                {/* Initiative Bottom Navigation */}
                <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb z-50">
                    <div className="flex justify-around items-center h-16">
                        {[
                            { id: 'evidence' as InitiativeTab, label: 'Evidence', icon: FileText },
                            { id: 'locations' as InitiativeTab, label: 'Locations', icon: MapPin },
                            { id: 'stories' as InitiativeTab, label: 'Stories', icon: BookOpen },
                        ].map((tab) => {
                            const Icon = tab.icon
                            const isActive = initiativeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setInitiativeTab(tab.id)}
                                    className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                                        isActive 
                                            ? 'text-primary-600' 
                                            : 'text-gray-400 hover:text-gray-600'
                                    }`}
                                >
                                    <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                                    <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                        {tab.label}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </nav>
            </div>
        )
    }

    // Top level view - Home or Account
    return (
        <div className="min-h-screen pb-20" style={{ backgroundColor: '#F9FAFB' }}>
            {/* Main Content */}
            <div className="flex-1">
                {view === 'home' && (
                    <MobileDashboard 
                        initiatives={initiatives}
                        onEnterInitiative={handleEnterInitiative}
                        onRefresh={loadInitiatives}
                        loading={loading}
                        onNavigateToAccount={() => setView('account')}
                    />
                )}
                {view === 'account' && (
                    <MobileAccountTab 
                        user={user}
                        subscriptionStatus={subscriptionStatus}
                    />
                )}
            </div>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb z-50">
                <div className="flex justify-around items-center h-16">
                    {[
                        { id: 'home' as TopLevelView, label: 'Home', icon: Home },
                        { id: 'account' as TopLevelView, label: 'Account', icon: User },
                    ].map((tab) => {
                        const Icon = tab.icon
                        const isActive = view === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setView(tab.id)}
                                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                                    isActive 
                                        ? 'text-primary-600' 
                                        : 'text-gray-400 hover:text-gray-600'
                                }`}
                            >
                                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                                <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                    {tab.label}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </nav>
        </div>
    )
}

