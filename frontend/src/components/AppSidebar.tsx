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

/** Org mark: logo when set, otherwise a branded initial tile. */
function OrgAvatar({ name, logoUrl, shared }: { name?: string; logoUrl?: string | null; shared?: boolean }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  if (logoUrl) {
    return (
      <span className="w-8 h-8 rounded-lg bg-white ring-1 ring-gray-200/80 flex items-center justify-center flex-shrink-0 overflow-hidden">
        <img src={logoUrl} alt="" className="w-full h-full object-contain" />
      </span>
    )
  }
  return (
    <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[13px] font-bold ${
      shared ? 'bg-evidence-50 text-evidence-700' : 'bg-primary-100 text-primary-950'
    }`}>
      {shared ? <Users className="w-4 h-4" /> : initial}
    </span>
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
  // A program workspace belongs to Programs.
  if (to === '/tracking/programs') return pathname === to || pathname.startsWith(`${to}/`) || pathname.startsWith('/programs/') || pathname.startsWith('/initiatives/')
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
      className={`group relative flex items-center gap-2.5 rounded-xl transition-colors ${
        nested ? 'px-2.5 py-[7px]' : 'px-2.5 py-2'
      } ${active ? '' : 'hover:bg-white/70'}`}
    >
      {active && (
        <motion.span
          layoutId={claim ? 'appSidebarShareTab' : 'appSidebarActiveTab'}
          className="absolute inset-0 rounded-xl bg-white border border-gray-200/70 shadow-card"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      <span className={`relative z-10 w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
        active
          ? (claim ? 'bg-claim-50 text-claim-700' : 'bg-primary-50 text-primary-900')
          : 'text-gray-400 group-hover:text-gray-600'
      }`}>
        <Icon className="w-4 h-4" />
      </span>
      <span className={`relative z-10 flex-1 min-w-0 text-[13px] truncate ${active ? 'font-semibold text-gray-900' : 'font-medium text-gray-600 group-hover:text-gray-900'}`}>
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

function SectionLabel({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'primary' | 'claim' | 'gray' }) {
  const color = tone === 'primary' ? 'text-primary-900' : tone === 'claim' ? 'text-claim-700' : 'text-gray-400'
  return (
    <p className={`px-2.5 pt-5 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] ${color}`}>
      {children}
    </p>
  )
}

/**
 * Org-level sidebar for Home / Tracking / Share.
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
  const { startOnboarding } = useOnboarding()
  const isDemoOrg = !!activeOrganization?.is_demo
  const supportContext = getSupportContext()
  const canEditShare = isOwner || isAdmin
  const needsPublicNudge = canEditShare && !!activeOrganization && !activeOrganization.is_public && !isDemoOrg

  const trackingOpen =
    pathname === '/tracking' ||
    pathname.startsWith('/tracking/') ||
    pathname.startsWith('/programs/') ||
    pathname.startsWith('/initiatives/') ||
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
    <div className="fixed left-0 top-0 w-56 h-screen bg-gradient-to-b from-primary-50/70 via-[#F7F8FA] to-[#F7F8FA] border-r border-gray-200/70 flex flex-col z-30 desktop-sidebar">
      <div className="flex-shrink-0 px-3 pt-4 pb-3">
        <Link to="/" className="flex items-center gap-2.5 px-1.5 py-1 rounded-xl hover:bg-white/70 transition-colors min-w-0">
          <span className="w-8 h-8 rounded-xl bg-white border border-primary-200/70 shadow-card flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src="/Nexuslogo.png" alt="" className="h-6 w-auto" />
          </span>
          <span className="min-w-0 leading-none">
            <span className="block text-[15px] font-newsreader text-secondary-900 truncate">Nexus Impacts</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-primary-900/70 mt-1">Impact tracking</span>
          </span>
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2 scrollbar-thin">
      <div className="pb-3 border-b border-gray-200/70" ref={orgMenuRef}>
        {teamLoading ? (
          <div className="h-9 rounded-xl bg-gray-100 animate-pulse" />
        ) : hasMultipleOrgs ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOrgMenuOpen(v => !v)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-all bg-white border border-gray-200/70 shadow-card hover:border-primary-300/70 hover:shadow-card-hover"
            >
              <OrgAvatar name={activeOrganization?.name} logoUrl={activeOrganization?.logo_url} shared={isSharedMember} />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold text-gray-900 truncate leading-tight">
                  {activeOrganization?.name || 'Select organization'}
                </span>
                <span className="block text-[10.5px] text-gray-400 truncate leading-tight mt-0.5">
                  {isSharedMember ? 'Shared with you' : 'Your organization'}
                </span>
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
                    {org.role === 'member' ? <Users className="w-3.5 h-3.5 text-evidence-600" /> : <Building2 className="w-3.5 h-3.5 text-gray-400" />}
                    <span className="flex-1 min-w-0 text-xs font-medium truncate">{org.name}</span>
                    {org.id === activeOrganization?.id && <Check className="w-3.5 h-3.5 text-primary-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-white border border-gray-200/70 shadow-card">
            <OrgAvatar name={activeOrganization?.name} logoUrl={activeOrganization?.logo_url} shared={isSharedMember} />
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-semibold text-gray-900 truncate leading-tight">
                {activeOrganization?.name || 'Organization'}
              </span>
              <span className="block text-[10.5px] text-gray-400 truncate leading-tight mt-0.5">
                {isSharedMember ? 'Shared with you' : 'Your organization'}
              </span>
            </span>
          </div>
        )}

        {!teamLoading && activeOrganization && !isDemoOrg && (
          <div className="mt-1.5 flex items-center gap-0.5 px-1">
            <Link
              to="/share/public"
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium min-w-0 border ${
                activeOrganization.is_public
                  ? 'text-impact-700 bg-impact-50 border-impact-100'
                  : 'text-amber-700 bg-amber-50 border-amber-100'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activeOrganization.is_public ? 'bg-impact-500' : 'bg-amber-400'}`} />
              <span className="truncate">{activeOrganization.is_public ? 'Public page live' : 'Not public yet'}</span>
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
            className="mt-1 w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-evidence-700 hover:bg-evidence-50"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Back to admin
          </button>
        )}
      </div>

      <div className="py-3">
        <NavRow to="/" label="Home" icon={SoftHome} active={pathname === '/'} />

        <SectionLabel tone="primary">Tracking</SectionLabel>
        <div className="space-y-0.5">
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

        <SectionLabel tone="claim">Share</SectionLabel>
        <div className="space-y-0.5">
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

        <SectionLabel>General</SectionLabel>
        <div className="space-y-0.5">
          <NavRow to="/explore" label="Explore" icon={Compass} active={pathActive(pathname, '/explore')} nested />
          <button
            type="button"
            onClick={startOnboarding}
            className="group relative w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-xl text-[13px] font-medium text-gray-600 hover:bg-white/70 hover:text-gray-900"
          >
            <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-gray-400 group-hover:text-gray-600"><Sparkles className="w-4 h-4" /></span>
            <span className="flex-1 text-left">Setup</span>
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-primary-500 text-primary-950">Beta</span>
          </button>
          <button
            type="button"
            onClick={startTutorial}
            className="group relative w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-xl text-[13px] font-medium text-gray-600 hover:bg-white/70 hover:text-gray-900"
          >
            <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-gray-400 group-hover:text-gray-600"><GraduationCap className="w-4 h-4" /></span>
            Tutorial
          </button>
          <NavRow to="/account" label="Settings" icon={Settings} active={pathActive(pathname, '/account')} nested />
        </div>
      </div>

      </div>

      <div className="p-3 border-t border-gray-200/70 flex-shrink-0">
        <div className="relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => setSettingsOpen(v => !v)}
            className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl bg-white border border-gray-200/70 shadow-card hover:border-primary-300/70 hover:shadow-card-hover transition-all text-left"
            title={displayName}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-evidence-500 text-white text-[11px] font-semibold flex items-center justify-center flex-shrink-0 ring-2 ring-white">
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
