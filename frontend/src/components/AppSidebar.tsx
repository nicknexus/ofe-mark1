import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  BarChart3,
  Tag,
  MapPin,
  Globe,
  BookOpen,
  Code2,
  Sparkles,
  Settings,
  GraduationCap,
  Compass,
  Building2,
  Users,
  Check,
  ChevronDown,
  ExternalLink,
  FlaskConical,
  LogOut,
  User as UserIcon,
} from 'lucide-react'
import { User } from '../types'
import { AuthService } from '../services/auth'
import { useTeam } from '../context/TeamContext'
import { useTutorial } from '../context/TutorialContext'
import { useOnboarding } from '../context/OnboardingContext'
import { notify } from '../lib/notify'
import { getSupportContext } from '../admin/support'
import { dropdownPop } from './timeline/motion'

interface AppSidebarProps {
  user: User
}

function SoftHome({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  )
}

const TRACKING_ITEMS = [
  { to: '/tracking/programs', label: 'Programs', icon: LayoutDashboard },
  { to: '/metrics', label: 'Metrics', icon: BarChart3 },
  { to: '/locations', label: 'Locations', icon: MapPin },
  { to: '/tags', label: 'Tags', icon: Tag },
] as const

const CONTENT_ITEMS = [
  { to: '/share/public', label: 'Public page', icon: Globe },
  { to: '/share/org', label: 'Organization', icon: Building2 },
  { to: '/share/context', label: 'Context', icon: BookOpen },
  { to: '/share/embed', label: 'Embed', icon: Code2 },
  { to: '/share/create', label: 'Content', icon: Sparkles, soon: true },
] as const

function pathActive(pathname: string, to: string) {
  if (to === '/share/public') return pathname === '/share' || pathname === '/share/public'
  if (to === '/tags') return pathname === '/tags' || pathname.startsWith('/tags/')
  if (to === '/account') return pathname === '/account' || pathname.startsWith('/account')
  if (to === '/share/org') return pathname === '/share/org' || pathname === '/share/brand'
  return pathname === to || pathname.startsWith(`${to}/`)
}

function NavRow({
  to,
  label,
  icon: Icon,
  active,
  nested,
  soon,
  nudge,
  accent = 'primary',
}: {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  nested?: boolean
  soon?: boolean
  nudge?: boolean
  accent?: 'primary' | 'claim'
}) {
  const claim = accent === 'claim'
  return (
    <Link
      to={to}
      className={`relative flex items-center gap-2.5 rounded-xl transition-colors ${
        nested ? 'px-3 py-2' : 'px-3 py-2.5'
      } ${active ? '' : 'hover:bg-gray-50'}`}
    >
      {active && (
        <>
          <motion.span
            layoutId={claim ? 'appSidebarShareTab' : 'appSidebarActiveTab'}
            className={`absolute inset-0 rounded-xl ${claim ? 'bg-claim-50' : 'bg-primary-50'}`}
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          />
          <motion.span
            layoutId={claim ? 'appSidebarShareBar' : 'appSidebarActiveBar'}
            className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full ${claim ? 'bg-claim-500' : 'bg-primary-600'}`}
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          />
        </>
      )}
      <Icon className={`relative z-10 w-4 h-4 flex-shrink-0 ${
        active ? (claim ? 'text-claim-700' : 'text-primary-800') : 'text-gray-400'
      }`} />
      <span className={`relative z-10 flex-1 min-w-0 text-[13px] font-medium truncate ${active ? 'text-gray-900' : 'text-gray-600'}`}>
        {label}
      </span>
      {soon && (
        <span className="relative z-10 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Soon</span>
      )}
      {nudge && (
        <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
      )}
    </Link>
  )
}

/**
 * Org-level sidebar for Home / Tracking / Share.
 * Hidden on initiative pages (those keep InitiativeSidebar) and on mobile via `.desktop-sidebar`.
 */
export default function AppSidebar({ user }: AppSidebarProps) {
  const location = useLocation()
  const pathname = location.pathname
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const orgMenuRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

  const {
    switcherOrganizations,
    activeOrganization,
    switchOrganization,
    hasMultipleOrgs,
    isSharedMember,
    isOwner,
    isAdmin,
    loading: teamLoading,
  } = useTeam()
  const { startTutorial } = useTutorial()
  const { startOnboarding } = useOnboarding()
  const isDemoOrg = !!activeOrganization?.is_demo
  const supportContext = getSupportContext()
  const canEditShare = isOwner || isAdmin
  const needsPublicNudge = canEditShare && !!activeOrganization && !activeOrganization.is_public && !isDemoOrg

  const trackingOpen =
    pathname === '/tracking' ||
    pathname.startsWith('/tracking/') ||
    pathname.startsWith('/metrics') ||
    pathname === '/locations' ||
    pathname === '/tags' ||
    pathname.startsWith('/tags/') ||
    pathname.startsWith('/share/team')
  const contentOpen =
    !pathname.startsWith('/share/team') && (
      pathname === '/share' ||
      pathname.startsWith('/share/') ||
      pathname === '/content' ||
      pathname.startsWith('/content/') ||
      pathname === '/context'
    )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (orgMenuRef.current && !orgMenuRef.current.contains(event.target as Node)) {
        setOrgMenuOpen(false)
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    try {
      await AuthService.signOut()
      notify.success('Signed out')
    } catch {
      notify.error('Failed to sign out')
    }
  }

  const displayName = supportContext ? 'Support session' : (user.name?.trim() || user.email)
  const initials = (user.name?.trim() || user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase()

  const publicHref = isDemoOrg && activeOrganization?.slug
    ? `/demo/${activeOrganization.slug}`
    : activeOrganization?.is_public && activeOrganization?.slug
      ? `/org/${activeOrganization.slug}`
      : null

  return (
    <div className="fixed left-0 top-0 w-56 h-screen bg-white border-r border-gray-200/70 flex flex-col z-30 desktop-sidebar">
      <div className="flex-shrink-0 px-3 pt-3 pb-2 bg-white">
        <Link to="/" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors min-w-0">
          <img src="/Nexuslogo.png" alt="" className="h-7 w-auto flex-shrink-0" />
          <span className="text-[15px] font-newsreader font-extralight text-secondary-900 truncate leading-none pt-0.5">Nexus Impacts</span>
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2">
      <div className="pb-3 border-b border-gray-100" ref={orgMenuRef}>
        {teamLoading ? (
          <div className="h-9 rounded-xl bg-gray-100 animate-pulse" />
        ) : hasMultipleOrgs ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOrgMenuOpen(v => !v)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${
                isSharedMember ? 'bg-purple-50 hover:bg-purple-100' : 'hover:bg-gray-50'
              }`}
            >
              {isSharedMember ? <Users className="w-4 h-4 text-purple-600 flex-shrink-0" /> : <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />}
              <span className={`flex-1 min-w-0 text-[13px] font-semibold truncate ${isSharedMember ? 'text-purple-800' : 'text-gray-900'}`}>
                {activeOrganization?.name || 'Select organization'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${orgMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {orgMenuOpen && (
              <div className="absolute top-full mt-1 left-0 right-0 app-card overflow-hidden z-50 p-1.5">
                <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Switch</p>
                {switcherOrganizations.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => {
                      switchOrganization(org.id)
                      setOrgMenuOpen(false)
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left ${
                      org.id === activeOrganization?.id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {org.role === 'member' ? <Users className="w-3.5 h-3.5 text-purple-500" /> : <Building2 className="w-3.5 h-3.5 text-gray-400" />}
                    <span className="flex-1 min-w-0 text-xs font-medium truncate">{org.name}</span>
                    {org.id === activeOrganization?.id && <Check className="w-3.5 h-3.5 text-primary-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl ${isSharedMember ? 'bg-purple-50' : ''}`}>
            {isSharedMember ? <Users className="w-4 h-4 text-purple-600 flex-shrink-0" /> : <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            <span className={`text-[13px] font-semibold truncate ${isSharedMember ? 'text-purple-800' : 'text-gray-900'}`}>
              {activeOrganization?.name || 'Organization'}
            </span>
          </div>
        )}

        {!teamLoading && activeOrganization && !isDemoOrg && (
          <div className="mt-1 flex items-center gap-0.5 px-2.5">
            <Link
              to="/share/public"
              className={`flex items-center gap-1.5 py-1 rounded-lg text-[11px] font-medium min-w-0 ${
                activeOrganization.is_public ? 'text-impact-700' : 'text-amber-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeOrganization.is_public ? 'bg-impact-500' : 'bg-amber-400'}`} />
              <span className="truncate">{activeOrganization.is_public ? 'Public page live' : 'Public page not live'}</span>
            </Link>
            {publicHref && (
              <a
                href={publicHref}
                target="_blank"
                rel="noreferrer"
                title="Open public page"
                className="p-1 rounded-md text-impact-600 hover:bg-impact-50 flex-shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {isDemoOrg && user.is_admin && (
          <button
            type="button"
            onClick={() => {
              const realOrg = switcherOrganizations.find(o => o.role === 'owner') || switcherOrganizations[0]
              if (realOrg) localStorage.setItem('nexus-active-org-id', realOrg.id)
              else localStorage.removeItem('nexus-active-org-id')
              window.location.href = '/admin/demos'
            }}
            className="mt-1 w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-purple-700 hover:bg-purple-50"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Back to admin
          </button>
        )}
      </div>

      <div className="py-3">
        <NavRow to="/" label="Home" icon={SoftHome} active={pathname === '/'} />

        <p className={`px-3 pt-5 pb-1.5 text-[13px] font-bold tracking-wide ${
          trackingOpen ? 'text-primary-800' : 'text-primary-700'
        }`}>
          Tracking
        </p>
        <div className={`rounded-xl ${trackingOpen ? 'bg-gray-50/80' : ''}`}>
          {TRACKING_ITEMS.map(item => (
            <NavRow key={item.to} to={item.to} label={item.label} icon={item.icon} active={pathActive(pathname, item.to)} nested />
          ))}
          {canEditShare && (
            <NavRow
              to="/share/team"
              label="Teams"
              icon={Users}
              active={pathActive(pathname, '/share/team')}
              nested
            />
          )}
        </div>

        <p className={`px-3 pt-5 pb-1.5 text-[13px] font-bold tracking-wide ${
          contentOpen ? 'text-claim-700' : 'text-claim-600'
        }`}>
          Share
        </p>
        <div className={`rounded-xl ${contentOpen ? 'bg-claim-50/50' : ''}`}>
          {CONTENT_ITEMS.filter(item => item.to !== '/share/embed' || canEditShare).map(item => (
            <NavRow
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              active={pathActive(pathname, item.to)}
              nested
              soon={'soon' in item && item.soon}
              nudge={item.to === '/share/public' && needsPublicNudge}
              accent="claim"
            />
          ))}
        </div>

        <p className="px-3 pt-5 pb-1.5 text-[13px] font-bold tracking-wide text-gray-400">
          General
        </p>
        <div>
          <NavRow to="/explore" label="Explore" icon={Compass} active={pathActive(pathname, '/explore')} nested />
          <button
            type="button"
            onClick={startOnboarding}
            className="relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50"
          >
            <Sparkles className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="flex-1 text-left">Setup</span>
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary-600 text-white">Beta</span>
          </button>
          <button
            type="button"
            onClick={startTutorial}
            className="relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50"
          >
            <GraduationCap className="w-4 h-4 text-gray-400 flex-shrink-0" />
            Tutorial
          </button>
          <NavRow to="/account" label="Settings" icon={Settings} active={pathActive(pathname, '/account')} nested />
        </div>
      </div>

      </div>

      <div className="p-3 border-t border-gray-100 flex-shrink-0">
        <div className="relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => setSettingsOpen(v => !v)}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left"
            title={displayName}
          >
            <div className="w-8 h-8 rounded-full bg-secondary-600 text-white text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
              {initials || <UserIcon className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{displayName}</p>
              <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
            </div>
          </button>

          <AnimatePresence>
            {settingsOpen && (
              <motion.div
                initial={dropdownPop.initial}
                animate={dropdownPop.animate}
                exit={dropdownPop.exit}
                className="absolute bottom-full left-0 right-0 mb-2 app-card overflow-hidden z-50 p-1.5 origin-bottom"
              >
                <button
                  type="button"
                  onClick={() => {
                    handleSignOut()
                    setSettingsOpen(false)
                  }}
                  className="app-btn app-btn-secondary w-full app-btn-sm"
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
