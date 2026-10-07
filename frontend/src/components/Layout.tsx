import React, { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { User } from '../types'
import AppSidebar from './AppSidebar'

interface LayoutProps {
  user: User
  children: ReactNode
}

const PAGE_EASE = [0.22, 1, 0.36, 1] as const

function pageKey(pathname: string) {
  if (pathname.startsWith('/share/content')) return '/share/content'
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
  const content = pathname.startsWith('/share/content')
  // The org sidebar stays on every authenticated page, program workspace
  // included, so the rest of the app is always one click away.
  return (
    <div className="min-h-screen">
      <AppSidebar user={user} />
      <motion.main
        className="relative min-h-screen ml-56 desktop-main-offset overflow-x-hidden"
        initial={false}
        animate={{ backgroundColor: content ? '#42505B' : '#F7F8FA' }}
        transition={{ duration: reduce ? 0 : content ? 0.8 : 0.55, ease: PAGE_EASE }}
      >
        <PageFade content={content}>{children}</PageFade>
      </motion.main>
    </div>
  )
}
