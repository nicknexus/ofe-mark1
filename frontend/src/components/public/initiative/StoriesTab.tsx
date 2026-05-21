import { Link } from 'react-router-dom'
import { useOrgLinkBase } from '../../../hooks/useOrgLinkBase'
import { BookOpen, Calendar, FileText, MapPin } from 'lucide-react'
import { PublicMetricTag, PublicStory } from '../../../services/publicApi'
import PublicTagChip from '../PublicTagChip'
import { formatDate } from '../../../utils'
import { EmptyState, LoadingState } from './PublicInitiativeTabStates'

export function StoriesTab({ stories, orgSlug, initiativeSlug, dateQS = '', tagsById, onTagClick, selectedTagIds }: {
    stories: PublicStory[] | null
    orgSlug: string
    initiativeSlug: string
    dateQS?: string
    tagsById?: Map<string, PublicMetricTag>
    onTagClick?: (id: string) => void
    selectedTagIds?: string[]
}) {
    const orgLinkBase = useOrgLinkBase()
    if (!stories) return <LoadingState />
    if (stories.length === 0) return <EmptyState icon={BookOpen} message="No stories available yet." />

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {stories.map((story) => (
                <Link
                    key={story.id}
                    to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/story/${story.id}${dateQS}`}
                    className="rounded-2xl overflow-hidden group bg-white border border-gray-200/80 shadow-public hover:shadow-public-hover hover:border-gray-300 transition-all"
                >
                    <div className="h-44 bg-gradient-to-br from-accent/10 to-accent/5 overflow-hidden">
                        {story.media_url && /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(story.media_url) ? (
                            <div className="relative w-full h-full">
                                <img src={`https://img.youtube.com/vi/${(story.media_url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/) || [])[1]}/hqdefault.jpg`} alt={story.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                                        <svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                    </div>
                                </div>
                            </div>
                        ) : story.media_url && story.media_type === 'photo' ? (
                            <img src={story.media_url} alt={story.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : story.media_type === 'video' && story.media_url ? (
                            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                                <FileText className="w-12 h-12 text-white/30" />
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <FileText className="w-12 h-12 text-accent/30" />
                            </div>
                        )}
                    </div>
                    <div className="p-4">
                        <h3 className="font-semibold text-foreground mb-2 group-hover:text-accent transition-colors">{story.title}</h3>
                        {story.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{story.description}</p>}
                        {tagsById && story.tag_ids && story.tag_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2" onClick={(e) => e.preventDefault()}>
                                {story.tag_ids.slice(0, 4).map(id => {
                                    const t = tagsById.get(id)
                                    if (!t) return null
                                    return (
                                        <PublicTagChip
                                            key={id}
                                            name={t.name}
                                            size="sm"
                                            selected={selectedTagIds?.includes(id)}
                                            onClick={onTagClick ? () => onTagClick(id) : undefined}
                                        />
                                    )
                                })}
                                {story.tag_ids.length > 4 && (
                                    <span className="text-xs text-muted-foreground px-1">+{story.tag_ids.length - 4}</span>
                                )}
                            </div>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-accent" />{formatDate(story.date_represented)}</span>
                            {(story.locations?.length || story.location?.name) && (
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-3.5 h-3.5 text-accent" />
                                    {story.locations?.length
                                        ? story.locations.map((l: any) => l.name).join(', ')
                                        : story.location?.name}
                                </span>
                            )}
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    )
}
