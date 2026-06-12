import React, { ReactNode, useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
 HelpCircle,
 Settings,
 Menu,
 X,
 ChevronDown,
 Building2,
 Users,
 Check,
 Compass,
 BookOpen,
 Eye,
 FlaskConical,
} from 'lucide-react'
import { AuthService } from '../services/auth'
import { apiService } from '../services/api'
import { useTeam } from '../context/TeamContext'
import { User, Organization } from '../types'
import { notify } from '../lib/notify'
import { UserProfileMenu } from './ui/UserProfileMenu'

interface LayoutProps {
 user: User
 children: ReactNode
}

export default function Layout({ user, children }: LayoutProps) {
 const location = useLocation()
 const navigate = useNavigate()
 const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
 const [orgMenuOpen, setOrgMenuOpen] = useState(false)
 const [organization, setOrganization] = useState<Organization | null>(null)
 const orgMenuRef = useRef<HTMLDivElement>(null)

 const {
 switcherOrganizations,
 activeOrganization,
 switchOrganization,
 hasMultipleOrgs,
 isSharedMember,
 ownedOrganization,
 hasOwnOrganization,
 canEditOrgContext
 } = useTeam()
 const isDemoOrg = !!activeOrganization?.is_demo

 useEffect(() => {
 const loadOrganization = async () => {
 try {
 const orgs = await apiService.getOrganizations()
 if (orgs && orgs.length > 0) {
 setOrganization(orgs[0])
 }
 } catch (error) {
 console.error('Failed to load organization:', error)
 }
 }
 loadOrganization()
 }, [])

 // Close org menu when clicking outside
 useEffect(() => {
 const handleClickOutside = (event: MouseEvent) => {
 if (orgMenuRef.current && !orgMenuRef.current.contains(event.target as Node)) {
 setOrgMenuOpen(false)
 }
 }
 if (orgMenuOpen) {
 document.addEventListener('mousedown', handleClickOutside)
 }
 return () => {
 document.removeEventListener('mousedown', handleClickOutside)
 }
 }, [orgMenuOpen])

 const handleSignOut = async () => {
 try {
 await AuthService.signOut()
 notify.success('Signed out')
 } catch (error) {
 notify.error('Failed to sign out')
 }
 }

 const handleTutorialClick = () => {
 // If on dashboard, trigger tutorial via localStorage event
 if (location.pathname === '/') {
 localStorage.removeItem('ofe-tutorial-seen')
 window.dispatchEvent(new Event('show-tutorial'))
 } else {
 // Navigate to dashboard and trigger tutorial
 navigate('/')
 setTimeout(() => {
 localStorage.removeItem('ofe-tutorial-seen')
 window.dispatchEvent(new Event('show-tutorial'))
 }, 100)
 }
 }

 // Hide navbar on initiative pages
 const isInitiativePage = location.pathname.startsWith('/initiatives')

 return (
 <div className="min-h-screen">
 {/* Header - hidden on initiative pages */}
 {!isInitiativePage && (
 <header className="bg-transparent absolute top-0 left-0 right-0 z-50">
 <div className="w-full px-4 sm:px-6">
 <div className="flex justify-between items-center h-24">
 {/* Logo + Organization Switcher (left-aligned) */}
 <div className="flex items-center gap-3 min-w-0">
 <Link to="/" className="flex items-center flex-shrink-0">
 <img
 src="/Nexuslogo.png"
 alt="Nexus Logo"
 className="h-16 w-auto"
 />
 </Link>
 <div className="hidden md:flex flex-col items-start justify-center min-w-0" ref={orgMenuRef}>
 {hasMultipleOrgs ? (
 <div className="relative">
 <button
 onClick={() => setOrgMenuOpen(!orgMenuOpen)}
 className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${isSharedMember
 ? 'bg-purple-50 border border-purple-200 hover:bg-purple-100'
 : 'app-btn app-btn-secondary px-4 py-2'
 }`}
 >
 {isSharedMember ? (
 <Users className="w-4 h-4 text-purple-600" />
 ) : (
 <Building2 className="w-4 h-4 text-gray-600" />
 )}
 <span className={`text-sm font-medium ${isSharedMember ? 'text-purple-800' : 'text-secondary-900'}`}>
 {activeOrganization?.name || 'Select Organization'}
 </span>
 {isSharedMember && (
 <span className="text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full">
 Team
 </span>
 )}
 <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${orgMenuOpen ? 'rotate-180' : ''}`} />
 </button>

 {/* Org Dropdown */}
 {orgMenuOpen && (
 <div className="absolute top-full mt-2 left-0 w-64 app-card overflow-hidden z-50">
 <div className="p-2">
 <p className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
 Switch Organization
 </p>
 {switcherOrganizations.map((org) => (
 <button
 key={org.id}
 onClick={() => {
 switchOrganization(org.id)
 setOrgMenuOpen(false)
 }}
 className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${org.id === activeOrganization?.id
 ? 'bg-primary-50 text-primary-700'
 : 'hover:bg-gray-50 text-gray-700'
 }`}
 >
 {org.role === 'member' ? (
 <Users className="w-4 h-4 text-purple-500" />
 ) : (
 <Building2 className="w-4 h-4 text-gray-500" />
 )}
 <div className="flex-1 text-left">
 <div className="text-sm font-medium">{org.name}</div>
 <div className="text-xs text-gray-400">
 {org.role === 'owner' ? 'Your organization' : 'Team member'}
 </div>
 </div>
 {org.id === activeOrganization?.id && (
 <Check className="w-4 h-4 text-primary-500" />
 )}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 ) : (
 <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${isSharedMember ? 'bg-purple-50 border border-purple-200' : ''
 }`}>
 {isSharedMember && <Users className="w-4 h-4 text-purple-600" />}
 <h1 className={`text-lg font-semibold ${isSharedMember ? 'text-purple-800' : 'text-secondary-900'}`}>
 {activeOrganization?.name || organization?.name}
 </h1>
 {isSharedMember && (
 <span className="text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full">
 Team
 </span>
 )}
 </div>
 )}
 {/* Back to admin dash — shown only while editing a demo org.
 Clicking it also flips the active org back to the user's real
 org so the pill + demo context disappear on next render. */}
 {isDemoOrg && user.is_admin && (
 <button
 type="button"
 onClick={() => {
 const realOrg = switcherOrganizations.find(
 (o) => o.role === 'owner'
 ) || switcherOrganizations[0]
 if (realOrg) {
 localStorage.setItem(
 'nexus-active-org-id',
 realOrg.id
 )
 } else {
 localStorage.removeItem('nexus-active-org-id')
 }
 // Full navigation so TeamProvider re-reads
 // the active org id from localStorage.
 window.location.href = '/admin/demos'
 }}
 className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-full text-xs font-medium transition-colors"
 title="Back to admin — Demo charities"
 >
 <FlaskConical className="w-3.5 h-3.5" />
 Back to admin
 </button>
 )}
 </div>
 </div>

 {/* Right side: Explore, Tutorial, Settings, User Profile */}
 <div className="flex items-center gap-3">
 {/* Context Button */}
 {activeOrganization && canEditOrgContext && (
 <Link
 to="/context"
 className="hidden lg:flex app-btn app-btn-secondary rounded-full !px-4 !py-2 gap-2"
 title="Context & Challenges"
 >
 <BookOpen className="w-4 h-4" />
 <span>Context</span>
 </Link>
 )}

 {/* Public View Button */}
 {isDemoOrg && activeOrganization?.slug ? (
 <Link
 to={`/demo/${activeOrganization.slug}`}
 target="_blank"
 className="hidden lg:flex app-btn app-btn-secondary rounded-full !px-4 !py-2 gap-2"
 title="Open this demo's public page"
 >
 <Eye className="w-4 h-4" />
 <span>Public View</span>
 </Link>
 ) : (
 activeOrganization?.is_public && activeOrganization?.slug && (
 <Link
 to={`/org/${activeOrganization.slug}`}
 className="hidden lg:flex app-btn app-btn-secondary rounded-full !px-4 !py-2 gap-2"
 title="View this organization's public page"
 >
 <Eye className="w-4 h-4" />
 <span>Public View</span>
 </Link>
 )
 )}

 {/* Explore Button */}
 <Link
 to="/explore"
 className="hidden lg:flex app-btn app-btn-secondary rounded-full !px-4 !py-2 gap-2"
 title="Explore organizations"
 >
 <Compass className="w-4 h-4" />
 <span>Explore</span>
 </Link>

 {/* Admin: Demo Charities (only for platform admins) */}
 {user.is_admin && (
 <Link
 to="/admin/demos"
 className="hidden lg:flex items-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 hover:border-purple-300 rounded-full transition-all duration-200 "
 title="Admin — Demo charities"
 >
 <FlaskConical className="w-4 h-4 text-purple-700" />
 <span className="text-sm font-medium text-purple-700">Demos</span>
 </Link>
 )}

 {/* Tutorial Button - Circle Icon */}
 <button
 onClick={handleTutorialClick}
 className="app-btn app-btn-icon app-btn-secondary rounded-full"
 title="Show tutorial"
 >
 <HelpCircle className="w-5 h-5 text-gray-700" />
 </button>

 {/* Settings Button - Circle Icon */}
 <Link
 to="/account"
 className="relative app-btn app-btn-icon app-btn-secondary rounded-full"
 title={!isDemoOrg && hasOwnOrganization && !ownedOrganization?.is_public ? "Settings - Organization not public" : "Settings"}
 >
 <Settings className="w-5 h-5 text-gray-700" />
 {!isDemoOrg && hasOwnOrganization && !ownedOrganization?.is_public && (
 <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">!</span>
 )}
 </Link>

 {/* User Profile with Organization and Dropdown */}
 <UserProfileMenu
 user={user}
 organizationName={activeOrganization?.name || organization?.name}
 />

 {/* Mobile menu button */}
 <div className="lg:hidden">
 <button
 onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
 className="app-btn app-btn-icon app-btn-secondary rounded-full"
 >
 {mobileMenuOpen ? (
 <X className="w-5 h-5 text-gray-700" />
 ) : (
 <Menu className="w-5 h-5 text-gray-700" />
 )}
 </button>
 </div>
 </div>
 </div>

 {/* Mobile Navigation Menu */}
 {mobileMenuOpen && (
 <div className="lg:hidden border-t border-gray-200 pb-4 mt-2 app-card">
 <div className="pt-4 px-4 space-y-3">
 <Link
 to="/explore"
 onClick={() => setMobileMenuOpen(false)}
 className="flex items-center space-x-3 px-4 py-3 text-base font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-xl transition-colors"
 >
 <Compass className="w-5 h-5" />
 <span>Explore Organizations</span>
 </Link>
 {activeOrganization && canEditOrgContext && (
 <Link
 to="/context"
 onClick={() => setMobileMenuOpen(false)}
 className="flex items-center space-x-3 px-4 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
 >
 <BookOpen className="w-5 h-5" />
 <span>Context &amp; Challenges</span>
 </Link>
 )}
 {isDemoOrg && activeOrganization?.slug ? (
 <Link
 to={`/demo/${activeOrganization.slug}`}
 target="_blank"
 onClick={() => setMobileMenuOpen(false)}
 className="flex items-center space-x-3 px-4 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
 >
 <Eye className="w-5 h-5" />
 <span>Public View</span>
 </Link>
 ) : (
 activeOrganization?.is_public && activeOrganization?.slug && (
 <Link
 to={`/org/${activeOrganization.slug}`}
 onClick={() => setMobileMenuOpen(false)}
 className="flex items-center space-x-3 px-4 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
 >
 <Eye className="w-5 h-5" />
 <span>Public View</span>
 </Link>
 )
 )}
 <button
 onClick={() => {
 handleTutorialClick()
 setMobileMenuOpen(false)
 }}
 className="flex items-center space-x-3 px-4 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors w-full"
 >
 <HelpCircle className="w-5 h-5" />
 <span>Tutorial</span>
 </button>
 <Link
 to="/account"
 onClick={() => setMobileMenuOpen(false)}
 className="flex items-center space-x-3 px-4 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
 >
 <Settings className="w-5 h-5" />
 <span>Settings</span>
 </Link>
 </div>

 {/* Mobile User Info */}
 <div className="pt-4 mt-4 border-t border-gray-100 px-4 pb-4">
 <div className="flex flex-col space-y-2">
 <div className="text-sm font-medium text-gray-900">
 {user.name || user.email}
 </div>
 {(activeOrganization || organization) && (
 <div className="text-xs text-gray-500">
 {activeOrganization?.name || organization?.name}
 </div>
 )}
 <button
 onClick={() => {
 handleSignOut()
 setMobileMenuOpen(false)
 }}
 className="flex items-center justify-center space-x-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors w-full mt-2"
 >
 <span>Sign Out</span>
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 </header>
 )}

 {/* Main Content */}
 <main className={`relative app-canvas ${isInitiativePage ? 'min-h-screen' : 'min-h-[calc(100vh-64px)]'}`}>
 {children}
 </main>
 </div>
 )
} 