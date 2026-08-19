import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { PageHeader, PageLoader, InlineAlert, Spinner } from '../components/ui'
import { useTeam } from '../context/TeamContext'
import { notify } from '../lib/notify'
import { apiService } from '../services/api'
import { OrganizationContext } from '../types'
import { easeOut, fadeUp, staggerContainer } from '../components/timeline/motion'

const DEFAULT_BRAND = '#c0dfa1'

type CheckItem = { id: string; label: string; done: boolean; to: string }

export default function ContentPublicPage() {
  const { refreshPermissions, loading: teamLoading, activeOrganization, isOwner, isAdmin } = useTeam()
  const org = activeOrganization
  const canEditShare = isOwner || isAdmin
  const [updating, setUpdating] = useState(false)
  const [orgContext, setOrgContext] = useState<OrganizationContext | null>(null)

  useEffect(() => {
    if (!org?.id) return
    let cancelled = false
    apiService.getOrgContext(org.id).then(ctx => {
      if (!cancelled) setOrgContext(ctx)
    }).catch(() => {
      if (!cancelled) setOrgContext(null)
    })
    return () => { cancelled = true }
  }, [org?.id])

  const checks = useMemo<CheckItem[]>(() => {
    const hasText = (v?: string | null) => !!(v && v.trim().length > 0)
    const hasList = (v?: unknown[] | null) => Array.isArray(v) && v.length > 0
    const c = orgContext
    return [
      { id: 'logo', label: 'Logo added', done: !!org?.logo_url, to: '/share/org?tab=brand' },
      { id: 'color', label: 'Brand color selected', done: !!org?.brand_color && org.brand_color.toLowerCase() !== DEFAULT_BRAND, to: '/share/org?tab=brand' },
      { id: 'mission', label: 'Mission written', done: hasText(org?.statement), to: '/share/org?tab=about' },
      { id: 'website', label: 'Website linked', done: hasText(org?.website_url), to: '/share/org?tab=links' },
      { id: 'donate', label: 'Support link added', done: hasText(org?.donation_url), to: '/share/org?tab=links' },
      { id: 'context', label: 'Context filled out', done: hasText(c?.problem_statement) && (hasText(c?.theory_of_change) || hasList(c?.theory_of_change_stages)), to: '/share/context' },
    ]
  }, [org?.logo_url, org?.brand_color, org?.statement, org?.website_url, org?.donation_url, orgContext])

  const doneCount = checks.filter(c => c.done).length

  const live = !!org?.is_public
  const publicHref = activeOrganization?.slug
    ? `${activeOrganization.is_demo ? '/demo' : '/org'}/${activeOrganization.slug}`
    : null
  const publicUrl = publicHref ? `${window.location.origin}${publicHref}` : null
  const canOpen = !!publicHref && (live || !!activeOrganization?.is_demo)

  const handleToggle = async (makePublic: boolean) => {
    if (!canEditShare || !org?.id) return
    setUpdating(true)
    try {
      await apiService.updateOrganization(org.id, { is_public: makePublic })
      notify.success(makePublic ? 'Public page is live' : 'Public page is off')
      await refreshPermissions()
    } catch (error) {
      notify.error((error as Error).message || 'Failed to update visibility')
    } finally {
      setUpdating(false)
    }
  }

  if (teamLoading) return <PageLoader />

  if (!org) {
    return (
      <div className="max-w-lg mx-auto pt-16 px-4">
        <InlineAlert tone="warning">Join or create an organization to manage the public page.</InlineAlert>
      </div>
    )
  }

  return (
    <motion.div
      className="min-h-screen pt-8 pb-10 px-4 sm:px-6 lg:px-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: easeOut }}
    >
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title="Public page"
          subtitle="Share the work you tracked. Visitors see this generated from your proof."
        />

        <motion.div
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeUp} className="lg:col-span-7 app-card p-8 flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                  {org.logo_url ? (
                    <img src={org.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-secondary-400">
                      {(org.name || '?').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-secondary-900 truncate">{org.name}</p>
                  <p className="text-xs text-secondary-500 truncate mt-0.5">
                    {org.statement?.trim() || 'Add a mission in Organization'}
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium flex-shrink-0 ${
                live ? 'bg-impact-50 text-impact-700' : 'bg-amber-50 text-amber-800'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-impact-500' : 'bg-amber-400'}`} />
                {live ? 'Live' : 'Not live'}
              </span>
            </div>

            <h2 className="text-[28px] font-semibold tracking-tight text-secondary-900 mt-8 leading-tight">
              {live ? 'Your page is live.' : 'Ready when you are.'}
            </h2>
            <p className="text-sm text-secondary-500 mt-2 leading-relaxed max-w-lg">
              {live
                ? 'Anyone can find it on Explore and open the URL. Take it offline anytime.'
                : 'Hidden until you go live. Tracking, brand, and context stay private until then.'}
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-6">
              {live ? (
                <>
                  {canOpen && (
                    <a href={publicHref!} target="_blank" rel="noreferrer" className="app-btn app-btn-primary">
                      <ExternalLink className="w-4 h-4" />
                      Open page
                    </a>
                  )}
                  {canEditShare && (
                    <button
                      type="button"
                      onClick={() => handleToggle(false)}
                      disabled={updating}
                      className="app-btn app-btn-secondary"
                    >
                      {updating ? <Spinner className="w-4 h-4" /> : null}
                      Take offline
                    </button>
                  )}
                </>
              ) : canEditShare ? (
                <button
                  type="button"
                  onClick={() => handleToggle(true)}
                  disabled={updating}
                  className="app-btn app-btn-primary"
                >
                  {updating ? <Spinner className="w-4 h-4" /> : null}
                  Go live
                </button>
              ) : (
                <p className="text-sm text-secondary-500">An owner or admin can publish this page.</p>
              )}
            </div>

            {!live && (
              <p className="text-xs text-secondary-400 mt-4">
                Going live makes programs, impact data, stories, and media viewable by anyone.
              </p>
            )}

            {publicUrl && (
              <div className="flex items-center gap-3 mt-auto pt-8">
                <div className="min-w-0 flex-1">
                  <p className="app-section-title mb-1">URL</p>
                  <p className="text-sm font-mono text-secondary-800 truncate">{publicUrl}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(publicUrl)
                    notify.success('URL copied')
                  }}
                  className="app-btn app-btn-ghost app-btn-sm flex-shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
              </div>
            )}
          </motion.div>

          <motion.div variants={fadeUp} className="lg:col-span-5 app-card p-6 flex flex-col">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <h3 className="text-[15px] font-semibold text-secondary-900">Before you go live</h3>
              <span className="text-[11px] tabular-nums text-secondary-400">{doneCount}/{checks.length}</span>
            </div>
            <p className="text-sm text-secondary-500 mb-4">
              Optimal, not required. You can go live with none of this.
            </p>
            <ul className="space-y-0.5">
              {checks.map(item => (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    className="group flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.done ? 'bg-impact-50 text-impact-600' : 'border border-gray-200'
                    }`}>
                      {item.done && <Check className="w-3 h-3" strokeWidth={2.5} />}
                    </span>
                    <span className={`text-sm flex-1 truncate ${
                      item.done ? 'text-secondary-400' : 'text-secondary-800 group-hover:text-primary-800'
                    }`}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}
