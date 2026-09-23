import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Sparkles } from 'lucide-react'
import UpgradeModal from '../components/UpgradeModal'
import { useTeam } from '../context/TeamContext'
import { SubscriptionService } from '../services/subscription'
import { PageLoader } from '../components/ui'
import ContentEngine from '../components/content/ContentEngine'

export default function ContentCreatePage() {
  const { isOwner, activeOrganization } = useTeam()
  const [isFree, setIsFree] = useState(false)
  const [gated, setGated] = useState(false)
  const [featuresLoaded, setFeaturesLoaded] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  useEffect(() => {
    let cancelled = false
    SubscriptionService.getFeatures()
      .then(f => {
        if (cancelled) return
        const locked = !f.contentStudio && !activeOrganization?.is_demo
        setIsFree(f.tier === 'free')
        setGated(locked)
        setFeaturesLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setFeaturesLoaded(true)
      })
    return () => { cancelled = true }
  }, [activeOrganization?.id, activeOrganization?.is_demo])

  if (!featuresLoaded) return <PageLoader />

  if (gated) {
    return (
      <>
        <GatedEmpty isOwner={isOwner} isFree={isFree} onUpgrade={() => setShowUpgrade(true)} />
        <UpgradeModal
          isOpen={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          title="Impact content is a paid feature"
          subtitle="Upgrade to Growth or Pro to turn tracked photos into posts and email."
        />
      </>
    )
  }

  return <ContentEngine />
}

function GatedEmpty({
  isOwner,
  isFree,
  onUpgrade,
}: {
  isOwner: boolean
  isFree: boolean
  onUpgrade: () => void
}) {
  return (
    <div className="min-h-screen pt-8 pb-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="app-card overflow-hidden">
          <div className="px-8 pt-10 pb-8">
            <div className="flex items-center gap-2">
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
                  Impact content
                </h1>
                <p className="text-sm text-secondary-500 mt-2 leading-relaxed max-w-xl">
                  Nexus writes one evidence-backed story from what you already logged, then adapts it for every channel you pick.
                </p>
              </div>
            </div>
          </div>
          <div className="px-8 py-5 border-t border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-secondary-600 leading-relaxed flex-1">
              {isOwner
                ? 'Not included on the Free plan. Upgrade to Growth or Pro to unlock it.'
                : 'Not included on the Free plan. Ask the organization owner to upgrade to Growth or Pro.'}
            </p>
            {isOwner ? (
              <button type="button" onClick={onUpgrade} className="app-btn app-btn-primary app-btn-sm flex-shrink-0">
                See plans
              </button>
            ) : (
              <Link to="/tracking/programs" className="app-btn app-btn-secondary app-btn-sm flex-shrink-0">
                Keep tracking
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
