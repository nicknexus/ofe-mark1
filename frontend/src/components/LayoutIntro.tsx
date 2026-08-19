import React, { useEffect, useState } from 'react'
import { Compass, LayoutDashboard } from 'lucide-react'
import ModalFrame, { ModalBody, ModalFooter, ModalHeader } from './ModalFrame'
import { useOnboarding } from '../context/OnboardingContext'
import { useTutorial } from '../context/TutorialContext'
import { supabase } from '../services/supabase'
import {
  LAYOUT_INTRO_VERSION,
  beginLayoutIntroCheck,
  endLayoutIntroCheck,
  introStorageKey,
  markLayoutIntroSeenLocal,
} from '../lib/layoutIntro'

/**
 * Versioned "What's New" for existing accounts. New signups skip it (stamped
 * on onboarding complete at the current LAYOUT_INTRO_VERSION).
 */
export default function LayoutIntro() {
  const { isActive: onboardingActive } = useOnboarding()
  const { isActive: tutorialActive } = useTutorial()
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState<1 | 2>(1)

  useEffect(() => {
    beginLayoutIntroCheck()
    if (onboardingActive || tutorialActive) return

    let cancelled = false
    const run = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled) return
        if (!user) {
          endLayoutIntroCheck(false)
          return
        }
        const seen = Number(user.user_metadata?.layout_intro_seen ?? 0)
        let localSeen = 0
        try {
          localSeen = Number(localStorage.getItem(introStorageKey(user.id)) || 0)
        } catch {
          localSeen = 0
        }
        if (seen >= LAYOUT_INTRO_VERSION || localSeen >= LAYOUT_INTRO_VERSION) {
          markLayoutIntroSeenLocal(user.id)
          endLayoutIntroCheck(false)
          return
        }
        endLayoutIntroCheck(true)
        if (!cancelled) setOpen(true)
      } catch {
        endLayoutIntroCheck(false)
      }
    }

    const t = window.setTimeout(run, 500)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [onboardingActive, tutorialActive])

  const dismiss = async () => {
    setOpen(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      markLayoutIntroSeenLocal(user?.id)
    } catch {
      markLayoutIntroSeenLocal()
    }
    try {
      await supabase.auth.updateUser({ data: { layout_intro_seen: LAYOUT_INTRO_VERSION } })
    } catch (error) {
      console.error('Error marking layout intro seen:', error)
    }
  }

  if (!open) return null

  return (
    <ModalFrame zIndexClass="z-[90]" size="md" onClose={dismiss}>
      <ModalHeader title={page === 1 ? "What's new" : 'One more thing'} />
      <ModalBody>
        <div className="flex items-center gap-1.5 mb-6">
          <span className={`h-1.5 w-8 rounded-full ${page === 1 ? 'bg-primary-500' : 'bg-primary-200'}`} />
          <span className={`h-1.5 w-8 rounded-full ${page === 2 ? 'bg-primary-500' : 'bg-primary-200'}`} />
        </div>

        {page === 1 ? (
          <div className="space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-secondary-900 leading-tight">
              New dashboard layout
            </h2>
            <p className="text-base sm:text-lg text-secondary-600 leading-relaxed">
              Everything is easier to find.{' '}
              <span className="font-semibold text-primary-800 bg-primary-50 px-1.5 py-0.5 rounded-md">Tracking</span>
              {' '}is where you prove the work.{' '}
              <span className="font-semibold text-claim-700 bg-claim-50 px-1.5 py-0.5 rounded-md">Share</span>
              {' '}is where you publish it.
            </p>
            <div className="rounded-xl border border-gray-200/80 bg-gray-50 p-3 hidden sm:block max-w-[11rem]" aria-hidden>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary-50">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />
                <span className="text-[11px] font-semibold text-secondary-900">Home</span>
              </div>
              <p className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-primary-800">Tracking</p>
              <p className="px-2 py-0.5 text-[11px] text-secondary-600">Programs</p>
              <p className="px-2 py-0.5 text-[11px] text-secondary-600">Metrics</p>
              <p className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-claim-700">Share</p>
              <p className="px-2 py-0.5 text-[11px] text-secondary-600">Public page</p>
              <p className="px-2 py-0.5 text-[11px] text-secondary-600">Organization</p>
              <p className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">General</p>
              <p className="px-2 py-0.5 text-[11px] text-secondary-600 flex items-center gap-1.5">
                <Compass className="w-3 h-3 text-gray-400" /> Explore
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            <p className="text-sm font-semibold uppercase tracking-wider text-secondary-400">Rename</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-secondary-900 leading-tight">
              Initiatives
              <span className="block text-lg sm:text-xl font-semibold text-secondary-400 mt-2">are now</span>
              <span className="block text-primary-700 mt-1">Programs</span>
            </h2>
            <p className="text-base sm:text-lg text-secondary-600 leading-relaxed">
              Same work, clearer name. Your data and public links stay the same.
            </p>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        {page === 1 ? (
          <button type="button" onClick={() => setPage(2)} className="app-btn app-btn-primary ml-auto">
            Next
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setPage(1)} className="app-btn app-btn-ghost">
              Back
            </button>
            <button type="button" onClick={dismiss} className="app-btn app-btn-primary ml-auto">
              Got it
            </button>
          </>
        )}
      </ModalFooter>
    </ModalFrame>
  )
}
