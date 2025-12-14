import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { supabase } from '../services/supabase'

export type TutorialStep = 
    | 'welcome'
    | 'explain-dashboard'
    | 'create-initiative'
    | 'explain-locations'
    | 'create-location'
    | 'location-created'
    | 'go-to-metrics'
    | 'explain-metrics'
    | 'create-metric'
    | 'create-impact-claim'
    | 'impact-claim-created'
    | 'explain-metric-detail'
    | 'create-evidence'
    | 'go-to-home'
    | 'explain-home'
    | 'complete'

interface TutorialData {
    initiativeId?: string
    locationId?: string
    metricId?: string
    impactClaimId?: string
}

interface TutorialContextType {
    isActive: boolean
    currentStep: TutorialStep
    tutorialData: TutorialData
    startTutorial: () => void
    advanceStep: (data?: Partial<TutorialData>) => void
    skipTutorial: () => Promise<void>
    completeTutorial: () => Promise<void>
    setTutorialData: (data: Partial<TutorialData>) => void
    hasCompletedTutorial: boolean
    isLoading: boolean
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined)

const STEP_ORDER: TutorialStep[] = [
    'welcome',
    'explain-dashboard',
    'create-initiative',
    'explain-locations',
    'create-location',
    'location-created',
    'go-to-metrics',
    'explain-metrics',
    'create-metric',
    'create-impact-claim',
    'impact-claim-created',
    'explain-metric-detail',
    'create-evidence',
    'go-to-home',
    'explain-home',
    'complete'
]

interface TutorialProviderProps {
    children: ReactNode
}

export function TutorialProvider({ children }: TutorialProviderProps) {
    const [isActive, setIsActive] = useState(false)
    const [currentStep, setCurrentStep] = useState<TutorialStep>('welcome')
    const [tutorialData, setTutorialDataState] = useState<TutorialData>({})
    const [hasCompletedTutorial, setHasCompletedTutorial] = useState(true)
    const [isLoading, setIsLoading] = useState(true)

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
                    setTimeout(() => {
                        setIsActive(true)
                        setCurrentStep('welcome')
                    }, 2000)
                }
            }
        } catch (error) {
            console.error('Error checking tutorial status:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const startTutorial = useCallback(() => {
        setIsActive(true)
        setCurrentStep('welcome')
        setTutorialDataState({})
    }, [])

    const advanceStep = useCallback((data?: Partial<TutorialData>) => {
        if (data) {
            setTutorialDataState(prev => ({ ...prev, ...data }))
        }

        const currentIndex = STEP_ORDER.indexOf(currentStep)
        if (currentIndex < STEP_ORDER.length - 1) {
            const nextStep = STEP_ORDER[currentIndex + 1]
            setCurrentStep(nextStep)
        }
    }, [currentStep])

    const setTutorialData = useCallback((data: Partial<TutorialData>) => {
        setTutorialDataState(prev => ({ ...prev, ...data }))
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

    const skipTutorial = useCallback(async () => {
        setIsActive(false)
        setCurrentStep('welcome')
        setTutorialDataState({})
        await markTutorialComplete()
    }, [])

    const completeTutorial = useCallback(async () => {
        setIsActive(false)
        setCurrentStep('welcome')
        await markTutorialComplete()
    }, [])

    return (
        <TutorialContext.Provider
            value={{
                isActive,
                currentStep,
                tutorialData,
                startTutorial,
                advanceStep,
                skipTutorial,
                completeTutorial,
                setTutorialData,
                hasCompletedTutorial,
                isLoading
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
