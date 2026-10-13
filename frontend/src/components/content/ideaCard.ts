import { Armchair, CircleDot, History, Image as ImageIcon, MapPin, Sparkles, TrendingUp, Video } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ContentIdeaCard, ContentIdeaCardV2, IdeaFilmingCategory, IdeaLens } from '../../types'

export const LENS_ORDER: IdeaLens[] = ['back', 'now', 'surprise', 'ahead']

export const LENS_META: Record<IdeaLens, { label: string; icon: LucideIcon; chip: string }> = {
  back: { label: 'Looking back', icon: History, chip: 'bg-[#60A5FA]/15 text-[#93C5FD]' },
  now: { label: 'Right now', icon: CircleDot, chip: 'bg-[#34D399]/15 text-[#6EE7B7]' },
  surprise: { label: 'The surprise', icon: Sparkles, chip: 'bg-[#C084FC]/15 text-[#D8B4FE]' },
  ahead: { label: 'Looking ahead', icon: TrendingUp, chip: 'bg-[#FBBF24]/15 text-[#FCD34D]' },
}

export const FILMING_ORDER: IdeaFilmingCategory[] = ['in_action', 'sit_down', 'on_location', 'photo_quote']

export const FILMING_META: Record<IdeaFilmingCategory, { label: string; kind: string; icon: LucideIcon }> = {
  in_action: { label: 'In action', kind: 'Video', icon: Video },
  sit_down: { label: 'Sit-down chat', kind: 'Video', icon: Armchair },
  on_location: { label: 'On location', kind: 'Video', icon: MapPin },
  photo_quote: { label: 'Photo and quote', kind: 'No video', icon: ImageIcon },
}

/** Best guess at a lens for a card written before lenses existed. */
function inferLens(text: string): IdeaLens {
  const q = text.toLowerCase()
  if (/\b(before|used to|what made you|why did you)\b/.test(q)) return 'back'
  if (/\b(surprised|did not expect|didn't expect|unexpected)\b/.test(q)) return 'surprise'
  if (/\b(hope|excited|next|looking forward|still needs)\b/.test(q)) return 'ahead'
  return 'now'
}

function isV2(card: ContentIdeaCard): card is ContentIdeaCardV2 {
  return (card as ContentIdeaCardV2).v === 2
}

/** Read any stored card as a v2 card, so the UI only ever handles one shape. */
export function toCardV2(card: ContentIdeaCard): ContentIdeaCardV2 {
  if (isV2(card)) return card
  const levels: Array<[string, string[]]> = [
    ['The quick version', card.capture?.quick || []],
    ['A fuller version', card.capture?.good || []],
    ['The long version', card.capture?.story || []],
  ]
  const ideas = levels.filter(([, steps]) => steps.length > 0).map(([name, steps]) => ({ name, steps }))
  return {
    v: 2,
    title: card.title,
    why: card.why,
    who: card.who,
    questions: (card.ask || []).map(text => ({ text, lens: inferLens(text) })),
    filming: ideas.length
      ? [{ category: 'photo_quote', fit: 'A photo plus their exact words, written down as they say them.', ideas }]
      : [],
    suggested: { category: 'photo_quote', reason: 'This card was written before video plans existed.' },
    channels: card.channels || [],
    journey_potential: !!card.journey_potential,
    follow_up: card.follow_up || '',
  }
}
