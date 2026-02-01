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
    Compass
} from 'lucide-react'
import { AuthService } from '../services/auth'
import { apiService } from '../services/api'
import { useTeam } from '../context/TeamContext'
import { User, Organization } from '../types'
import toast from 'react-hot-toast'

interface LayoutProps {
    user: User
    children: ReactNode
}

export default function Layout({ user, children }: LayoutProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [userMenuOpen, setUserMenuOpen] = useState(false)
    const [orgMenuOpen, setOrgMenuOpen] = useState(false)
    const [organization, setOrganization] = useState<Organization | null>(null)
    const userMenuRef = useRef<HTMLDivElement>(null)
    const orgMenuRef = useRef<HTMLDivElement>(null)

    const {
        accessibleOrganizations,
        activeOrganization,
        switchOrganization,
        hasMultipleOrgs,
        isSharedMember,
        ownedOrganization,
        hasOwnOrganization
    } = useTeam()

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

    // Close user menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setUserMenuOpen(false)
            }
        }
        if (userMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [userMenuOpen])

    const handleSignOut = async () => {
        try {
            await AuthService.signOut()
            toast.success('Signed out successfully')
        } catch (error) {
            toast.error('Failed to sign out')
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
                            {/* Logo */}
                            <div className="flex items-center">
                                <Link to="/" className="flex items-center">
                                    <img
                                        src="/Nexuslogo.png"
                                        alt="Nexus Logo"
                                        className="h-16 w-auto"
                                    />
                                </Link>
                            </div>

                            {/* Center: Organization Switcher */}
                            <div className="hidden md:flex flex-col items-center justify-center absolute left-1/2 transform -translate-x-1/2" ref={orgMenuRef}>
                                {hasMultipleOrgs ? (
                                    <div className="relative">
                                        <button
                                            onClick={() => setOrgMenuOpen(!orgMenuOpen)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${isSharedMember
                                                    ? 'bg-purple-50 border border-purple-200 hover:bg-purple-100'
                                                    : 'bg-white/80 border border-gray-200 hover:bg-white'
                                                }`}
                                        >
                                            {isSharedMember ? (
                                                <Users className="w-4 h-4 text-purple-600" />
                                            ) : (
                                                <Building2 className="w-4 h-4 text-gray-600" />
                                            )}
                                            <span className={`text-sm font-medium ${isSharedMember ? 'text-purple-800' : 'text-gray-900'}`}>
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
                                            <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 w-64 bg-white rounded-xl shadow-bubble-lg border border-gray-200 overflow-hidden z-50">
                                                <div className="p-2">
                                                    <p className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                                                        Switch Organization
                                                    </p>
                                                    {accessibleOrganizations.map((org) => (
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
                                        <h1 className={`text-lg font-semibold ${isSharedMember ? 'text-purple-800' : 'text-gray-900'}`}>
                                            {activeOrganization?.name || organization?.name}
                                        </h1>
                                        {isSharedMember && (
                                            <span className="text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded-full">
                                                Team
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Right side: Explore, Tutorial, Settings, User Profile */}
                            <div className="flex items-center gap-3">
                                {/* Explore Button */}
                                <Link
                                    to="/explore"
                                    className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-full transition-all duration-200 shadow-bubble-sm"
                                    title="Explore organizations"
                                >
                                    <Compass className="w-4 h-4 text-primary-600" />
                                    <span className="text-sm font-medium text-primary-700">Explore</span>
                                </Link>

                                {/* Tutorial Button - Circle Icon */}
                                <button
                                    onClick={handleTutorialClick}
                                    className="w-10 h-10 rounded-full bg-white/80 hover:bg-white border border-gray-200 hover:border-gray-300 flex items-center justify-center transition-all duration-200 shadow-bubble-sm"
                                    title="Show tutorial"
                                >
                                    <HelpCircle className="w-5 h-5 text-gray-700" />
                                </button>

                                {/* Settings Button - Circle Icon */}
                                <Link
                                    to="/account"
                                    className="relative w-10 h-10 rounded-full bg-white/80 hover:bg-white border border-gray-200 hover:border-gray-300 flex items-center justify-center transition-all duration-200 shadow-bubble-sm"
                                    title={hasOwnOrganization && !ownedOrganization?.is_public ? "Settings - Organization not public" : "Settings"}
                                >
                                    <Settings className="w-5 h-5 text-gray-700" />
                                    {hasOwnOrganization && !ownedOrganization?.is_public && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center">!</span>
                                    )}
                                </Link>

                                {/* User Profile with Organization and Dropdown */}
                                <div className="hidden md:block relative" ref={userMenuRef}>
                                    <button
                                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                                        className="flex items-center gap-2 px-3 h-10 bg-white/80 hover:bg-white border border-gray-200 hover:border-gray-300 rounded-full transition-all duration-200 shadow-bubble-sm min-w-[180px]"
                                    >
                                        <div className="flex flex-col items-start flex-1 min-w-0 justify-center">
                                            <span className="text-xs font-medium text-gray-900 truncate w-full leading-tight">
                                                {user.name || user.email}
                                            </span>
                                            {organization && (
                                                <span className="text-[10px] text-gray-500 truncate w-full leading-tight">
                                                    {organization.name}
                                                </span>
                                            )}
                                        </div>
                                        <ChevronDown className={`w-3 h-3 text-gray-500 flex-shrink-0 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Dropdown Menu */}
                                    {userMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-bubble-lg border border-gray-200 overflow-hidden z-50">
                                            <Link
                                                to="/account"
                                                onClick={() => setUserMenuOpen(false)}
                                                className="block w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left border-b border-gray-100"
                                            >
                                                Account Settings
                                            </Link>
                                            <button
                                                onClick={() => {
                                                    handleSignOut()
                                                    setUserMenuOpen(false)
                                                }}
                                                className="w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                                            >
                                                Sign Out
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Mobile menu button */}
                                <div className="md:hidden">
                                    <button
                                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                        className="w-10 h-10 rounded-full bg-white/80 hover:bg-white border border-gray-200 hover:border-gray-300 flex items-center justify-center transition-all duration-200 shadow-bubble-sm"
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
                            <div className="md:hidden border-t border-gray-200 pb-4 mt-2 bg-white/95 backdrop-blur-sm rounded-2xl shadow-bubble-lg">
                                <div className="pt-4 px-4 space-y-3">
                                    <Link
                                        to="/explore"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center space-x-3 px-4 py-3 text-base font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-xl transition-colors"
                                    >
                                        <Compass className="w-5 h-5" />
                                        <span>Explore Organizations</span>
                                    </Link>
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
                                        {organization && (
                                            <div className="text-xs text-gray-500">
                                                {organization.name}
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
            <main className={`relative ${isInitiativePage ? 'min-h-screen' : 'min-h-[calc(100vh-64px)]'}`}>
                {children}
            </main>
        </div>
    )
} 