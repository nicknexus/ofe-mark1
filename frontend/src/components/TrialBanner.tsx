import { useState } from 'react'
import { CreditCard, CalendarX2, ArrowRight, X, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Props {
 remainingDays: number | null
 planName?: string
 trialEndsAt?: string | null
 /** No card on file (legacy grace period): access ends unless they add one. */
 cardless?: boolean
 /** Trial was cancelled: access ends at trial end and nothing is billed. */
 cancelling?: boolean
}

type Tone = 'amber' | 'red'

const TONES: Record<Tone, { accent: string; chip: string; icon: string }> = {
 amber: { accent: 'border-l-amber-500', chip: 'bg-amber-50', icon: 'text-amber-600' },
 red: { accent: 'border-l-red-500', chip: 'bg-red-50', icon: 'text-red-600' },
}

function formatDate(iso?: string | null) {
 if (!iso) return null
 const d = new Date(iso)
 if (Number.isNaN(d.getTime())) return null
 return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const dayCount = (n: number) => (n === 1 ? '1 day' : `${n} days`)

export default function TrialBanner({ remainingDays, planName, trialEndsAt, cardless, cancelling }: Props) {
 const navigate = useNavigate()
 const state = cardless ? 'cardless' : 'cancelling'
 // Keyed by state + end date so a new situation (e.g. they just cancelled)
 // shows once even if an earlier banner was dismissed. The card-less grace
 // banner only hides for this session: losing access must never be a surprise.
 const dismissKey = `nexus-trial-banner-dismissed:${state}:${trialEndsAt ?? ''}`
 const store = cardless ? sessionStorage : localStorage
 const [dismissed, setDismissed] = useState(() => {
  try { return store.getItem(dismissKey) === 'true' } catch { return false }
 })

 // Trials with a card on file that will convert get no banner at all.
 if (remainingDays === null || dismissed || (!cardless && !cancelling)) return null

 const endLabel = formatDate(trialEndsAt)
 const left = remainingDays === 0 ? 'Ends today' : `${dayCount(remainingDays)} left`

 let tone: Tone
 let icon: LucideIcon
 let title: string
 let detail: string
 let action: string
 if (cardless) {
  tone = remainingDays <= 3 ? 'red' : 'amber'
  icon = CreditCard
  title = `${left} of access`
  detail = `Add a card to keep your account${endLabel ? ` after ${endLabel}` : ''}.`
  action = 'Add a card'
 } else {
  tone = 'amber'
  icon = CalendarX2
  title = 'Trial cancelled'
  detail = `Access ends${endLabel ? ` ${endLabel}` : ' when your trial ends'}. You will not be billed.`
  action = 'Resume plan'
 }
 const t = TONES[tone]
 const Icon = icon

 const dismiss = () => {
  try { store.setItem(dismissKey, 'true') } catch { /* storage blocked */ }
  setDismissed(true)
 }

 return (
  <div
   className="fixed left-3 right-3 sm:left-auto sm:right-4 z-[100] sm:w-[400px] animate-slide-up"
   style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
   role="status"
  >
   <div className={`app-card-elevated overflow-hidden border-l-4 ${t.accent}`}>
    <div className="flex items-start gap-3 p-3.5">
     <div className={`w-9 h-9 rounded-lg ${t.chip} flex items-center justify-center shrink-0`}>
      <Icon className={`w-[18px] h-[18px] ${t.icon}`} />
     </div>
     <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-gray-900 leading-5">{title}</p>
      <p className="text-xs text-gray-500 leading-4 mt-0.5">{detail}</p>
      <button
       onClick={() => navigate('/account?tab=billing')}
       className="app-btn app-btn-sm app-btn-secondary mt-2.5"
      >
       {action}
       <ArrowRight className="w-3.5 h-3.5" />
      </button>
     </div>
     <button
      onClick={dismiss}
      className="app-btn app-btn-ghost h-7 w-7 px-0 rounded-lg -mr-1 -mt-1 shrink-0"
      aria-label="Dismiss"
     >
      <X className="w-4 h-4" />
     </button>
    </div>
   </div>
  </div>
 )
}
