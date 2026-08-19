import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTeam } from '../context/TeamContext'
import { PageHeader } from '../components/ui'
import { fadeUp, staggerContainer, easeOut } from '../components/timeline/motion'

const ITEMS = [
  {
    to: '/share/public',
    kicker: 'Go live',
    title: 'Public page',
    description: 'Turn it on when the tracking is ready.',
  },
  {
    to: '/share/org',
    kicker: 'Identity',
    title: 'Organization',
    description: 'Name, mission, links, logo, and color.',
  },
  {
    to: '/share/context',
    kicker: 'Why',
    title: 'Context',
    description: 'Problem, theory of change, strategies — the story behind the numbers.',
  },
  {
    to: '/share/embed',
    kicker: 'Your site',
    title: 'Embed',
    description: 'Put the impact widget on your own website.',
  },
] as const

export default function ContentHubPage() {
  const { activeOrganization } = useTeam()
  const live = !!activeOrganization?.is_public
  const publicHref = activeOrganization?.slug
    ? `${activeOrganization.is_demo ? '/demo' : '/org'}/${activeOrganization.slug}`
    : null

  return (
    <motion.div
      className="min-h-screen pt-8 pb-10 px-4 sm:px-6 lg:px-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: easeOut }}
    >
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title="Share"
          subtitle="Identity, then go live. Content comes later."
          actions={
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium ${
                live ? 'bg-impact-50 text-impact-700' : 'bg-amber-50 text-amber-800'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-impact-500' : 'bg-amber-400'}`} />
                {live ? 'Live' : 'Off'}
              </span>
              {live && publicHref && (
                <a href={publicHref} target="_blank" rel="noreferrer" className="app-btn app-btn-secondary app-btn-sm">
                  Open
                </a>
              )}
              <Link to="/share/public" className="app-btn app-btn-primary app-btn-sm">
                {live ? 'Manage' : 'Publish'}
              </Link>
            </div>
          }
        />

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {ITEMS.map(item => (
            <motion.div key={item.to} variants={fadeUp}>
              <Link to={item.to} className="app-card-interactive p-5 block h-full">
                <p className="app-section-title mb-2">{item.kicker}</p>
                <h2 className="text-[15px] font-semibold text-secondary-900">{item.title}</h2>
                <p className="text-sm text-secondary-500 mt-1.5 leading-relaxed">{item.description}</p>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <Link
          to="/share/create"
          className="mt-3 app-card-muted px-5 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors rounded-xl"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-secondary-900">Content</h2>
              <span className="app-chip text-[10px] uppercase tracking-wide">Soon</span>
            </div>
            <p className="text-xs text-secondary-500 mt-0.5">
              Impact content dashboard — branded posts from what you tracked.
            </p>
          </div>
        </Link>
      </div>
    </motion.div>
  )
}
