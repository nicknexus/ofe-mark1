import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  CheckCircle2,
  MapPin,
  Users,
  ArrowLeft,
  BookOpen,
  Sparkles,
  Settings,
  LogOut,
  User as UserIcon
} from 'lucide-react'
import { User } from '../types'
import { useTeam } from '../context/TeamContext'
import { dropdownPop } from './timeline/motion'

interface InitiativeSidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
  initiativeTitle: string
  initiativeId: string
  initiativeSlug?: string
  user: User
  onSignOut: () => void
}

const TABS = [
  { id: 'metrics', label: 'Metrics', icon: LayoutDashboard, description: 'Dashboard' },
  { id: 'logs', label: 'Logs', icon: CheckCircle2, description: 'Impact activity' },
  { id: 'location', label: 'Locations', icon: MapPin, description: 'Where you work' },
  { id: 'beneficiaries', label: 'Beneficiaries', icon: Users, description: 'People management' },
  { id: 'stories', label: 'Stories', icon: BookOpen, description: 'Impact stories' },
  { id: 'report', label: 'AI Report', icon: Sparkles, description: 'Generate impact report' },
]

/**
 * Fixed left navigation for the initiative workspace: back link + initiative
 * identity up top, single-line nav rows with a soft active state, and a
 * user/account row pinned to the bottom.
 */
export default function InitiativeSidebar({
  activeTab,
  onTabChange,
  initiativeTitle,
  user,
  onSignOut
}: InitiativeSidebarProps) {
  const navigate = useNavigate()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const { activeOrganization, isOwner, isAdmin } = useTeam()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const displayName = user.name?.trim() || user.email
  const initials = (user.name?.trim() || user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()
  const needsPublicNudge = (isOwner || isAdmin) && !!activeOrganization && !activeOrganization.is_public && !activeOrganization.is_demo

  return (
    <div className="fixed left-0 top-0 w-56 h-screen bg-white border-r border-gray-200/70 flex flex-col z-30 desktop-sidebar">
      {/* Back link */}
      <div className="px-3 pt-3">
        <Link
          to="/tracking/programs"
          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>All programs</span>
        </Link>
      </div>

      {/* Initiative identity — no logo, title wraps so long names stay readable */}
      <div className="px-4 pt-2.5 pb-4 border-b border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Program</p>
        <h2 className="text-base font-semibold text-gray-900 leading-snug break-words">
          {initiativeTitle}
        </h2>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="px-3 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Workspace
        </p>
        <nav className="space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <motion.button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                whileTap={{ scale: 0.98 }}
                className={`relative w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${isActive ? '' : 'hover:bg-gray-50'}`}
              >
                {/* Active pill + accent bar slide between tabs */}
                {isActive && (
                  <>
                    <motion.span
                      layoutId="sidebarActiveTab"
                      className="absolute inset-0 rounded-xl bg-primary-50"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                    <motion.span
                      layoutId="sidebarActiveBar"
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary-600"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  </>
                )}
                <Icon className={`relative z-10 w-5 h-5 flex-shrink-0 transition-colors ${isActive ? 'text-primary-800' : 'text-gray-400'}`} />
                <span className="relative z-10 flex-1 min-w-0 text-left">
                  <span className={`block text-[15px] font-medium leading-tight truncate transition-colors ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                    {tab.label}
                  </span>
                  <span className={`block text-xs leading-tight truncate mt-0.5 transition-colors ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                    {tab.description}
                  </span>
                </span>
              </motion.button>
            )
          })}
        </nav>
      </div>

      {/* User / account row */}
      <div className="p-3 border-t border-gray-100">
        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left"
            title={needsPublicNudge ? 'Settings — organization not public' : 'Settings'}
          >
            <div className="w-8 h-8 rounded-full bg-secondary-600 text-white text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
              {initials || <UserIcon className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{displayName}</p>
              <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
            </div>
            <span className="relative flex-shrink-0">
              <Settings className="w-4 h-4 text-gray-400" />
              {needsPublicNudge && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                  !
                </span>
              )}
            </span>
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
          {settingsOpen && (
            <motion.div
              initial={dropdownPop.initial}
              animate={dropdownPop.animate}
              exit={dropdownPop.exit}
              className="absolute bottom-full left-0 right-0 mb-2 app-card overflow-hidden z-50 p-1.5 origin-bottom">
              <button
                onClick={() => {
                  navigate('/account')
                  setSettingsOpen(false)
                }}
                className="app-btn app-btn-ghost w-full justify-start app-btn-sm h-auto py-2.5"
              >
                <UserIcon className="w-4 h-4" />
                <span>Account</span>
              </button>
              <button
                onClick={() => {
                  onSignOut()
                  setSettingsOpen(false)
                }}
                className="app-btn app-btn-secondary w-full app-btn-sm mt-1"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
