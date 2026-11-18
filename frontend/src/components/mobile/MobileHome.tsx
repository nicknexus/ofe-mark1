import { useState } from 'react'
import { ArrowRight, Building2, ClipboardList, ImagePlus, PenSquare } from 'lucide-react'

interface MobileHomeProps {
  organizationName: string
  logoUrl?: string | null
  canAddLog: boolean
  canAddStory: boolean
  canCreatePost: boolean
  onAddLog: () => void
  onAddStory: () => void
  onCreatePost: () => void
}

export default function MobileHome({
  organizationName, logoUrl, canAddLog, canAddStory, canCreatePost,
  onAddLog, onAddStory, onCreatePost,
}: MobileHomeProps) {
  const [failedLogo, setFailedLogo] = useState<string | null>(null)
  const showLogo = logoUrl && logoUrl !== failedLogo

  return (
    <main className="mx-auto w-full max-w-lg px-5 pb-6">
      <div className="mobile-home-identity">
        {showLogo ? (
          <img src={logoUrl} alt={organizationName} className="max-h-28 max-w-[260px] w-full object-contain" onError={() => setFailedLogo(logoUrl)} />
        ) : (
          <>
            <span className="mobile-home-org-icon"><Building2 className="h-7 w-7" aria-hidden="true" /></span>
            <span className="text-center text-2xl font-semibold tracking-tight text-secondary-900 break-words max-w-full">{organizationName}</span>
          </>
        )}
        <h1 className="text-xs font-medium tracking-wide text-secondary-500">Your impact workspace</h1>
      </div>

      <section aria-labelledby="mobile-capture-title">
        <h2 id="mobile-capture-title" className="mobile-home-section-title">Capture your work</h2>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onAddLog} disabled={!canAddLog} className="app-card-interactive mobile-capture-card">
            <ClipboardList className="h-9 w-9 mb-5" strokeWidth={1.6} aria-hidden="true" />
            <span className="text-lg font-semibold tracking-tight text-secondary-900">Add log</span>
            <span className="mt-1.5 text-sm leading-relaxed text-secondary-600">
              {canAddLog ? 'Your impact and evidence' : 'Ask an admin for log access'}
            </span>
          </button>
          <button type="button" onClick={onAddStory} disabled={!canAddStory} className="app-card-interactive mobile-capture-card">
            <ImagePlus className="h-9 w-9 mb-5" strokeWidth={1.6} aria-hidden="true" />
            <span className="text-lg font-semibold tracking-tight text-secondary-900">Add story</span>
            <span className="mt-1.5 text-sm leading-relaxed text-secondary-600">
              {canAddStory ? 'A moment that matters from your work' : 'Ask an admin for story access'}
            </span>
          </button>
        </div>
      </section>

      <section aria-labelledby="mobile-share-title" className="mt-7">
        <h2 id="mobile-share-title" className="mobile-home-section-title">Share your impact</h2>
        <button type="button" onClick={onCreatePost} disabled={!canCreatePost} className="mobile-share-card">
          <PenSquare className="h-9 w-9 shrink-0" strokeWidth={1.6} aria-hidden="true" />
          <span className="flex-1 min-w-0">
            <span className="block text-lg font-semibold tracking-tight">Create social post</span>
            <span className="mt-1.5 block text-sm leading-relaxed text-white/80">
              {canCreatePost ? 'Turn your stories and evidence into something to share.' : 'Ask an admin for Content Studio access.'}
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
        </button>
      </section>
    </main>
  )
}
