import { useState } from 'react'
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, Repeat2, Send, Share2, ThumbsUp } from 'lucide-react'

export type PreviewPlatform = 'instagram' | 'facebook' | 'linkedin'

const LIMIT: Record<PreviewPlatform, number> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
}

const LABEL: Record<PreviewPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
}

export function socialCaption(parts: Array<string | null | undefined>) {
  return parts.map(part => (part || '').trim()).filter(Boolean).join('\n\n')
}

function Avatar({ name, image }: { name: string; image?: string | null }) {
  if (image) return <img src={image} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
  return (
    <span className="h-7 w-7 rounded-full bg-[#E7F3DF] text-[#14352A] text-[11px] font-semibold inline-flex items-center justify-center flex-shrink-0">
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  )
}

export default function SocialPostPreview({
  caption,
  media,
  profileName,
  profileImage,
  names,
}: {
  caption: string
  media: { url: string }[]
  profileName: string
  profileImage?: string | null
  names?: Partial<Record<PreviewPlatform, string | null>>
}) {
  const [platform, setPlatform] = useState<PreviewPlatform>('instagram')
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const who = names?.[platform] || profileName || 'Your account'
  const photo = media[Math.min(index, Math.max(media.length - 1, 0))]
  const limit = LIMIT[platform]
  const over = caption.length > limit
  const textFirst = platform !== 'instagram'

  const frame = (
    <div className={`relative overflow-hidden bg-[#E7F3DF] ${platform === 'instagram' ? 'aspect-square' : 'aspect-[1.91/1]'}`}>
      {photo ? (
        <img src={photo.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-secondary-400">No photo on this post</div>
      )}
      {media.length > 1 && (
        <>
          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 text-[#14352A] inline-flex items-center justify-center"
            onClick={() => setIndex(current => (current - 1 + media.length) % media.length)}
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 text-[#14352A] inline-flex items-center justify-center"
            onClick={() => setIndex(current => (current + 1) % media.length)}
            aria-label="Next photo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="absolute bottom-2 right-2 rounded-full bg-black/55 text-white text-[11px] px-2 py-0.5">
            {Math.min(index, media.length - 1) + 1} / {media.length}
          </span>
        </>
      )}
    </div>
  )

  const words = caption ? (
    <div>
      <p className={`text-[13px] leading-snug text-[#1C2B24] whitespace-pre-wrap break-words ${open ? '' : 'line-clamp-3'}`}>
        {platform === 'instagram' && <span className="font-semibold mr-1">{who}</span>}
        {caption}
      </p>
      {caption.length > 80 && (
        <button type="button" className="mt-1 text-[12px] font-semibold text-secondary-400" onClick={() => setOpen(value => !value)}>
          {open ? 'Less' : 'More'}
        </button>
      )}
    </div>
  ) : (
    <p className="text-[12px] font-medium text-amber-800">No caption yet. The photo would post alone.</p>
  )

  return (
    <div className="studio-panel overflow-hidden max-w-[340px]">
      <div className="flex flex-wrap gap-1.5 p-2.5">
        {(['instagram', 'facebook', 'linkedin'] as const).map(id => (
          <button
            key={id}
            type="button"
            onClick={() => { setPlatform(id); setIndex(0); setOpen(false) }}
            className={`studio-pill h-8 ${platform === id ? 'studio-pill-on' : ''}`}
          >
            {LABEL[id]}
          </button>
        ))}
      </div>
      <div className="border-t border-[#14352A]/[0.06]">
        <div className="flex items-center gap-2 px-3 py-2">
          <Avatar name={who} image={profileImage} />
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold text-[#1C2B24] truncate">{who}</span>
            <span className="block text-[11px] text-secondary-400">{LABEL[platform]}</span>
          </span>
        </div>
        {textFirst && <div className="px-3 pb-2">{words}</div>}
        {frame}
        <div className="px-3 py-2 flex items-center gap-3 text-[#14352A]">
          {platform === 'linkedin' ? (
            <>
              <ThumbsUp className="w-4 h-4" />
              <MessageCircle className="w-4 h-4" />
              <Repeat2 className="w-4 h-4" />
              <Send className="w-4 h-4" />
            </>
          ) : platform === 'facebook' ? (
            <>
              <ThumbsUp className="w-4 h-4" />
              <MessageCircle className="w-4 h-4" />
              <Share2 className="w-4 h-4" />
            </>
          ) : (
            <>
              <Heart className="w-4 h-4" />
              <MessageCircle className="w-4 h-4" />
              <Send className="w-4 h-4" />
              <Bookmark className="w-4 h-4 ml-auto" />
            </>
          )}
        </div>
        {!textFirst && <div className="px-3 pb-2.5">{words}</div>}
      </div>
      <div className="px-3 pb-3">
        <p className="text-[11px] text-secondary-400 leading-snug">
          Caption under the photo, not printed on it.
        </p>
        <p className={`mt-1 text-[11px] ${over ? 'font-semibold text-red-700' : 'text-secondary-400'}`}>
          {over ? `${caption.length} / ${limit}` : `${caption.length} characters`}
        </p>
      </div>
    </div>
  )
}
