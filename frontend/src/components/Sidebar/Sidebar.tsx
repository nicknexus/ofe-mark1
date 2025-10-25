import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
    Home,
    BarChart3,
    MapPin,
    Users,
    Menu,
    X,
    ChevronLeft,
    ChevronRight
} from 'lucide-react'
import { Labels } from '../../ui/labels'
import NavItem from './NavItem'

interface SidebarProps {
    children: React.ReactNode
}

export default function Sidebar({ children }: SidebarProps) {
    const location = useLocation()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    // Extract initiative ID from current path
    const initiativeId = location.pathname.match(/\/initiatives\/([^\/]+)/)?.[1]

    const navItems = [
        {
            path: initiativeId ? `/initiatives/${initiativeId}` : '/initiatives',
            label: 'Home',
            icon: Home,
            active: location.pathname.includes('/initiatives') && !location.pathname.includes('/kpis')
        },
        {
            path: initiativeId ? `/initiatives/${initiativeId}/kpis` : '/initiatives',
            label: Labels.kpiPlural,
            icon: BarChart3,
            active: location.pathname.includes('/initiatives') && location.pathname.includes('/kpis')
        },
        {
            path: initiativeId ? `/initiatives/${initiativeId}/locations` : '/locations',
            label: Labels.locations,
            icon: MapPin,
            active: location.pathname.includes('/locations')
        },
        {
            path: initiativeId ? `/initiatives/${initiativeId}/beneficiaries` : '/beneficiaries',
            label: Labels.beneficiaries,
            icon: Users,
            active: location.pathname.includes('/beneficiaries')
        }
    ]

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Mobile menu button */}
            <div className="lg:hidden fixed top-4 left-4 z-50">
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

            {/* Mobile sidebar overlay */}
            {mobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-40">
                    <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)} />
                    <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg">
                        <div className="flex flex-col h-full">
                            {/* Mobile header */}
                            <div className="flex items-center justify-between p-4 border-b border-gray-200">
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                                        <BarChart3 className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-lg font-bold text-gray-900">OFE</span>
                                </div>
                                <button
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Mobile navigation */}
                            <nav className="flex-1 px-4 py-6 space-y-2">
                                {navItems.map((item) => {
                                    const Icon = item.icon
                                    return (
                                        <NavItem
                                            key={item.path}
                                            path={item.path}
                                            label={item.label}
                                            icon={Icon}
                                            isActive={item.active}
                                            onClick={() => setMobileMenuOpen(false)}
                                        />
                                    )
                                })}
                            </nav>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex">
                {/* Desktop sidebar */}
                <div className={`hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-40 bg-white border-r border-gray-200 transition-all duration-300 ${isCollapsed ? 'lg:w-16' : 'lg:w-64'
                    }`}>
                    {/* Desktop header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                        {!isCollapsed && (
                            <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                                    <BarChart3 className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-lg font-bold text-gray-900">OFE</span>
                            </div>
                        )}
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                            {isCollapsed ? (
                                <ChevronRight className="w-4 h-4" />
                            ) : (
                                <ChevronLeft className="w-4 h-4" />
                            )}
                        </button>
                    </div>

                    {/* Desktop navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-2">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            return (
                                <NavItem
                                    key={item.path}
                                    path={item.path}
                                    label={isCollapsed ? '' : item.label}
                                    icon={Icon}
                                    isActive={item.active}
                                />
                            )
                        })}
                    </nav>
                </div>

                {/* Main content */}
                <div className={`flex-1 lg:transition-all lg:duration-300 ${isCollapsed ? 'lg:ml-16' : 'lg:ml-64'
                    }`}>
                    <main className="mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    )
}
