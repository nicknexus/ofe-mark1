import React, { useEffect, useState, useRef } from 'react'
import { X, ChevronRight, Sparkles, MapPin, BarChart3, TrendingUp, FileText, CheckCircle, Rocket, Home, PartyPopper } from 'lucide-react'
import { useTutorial, TutorialStep } from '../context/TutorialContext'
import { useNavigate, useLocation } from 'react-router-dom'

interface StepConfig {
    title: string
    description: string
    icon: React.ComponentType<any>
    targetSelector?: string
    action: string
    showTarget: boolean // Whether to highlight the target element
    modalGuidance?: string
    stayOnCurrentTab?: boolean // Don't auto-navigate, let user click
}

const STEP_CONFIGS: Record<TutorialStep, StepConfig> = {
    'welcome': {
        title: 'Welcome to OFE! 🎉',
        description: "Let's get you set up with your first impact tracking project. This interactive tutorial will guide you through creating your first initiative, location, metric, impact claim, and evidence.",
        icon: Sparkles,
        action: "Click 'Let's Go!' to begin",
        showTarget: false
    },
    'explain-dashboard': {
        title: 'Your Dashboard',
        description: "This is your main dashboard where you can see all your initiatives at a glance. Initiatives are your main projects or programs - like 'Youth Training 2025' or 'Clean Water Project'.",
        icon: Home,
        action: "Click 'Next' to continue",
        showTarget: false
    },
    'create-initiative': {
        title: 'Create Your Initiative',
        description: 'Now click the "New Initiative" button to create your first project.',
        icon: Rocket,
        targetSelector: '[data-tutorial="create-initiative"]',
        action: 'Click "New Initiative"',
        showTarget: true,
        modalGuidance: '📝 Fill in your initiative:\n\n• Title - Name your project\n  (e.g., "Youth Training 2025")\n\n• Description - What does it do?\n\nThen click "Create Initiative"'
    },
    'explain-locations': {
        title: 'Locations Tab 📍',
        description: "Welcome to the Locations tab! This is where you manage all the geographic places where your impact happens - offices, villages, schools, or any location you work in.",
        icon: MapPin,
        targetSelector: '[data-tutorial="locations-tab"]',
        action: "Click 'Next' to add your first location",
        showTarget: true
    },
    'create-location': {
        title: 'Add Your First Location',
        description: 'Click the "Add Location" button to add where your impact happens.',
        icon: MapPin,
        targetSelector: '[data-tutorial="add-location"]',
        action: 'Click "Add Location"',
        showTarget: true,
        modalGuidance: '📍 Add your location:\n\n• Search for a place or enter coordinates\n\n• Name - Give it a clear name\n  (e.g., "Main Office", "Village A")\n\nThen click "Create"'
    },
    'location-created': {
        title: 'Great Job! 🎉',
        description: "You've created your first location! You can see all your locations on the map here. Each location can be linked to your impact claims to show exactly where your work is happening.",
        icon: PartyPopper,
        action: "Click 'Next' to continue",
        showTarget: false
    },
    'go-to-metrics': {
        title: 'Next: Create a Metric',
        description: "Now let's head to the Metrics tab to define what you want to measure. Click on the Metrics tab in the sidebar.",
        icon: BarChart3,
        targetSelector: '[data-tutorial="metrics-tab"]',
        action: 'Click "Metrics" tab',
        showTarget: true,
        stayOnCurrentTab: true
    },
    'explain-metrics': {
        title: 'Metrics Tab 📊',
        description: "This is where you define your Key Performance Indicators (KPIs). Metrics track things like 'People Trained', 'Wells Built', or 'Meals Provided'. You can have as many metrics as you need.",
        icon: BarChart3,
        action: "Click 'Next' to create your first metric",
        showTarget: false
    },
    'create-metric': {
        title: 'Create Your First Metric',
        description: 'Click "Add Metric" to define what you want to track.',
        icon: BarChart3,
        targetSelector: '[data-tutorial="add-metric"]',
        action: 'Click "Add Metric"',
        showTarget: true,
        modalGuidance: '📊 Create your metric:\n\n• Title - What are you measuring?\n  (e.g., "People Trained")\n\n• Unit - How do you count it?\n  (e.g., "people", "hours")\n\n• Category - Input, Output, or Impact\n\nThen click "Create Metric"'
    },
    'explain-metric-detail': {
        title: 'Your Metric Dashboard 📈',
        description: "Great! You can see your impact claim in the chart now. This is your metric's progress over time. Each claim is listed below with its date, value, and location. Now let's add some evidence to prove your work!",
        icon: TrendingUp,
        action: "Click 'Next' to add evidence",
        showTarget: false
    },
    'create-impact-claim': {
        title: 'Add an Impact Claim',
        description: 'Impact claims record your actual results - how much you achieved, when, and where. Click "+ Impact Claim" to record your first result.',
        icon: TrendingUp,
        targetSelector: '[data-tutorial="add-impact-claim"]',
        action: 'Click "+ Impact Claim"',
        showTarget: true,
        modalGuidance: '📈 Record your impact:\n\n• Value - How much did you achieve?\n\n• Date - When did this happen?\n\n• Location - Where did it happen?\n\n• Label - Give it a name\n\nThen click "Add Impact Claim"'
    },
    'impact-claim-created': {
        title: 'Excellent! 🎯',
        description: "You've recorded your first impact claim! You can see it displayed in your metric's chart.",
        icon: PartyPopper,
        action: "Click 'Next' to continue",
        showTarget: false
    },
    'create-evidence': {
        title: 'Upload Evidence',
        description: 'Click the "Add Evidence" button on your impact claim to upload proof of your work. This will auto-link the evidence to this specific claim.',
        icon: FileText,
        targetSelector: '[data-tutorial="quick-add-evidence"]',
        action: 'Click "Add Evidence" on the impact claim',
        showTarget: true,
        modalGuidance: '📎 Add your evidence:\n\n• Upload a file or paste a link\n\n• The metric is already selected!\n\n• Add a description if you like\n\nThen click "Add Evidence"'
    },
    'go-to-home': {
        title: 'Almost Done! 🏠',
        description: "Great work! You've created a complete impact record. Let's head back to the Home tab to see your overall progress.",
        icon: Home,
        targetSelector: '[data-tutorial="home-tab"]',
        action: 'Click "Home" tab',
        showTarget: true,
        stayOnCurrentTab: true
    },
    'explain-home': {
        title: 'Your Impact Overview',
        description: "This is your Home dashboard where you can see all your metrics at a glance. Track your overall progress, view charts, and monitor your impact across all your work. You can click any metric card to dive into details.",
        icon: Home,
        action: "Click 'Next' to finish",
        showTarget: false
    },
    'complete': {
        title: 'You Did It! 🎊',
        description: "Congratulations! You've learned how to track your impact in OFE. Keep adding initiatives, metrics, claims, and evidence to build a powerful impact story. You can restart this tutorial anytime from the Dashboard.",
        icon: CheckCircle,
        action: 'Click "Finish" to close',
        showTarget: false
    }
}

export default function InteractiveTutorial() {
    const { isActive, currentStep, advanceStep, skipTutorial, completeTutorial, tutorialData } = useTutorial()
    const navigate = useNavigate()
    const location = useLocation()
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [displayedStep, setDisplayedStep] = useState<TutorialStep>(currentStep)
    const [renderPhase, setRenderPhase] = useState<'hidden' | 'ready' | 'visible'>('hidden')

    // Use displayed step for rendering (this is what actually shows)
    const stepConfig = STEP_CONFIGS[displayedStep]

    /*
     * TUTORIAL RENDERING SEQUENCE - IMPORTANT FOR FUTURE UPDATES
     * ===========================================================
     * 
     * The tutorial uses a 3-phase rendering system to prevent flashing:
     * 
     * renderPhase: 'hidden' → 'ready' → 'visible'
     * 
     * - 'hidden': Component returns null, nothing is rendered
     * - 'ready': Component renders with opacity-0 (invisible but in DOM)
     * - 'visible': Component transitions to opacity-100 (CSS fade-in)
     * 
     * CRITICAL RULES:
     * 1. The show sequence must ONLY start when displayedStep === currentStep
     *    This prevents showing old content during step transitions.
     * 
     * 2. For steps with targets, we wait 500ms before looking for the element.
     *    This allows time for tab content loaders to complete.
     *    The app has sub-loaders that load tab content independently.
     * 
     * 3. The tutorial only shows once the target element is actually found.
     *    If a tab is still loading, the target won't exist yet.
     * 
     * Step Transition Flow:
     * 1. User clicks Next → currentStep changes
     * 2. We detect displayedStep !== currentStep → set renderPhase='hidden'
     * 3. Wait 300ms for fade-out
     * 4. Update displayedStep to match currentStep
     * 5. Now displayedStep === currentStep, so show sequence can begin
     * 6. For steps WITH targets: wait 500ms, then look for target element
     * 7. For steps WITHOUT targets: wait 100ms
     * 8. Set renderPhase='ready' (renders invisible)
     * 9. After 50ms, set renderPhase='visible' (CSS transition to opacity-100)
     */

    // EFFECT 1: Handle step changes and transitions
    useEffect(() => {
        if (!isActive) {
            setRenderPhase('hidden')
            setDisplayedStep(currentStep)
            setTargetRect(null)
            return
        }

        // When step changes, hide immediately and schedule displayedStep update
        if (displayedStep !== currentStep) {
            setRenderPhase('hidden')
            
            // Wait for fade-out, then update displayedStep
            const timer = setTimeout(() => {
                setDisplayedStep(currentStep)
                setTargetRect(null)
            }, 300)

            return () => clearTimeout(timer)
        }
    }, [isActive, currentStep, displayedStep])

    // EFFECT 2: Show sequence for steps WITHOUT targets (centered cards)
    useEffect(() => {
        // CRITICAL: Only proceed when displayedStep has caught up to currentStep
        // This prevents showing old content during transitions
        if (!isActive || renderPhase !== 'hidden' || displayedStep !== currentStep) {
            return
        }
        
        const config = STEP_CONFIGS[displayedStep]
        
        // Only handle steps without targets here
        if (config.showTarget && config.targetSelector) {
            return // Handled by target finder effect below
        }
        
        // No target needed - proceed to show after brief delay
        const timer = setTimeout(() => {
            setRenderPhase('ready')
            // Small delay before visible to ensure opacity-0 renders first
            setTimeout(() => setRenderPhase('visible'), 50)
        }, 100)
        
        return () => clearTimeout(timer)
    }, [isActive, displayedStep, currentStep, renderPhase])

    // Detect if a modal is open
    useEffect(() => {
        const checkForModal = () => {
            const modal = document.querySelector('[class*="fixed"][class*="inset-0"][class*="z-[60]"]')
            setIsModalOpen(!!modal)
        }

        checkForModal()
        const interval = setInterval(checkForModal, 200)
        return () => clearInterval(interval)
    }, [currentStep])

    // EFFECT 3: Find target element and show sequence for steps WITH targets
    useEffect(() => {
        if (!isActive || !stepConfig.targetSelector || !stepConfig.showTarget) {
            return
        }
        
        // When already visible, just keep updating targetRect for positioning on resize/scroll
        if (renderPhase !== 'hidden') {
            const findTarget = () => {
                const target = document.querySelector(stepConfig.targetSelector!)
                if (target) {
                    setTargetRect(target.getBoundingClientRect())
                }
            }
            findTarget()
            const interval = setInterval(findTarget, 500)
            window.addEventListener('resize', findTarget)
            window.addEventListener('scroll', findTarget, true)
            return () => {
                clearInterval(interval)
                window.removeEventListener('resize', findTarget)
                window.removeEventListener('scroll', findTarget, true)
            }
        }

        // CRITICAL: Only look for target when displayedStep has caught up to currentStep
        // This prevents showing at wrong position during transitions
        if (displayedStep !== currentStep) {
            return
        }

        // Hidden phase - look for target element, then trigger show sequence
        let foundIt = false
        let checkInterval: NodeJS.Timeout | null = null
        
        const findAndShow = () => {
            if (foundIt) return true
            
            const target = document.querySelector(stepConfig.targetSelector!)
            if (target) {
                foundIt = true
                const rect = target.getBoundingClientRect()
                setTargetRect(rect)
                
                // Target found - start show sequence
                setTimeout(() => {
                    setRenderPhase('ready')
                    // Small delay before visible to ensure opacity-0 renders first
                    setTimeout(() => setRenderPhase('visible'), 50)
                }, 100)
                return true
            }
            return false
        }

        // Initial check after delay (wait for page/tab to render)
        // Using 500ms to allow time for tab content loaders to complete
        const initialTimer = setTimeout(() => {
            if (!findAndShow()) {
                // Target not found yet, keep polling
                checkInterval = setInterval(() => {
                    if (findAndShow() && checkInterval) {
                        clearInterval(checkInterval)
                    }
                }, 200)
            }
        }, 500)

        return () => {
            clearTimeout(initialTimer)
            if (checkInterval) clearInterval(checkInterval)
        }
    }, [isActive, displayedStep, currentStep, stepConfig.targetSelector, stepConfig.showTarget, renderPhase])

    // Handle navigation based on step - but NOT for steps that say stayOnCurrentTab
    useEffect(() => {
        if (!isActive || !tutorialData.initiativeId) return
        if (stepConfig.stayOnCurrentTab) return // Don't auto-navigate

        const search = location.search

        // Navigate to correct tab based on step
        if ((currentStep === 'explain-locations' || currentStep === 'create-location' || currentStep === 'location-created') && 
            !search.includes('tab=location')) {
            navigate(`/initiatives/${tutorialData.initiativeId}?tab=location`)
        }
        if ((currentStep === 'explain-metrics' || currentStep === 'create-metric' || 
             currentStep === 'create-impact-claim' || currentStep === 'impact-claim-created' ||
             currentStep === 'explain-metric-detail' || currentStep === 'create-evidence') && 
            !search.includes('tab=metrics')) {
            navigate(`/initiatives/${tutorialData.initiativeId}?tab=metrics`)
        }
        if (currentStep === 'explain-home' && !search.includes('tab=home') && search !== '') {
            navigate(`/initiatives/${tutorialData.initiativeId}?tab=home`)
        }
    }, [currentStep, isActive, tutorialData.initiativeId, navigate, location.search, stepConfig.stayOnCurrentTab])

    const handleContinue = () => {
        if (currentStep === 'complete') {
            completeTutorial()
        } else {
            advanceStep()
        }
    }

    // Handle tab click advancement
    useEffect(() => {
        if (!isActive) return

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            
            // Check if clicking metrics tab during go-to-metrics step
            if (currentStep === 'go-to-metrics' && target.closest('[data-tutorial="metrics-tab"]')) {
                setTimeout(() => advanceStep(), 100)
            }
            // Check if clicking home tab during go-to-home step
            if (currentStep === 'go-to-home' && target.closest('[data-tutorial="home-tab"]')) {
                setTimeout(() => advanceStep(), 100)
            }
        }

        document.addEventListener('click', handleClick)
        return () => document.removeEventListener('click', handleClick)
    }, [isActive, currentStep, advanceStep])

    // Don't render anything until ready (prevents flashing)
    if (!isActive) return null
    if (renderPhase === 'hidden') return null

    const IconComponent = stepConfig.icon

    // Calculate card position - always keep on screen
    const getCardPosition = (): React.CSSProperties | null => {
        const cardWidth = 400
        const cardHeight = 400
        const padding = 24
        const windowWidth = window.innerWidth
        const windowHeight = window.innerHeight

        // When modal is open, position in top-left
        if (isModalOpen) {
            return {
                top: `${padding}px`,
                left: `${padding}px`,
                maxWidth: `${Math.min(cardWidth - 40, windowWidth - padding * 2)}px`
            }
        }

        // If step needs target but we don't have it yet, return null to hide
        if (stepConfig.showTarget && stepConfig.targetSelector && !targetRect) {
            return null
        }

        // Center position when no target to highlight
        if (!targetRect || !stepConfig.showTarget) {
            return {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                maxWidth: `${Math.min(cardWidth, windowWidth - padding * 2)}px`
            }
        }

        // Calculate best position relative to target
        let top: number
        let left: number

        const preferredTop = targetRect.bottom + padding
        const preferredLeft = targetRect.left

        if (preferredTop + cardHeight <= windowHeight - padding) {
            top = preferredTop
        } else if (targetRect.top - cardHeight - padding >= padding) {
            top = targetRect.top - cardHeight - padding
        } else {
            top = Math.max(padding, (windowHeight - cardHeight) / 2)
        }

        if (preferredLeft + cardWidth <= windowWidth - padding) {
            left = preferredLeft
        } else {
            left = Math.max(padding, windowWidth - cardWidth - padding)
        }

        return {
            top: `${top}px`,
            left: `${left}px`,
            maxWidth: `${Math.min(cardWidth, windowWidth - padding * 2)}px`
        }
    }

    const cardStyle = getCardPosition()

    // Determine if this step has a Next button
    const hasNextButton = !stepConfig.showTarget || displayedStep === 'complete' || 
        displayedStep === 'explain-locations' // This one shows target but also has Next

    // When modal is open, show floating guidance card
    if (isModalOpen && stepConfig.modalGuidance) {
        return (
            <div 
                className={`fixed z-[70] transition-opacity duration-300 ease-in-out ${renderPhase === 'visible' ? 'opacity-100' : 'opacity-0'}`}
                style={{ top: 24, left: 24 }}
            >
                <div className="bg-white rounded-2xl shadow-2xl w-80 p-5 border-2 border-primary-300">
                    <button
                        onClick={skipTutorial}
                        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center flex-shrink-0">
                            <IconComponent className="w-5 h-5 text-primary-600" />
                        </div>
                        <h2 className="text-base font-bold text-gray-900">{stepConfig.title}</h2>
                    </div>

                    <div className="bg-primary-50 border border-primary-200 rounded-xl p-3">
                        <p className="text-sm text-primary-800 whitespace-pre-line leading-relaxed">
                            {stepConfig.modalGuidance}
                        </p>
                    </div>

                    <button
                        onClick={skipTutorial}
                        className="text-xs text-gray-500 hover:text-gray-700 underline mt-3"
                    >
                        Skip tutorial
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div 
            className={`fixed inset-0 z-[55] pointer-events-none transition-opacity duration-300 ease-in-out ${renderPhase === 'visible' ? 'opacity-100' : 'opacity-0'}`}
        >
            {/* Overlay that blocks clicks everywhere except the highlighted target */}
            {targetRect && stepConfig.showTarget ? (
                <>
                    {/* 4 overlay divs surrounding the target - creates a real hole for clicks */}
                    {/* Top */}
                    <div 
                        className="absolute bg-black/50 left-0 right-0 top-0 pointer-events-auto"
                        style={{ height: Math.max(0, targetRect.top - 12) }}
                    />
                    {/* Bottom */}
                    <div 
                        className="absolute bg-black/50 left-0 right-0 bottom-0 pointer-events-auto"
                        style={{ top: targetRect.bottom + 12 }}
                    />
                    {/* Left */}
                    <div 
                        className="absolute bg-black/50 left-0 pointer-events-auto"
                        style={{ 
                            top: Math.max(0, targetRect.top - 12), 
                            width: Math.max(0, targetRect.left - 12),
                            height: targetRect.height + 24
                        }}
                    />
                    {/* Right */}
                    <div 
                        className="absolute bg-black/50 right-0 pointer-events-auto"
                        style={{ 
                            top: Math.max(0, targetRect.top - 12), 
                            left: targetRect.right + 12,
                            height: targetRect.height + 24
                        }}
                    />
                    {/* Subtle glow around target */}
                    <div
                        className="absolute rounded-xl pointer-events-none"
                        style={{
                            top: targetRect.top - 8,
                            left: targetRect.left - 8,
                            width: targetRect.width + 16,
                            height: targetRect.height + 16,
                            boxShadow: '0 0 20px 8px rgba(255, 255, 255, 0.4)'
                        }}
                    />
                </>
            ) : (
                /* Full overlay when no target to highlight - blocks all clicks */
                <div className="absolute inset-0 bg-black/50 pointer-events-auto" />
            )}

            {/* Tutorial Card - only render when position is known and not mid-transition */}
            {cardStyle && (
            <div
                className="absolute bg-white rounded-2xl shadow-2xl p-6 pointer-events-auto"
                style={cardStyle}
            >
                <button
                    onClick={skipTutorial}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Step indicator */}
                <div className="flex items-center space-x-1 mb-4 flex-wrap">
                    {Object.keys(STEP_CONFIGS).map((step, index) => (
                        <div
                            key={step}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                index <= Object.keys(STEP_CONFIGS).indexOf(displayedStep)
                                    ? 'bg-primary-500 w-3'
                                    : 'bg-gray-200 w-1.5'
                            }`}
                        />
                    ))}
                </div>

                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center mb-4">
                    <IconComponent className="w-7 h-7 text-primary-600" />
                </div>

                {/* Content */}
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {stepConfig.title}
                </h2>
                <p className="text-gray-600 mb-4 leading-relaxed text-sm">
                    {stepConfig.description}
                </p>

                {/* Action hint */}
                <div className={`rounded-xl p-3 mb-5 ${
                    stepConfig.showTarget && !hasNextButton
                        ? 'bg-primary-50 border border-primary-200' 
                        : 'bg-gray-50 border border-gray-200'
                }`}>
                    <p className={`text-sm font-medium flex items-center ${
                        stepConfig.showTarget && !hasNextButton ? 'text-primary-700' : 'text-gray-700'
                    }`}>
                        <span className="mr-2">{stepConfig.showTarget && !hasNextButton ? '👉' : '💡'}</span>
                        {stepConfig.action}
                    </p>
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={skipTutorial}
                        className="text-sm text-gray-500 hover:text-gray-700 underline"
                    >
                        Skip tutorial
                    </button>

                    {/* Show button for explanation/celebration steps */}
                    {hasNextButton && (
                        <button
                            onClick={handleContinue}
                            className="flex items-center space-x-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors font-medium shadow-lg shadow-primary-500/30"
                        >
                            <span>
                                {displayedStep === 'complete' ? 'Finish' : 
                                 displayedStep === 'welcome' ? "Let's Go!" : 
                                 'Next'}
                            </span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
            )}
        </div>
    )
}
