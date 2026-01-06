import React, { useState, useEffect } from 'react'
import { Clock, ArrowRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const BANNER_DISMISSED_KEY = 'nexus-trial-banner-dismissed'

interface Props {
    remainingDays: number | null
    onUpgradeClick?: () => void
}

export default function TrialBanner({ remainingDays, onUpgradeClick }: Props) {
    const [dismissed, setDismissed] = useState(() => {
        // Check localStorage on initial render
        const stored = localStorage.getItem(BANNER_DISMISSED_KEY)
        return stored === 'true'
    })
    const navigate = useNavigate()

    // Only show again if days remaining hits critical threshold (3 days or less)
    useEffect(() => {
        if (remainingDays !== null && remainingDays <= 3) {
            // Reset dismissed state when it becomes critical
            const wasDismissedBefore = localStorage.getItem(BANNER_DISMISSED_KEY) === 'true'
            const criticalShown = localStorage.getItem('nexus-trial-critical-shown') === 'true'
            
            if (wasDismissedBefore && !criticalShown) {
                localStorage.removeItem(BANNER_DISMISSED_KEY)
                localStorage.setItem('nexus-trial-critical-shown', 'true')
                setDismissed(false)
            }
        }
    }, [remainingDays])

    if (remainingDays === null || dismissed) return null

    const isUrgent = remainingDays <= 7
    const isCritical = remainingDays <= 3

    const handleUpgrade = () => {
        if (onUpgradeClick) {
            onUpgradeClick()
        } else {
            // Navigate to account page where subscription info is shown
            navigate('/account')
        }
    }

    const getBannerStyle = () => {
        if (isCritical) {
            return 'bg-gradient-to-r from-red-500 to-red-600'
        }
        if (isUrgent) {
            return 'bg-gradient-to-r from-amber-500 to-amber-600'
        }
        return 'bg-gradient-to-r from-primary-500 to-primary-600'
    }

    const getMessage = () => {
        if (remainingDays === 0) {
            return 'Your trial ends today!'
        }
        if (remainingDays === 1) {
            return '1 day left in your trial'
        }
        return `${remainingDays} days left in your trial`
    }

    return (
        <div className={`${getBannerStyle()} text-white py-2.5 px-4 fixed top-0 left-0 right-0 z-[100]`}>
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">{getMessage()}</span>
                    {!isCritical && (
                        <span className="hidden sm:inline text-white/80">
                            — Upgrade to keep your impact tracking running
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleUpgrade}
                        className="flex items-center gap-1 text-sm font-semibold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                        Upgrade Now
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    
                    {!isUrgent && (
                        <button 
                            onClick={() => {
                                localStorage.setItem(BANNER_DISMISSED_KEY, 'true')
                                setDismissed(true)
                            }}
                            className="text-white/70 hover:text-white p-1 rounded transition-colors cursor-pointer"
                            aria-label="Dismiss"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

