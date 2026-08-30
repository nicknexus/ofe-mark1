import React, { useState } from 'react'
import { Clock, ArrowRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const BANNER_DISMISSED_KEY = 'nexus-trial-banner-dismissed'

interface Props {
 remainingDays: number | null
 planName?: string
 trialEndsAt?: string | null
}

function formatDate(iso?: string | null) {
 if (!iso) return null
 const d = new Date(iso)
 if (Number.isNaN(d.getTime())) return null
 return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function TrialBanner({ remainingDays, planName, trialEndsAt }: Props) {
 const [dismissed, setDismissed] = useState(() => {
 const stored = localStorage.getItem(BANNER_DISMISSED_KEY)
 return stored === 'true'
 })
 const navigate = useNavigate()

 if (remainingDays === null || dismissed) return null

 const isUrgent = remainingDays <= 7
 const isCritical = remainingDays <= 3
 const endLabel = formatDate(trialEndsAt)
 const plan = planName ? planName.charAt(0).toUpperCase() + planName.slice(1) : 'your plan'

 const handleBilling = () => {
 navigate('/account?tab=billing')
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
 return `${plan} trial ends today. You will be billed unless you cancel.`
 }
 if (remainingDays === 1) {
 return `1 day left on ${plan}. You will be billed${endLabel ? ` on ${endLabel}` : ''} unless you cancel.`
 }
 return `${remainingDays} days left on ${plan}. You will be billed${endLabel ? ` on ${endLabel}` : ''} unless you cancel.`
 }

 return (
 <div className={`${getBannerStyle()} text-white py-2.5 px-4 fixed top-0 left-0 right-0 z-[100]`}>
 <div className="max-w-7xl mx-auto flex items-center justify-between">
 <div className="flex items-center gap-2 text-sm">
 <Clock className="w-4 h-4" />
 <span className="font-medium">{getMessage()}</span>
 </div>

 <div className="flex items-center gap-3">
 <button
 onClick={handleBilling}
 className="flex items-center gap-1 text-sm font-semibold bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors cursor-pointer"
 >
 Manage billing
 <ArrowRight className="w-4 h-4" />
 </button>

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
 </div>
 </div>
 </div>
 )
}
