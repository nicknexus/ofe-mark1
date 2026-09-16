import React, { ReactNode } from 'react'
import { User } from '../types'
import AppSidebar from './AppSidebar'

interface LayoutProps {
  user: User
  children: ReactNode
}

export default function Layout({ user, children }: LayoutProps) {
  // The org sidebar stays on every authenticated page, program workspace
  // included, so the rest of the app is always one click away.
  return (
    <div className="min-h-screen">
      <AppSidebar user={user} />
      <main className="relative app-canvas min-h-screen ml-56 desktop-main-offset">
        {children}
      </main>
    </div>
  )
}
