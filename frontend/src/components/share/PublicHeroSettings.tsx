import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Play, Trash2 } from 'lucide-react'
import { notify } from '../../lib/notify'
import { apiService } from '../../services/api'
import type { AccessibleOrganization } from '../../services/team'
import { getVideoThumbnailUrl, isValidVideoUrl } from '../../utils/videoEmbed'
import { PUBLIC_HERO_LAYOUTS_ENABLED } from './publicHeroRelease'

type HeroMode = 'classic' | 'image' | 'video'

const CHOICES: { id: HeroMode; title: string; body: string }[] = [
    { id: 'classic', title: 'Classic', body: 'The dashboard you have now. Logo, name, and description, with the globe beside them.' },
    { id: 'image', title: 'Feature image', body: 'A photo you upload fills the hero. Your name and description sit on the left.' },
    { id: 'video', title: 'Feature video', body: 'A YouTube or Vimeo link. Visitors hit play and it runs behind your name.' },
]

function HeroSketch({
    mode,
    org,
    imageUrl,
    videoUrl,
}: {
    mode: HeroMode
    org: AccessibleOrganization
    imageUrl?: string | null
    videoUrl?: string | null
}) {
    const color = org.brand_color || '#c0dfa1'
    const name = org.name || 'Your organization'
    const poster = mode === 'video' ? getVideoThumbnailUrl(videoUrl) : imageUrl
    const mark = (
        <span className="h-5 w-5 rounded-md bg-white overflow-hidden shrink-0 inline-flex items-center justify-center shadow-sm">
            {org.logo_url ? <img src={org.logo_url} alt="" className="h-full w-full object-cover" /> : <span className="text-[9px] font-semibold text-[#14352A]">{name.charAt(0)}</span>}
        </span>
    )

    if (mode === 'classic') {
        return (
            <div className="h-[128px] bg-[#F4F6F1] relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-6 bg-white border-b border-black/5 flex items-center gap-1 px-2">
                    <span className="h-2 w-8 rounded-full bg-gray-200" />
                    <span className="h-2 w-6 rounded-full bg-gray-100" />
                    <span className="h-2 w-5 rounded-full bg-gray-100" />
                </div>
                <div className="absolute left-2.5 top-9 right-[46%] bottom-2 flex flex-col justify-center gap-1.5">
                    <span className="flex items-center gap-1.5 min-w-0">
                        {mark}
                        <span className="text-[10px] font-semibold text-[#1C2B24] truncate">{name}</span>
                    </span>
                    <span className="h-1.5 w-4/5 rounded-full bg-[#1C2B24]/15" />
                    <span className="h-1.5 w-3/5 rounded-full bg-[#1C2B24]/10" />
                </div>
                <div
                    className="absolute right-[-8%] top-8 h-[108px] w-[108px] rounded-full"
                    style={{ background: `radial-gradient(circle at 38% 38%, #fff, ${color} 42%, ${color}99 70%)` }}
                />
            </div>
        )
    }

    return (
        <div className="h-[128px] relative overflow-hidden bg-[#14352A]">
            {poster ? (
                <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
                <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${color}, #14352A 70%)` }} />
            )}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(8,14,11,0.88) 0%, rgba(8,14,11,0.45) 46%, rgba(8,14,11,0.05) 100%)' }} />
            <div className="absolute left-2.5 top-0 bottom-0 flex items-center gap-1.5 max-w-[58%]">
                {mark}
                <span className="min-w-0">
                    <span className="block text-[10px] font-semibold text-white truncate">{name}</span>
                    <span className="mt-1 block h-1.5 w-16 rounded-full bg-white/40" />
                </span>
            </div>
            {mode === 'video' && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white text-[#0b1410] inline-flex items-center justify-center shadow">
                    <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
                </span>
            )}
        </div>
    )
}

export function PublicHeroSettings({
    org,
    canEdit,
    storyVideo,
    onSaved,
}: {
    org: AccessibleOrganization
    canEdit: boolean
    storyVideo?: string
    onSaved: () => Promise<void>
}) {
    const [hero, setHero] = useState<{ public_hero: HeroMode; hero_image_url: string | null; hero_video_url: string | null; ready: boolean } | null>(null)
    const [videoDraft, setVideoDraft] = useState('')
    const [busy, setBusy] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const load = async () => {
        if (!org.id) return
        const next = await apiService.getPublicHero(org.id)
        const mode: HeroMode = next.public_hero === 'image' || next.public_hero === 'video' ? next.public_hero : 'classic'
        setHero({ ...next, public_hero: mode })
        setVideoDraft(next.hero_video_url || '')
    }

    useEffect(() => {
        load().catch(() => setHero({ public_hero: 'classic', hero_image_url: null, hero_video_url: null, ready: false }))
    }, [org.id])

    const mode: HeroMode = hero?.public_hero || 'classic'
    const choices = PUBLIC_HERO_LAYOUTS_ENABLED ? CHOICES : CHOICES.filter(choice => choice.id === 'classic')
    const shownMode: HeroMode = PUBLIC_HERO_LAYOUTS_ENABLED ? mode : 'classic'

    const saveMode = async (next: HeroMode) => {
        if (!canEdit || !org.id || next === mode) return
        setBusy(true)
        try {
            await apiService.updateOrganization(org.id, { public_hero: next })
            await onSaved()
            await load()
        } catch (error) {
            notify.error((error as Error).message || 'Could not save the hero')
        } finally {
            setBusy(false)
        }
    }

    const upload = async (file: File) => {
        if (!org.id) return
        setBusy(true)
        try {
            await apiService.uploadHeroImage(org.id, file)
            if (mode !== 'image') await apiService.updateOrganization(org.id, { public_hero: 'image' })
            await onSaved()
            await load()
            notify.success('Hero image saved')
        } catch (error) {
            notify.error((error as Error).message || 'Could not upload the image')
        } finally {
            setBusy(false)
        }
    }

    const removeImage = async () => {
        if (!org.id) return
        setBusy(true)
        try {
            await apiService.deleteHeroImage(org.id)
            await onSaved()
            await load()
        } catch (error) {
            notify.error((error as Error).message || 'Could not remove the image')
        } finally {
            setBusy(false)
        }
    }

    const saveVideo = async () => {
        if (!org.id) return
        const trimmed = videoDraft.trim()
        if (trimmed && !isValidVideoUrl(trimmed)) {
            notify.error('Use a YouTube or Vimeo link')
            return
        }
        setBusy(true)
        try {
            await apiService.updateOrganization(org.id, { hero_video_url: trimmed, public_hero: 'video' })
            await onSaved()
            await load()
            notify.success(trimmed ? 'Hero video saved' : 'Hero video cleared')
        } catch (error) {
            notify.error((error as Error).message || 'Could not save the video')
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="app-card p-6 sm:p-8 mt-4">
            <h2 className="text-[15px] font-semibold text-secondary-900">Hero</h2>
            <p className="text-sm text-secondary-500 mt-1">
                {PUBLIC_HERO_LAYOUTS_ENABLED
                    ? 'How the top of the public page looks. Image and video only show after you set them here.'
                    : 'How the top of the public page looks.'}
            </p>
            {PUBLIC_HERO_LAYOUTS_ENABLED && hero && !hero.ready && (
                <p className="mt-3 text-sm text-amber-800">Hero settings are not available until the database update is applied.</p>
            )}
            <div className={`mt-5 grid grid-cols-1 gap-3 ${choices.length > 1 ? 'md:grid-cols-3' : 'max-w-sm'}`}>
                {choices.map(choice => {
                    const selected = shownMode === choice.id
                    return (
                        <button
                            key={choice.id}
                            type="button"
                            disabled={!PUBLIC_HERO_LAYOUTS_ENABLED || !canEdit || busy || !hero?.ready}
                            onClick={() => saveMode(choice.id)}
                            className={`text-left rounded-2xl border overflow-hidden transition-colors ${selected ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-400' : 'border-gray-200 hover:border-gray-300'} ${PUBLIC_HERO_LAYOUTS_ENABLED ? 'disabled:opacity-60' : 'disabled:opacity-100 cursor-default'}`}
                        >
                            <HeroSketch mode={choice.id} org={org} imageUrl={hero?.hero_image_url} videoUrl={hero?.hero_video_url} />
                            <span className="block px-4 pt-3 text-sm font-semibold text-secondary-900">{choice.title}</span>
                            <span className="block px-4 pt-1 pb-4 text-[13px] leading-relaxed text-secondary-500">{choice.body}</span>
                        </button>
                    )
                })}
            </div>

            {PUBLIC_HERO_LAYOUTS_ENABLED && mode === 'image' && (
                <div className="mt-6">
                    {hero?.hero_image_url ? (
                        <img src={hero.hero_image_url} alt="" className="h-40 w-full max-w-md object-cover rounded-2xl border border-gray-100" />
                    ) : (
                        <p className="text-sm text-amber-800">The live page stays on Classic until an image is saved.</p>
                    )}
                    {canEdit && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={event => {
                                    const file = event.target.files?.[0]
                                    if (file) upload(file)
                                    event.target.value = ''
                                }}
                            />
                            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="app-btn app-btn-secondary">
                                <ImagePlus className="w-4 h-4" />
                                {hero?.hero_image_url ? 'Replace image' : 'Upload image'}
                            </button>
                            {hero?.hero_image_url && (
                                <button type="button" disabled={busy} onClick={removeImage} className="app-btn app-btn-ghost">
                                    <Trash2 className="w-4 h-4" />
                                    Remove
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {PUBLIC_HERO_LAYOUTS_ENABLED && mode === 'video' && (
                <div className="mt-6 max-w-xl">
                    {!isValidVideoUrl(hero?.hero_video_url) && (
                        <p className="text-sm text-amber-800 mb-3">The live page stays on Classic until a video link is saved.</p>
                    )}
                    <label className="app-label" htmlFor="hero-video">YouTube or Vimeo link</label>
                    <input
                        id="hero-video"
                        className="app-input"
                        value={videoDraft}
                        disabled={!canEdit || busy}
                        placeholder="https://www.youtube.com/watch?v=..."
                        onChange={event => setVideoDraft(event.target.value)}
                    />
                    {canEdit && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" disabled={busy} onClick={saveVideo} className="app-btn app-btn-primary">Save video</button>
                            {storyVideo && isValidVideoUrl(storyVideo) && videoDraft.trim() !== storyVideo.trim() && (
                                <button type="button" disabled={busy} onClick={() => setVideoDraft(storyVideo)} className="app-btn app-btn-ghost">
                                    Use the Our story video
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}
