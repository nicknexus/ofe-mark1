import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Image, Lock, MessageSquareQuote, Sparkles, Type } from 'lucide-react'
import UpgradeModal from '../components/UpgradeModal'
import { useTeam } from '../context/TeamContext'
import { SubscriptionService } from '../services/subscription'
import { fadeUp, staggerContainer, easeOut } from '../components/timeline/motion'

const PREVIEWS = [
  {
    icon: Image,
    kicker: 'Graphic',
    title: 'A post that looks like you',
    body: 'Pick a story or photo you already logged. Get a branded image: logo, color, ready to drop on Instagram or LinkedIn.',
  },
  {
    icon: Type,
    kicker: 'Caption',
    title: 'The words, from the proof',
    body: 'A caption in your voice, sourced from the evidence, not a blank box. Edit once, then share.',
  },
  {
    icon: MessageSquareQuote,
    kicker: 'Dashboard',
    title: 'What to share this week',
    body: 'See the stories worth posting, not a pile of files. One place to turn tracking into content.',
  },
] as const

export default function ContentCreatePage() {
  const { isOwner } = useTeam()
  const [isFree, setIsFree] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  useEffect(() => {
    SubscriptionService.getFeatures()
      .then(f => setIsFree(f.tier === 'free'))
      .catch(() => { /* fail open: don't falsely paywall */ })
  }, [])

  return (
    <motion.div
      className="min-h-screen pt-8 pb-10 px-4 sm:px-6 lg:px-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: easeOut }}
    >
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="app-card overflow-hidden"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <div className="relative px-8 pt-10 pb-8">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-36"
              style={{ background: 'radial-gradient(ellipse 70% 100% at 12% 0%, rgba(192,223,161,0.45) 0%, transparent 72%)' }}
            />
            <motion.div variants={fadeUp} className="relative">
              <div className="flex items-center gap-2">
                <span className="app-chip text-[10px] uppercase tracking-wide">Coming soon</span>
                {isFree && (
                  <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-800">
                    <Lock className="w-3 h-3" />
                    Growth & Pro
                  </span>
                )}
              </div>
              <div className="flex items-start gap-3 mt-4">
                <div className="app-icon-tile app-icon-tile-accent mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-[28px] font-semibold tracking-tight text-secondary-900 leading-tight">
                    Impact content dashboard coming soon
                  </h1>
                  <p className="text-sm text-secondary-500 mt-2 leading-relaxed max-w-xl">
                    Turn what you tracked into something people can actually share: a branded image, a caption, or both. Proof in, post out.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={staggerContainer}
              className="relative grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8"
            >
              {PREVIEWS.map(item => (
                <motion.div
                  key={item.kicker}
                  variants={fadeUp}
                  className="rounded-xl border border-gray-200/80 bg-white p-5"
                >
                  <div className="app-icon-tile bg-claim-50 text-claim-700">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <p className="app-section-title mt-4 mb-1.5">{item.kicker}</p>
                  <h2 className="text-[15px] font-semibold text-secondary-900">{item.title}</h2>
                  <p className="text-sm text-secondary-500 mt-1.5 leading-relaxed">{item.body}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>

          <div className="px-8 py-5 border-t border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center gap-3">
            {isFree ? (
              <>
                <p className="text-sm text-secondary-600 leading-relaxed flex-1">
                  {isOwner
                    ? "Not included on the Free plan. Upgrade to Growth or Pro and you'll get this dashboard the day it ships."
                    : 'Not included on the Free plan. Ask the organization owner to upgrade to Growth or Pro.'}
                </p>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => setShowUpgrade(true)}
                    className="app-btn app-btn-primary app-btn-sm flex-shrink-0"
                  >
                    See plans
                  </button>
                ) : (
                  <Link to="/tracking/programs" className="app-btn app-btn-secondary app-btn-sm flex-shrink-0">
                    Keep tracking
                  </Link>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-secondary-600 leading-relaxed flex-1">
                  You're on a paid plan. This is next. Keep tracking so the stories are ready when it drops.
                </p>
                <Link to="/tracking/programs" className="app-btn app-btn-primary app-btn-sm flex-shrink-0">
                  Keep tracking
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </div>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        title="Impact content is a paid feature"
        subtitle="Not on Free. Upgrade to Growth or Pro to get the content dashboard when it launches."
      />
    </motion.div>
  )
}
