import React from 'react'
import { Link } from 'react-router-dom'
import { LucideIcon } from 'lucide-react'

interface NavItemProps {
    path: string
    label: string
    icon: LucideIcon
    isActive: boolean
    onClick?: () => void
}

export default function NavItem({ path, label, icon: Icon, isActive, onClick }: NavItemProps) {
    return (
        <Link
            to={path}
            onClick={onClick}
            className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                    ? 'text-primary-600 bg-primary-50 border-r-2 border-primary-500'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
        >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="truncate">{label}</span>
        </Link>
    )
}
