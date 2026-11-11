import { Link } from 'react-router-dom'
import { Calendar, FolderOpen, Image as ImageIcon, Pencil, Share2, Sparkles } from 'lucide-react'
import { InlineAlert, SectionLoader } from '../../components/ui'
import { formatDate } from '../../utils'
import { StudioFrame, StudioPanel, STUDIO_PLATFORMS } from './StudioFrame'
import { useStudioLibrary } from './useStudioLibrary'
import { useSocialAccount } from './useSocialAccount'

const STEPS = [
  { icon: ImageIcon, title: 'Select materials', body: 'Photos and updates you already logged.' },
  { icon: Pencil, title: 'Craft the story', body: 'Write it, or let Nexus draft it.' },
  { icon: Share2, title: 'Choose channels', body: 'Each network keeps its own caption.' },
  { icon: Calendar, title: 'Schedule', body: 'Pick a time once an account is connected.' },
]

export default function StudioHome() {
  const { packages, journeys, loading, error } = useStudioLibrary()
  const { account, ready: accountsReady } = useSocialAccount()
  const connectedNames = STUDIO_PLATFORMS
    .filter(platform => account?.connections?.[platform.id]?.connected)
    .map(platform => account?.connections?.[platform.id]?.label || platform.label)
  const journeyById = new Map(journeys.map(journey => [journey.id, journey]))
  const drafts = packages
    .filter(pkg => !pkg.published_at)
    .sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at))
  const inJourneys = packages.filter(pkg => pkg.journey_id).length

  return (
    <StudioFrame
      title="Create content from your impact"
      subtitle="Turn logged photos and updates into posts you can keep, or schedule once an account is connected."
    >
      {error && <InlineAlert tone="warning" className="mb-4">{error}</InlineAlert>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 items-stretch">
        <section className="studio-hero p-6 sm:p-8 flex flex-col justify-center min-h-[220px]">
          <h2 className="font-fraunces text-[30px] sm:text-[34px] font-medium leading-tight">Create a post</h2>
          <p className="mt-2 text-[15px] text-white/75 max-w-md leading-relaxed">
            A post can stand on its own, or live in a journey as an update.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link to="/studio/new" state={{ studioStart: 'diy' }} className="studio-hero-btn">
              <FolderOpen className="w-4 h-4" /> Choose materials yourself
            </Link>
            <Link to="/studio/new" state={{ studioStart: 'nexus' }} className="studio-hero-btn studio-hero-btn-mint">
              <Sparkles className="w-4 h-4" /> Draft with Nexus
            </Link>
          </div>
        </section>

        <StudioPanel className="p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-[15px] font-semibold text-[#1C2B24]">Upcoming posts</h2>
            <Link to="/studio/calendar" className="text-[12px] font-medium text-[#2A6B4A]">Calendar</Link>
          </div>
          <div className="flex-1 flex flex-col justify-center py-4">
            <p className="text-sm font-medium text-[#1C2B24]">Nothing scheduled</p>
            <p className="mt-1 text-[13px] text-secondary-500 leading-relaxed">
              Scheduled posts show up here after you connect an account.
            </p>
          </div>
        </StudioPanel>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          return (
            <div key={step.title} className="studio-panel px-4 py-4">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#E7F3DF] text-[#14352A] text-[12px] font-semibold inline-flex items-center justify-center">
                  {index + 1}
                </span>
                <Icon className="w-3.5 h-3.5 text-[#2A6B4A]" />
              </div>
              <p className="mt-3 text-[14px] font-semibold text-[#1C2B24]">{step.title}</p>
              <p className="mt-1 text-[12px] text-secondary-500 leading-relaxed">{step.body}</p>
            </div>
          )
        })}
      </div>

      <StudioPanel className="mt-4 px-4 py-3 flex flex-wrap items-center gap-3">
        {!accountsReady ? (
          <span className="h-3 w-56 rounded-full bg-[#E7F3DF] animate-pulse" />
        ) : (
          <p className="text-[13px] text-secondary-600">
            {connectedNames.length ? `Connected: ${connectedNames.join(', ')}` : 'Instagram, Facebook, and LinkedIn are not connected.'}
          </p>
        )}
        <Link to="/studio/accounts" className="ml-auto text-[13px] font-semibold text-[#2A6B4A]">Connect</Link>
      </StudioPanel>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 mt-8 items-start">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[18px] font-semibold text-[#1C2B24]">In progress</h2>
            <Link to="/studio/library" className="text-[13px] font-medium text-[#2A6B4A]">View all</Link>
          </div>
          {loading ? (
            <SectionLoader />
          ) : drafts.length === 0 ? (
            <StudioPanel className="px-5 py-8">
              <p className="text-sm font-medium text-[#1C2B24]">No drafts yet</p>
              <p className="mt-1 text-[13px] text-secondary-500">Create a post and it will sit here until you schedule it.</p>
            </StudioPanel>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {drafts.slice(0, 3).map(pkg => {
                const journey = pkg.journey_id ? journeyById.get(pkg.journey_id) : undefined
                return (
                  <Link key={pkg.id} to={`/studio/post/${pkg.id}`} className="studio-panel overflow-hidden block">
                    <div className="relative h-36 bg-[#E7F3DF]">
                      {pkg.image_url && <img src={pkg.image_url} alt="" className="w-full h-full object-cover" />}
                      <span className="absolute top-2.5 left-2.5 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-medium text-[#14352A]">
                        Draft
                      </span>
                    </div>
                    <div className="px-3.5 py-3">
                      <p className="text-[15px] font-semibold text-[#1C2B24] leading-snug line-clamp-2">{pkg.hook || 'Untitled post'}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[12px] text-secondary-500 truncate">
                          {journey?.title || 'Post'}
                          {' · '}
                          {formatDate(pkg.updated_at || pkg.created_at, { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="text-[12px] font-semibold text-[#2A6B4A] flex-shrink-0">Continue</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <StudioPanel className="p-5">
          <h2 className="text-[15px] font-semibold text-[#1C2B24]">Quick results</h2>
          <p className="mt-0.5 text-[12px] text-secondary-500">From the posts in this studio</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Drafts" value={loading ? '–' : String(drafts.length)} />
            <Stat label="Journeys" value={loading ? '–' : String(inJourneys)} />
            <Stat label="Scheduled" value="–" />
          </div>
          <p className="mt-3 text-[12px] text-secondary-400 leading-relaxed">
            Reach and likes appear here after an account is connected.
          </p>
        </StudioPanel>
      </div>
    </StudioFrame>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#F3F6F1] px-2 py-3 text-center">
      <p className="font-fraunces text-[26px] leading-none text-[#1C2B24]">{value}</p>
      <p className="mt-1.5 text-[11px] text-secondary-500">{label}</p>
    </div>
  )
}
