import React, { ReactNode, useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
    HelpCircle,
    Settings,
    Menu,
    X,
    ChevronDown,
    HardDrive
} from 'lucide-react'
import { AuthService } from '../services/auth'
import { apiService } from '../services/api'
import { User, Organization } from '../types'
import { useStorage } from '../context/StorageContext'
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
    const [organization, setOrganization] = useState<Organization | null>(null)
    const { storageUsage } = useStorage()
    const userMenuRef = useRef<HTMLDivElement>(null)

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

                        {/* Center: Organization Name + Dashboard */}
                        <div className="hidden md:flex flex-col items-center justify-center absolute left-1/2 transform -translate-x-1/2">
                            {organization && (
                                <h1 className="text-xl font-semibold text-gray-900">
                                    {organization.name}
                                </h1>
                            )}
                            <span className="text-sm text-gray-500">Dashboard</span>
                        </div>

                        {/* Right side: Storage, Tutorial, Settings, User Profile */}
                        <div className="flex items-center gap-3">
                            {/* Storage Bar */}
                            {storageUsage && (
                                <Link
                                    to="/account"
                                    className="hidden sm:flex items-center gap-2 px-3 h-10 bg-white/80 hover:bg-white border border-gray-200 hover:border-gray-300 rounded-full transition-all duration-200 shadow-bubble-sm"
                                    title={`${storageUsage.used_gb >= 1 ? storageUsage.used_gb.toFixed(2) + ' GB' : ((storageUsage.storage_used_bytes || 0) / (1024 * 1024)).toFixed(1) + ' MB'} / ${storageUsage.placeholder_max_gb} GB`}
                                >
                                    <HardDrive className="w-4 h-4 text-gray-500" />
                                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-blue-500 rounded-full"
                                            style={{ width: `${Math.max(Math.min(storageUsage.used_percentage, 100), storageUsage.storage_used_bytes > 0 ? 2 : 0)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {storageUsage.used_gb >= 1 
                                            ? `${storageUsage.used_gb.toFixed(1)}GB`
                                            : `${((storageUsage.storage_used_bytes || 0) / (1024 * 1024)).toFixed(0)}MB`
                                        }
                                    </span>
                                </Link>
                            )}

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
                                className="w-10 h-10 rounded-full bg-white/80 hover:bg-white border border-gray-200 hover:border-gray-300 flex items-center justify-center transition-all duration-200 shadow-bubble-sm"
                                title="Settings"
                            >
                                <Settings className="w-5 h-5 text-gray-700" />
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