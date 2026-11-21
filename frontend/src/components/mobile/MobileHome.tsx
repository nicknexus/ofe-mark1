import { useState } from 'react'
import { ArrowRight, Building2, ClipboardList, ImagePlus, PenSquare } from 'lucide-react'
import { Button } from '../ui'

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
    <main className="mx-auto w-full max-w-lg px-4 pb-4">
      <div className="flex flex-col items-center justify-center gap-2 px-2 py-4">
        {showLogo ? (
          <img src={logoUrl} alt={organizationName} className="h-12 max-w-[220px] w-full object-contain" onError={() => setFailedLogo(logoUrl)} />
        ) : (
          <div className="flex max-w-full items-center gap-2.5">
            <span className="app-icon-tile app-icon-tile-sm app-icon-tile-accent"><Building2 className="h-4 w-4" aria-hidden="true" /></span>
            <span className="text-lg font-semibold leading-tight text-secondary-900 break-words line-clamp-2 min-w-0">{organizationName}</span>
          </div>
        )}
        <h1 className="app-page-subtitle text-center">Your impact workspace</h1>
      </div>

      <section aria-labelledby="mobile-capture-title">
        <h2 id="mobile-capture-title" className="app-section-title mb-2">Capture your work</h2>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onAddLog} disabled={!canAddLog} className="app-card-interactive flex flex-col items-start p-3 text-left disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2">
            <span className="app-icon-tile app-icon-tile-sm app-icon-tile-accent mb-2"><ClipboardList className="h-4 w-4" aria-hidden="true" /></span>
            <span className="app-card-title">Add log</span>
            <span className="mt-1 text-sm leading-snug text-secondary-500">
              {canAddLog ? 'Your impact and evidence' : 'Ask an admin for log access'}
            </span>
          </button>
          <button type="button" onClick={onAddStory} disabled={!canAddStory} className="app-card-interactive flex flex-col items-start p-3 text-left disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2">
            <span className="app-icon-tile app-icon-tile-sm app-icon-tile-accent mb-2"><ImagePlus className="h-4 w-4" aria-hidden="true" /></span>
            <span className="app-card-title">Add story</span>
            <span className="mt-1 text-sm leading-snug text-secondary-500">
              {canAddStory ? 'A moment that matters' : 'Ask an admin for story access'}
            </span>
          </button>
        </div>
      </section>

      <section aria-labelledby="mobile-share-title" className="mt-4">
        <h2 id="mobile-share-title" className="app-section-title mb-2">Share your impact</h2>
        <div className="app-card p-3">
          <div className="flex items-center gap-3">
            <span className="app-icon-tile app-icon-tile-sm app-icon-tile-accent"><PenSquare className="h-4 w-4" aria-hidden="true" /></span>
            <p className="text-sm leading-snug text-secondary-500">
              {canCreatePost ? 'Turn your stories and evidence into something to share.' : 'Ask an admin for Content Studio access.'}
            </p>
          </div>
          <Button type="button" size="lg" onClick={onCreatePost} disabled={!canCreatePost} className="mt-3 w-full">
            Create social post <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </section>
    </main>
  )
}
