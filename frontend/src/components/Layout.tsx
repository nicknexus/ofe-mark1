import React, { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    LogOut,
    User as UserIcon,
    BarChart3,
    Target,
    FileText,
    Settings
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
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo */}
                        <div className="flex items-center">
                            <Link to="/" className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                                    <Target className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-xl font-bold text-gray-900">OFE</span>
                            </Link>
                        </div>

                        {/* Navigation */}
                        <nav className="hidden md:flex space-x-8">
                            {navLinks.map((link) => {
                                const Icon = link.icon
                                return (
                                    <Link
                                        key={link.path}
                                        to={link.path}
                                        className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${link.active
                                                ? 'text-primary-600 bg-primary-50'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        <span>{link.label}</span>
                                    </Link>
                                )
                            })}
                        </nav>

                        {/* User Menu */}
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2 text-sm text-gray-700">
                                    <UserIcon className="w-4 h-4" />
                                    <span>{user.name || user.email}</span>
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
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    )
} 