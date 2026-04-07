import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
    Zap,
    FileText, 
    MapPin, 
    BookOpen, 
    BarChart3,
    User,
    ChevronLeft,
    Layers,
    Compass,
    Building2,
    Users,
    ChevronDown,
    Check
} from 'lucide-react'
import { apiService } from '../services/api'
import { Initiative, User as UserType, SubscriptionStatus } from '../types'
import { useTeam } from '../context/TeamContext'
import MobileDashboard from './mobile/MobileDashboard'
import MobileActionsTab from './mobile/MobileActionsTab'
import MobileEvidenceTab from './mobile/MobileEvidenceTab'
import MobileMetricsTab from './mobile/MobileMetricsTab'
import MobileLocationsTab from './mobile/MobileLocationsTab'
import MobileStoriesTab from './mobile/MobileStoriesTab'
import MobileAccountTab from './mobile/MobileAccountTab'
import ExplorePage from '../pages/ExplorePage'

interface MobileAppProps {
    user: UserType
    subscriptionStatus: SubscriptionStatus | null
}

type TopLevelView = 'actions' | 'initiatives' | 'explore' | 'account'
type InitiativeTab = 'evidence' | 'metrics' | 'locations' | 'stories'

export default function MobileApp({ user, subscriptionStatus }: MobileAppProps) {
    const navigate = useNavigate()
    const location = useLocation()
    const { accessibleOrganizations, activeOrganization, switchOrganization, hasMultipleOrgs, isSharedMember } = useTeam()
    const [view, setViewRaw] = useState<TopLevelView>(() => {
        const saved = sessionStorage.getItem('mobile-view')
        if (saved === 'explore' || saved === 'account' || saved === 'actions' || saved === 'initiatives') return saved
        return 'actions'
    })
    const setView = (v: TopLevelView) => {
        sessionStorage.setItem('mobile-view', v)
        setViewRaw(v)
    }
    const [initiatives, setInitiatives] = useState<Initiative[]>([])
    const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null)
    const [initiativeTab, setInitiativeTab] = useState<InitiativeTab>('evidence')
    const [autoAdd, setAutoAdd] = useState(false)
    const [loading, setLoading] = useState(true)
    const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
    const orgDropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (location.pathname === '/explore') {
            setView('explore')
            navigate('/', { replace: true })
        }
    }, [location.pathname])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
                setOrgDropdownOpen(false)
            }
        }
        if (orgDropdownOpen) document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [orgDropdownOpen])

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

    const handleEnterInitiative = (initiative: Initiative) => {
        setSelectedInitiative(initiative)
        setInitiativeTab('evidence')
        setAutoAdd(false)
    }

    const handleExitInitiative = () => {
        setSelectedInitiative(null)
        setAutoAdd(false)
    }

    const handleQuickAction = (initiativeId: string, action: 'evidence' | 'impact_claim' | 'story' | 'location') => {
        const initiative = initiatives.find(i => i.id === initiativeId)
        if (!initiative) return
        setSelectedInitiative(initiative)
        setAutoAdd(true)
        const tabMap: Record<string, InitiativeTab> = {
            evidence: 'evidence',
            impact_claim: 'metrics',
            story: 'stories',
            location: 'locations',
        }
        setInitiativeTab(tabMap[action])
    }

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

    if (selectedInitiative) {
        return (
            <div className="min-h-screen pb-20" style={{ backgroundColor: '#F9FAFB' }}>
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

                <div className="flex-1">
                    {initiativeTab === 'evidence' && (
                        <MobileEvidenceTab 
                            key={`${selectedInitiative.id}-${autoAdd}`}
                            initiativeId={selectedInitiative.id!}
                            onRefresh={() => {}}
                            autoAdd={autoAdd}
                        />
                    )}
                    {initiativeTab === 'metrics' && (
                        <MobileMetricsTab 
                            key={`${selectedInitiative.id}-${autoAdd}`}
                            initiativeId={selectedInitiative.id!}
                            autoAdd={autoAdd}
                        />
                    )}
                    {initiativeTab === 'locations' && (
                        <MobileLocationsTab 
                            key={`${selectedInitiative.id}-${autoAdd}`}
                            initiativeId={selectedInitiative.id!}
                            autoAdd={autoAdd}
                        />
                    )}
                    {initiativeTab === 'stories' && (
                        <MobileStoriesTab 
                            key={`${selectedInitiative.id}-${autoAdd}`}
                            initiativeId={selectedInitiative.id!}
                            autoAdd={autoAdd}
                        />
                    )}
                </div>

                <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb z-50">
                    <div className="flex justify-around items-center h-16">
                        {[
                            { id: 'evidence' as InitiativeTab, label: 'Evidence', icon: FileText },
                            { id: 'metrics' as InitiativeTab, label: 'Metrics', icon: BarChart3 },
                            { id: 'stories' as InitiativeTab, label: 'Stories', icon: BookOpen },
                            { id: 'locations' as InitiativeTab, label: 'Locations', icon: MapPin },
                        ].map((tab) => {
                            const Icon = tab.icon
                            const isActive = initiativeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => { setInitiativeTab(tab.id); setAutoAdd(false) }}
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

    return (
        <div className="min-h-screen pb-20" style={{ backgroundColor: '#F9FAFB' }}>
            {/* Org Switcher - shown on Actions and Initiatives tabs */}
            {hasMultipleOrgs && (view === 'actions' || view === 'initiatives') && (
                <div className="bg-white border-b border-gray-100 px-4 py-2.5 sticky top-0 z-40" ref={orgDropdownRef}>
                    <button
                        onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-all ${
                            isSharedMember
                                ? 'bg-purple-50 border border-purple-200'
                                : 'bg-gray-50 border border-gray-200'
                        }`}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            {isSharedMember ? (
                                <Users className="w-4 h-4 text-purple-600 flex-shrink-0" />
                            ) : (
                                <Building2 className="w-4 h-4 text-gray-600 flex-shrink-0" />
                            )}
                            <span className={`text-sm font-medium truncate ${isSharedMember ? 'text-purple-800' : 'text-gray-900'}`}>
                                {activeOrganization?.name || 'Select Organization'}
                            </span>
                            {isSharedMember && (
                                <span className="text-[10px] bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                                    Team
                                </span>
                            )}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${orgDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {orgDropdownOpen && (
                        <div className="absolute left-4 right-4 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
                            <div className="p-1.5">
                                <p className="px-3 py-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                                    Switch Organization
                                </p>
                                {accessibleOrganizations.map((org) => (
                                    <button
                                        key={org.id}
                                        onClick={() => {
                                            switchOrganization(org.id)
                                            setOrgDropdownOpen(false)
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                                            org.id === activeOrganization?.id
                                                ? 'bg-primary-50 text-primary-700'
                                                : 'text-gray-700 active:bg-gray-50'
                                        }`}
                                    >
                                        {org.role === 'member' ? (
                                            <Users className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                        ) : (
                                            <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 text-left min-w-0">
                                            <div className="text-sm font-medium truncate">{org.name}</div>
                                            <div className="text-xs text-gray-400">
                                                {org.role === 'owner' ? 'Your organization' : 'Team member'}
                                            </div>
                                        </div>
                                        {org.id === activeOrganization?.id && (
                                            <Check className="w-4 h-4 text-primary-500 flex-shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1">
                {view === 'actions' && (
                    <MobileActionsTab
                        initiatives={initiatives}
                        onAction={handleQuickAction}
                    />
                )}
                {view === 'initiatives' && (
                    <MobileDashboard 
                        initiatives={initiatives}
                        onEnterInitiative={handleEnterInitiative}
                        onRefresh={loadInitiatives}
                        loading={loading}
                        onNavigateToAccount={() => setView('account')}
                    />
                )}
                {view === 'explore' && (
                    <ExplorePage embedded />
                )}
                {view === 'account' && (
                    <MobileAccountTab 
                        user={user}
                        subscriptionStatus={subscriptionStatus}
                    />
                )}
            </div>

            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb z-50">
                <div className="flex justify-around items-center h-16">
                    {[
                        { id: 'actions' as TopLevelView, label: 'Actions', icon: Zap },
                        { id: 'initiatives' as TopLevelView, label: 'Initiatives', icon: Layers },
                    ].map((tab) => {
                        const Icon = tab.icon
                        const isActive = view === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => { setView(tab.id); if (location.pathname !== '/') navigate('/', { replace: true }) }}
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
                    <button
                        onClick={() => { setView('explore'); if (location.pathname !== '/') navigate('/', { replace: true }) }}
                        className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                            view === 'explore' ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        <Compass className={`w-5 h-5 ${view === 'explore' ? 'stroke-[2.5]' : ''}`} />
                        <span className={`text-xs mt-1 ${view === 'explore' ? 'font-semibold' : 'font-medium'}`}>Explore</span>
                    </button>
                    <button
                        onClick={() => { setView('account'); if (location.pathname !== '/') navigate('/', { replace: true }) }}
                        className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                            view === 'account' ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        <User className={`w-5 h-5 ${view === 'account' ? 'stroke-[2.5]' : ''}`} />
                        <span className={`text-xs mt-1 ${view === 'account' ? 'font-semibold' : 'font-medium'}`}>Account</span>
                    </button>
                </div>
            </nav>
        </div>
    )
}
