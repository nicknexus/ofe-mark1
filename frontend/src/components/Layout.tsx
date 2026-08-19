import React, { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { User } from '../types'
import AppSidebar from './AppSidebar'

interface LayoutProps {
  user: User
  children: ReactNode
}

export default function Layout({ user, children }: LayoutProps) {
  const location = useLocation()
  // Initiative workspace keeps its own sidebar. Org chrome disappears until they go back.
  const isInitiativePage = location.pathname.startsWith('/initiatives')

  return (
    <div className="min-h-screen">
      {!isInitiativePage && <AppSidebar user={user} />}
      <main className={`relative app-canvas ${isInitiativePage ? 'min-h-screen' : 'min-h-screen ml-56 desktop-main-offset'}`}>
        {children}
      </main>
    </div>
  )
}
