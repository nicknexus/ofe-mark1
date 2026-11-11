import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PenLine,
  LayoutDashboard,
  BarChart3,
  Calendar,
  Library,
  Link2,
  Tag,
  MapPin,
  Globe,
  BookOpen,
  Code2,
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
import { notify } from '../lib/notify'
import { getSupportContext } from '../admin/support'
import { dropdownPop } from './timeline/motion'
import { isStudioMode, studioNavActive } from '../pages/studio/studioPaths'

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

const LIBRARY_ITEMS = [
  { to: '/metrics', label: 'Metrics', icon: BarChart3 },
  { to: '/locations', label: 'Locations', icon: MapPin },
  { to: '/tags', label: 'Tags', icon: Tag },
] as const

const CONTENT_ITEMS = [
  { to: '/share/public', label: 'Public page', icon: Globe },
  { to: '/share/org', label: 'Organization', icon: Building2 },
  { to: '/share/context', label: 'Context', icon: BookOpen },
  { to: '/share/embed', label: 'Embed', icon: Code2 },
] as const

const STUDIO_ITEMS = [
  { to: '/studio', label: 'Studio', icon: PenLine },
  { to: '/studio/library', label: 'Library', icon: Library },
  { to: '/studio/calendar', label: 'Calendar', icon: Calendar },
  { to: '/studio/insights', label: 'Insights', icon: BarChart3 },
  { to: '/studio/accounts', label: 'Accounts', icon: Link2 },
] as const

function pathActive(pathname: string, to: string) {
  if (to === '/share/public') return pathname === '/share' || pathname === '/share/public'
  if (to === '/tags') return pathname === '/tags' || pathname.startsWith('/tags/')
  if (to === '/account') return pathname === '/account' || pathname.startsWith('/account')
  if (to === '/share/org') return pathname === '/share/org' || pathname === '/share/brand'
  if (to === '/home') return pathname === '/home'
  // A program workspace belongs to Programs. `/` redirects there.
  if (to === '/tracking/programs') {
    return pathname === '/' || pathname === to || pathname.startsWith(`${to}/`) || pathname.startsWith('/programs/') || pathname.startsWith('/initiatives/')
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}

function NavRow({
  to,
  label,
  icon: Icon,
  active,
  nested,
  compact,
  soon,
  nudge,
  beta,
  accent = 'primary',
}: {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  nested?: boolean
  compact?: boolean
  soon?: boolean
  nudge?: boolean
  beta?: boolean
  accent?: 'primary' | 'claim'
}) {
  const claim = accent === 'claim'
  return (
    <Link
      to={to}
      className={`relative flex items-center rounded-lg transition-colors ${
        compact ? 'gap-2 px-2.5 py-1.5' : nested ? 'gap-2.5 px-3 py-2' : 'gap-2.5 px-3 py-2.5'
      } ${active ? '' : 'hover:bg-gray-50'}`}
    >
      {active && (
        <>
          <span className={`absolute inset-0 rounded-lg ${
            claim ? 'bg-claim-50' : compact ? 'bg-white shadow-sm' : 'bg-primary-50'
          }`} />
          {!compact && (
            <span className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full ${claim ? 'bg-claim-500' : 'bg-primary-600'}`} />
          )}
        </>
      )}
      <Icon className={`relative z-10 flex-shrink-0 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${
        active ? (claim ? 'text-claim-700' : 'text-primary-800') : 'text-gray-400'
      }`} />
      <span className={`relative z-10 flex-1 min-w-0 font-medium truncate ${
        compact ? 'text-[12px]' : 'text-[13px]'
      } ${active ? 'text-gray-900' : compact ? 'text-gray-500' : 'text-gray-600'}`}>
        {label}
      </span>
      {soon && (
        <span className="relative z-10 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Soon</span>
      )}
      {beta && (
        <span className="relative z-10 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary-600 text-white">Beta</span>
      )}
      {nudge && (
        <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
      )}
    </Link>
  )
}

/**
 * Org-level sidebar: Home, Tracking (Programs + shared library), Share.
 * Hidden on mobile via `.desktop-sidebar` (the program page shows it too).
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
  const isDemoOrg = !!activeOrganization?.is_demo
  const supportContext = getSupportContext()
  const canEditShare = isOwner || isAdmin
  const needsPublicNudge = canEditShare && !!activeOrganization && !activeOrganization.is_public && !isDemoOrg

  const studioMode = isStudioMode(pathname)
  const programsOpen = pathActive(pathname, '/tracking/programs')
  const libraryOpen =
    pathname.startsWith('/metrics') ||
    pathname === '/locations' ||
    pathname === '/tags' ||
    pathname.startsWith('/tags/')
  const trackingOpen = programsOpen || libraryOpen
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
    <div className={`fixed left-0 top-0 w-56 h-screen flex flex-col z-30 desktop-sidebar ${
      studioMode ? 'studio-sidebar' : 'bg-white border-r border-gray-200/70'
    }`}>
      <div className={`flex-shrink-0 px-3 pt-3 pb-2 ${studioMode ? '' : 'bg-white'}`}>
        <Link to={studioMode ? '/studio' : '/home'} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors min-w-0 ${
          studioMode ? 'hover:bg-white/10' : 'hover:bg-gray-50'
        }`}>
          <img src="/Nexuslogo.png" alt="" className="h-7 w-auto flex-shrink-0" />
          <span className={`text-[15px] font-newsreader font-extralight truncate leading-none pt-0.5 ${
            studioMode ? 'text-[#F4F7F2]' : 'text-secondary-900'
          }`}>Nexus Impacts</span>
        </Link>
        <div
          className={`mt-2.5 flex p-0.5 rounded-full ${studioMode ? 'bg-black/30 ring-1 ring-white/10' : 'bg-[#EEF2EA]'}`}
          role="tablist"
          aria-label="App"
        >
          <Link
            to="/home"
            role="tab"
            aria-selected={!studioMode}
            className={`flex-1 h-7 rounded-full text-[11px] font-semibold tracking-tight inline-flex items-center justify-center gap-1 transition-all ${
              studioMode
                ? 'text-white/60 hover:text-white'
                : 'bg-white text-[#14352A] shadow-[0_1px_2px_rgba(20,53,42,0.12)]'
            }`}
          >
            <SoftHome className="w-3.5 h-3.5" />
            Nexus
          </Link>
          <Link
            to="/studio"
            role="tab"
            aria-selected={studioMode}
            className={`flex-1 h-7 rounded-full text-[11px] font-semibold tracking-tight inline-flex items-center justify-center gap-1 transition-all ${
              studioMode
                ? 'bg-[#C0DFA1] text-[#14352A] shadow-[0_1px_2px_rgba(0,0,0,0.25)]'
                : 'text-[#3d5c49] hover:text-[#14352A]'
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            Studio
          </Link>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2 scrollbar-thin">
      <div className={`pb-3 border-b ${studioMode ? 'border-white/10' : 'border-gray-100'}`} ref={orgMenuRef}>
        <div className="h-9">
        {teamLoading ? (
          <div className={`h-9 rounded-xl animate-pulse ${studioMode ? 'bg-white/10' : 'bg-gray-100'}`} />
        ) : hasMultipleOrgs ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOrgMenuOpen(v => !v)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-colors ${
                studioMode
                  ? 'hover:bg-white/10'
                  : isSharedMember ? 'bg-purple-50 hover:bg-purple-100' : 'hover:bg-gray-50'
              }`}
            >
              {isSharedMember ? <Users className={`w-4 h-4 flex-shrink-0 ${studioMode ? 'text-white/80' : 'text-purple-600'}`} /> : <Building2 className={`w-4 h-4 flex-shrink-0 ${studioMode ? 'text-white/70' : 'text-gray-500'}`} />}
              <span className={`flex-1 min-w-0 text-[13px] font-semibold truncate ${
                studioMode ? 'text-white' : isSharedMember ? 'text-purple-800' : 'text-gray-900'
              }`}>
                {activeOrganization?.name || 'Select organization'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${studioMode ? 'text-white/50' : 'text-gray-400'} ${orgMenuOpen ? 'rotate-180' : ''}`} />
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
          <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl ${!studioMode && isSharedMember ? 'bg-purple-50' : ''}`}>
            {isSharedMember ? <Users className={`w-4 h-4 flex-shrink-0 ${studioMode ? 'text-white/80' : 'text-purple-600'}`} /> : <Building2 className={`w-4 h-4 flex-shrink-0 ${studioMode ? 'text-white/60' : 'text-gray-400'}`} />}
            <span className={`text-[13px] font-semibold truncate ${studioMode ? 'text-white' : isSharedMember ? 'text-purple-800' : 'text-gray-900'}`}>
              {activeOrganization?.name || 'Organization'}
            </span>
          </div>
        )}
        </div>

        <div className="mt-1 h-6 flex items-center gap-0.5 px-2.5">
          {isDemoOrg && user.is_admin ? (
            <button
              type="button"
              onClick={() => {
                const realOrg = switcherOrganizations.find(o => o.role === 'owner') || switcherOrganizations[0]
                if (realOrg) localStorage.setItem('nexus-active-org-id', realOrg.id)
                else localStorage.removeItem('nexus-active-org-id')
                window.location.href = '/admin/demos'
              }}
              className="flex items-center gap-1.5 text-[11px] font-medium text-purple-700"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Back to admin
            </button>
          ) : !teamLoading && activeOrganization && !isDemoOrg ? (
            <>
              <Link
                to="/share/public"
                className={`flex items-center gap-1.5 min-w-0 ${
                  studioMode
                    ? activeOrganization.is_public ? 'text-[#C0DFA1]' : 'text-amber-200'
                    : activeOrganization.is_public ? 'text-impact-700' : 'text-amber-700'
                } text-[11px] font-medium`}
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
                  className={`p-1 rounded-md flex-shrink-0 ${studioMode ? 'text-[#C0DFA1] hover:bg-white/10' : 'text-impact-600 hover:bg-impact-50'}`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="py-3">
        {studioMode ? (
          <div className="space-y-0.5">
            {STUDIO_ITEMS.map(item => {
              const Icon = item.icon
              const active = studioNavActive(pathname, item.to)
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`studio-nav-link ${active ? 'studio-nav-link-active' : ''}`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        ) : (
        <>
        <NavRow to="/home" label="Home" icon={SoftHome} active={pathActive(pathname, '/home')} />

        <p className={`px-3 pt-5 pb-1.5 text-[13px] font-bold tracking-wide ${
          trackingOpen ? 'text-primary-800' : 'text-primary-700'
        }`}>
          Tracking
        </p>
        <div>
          <Link
            to="/tracking/programs"
            className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${programsOpen ? '' : 'hover:bg-gray-50'}`}
          >
            {programsOpen && (
              <>
                <span className="absolute inset-0 rounded-lg bg-primary-50" />
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-primary-600" />
              </>
            )}
            <LayoutDashboard className={`relative z-10 w-4 h-4 flex-shrink-0 ${programsOpen ? 'text-primary-800' : 'text-gray-400'}`} />
            <span className={`relative z-10 flex-1 min-w-0 text-[13px] font-medium truncate ${programsOpen ? 'text-gray-900' : 'text-gray-600'}`}>
              Programs
            </span>
            <ChevronDown className={`relative z-10 w-3.5 h-3.5 flex-shrink-0 transition-transform ${
              trackingOpen ? 'text-gray-500 rotate-180' : 'text-gray-300'
            }`} />
          </Link>
          {trackingOpen && (
            <div className="relative ml-5 mt-0.5 mb-1 pl-3">
              <span className="absolute left-0 top-1 bottom-2 w-px bg-gray-200" aria-hidden />
              {LIBRARY_ITEMS.map(item => {
                const Icon = item.icon
                const active = pathActive(pathname, item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      active ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                    }`}
                  >
                    <span className="absolute -left-3 top-1/2 w-2.5 h-px bg-gray-200" aria-hidden />
                    <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-gray-700' : 'text-gray-400'}`} />
                    <span className="truncate">Global {item.label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <p className={`px-3 pt-5 pb-1.5 text-[13px] font-bold tracking-wide ${
          contentOpen ? 'text-claim-700' : 'text-claim-600'
        }`}>
          Share
        </p>
        <div className={`rounded-xl ${contentOpen ? 'bg-claim-50/50' : ''}`}>
          {CONTENT_ITEMS.filter(item => item.to !== '/share/embed' || canEditShare || teamLoading).map(item => (
            <NavRow
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              active={pathActive(pathname, item.to)}
              nested
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
            onClick={startTutorial}
            className="relative w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-gray-600 hover:bg-gray-50"
          >
            <GraduationCap className="w-4 h-4 text-gray-400 flex-shrink-0" />
            Tutorial
          </button>
          {(canEditShare || teamLoading) && (
            <NavRow to="/share/team" label="Teams" icon={Users} active={pathActive(pathname, '/share/team')} nested />
          )}
          <NavRow to="/account" label="Settings" icon={Settings} active={pathActive(pathname, '/account')} nested />
        </div>
        </>
        )}
      </div>

      </div>

      <div className={`p-3 border-t flex-shrink-0 ${studioMode ? 'border-white/10' : 'border-gray-100'}`}>
        <div className="relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => setSettingsOpen(v => !v)}
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors text-left ${
              studioMode ? 'hover:bg-white/10' : 'hover:bg-gray-50'
            }`}
            title={displayName}
          >
            <div className={`w-8 h-8 rounded-full text-[11px] font-semibold flex items-center justify-center flex-shrink-0 ${
              studioMode ? 'bg-[#C0DFA1] text-[#14352A]' : 'bg-secondary-600 text-white'
            }`}>
              {initials || <UserIcon className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold truncate ${studioMode ? 'text-white' : 'text-gray-800'}`}>{displayName}</p>
              <p className={`text-[11px] truncate ${studioMode ? 'text-white/50' : 'text-gray-400'}`}>{user.email}</p>
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
