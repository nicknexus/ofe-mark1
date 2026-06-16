import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { supabase } from '../services/supabase'

interface OnboardingContextType {
  /** Whether the full-screen wizard is currently mounted/visible. */
  isActive: boolean
  /** True once the user has finished or skipped onboarding (persisted to user_metadata). */
  hasCompletedOnboarding: boolean
  /** Launch the wizard manually (e.g. from the dashboard "Set up" entry point). */
  startOnboarding: () => void
  /** Close the wizard without marking complete (lets the user resume later). */
  pauseOnboarding: () => void
  /** Close the wizard and persist completion so it never auto-launches again. */
  completeOnboarding: () => Promise<void>
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

interface OnboardingProviderProps {
  children: ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const [isActive, setIsActive] = useState(false)
  // Assume completed until we learn otherwise — avoids a flash of the wizard
  // for established users while the auth lookup resolves.
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(true)

  useEffect(() => {
    checkOnboardingStatus()
  }, [])

  const checkOnboardingStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const completed = user.user_metadata?.has_completed_onboarding === true
      setHasCompletedOnboarding(completed)

      if (!completed) {
        // Small delay so the dashboard paints behind the overlay first,
        // matching the old tutorial's entrance timing.
        const timer = setTimeout(() => setIsActive(true), 1200)
        return () => clearTimeout(timer)
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error)
    }
  }

  const startOnboarding = useCallback(() => {
    setIsActive(true)
  }, [])

  const pauseOnboarding = useCallback(() => {
    setIsActive(false)
    // Anything created during the session should show up immediately on the
    // dashboard behind us — no manual refresh.
    window.dispatchEvent(new Event('onboarding-updated'))
  }, [])

  const completeOnboarding = useCallback(async () => {
    setIsActive(false)
    setHasCompletedOnboarding(true)
    window.dispatchEvent(new Event('onboarding-updated'))
    try {
      // Also flip the legacy tutorial flag so the old slide tour never
      // auto-fires for users who came through onboarding.
      const { error } = await supabase.auth.updateUser({
        data: { has_completed_onboarding: true, has_completed_tutorial: true },
      })
      if (error) throw error
    } catch (error) {
      console.error('Error marking onboarding complete:', error)
    }
  }, [])

  return (
    <OnboardingContext.Provider
      value={{
        isActive,
        hasCompletedOnboarding,
        startOnboarding,
        pauseOnboarding,
        completeOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return context
}
