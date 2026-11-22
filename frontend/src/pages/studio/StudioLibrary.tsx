import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Plus, Search } from 'lucide-react'
import { InlineAlert, SectionLoader } from '../../components/ui'
import { filterPosts } from '../../components/content/ContentWorkspace'
import { formatDate } from '../../utils'
import { SocialMarks, StudioFrame, StudioPanel, socialSendLabel } from './StudioFrame'
import { useStudioLibrary } from './useStudioLibrary'

type LibraryFilter = 'all' | 'draft' | 'public'

const FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'public', label: 'Posted' },
]

export default function StudioLibrary() {
  const { packages, loading, error } = useStudioLibrary()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LibraryFilter>('all')

  const visible = useMemo(() => {
    const status = filter === 'draft' ? 'draft' : filter === 'public' ? 'published' : 'all'
    return filterPosts(packages, query, 'all', status, 'all')
  }, [packages, query, filter])

  return (
    <StudioFrame
      brand
      title="Library"
      subtitle="Every post you have drafted."
      actions={
        <Link to="/studio/new" state={{ studioStart: 'diy', from: '/studio/library' }} className="studio-hero-btn studio-hero-btn-mint">
          <Plus className="w-4 h-4" /> Create a post
        </Link>
      }
    >
      {error && <InlineAlert tone="warning" className="mb-4">{error}</InlineAlert>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {FILTERS.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`studio-pill ${filter === item.id ? 'studio-pill-on' : ''}`}
          >
            {item.label}
          </button>
        ))}
        <div className="relative w-full sm:w-56 sm:ml-auto">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
          <input
            className="app-input h-9 pl-8 text-[13px]"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search posts"
          />
        </div>
      </div>

      {loading && packages.length === 0 ? (
        <SectionLoader />
      ) : packages.length === 0 ? (
        <StudioPanel className="px-6 py-12 text-center">
          <Camera className="w-5 h-5 mx-auto studio-accent-text" />
          <p className="mt-3 text-sm font-semibold studio-ink-text">No posts yet</p>
          <p className="mt-1 text-[13px] text-secondary-500">Create one and it will show up in this list.</p>
        </StudioPanel>
      ) : visible.length === 0 ? (
        <StudioPanel className="px-6 py-12 text-center">
          <p className="text-sm font-semibold studio-ink-text">Nothing matches</p>
          <button type="button" className="studio-pill mt-3" onClick={() => { setQuery(''); setFilter('all') }}>Clear</button>
        </StudioPanel>
      ) : (
        <StudioPanel className="divide-y divide-[color-mix(in_srgb,var(--studio-ink)_8%,transparent)]">
          {visible.map(pkg => {
            const sent = socialSendLabel(pkg.publications)
            return (
              <div key={pkg.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--studio-teal-wash)] transition-colors">
                <Link to={`/studio/post/${pkg.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                  {pkg.image_url ? (
                    <img src={pkg.image_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <span className="w-14 h-14 rounded-xl studio-teal-wash flex-shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold studio-ink-text truncate">{pkg.hook || 'Untitled post'}</span>
                    <span className="block text-[12px] text-secondary-500 truncate mt-0.5">
                      {formatDate(pkg.updated_at || pkg.created_at, { month: 'short', day: 'numeric' })}
                      {sent ? ` · ${sent}` : ''}
                    </span>
                  </span>
                </Link>
                <span className="ml-auto flex items-center gap-2 flex-shrink-0">
                  <SocialMarks items={pkg.publications} />
                  <span className={`inline-flex h-7 w-[108px] items-center justify-center rounded-full text-[12px] font-medium border ${
                    pkg.published_at ? 'bg-[var(--studio-green)] text-white border-transparent' : 'bg-white text-[var(--studio-ink)] border-[color-mix(in_srgb,var(--studio-ink)_10%,transparent)]'
                  }`}>
                    {pkg.published_at ? 'Posted' : 'Draft'}
                  </span>
                  <Link to={`/studio/post/${pkg.id}`} className="app-btn app-btn-secondary app-btn-sm w-[132px] justify-center">
                    Post to socials
                  </Link>
                </span>
              </div>
            )
          })}
        </StudioPanel>
      )}
    </StudioFrame>
  )
}
