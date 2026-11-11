import React, { ReactNode, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { User } from '../types'
import AppSidebar from './AppSidebar'
import { isDarkStudioPath, isStudioComposer, isStudioMode } from '../pages/studio/studioPaths'

interface LayoutProps {
  user: User
  children: ReactNode
}

const PAGE_EASE = [0.22, 1, 0.36, 1] as const

function pageKey(pathname: string) {
  // One key for the whole composer so a draft survives new -> post -> journey.
  if (isStudioComposer(pathname) || pathname.startsWith('/share/content')) return '/studio/composer'
  // Opening a metric stays inside the program. A new key here remounts the
  // whole workspace and replays the page-enter animation on the header.
  const program = pathname.match(/^\/programs\/[^/]+/)
  if (program) return program[0]
  return pathname
}

function PageFade({ children, content }: { children: ReactNode; content: boolean }) {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  const key = pageKey(pathname)
  // CSS enter, not AnimatePresence. A zero-length presence exit never signals
  // completion, and mode="wait" then leaves the next page unmounted.
  return (
    <div key={key} className={reduce || content ? 'min-h-screen' : 'min-h-screen app-page-enter'}>
      {children}
    </div>
  )
}

export default function Layout({ user, children }: LayoutProps) {
  const { pathname } = useLocation()
  const reduce = useReducedMotion()
  const content = isStudioComposer(pathname) || pathname.startsWith('/share/content')
  const ideas = pathname.startsWith('/studio/capture') || pathname.startsWith('/share/content/capture')
  const dark = isDarkStudioPath(pathname)
  // The org sidebar stays on every authenticated page, program workspace
  // included, so the rest of the app is always one click away.
  return (
    <div className="min-h-screen">
      <AppSidebar user={user} />
      <motion.main
        className="relative min-h-screen ml-56 desktop-main-offset overflow-x-hidden"
        initial={false}
        animate={{ backgroundColor: ideas ? '#1a2228' : dark ? '#42505B' : isStudioMode(pathname) ? '#F3F6F1' : '#F7F8FA' }}
        transition={{ duration: reduce ? 0 : content ? 0.8 : 0.55, ease: PAGE_EASE }}
      >
        <PageFade content={content}>
          <Suspense fallback={<div className="min-h-screen" />}>{children}</Suspense>
        </PageFade>
      </motion.main>
    </div>
  )
}
