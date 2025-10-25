import React, { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { LogOut, User as UserIcon } from 'lucide-react'
import { AuthService } from '../services/auth'
import { User } from '../types'
import toast from 'react-hot-toast'
import Sidebar from './Sidebar/Sidebar'

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

    // Show sidebar only for initiative pages
    const isInitiativePage = location.pathname.includes('/initiatives')

    if (isInitiativePage) {
        return (
            <div className="min-h-screen bg-gray-50">
                {/* Top header with user info and sign out */}
                <header className="bg-white border-b border-gray-200 lg:ml-64">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-end items-center h-16">
                            {/* User Menu */}
                            <div className="flex items-center space-x-4">
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
                        </div>
                    </div>
                </header>

                {/* Sidebar and main content */}
                <Sidebar>
                    {children}
                </Sidebar>
            </div>
        )
    }

    // Regular layout for non-initiative pages
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top header with user info and sign out */}
            <header className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-end items-center h-16">
                        {/* User Menu */}
                        <div className="flex items-center space-x-4">
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
                    </div>
                </div>
            </header>

            {/* Main content without sidebar */}
            <main className="mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
                {children}
            </main>
        </div>
    )
} 