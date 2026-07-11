import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
 Home,
 Activity,
 MapPin,
 BookOpen,
 User,
 ChevronLeft,
 Layers,
 Compass,
 Building2,
 Users,
 ChevronDown,
 Check,
 Plus,
 X
} from 'lucide-react'
import { apiService } from '../services/api'
import { Initiative, User as UserType, SubscriptionStatus } from '../types'
import { useTeam } from '../context/TeamContext'
import { notify } from '../lib/notify'
import MobileDashboard from './mobile/MobileDashboard'
import { PageLoader } from './ui'
import MobileLocationsTab from './mobile/MobileLocationsTab'
import MobileStoriesTab from './mobile/MobileStoriesTab'
import MobileAccountTab from './mobile/MobileAccountTab'
import TimelineTab from './InitiativeTabs/TimelineTab'
import MobileOverview from './overview/MobileOverview'
import UploadWizardLauncher from './upload/UploadWizardLauncher'
import ExplorePage from '../pages/ExplorePage'

interface MobileAppProps {
 user: UserType
 subscriptionStatus: SubscriptionStatus | null
}

type TopLevelView = 'initiatives' | 'explore' | 'account'
type InitiativeTab = 'timeline' | 'overview' | 'stories' | 'locations'

export default function MobileApp({ user, subscriptionStatus }: MobileAppProps) {
 const navigate = useNavigate()
 const location = useLocation()
 const { accessibleOrganizations, activeOrganization, switchOrganization, hasMultipleOrgs, isSharedMember } = useTeam()
 const [view, setViewRaw] = useState<TopLevelView>(() => {
 const saved = sessionStorage.getItem('mobile-view')
 if (saved === 'explore' || saved === 'account' || saved === 'initiatives') return saved
 return 'initiatives'
 })
 const setView = (v: TopLevelView) => {
 sessionStorage.setItem('mobile-view', v)
 setViewRaw(v)
 }
 const [initiatives, setInitiatives] = useState<Initiative[]>([])
 const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null)
 const [initiativeTab, setInitiativeTab] = useState<InitiativeTab>('timeline')
 const [loading, setLoading] = useState(true)
 const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
 const orgDropdownRef = useRef<HTMLDivElement>(null)

 // The + flow: pick an initiative (when more than one), then the wizard.
 const [showAddPicker, setShowAddPicker] = useState(false)
 const [addInitiativeId, setAddInitiativeId] = useState<string | null>(null)

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
 setInitiativeTab('timeline')
 }

 const handleExitInitiative = () => {
 setSelectedInitiative(null)
 }

 const handlePlusClick = () => {
 // Inside an initiative the + isn't shown; this always starts from the top level.
 if (initiatives.length === 0) {
 notify.error('Create an initiative first')
 setView('initiatives')
 return
 }
 if (initiatives.length === 1) {
 setAddInitiativeId(initiatives[0].id!)
 return
 }
 setShowAddPicker(true)
 }

 const openTimelineForMetric = (kpiId: string) => {
 setInitiativeTab('timeline')
 navigate(`/?metric=${kpiId}`, { replace: true })
 }

 if (loading) {
 return <PageLoader label="Loading..." />
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
 {initiativeTab === 'timeline' && (
 <TimelineTab
 initiativeId={selectedInitiative.id!}
 onRefresh={() => {}}
 />
 )}
 {initiativeTab === 'overview' && (
 <MobileOverview
 initiativeId={selectedInitiative.id!}
 onOpenTimelineForMetric={openTimelineForMetric}
 />
 )}
 {initiativeTab === 'stories' && (
 <MobileStoriesTab
 key={selectedInitiative.id}
 initiativeId={selectedInitiative.id!}
 />
 )}
 {initiativeTab === 'locations' && (
 <MobileLocationsTab
 key={selectedInitiative.id}
 initiativeId={selectedInitiative.id!}
 />
 )}
 </div>

 <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb z-50">
 <div className="flex justify-around items-center h-16">
 {[
 { id: 'timeline' as InitiativeTab, label: 'Timeline', icon: Activity },
 { id: 'overview' as InitiativeTab, label: 'Overview', icon: Home },
 { id: 'stories' as InitiativeTab, label: 'Stories', icon: BookOpen },
 { id: 'locations' as InitiativeTab, label: 'Locations', icon: MapPin },
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

 return (
 <div className="min-h-screen pb-20" style={{ backgroundColor: '#F9FAFB' }}>
 {/* Org Switcher - shown on Initiatives tab */}
 {hasMultipleOrgs && view === 'initiatives' && (
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
 <span className="text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
 Team
 </span>
 )}
 </div>
 <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${orgDropdownOpen ? 'rotate-180' : ''}`} />
 </button>

 {orgDropdownOpen && (
 <div className="absolute left-4 right-4 mt-1 app-card-elevated overflow-hidden z-50">
 <div className="p-1.5">
 <p className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
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

 {/* Bottom nav: Initiatives · [ + ] · Explore · Account */}
 <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb z-50">
 <div className="flex justify-around items-center h-16">
 <button
 onClick={() => { setView('initiatives'); if (location.pathname !== '/') navigate('/', { replace: true }) }}
 className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
 view === 'initiatives' ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
 }`}
 >
 <Layers className={`w-5 h-5 ${view === 'initiatives' ? 'stroke-[2.5]' : ''}`} />
 <span className={`text-xs mt-1 ${view === 'initiatives' ? 'font-semibold' : 'font-medium'}`}>Initiatives</span>
 </button>

 {/* Big + — add a claim, evidence, or both */}
 <div className="flex-1 flex items-center justify-center">
 <button
 onClick={handlePlusClick}
 aria-label="Add claim or evidence"
 className="-mt-7 w-14 h-14 rounded-full bg-primary-500 text-white shadow-lg shadow-primary-500/30 flex items-center justify-center active:scale-95 transition-transform"
 >
 <Plus className="w-7 h-7" strokeWidth={2.5} />
 </button>
 </div>

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

 {/* Initiative picker for the + button */}
 {showAddPicker && (
 <div className="fixed inset-0 z-[90]">
 <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddPicker(false)} />
 <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl safe-area-pb max-h-[70vh] flex flex-col">
 <div className="flex items-center justify-between px-5 pt-4 pb-2">
 <div>
 <h2 className="text-base font-semibold text-gray-900">Add to which initiative?</h2>
 <p className="text-xs text-gray-500">Claims and evidence live inside an initiative</p>
 </div>
 <button
 onClick={() => setShowAddPicker(false)}
 className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
 aria-label="Close"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 <div className="overflow-y-auto px-3 pb-4 space-y-1">
 {initiatives.map(initiative => (
 <button
 key={initiative.id}
 onClick={() => {
 setShowAddPicker(false)
 setAddInitiativeId(initiative.id!)
 }}
 className="w-full flex items-center gap-3 px-3 py-3 rounded-xl active:bg-gray-50 text-left"
 >
 <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
 <Layers className="w-4 h-4 text-primary-800" />
 </div>
 <div className="min-w-0">
 <p className="text-sm font-medium text-gray-900 truncate">{initiative.title}</p>
 {initiative.description && (
 <p className="text-xs text-gray-500 truncate">{initiative.description}</p>
 )}
 </div>
 </button>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* Full-screen guided upload (same wizard as desktop) */}
 {addInitiativeId && (
 <UploadWizardLauncher
 initiativeId={addInitiativeId}
 onClose={() => setAddInitiativeId(null)}
 onCreated={loadInitiatives}
 />
 )}
 </div>
 )
}
