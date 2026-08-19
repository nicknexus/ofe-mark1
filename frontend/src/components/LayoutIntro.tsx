import React, { useEffect, useState } from 'react'
import { Compass } from 'lucide-react'
import ModalFrame, { ModalBody, ModalFooter, ModalHeader } from './ModalFrame'
import { useOnboarding } from '../context/OnboardingContext'
import { useTutorial } from '../context/TutorialContext'
import { supabase } from '../services/supabase'
import {
  LAYOUT_INTRO_SESSION,
  LAYOUT_INTRO_VERSION,
  hasSeenLayoutIntro,
  markLayoutIntroSeenLocal,
} from '../lib/layoutIntro'

const SECTIONS = [
  {
    kicker: 'Home',
    title: 'Your org at a glance',
    body: 'Next steps, shortcuts, and whether the public page is live.',
    accent: 'text-secondary-800 bg-gray-100',
  },
  {
    kicker: 'Tracking',
    title: 'Prove it',
    body: 'Initiatives, metrics, locations, tags, and evidence. This is the work.',
    accent: 'text-primary-800 bg-primary-50',
  },
  {
    kicker: 'Share',
    title: 'Go live',
    body: 'Public page, organization, context, and embed. Turn tracking into something people can see.',
    accent: 'text-claim-700 bg-claim-50',
  },
] as const

/**
 * One-shot welcome-back for people who already had an account before the
 * sidebar split. New signups skip it (stamped on onboarding complete).
 */
export default function LayoutIntro() {
  const { isActive: onboardingActive } = useOnboarding()
  const { isActive: tutorialActive } = useTutorial()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return
    if (hasSeenLayoutIntro()) return
    if (onboardingActive || tutorialActive) return

    let cancelled = false
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const onboarded = user?.user_metadata?.has_completed_onboarding === true
        const seen = Number(user?.user_metadata?.layout_intro_seen ?? 0)
        if (seen >= LAYOUT_INTRO_VERSION) {
          markLayoutIntroSeenLocal()
          return
        }
        // New accounts go through onboarding, not this "welcome back".
        if (!onboarded) return
      } catch {
        return
      }
      if (!cancelled) {
        try { sessionStorage.setItem(LAYOUT_INTRO_SESSION, '1') } catch { /* ignore */ }
        setOpen(true)
      }
    }

    const t = window.setTimeout(run, 700)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [onboardingActive, tutorialActive])

  const dismiss = async () => {
    setOpen(false)
    markLayoutIntroSeenLocal()
    try {
      await supabase.auth.updateUser({ data: { layout_intro_seen: LAYOUT_INTRO_VERSION } })
    } catch (error) {
      console.error('Error marking layout intro seen:', error)
    }
  }

  if (!open) return null

  return (
    <ModalFrame zIndexClass="z-[90]" size="lg" onClose={dismiss}>
      <ModalHeader title="Nexus has a new layout" />
      <ModalBody>
        <p className="text-sm text-secondary-500 leading-relaxed -mt-1 mb-5">
          <span className="font-semibold text-primary-800 bg-primary-50 px-1.5 py-0.5 rounded-md">Tracking</span>
          {' '}is where you prove the work.{' '}
          <span className="font-semibold text-claim-700 bg-claim-50 px-1.5 py-0.5 rounded-md">Share</span>
          {' '}is where you publish it. Same data, easier to find.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[8.5rem_1fr] gap-4 items-stretch">
          <div className="rounded-xl border border-gray-200/80 bg-gray-50 p-2.5 hidden sm:block" aria-hidden>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary-50">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />
              <span className="text-[11px] font-semibold text-secondary-900">Home</span>
            </div>
            <p className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-primary-800">Tracking</p>
            <p className="px-2 py-0.5 text-[11px] text-secondary-600">Initiatives</p>
            <p className="px-2 py-0.5 text-[11px] text-secondary-600">Metrics</p>
            <p className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-claim-700">Share</p>
            <p className="px-2 py-0.5 text-[11px] text-secondary-600">Public page</p>
            <p className="px-2 py-0.5 text-[11px] text-secondary-600">Organization</p>
            <p className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">General</p>
            <p className="px-2 py-0.5 text-[11px] text-secondary-600 flex items-center gap-1.5">
              <Compass className="w-3 h-3 text-gray-400" /> Explore
            </p>
          </div>

          <div className="space-y-2.5">
            {SECTIONS.map(s => (
              <div key={s.kicker} className={`rounded-xl border p-4 ${
                s.kicker === 'Tracking' ? 'border-primary-200/80 bg-primary-50/30'
                  : s.kicker === 'Share' ? 'border-claim-200/80 bg-claim-50/40'
                    : 'border-gray-200/80'
              }`}>
                <span className={`inline-flex items-center h-6 px-2 rounded-md text-[10px] font-bold uppercase tracking-wide ${s.accent}`}>
                  {s.kicker}
                </span>
                <p className="text-sm font-semibold text-secondary-900 mt-2">{s.title}</p>
                <p className="text-sm text-secondary-500 mt-0.5 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-secondary-400 mt-4">
          Tutorial is still under General if you want the full walkthrough.
        </p>
      </ModalBody>
      <ModalFooter>
        <button type="button" onClick={dismiss} className="app-btn app-btn-primary ml-auto">
          Got it
        </button>
      </ModalFooter>
    </ModalFrame>
  )
}
