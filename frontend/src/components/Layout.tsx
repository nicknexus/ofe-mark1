import React, { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
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
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key}
        initial={reduce || content ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.16, ease: PAGE_EASE } }}
        transition={content
          ? { duration: 0 }
          : { duration: 0.32, delay: reduce ? 0 : 0.2, ease: PAGE_EASE }}
        className="min-h-screen"
      >
        {children}
      </motion.div>
    </AnimatePresence>
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
