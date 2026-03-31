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
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined)

interface TutorialProviderProps {
    children: ReactNode
}

const TOTAL_SLIDES = 7

export function TutorialProvider({ children }: TutorialProviderProps) {
    const [isActive, setIsActive] = useState(false)
    const [currentSlide, setCurrentSlide] = useState(0)
    const [hasCompletedTutorial, setHasCompletedTutorial] = useState(true)

    useEffect(() => {
        checkTutorialStatus()
    }, [])

    const checkTutorialStatus = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const completed = user.user_metadata?.has_completed_tutorial === true
                setHasCompletedTutorial(completed)

                if (!completed) {
                    const timer = setTimeout(() => {
                        setIsActive(true)
                        setCurrentSlide(0)
                    }, 1500)
                    return () => clearTimeout(timer)
                }
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
                data: { has_completed_tutorial: true }
            })
            if (error) throw error
            setHasCompletedTutorial(true)
        } catch (error) {
            console.error('Error marking tutorial complete:', error)
        }
    }

    const closeTutorial = useCallback(async () => {
        setIsActive(false)
        setCurrentSlide(0)
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
                hasCompletedTutorial
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
