import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { supabase } from '../services/supabase'

interface TutorialContextType {
 isActive: boolean
 currentSlide: number
 totalSlides: number
 startTutorial: () => void
 nextSlide: () => void
 prevSlide: () => void
 goToSlide: (index: number) => void
 closeTutorial: () => Promise<void>
 hasCompletedTutorial: boolean
 /** True when the signed-in user hasn't seen the current tutorial version yet. */
 needsTutorial: boolean
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined)

interface TutorialProviderProps {
 children: ReactNode
}

/**
 * Bump this when the tutorial content changes enough that everyone should see it
 * again. We gate on a *version* (stored in user_metadata) rather than a boolean,
 * so raising this number re-shows the tour for all users on their next login —
 * no database migration required. Existing users have no `tutorial_version_seen`
 * field, so they're treated as "unseen" the first time this ships.
 */
export const TUTORIAL_VERSION = 2

const TOTAL_SLIDES = 7

export function TutorialProvider({ children }: TutorialProviderProps) {
 const [isActive, setIsActive] = useState(false)
 const [currentSlide, setCurrentSlide] = useState(0)
 const [hasCompletedTutorial, setHasCompletedTutorial] = useState(true)
 const [needsTutorial, setNeedsTutorial] = useState(false)

 useEffect(() => {
 checkTutorialStatus()
 }, [])

 const checkTutorialStatus = async () => {
 try {
 const { data: { user } } = await supabase.auth.getUser()
 if (user) {
 const seenVersion = Number(user.user_metadata?.tutorial_version_seen ?? 0)
 const seen = seenVersion >= TUTORIAL_VERSION
 setHasCompletedTutorial(seen)
 setNeedsTutorial(!seen)
 }
 } catch (error) {
 console.error('Error checking tutorial status:', error)
 }
 }

 const startTutorial = useCallback(() => {
 setIsActive(true)
 setCurrentSlide(0)
 }, [])

 const nextSlide = useCallback(() => {
 setCurrentSlide(prev => Math.min(prev + 1, TOTAL_SLIDES - 1))
 }, [])

 const prevSlide = useCallback(() => {
 setCurrentSlide(prev => Math.max(prev - 1, 0))
 }, [])

 const goToSlide = useCallback((index: number) => {
 setCurrentSlide(Math.max(0, Math.min(index, TOTAL_SLIDES - 1)))
 }, [])

 const markTutorialComplete = async () => {
 try {
 const { error } = await supabase.auth.updateUser({
 data: { tutorial_version_seen: TUTORIAL_VERSION, has_completed_tutorial: true }
 })
 if (error) throw error
 setHasCompletedTutorial(true)
 setNeedsTutorial(false)
 } catch (error) {
 console.error('Error marking tutorial complete:', error)
 }
 }

 const closeTutorial = useCallback(async () => {
 setIsActive(false)
 setCurrentSlide(0)
 setNeedsTutorial(false)
 await markTutorialComplete()
 }, [])

 return (
 <TutorialContext.Provider
 value={{
 isActive,
 currentSlide,
 totalSlides: TOTAL_SLIDES,
 startTutorial,
 nextSlide,
 prevSlide,
 goToSlide,
 closeTutorial,
 hasCompletedTutorial,
 needsTutorial,
 }}
 >
 {children}
 </TutorialContext.Provider>
 )
}

export function useTutorial() {
 const context = useContext(TutorialContext)
 if (context === undefined) {
 throw new Error('useTutorial must be used within a TutorialProvider')
 }
 return context
}
