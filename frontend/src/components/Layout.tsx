import React, { ReactNode, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    LogOut,
    User as UserIcon,
    BarChart3,
    Menu,
    X
} from 'lucide-react'
import { AuthService } from '../services/auth'
import { User } from '../types'
import toast from 'react-hot-toast'

interface LayoutProps {
    user: User
    children: ReactNode
}

export default function Layout({ user, children }: LayoutProps) {
    const location = useLocation()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const handleSignOut = async () => {
        try {
            await AuthService.signOut()
            toast.success('Signed out successfully')
        } catch (error) {
            toast.error('Failed to sign out')
        }
    }

    const navLinks = [
        {
            path: '/',
            label: 'Dashboard',
            icon: BarChart3,
            active: location.pathname === '/'
        }
    ]

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="bg-white border-b border-gray-100 shadow-bubble-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo */}
                        <div className="flex items-center">
                            <Link to="/" className="flex items-center">
                                <img 
                                    src="/Nexuslogo.png" 
                                    alt="Nexus Logo" 
                                    className="h-10 w-auto"
                                />
                            </Link>
                        </div>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex space-x-8">
                            {navLinks.map((link) => {
                                const Icon = link.icon
                                return (
                                    <Link
                                        key={link.path}
                                        to={link.path}
                                        className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${link.active
                                            ? 'text-primary-600 bg-primary-50 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span>{link.label}</span>
                                    </Link>
                                )
                            })}
                        </nav>

                        {/* Desktop User Menu */}
                        <div className="hidden md:flex items-center space-x-4">
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2 text-sm text-gray-700">
                                    <UserIcon className="w-4 h-4" />
                                    <span className="truncate max-w-32">{user.name || user.email}</span>
                                </div>
                                <button
                                    onClick={handleSignOut}
                                    className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </div>

                        {/* Mobile menu button */}
                        <div className="md:hidden">
                            <button
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                                {mobileMenuOpen ? (
                                    <X className="w-5 h-5" />
                                ) : (
                                    <Menu className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Mobile Navigation Menu */}
                    {mobileMenuOpen && (
                        <div className="md:hidden border-t border-gray-200 pb-4">
                            <div className="pt-4 space-y-1">
                                {navLinks.map((link) => {
                                    const Icon = link.icon
                                    return (
                                        <Link
                                            key={link.path}
                                            to={link.path}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className={`flex items-center space-x-3 px-4 py-3 text-base font-medium rounded-md transition-colors ${link.active
                                                ? 'text-primary-500 bg-primary-50'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                }`}
                                        >
                                            <Icon className="w-5 h-5" />
                                            <span>{link.label}</span>
                                        </Link>
                                    )
                                })}
                            </div>

                            {/* Mobile User Info & Sign Out */}
                            <div className="pt-4 mt-4 border-t border-gray-100">
                                <div className="px-4 py-2">
                                    <div className="flex items-center space-x-3 text-sm text-gray-700 mb-3">
                                        <UserIcon className="w-4 h-4" />
                                        <span className="truncate">{user.name || user.email}</span>
                                    </div>
                                    <button
                                        onClick={handleSignOut}
                                        className="flex items-center space-x-3 px-2 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors w-full"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span>Sign Out</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="relative min-h-[calc(100vh-64px)]">
                {children}
            </main>
        </div>
    )
} 