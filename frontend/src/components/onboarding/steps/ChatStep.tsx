import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, Wand2, ChevronLeft, User } from 'lucide-react'
import { apiService } from '../../../services/api'
import { notify } from '../../../lib/notify'
import { OnboardingDraftApi } from '../useOnboardingDraft'
import { ChatMessage, ChatStage, SectionItem } from '../planTypes'
import { persistSection } from '../persistSection'
import SectionReview from '../SectionReview'
import { bubbleVariants, easeOut } from '../motion'
import { Initiative } from '../../../types'

interface Props {
  orgId: string | null
  orgName?: string
  draftApi: OnboardingDraftApi
  onPlanApplied: () => void
  onBackToOptions: () => void
  onSkip: () => void
}

function intro(stage: ChatStage, initiativeTitle?: string): string {
  switch (stage) {
    case 'description': return "First, tell me about your organization — what do you do, and who do you help? Or hit “Suggest” and I'll draft something."
    case 'locations': return 'Where do you create impact? Where does your organization operate and deliver its work? Tell me the places (city, country), or hit “Suggest” and I\'ll propose some based on what you\'ve shared.'
    case 'initiatives': return 'Now your programs. What are the main initiatives you run? I can propose a few too.'
    case 'metrics': return `Let's add metrics for “${initiativeTitle}”. What do you want to measure? I can suggest some strong ones.`
    case 'groups': return `Any specific groups “${initiativeTitle}” serves? This one's optional — tell me, suggest, or skip.`
  }
}

const STAGE_LABEL: Record<ChatStage, string> = {
  description: 'About you', locations: 'Locations', initiatives: 'Initiatives', metrics: 'Metrics', groups: 'Groups',
}

export default function ChatStep({ orgId, orgName, draftApi, onPlanApplied, onBackToOptions, onSkip }: Props) {
  const [stage, setStage] = useState<ChatStage>('description')
  const [queue, setQueue] = useState<Initiative[]>([])
  const [initIdx, setInitIdx] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: intro('description') }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [pending, setPending] = useState<SectionItem[] | null>(null)
  const [persisting, setPersisting] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const currentInitiative = queue[initIdx]
  const scopeLabel = (stage === 'metrics' || stage === 'groups') ? currentInitiative?.title : undefined

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, pending, sending, persisting])

  const pushAssistant = (content: string) => setMessages(m => [...m, { role: 'assistant', content }])

  const enterStage = (next: ChatStage, idx: number, q: Initiative[]) => {
    setStage(next)
    setInitIdx(idx)
    setPending(null)
    const title = (next === 'metrics' || next === 'groups') ? q[idx]?.title : undefined
    pushAssistant(intro(next, title))
  }

  const advance = (createdInitiatives: Initiative[]) => {
    if (stage === 'description') return enterStage('locations', 0, queue)
    if (stage === 'locations') return enterStage('initiatives', 0, queue)
    if (stage === 'initiatives') {
      const q = createdInitiatives.length ? createdInitiatives : queue
      setQueue(q)
      if (q.length === 0) return onPlanApplied()
      return enterStage('metrics', 0, q)
    }
    if (stage === 'metrics') {
      if (initIdx + 1 < queue.length) return enterStage('metrics', initIdx + 1, queue)
      return enterStage('groups', 0, queue)
    }
    if (stage === 'groups') {
      if (initIdx + 1 < queue.length) return enterStage('groups', initIdx + 1, queue)
      return onPlanApplied()
    }
  }

  const callAI = async (history: ChatMessage[]) => {
    setSending(true)
    try {
      const res = await apiService.onboardingChat(history, stage, {
        orgName,
        initiativeTitle: scopeLabel,
      })
      if (res.content) pushAssistant(res.content)
      if (res.type === 'proposal' && res.items) setPending(res.items)
    } catch (e: any) {
      pushAssistant(
        e?.message?.includes('Quota')
          ? 'The assistant is briefly unavailable. You can type items yourself, or switch to manual setup.'
          : (e?.message || 'Something went wrong — try again?')
      )
    } finally {
      setSending(false)
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || sending) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setPending(null)
    await callAI(next)
  }

  const suggest = async () => {
    if (sending) return
    const next = [...messages, { role: 'user' as const, content: 'Please suggest some for this step.' }]
    setMessages(next)
    setPending(null)
    await callAI(next)
  }

  const confirm = async () => {
    if (!pending) return
    setPersisting(true)
    try {
      const result = await persistSection(stage, pending, { orgId, initiativeId: currentInitiative?.id }, draftApi)
      if (result.errors.length > 0) {
        notify.error(`Couldn't add: ${result.errors.slice(0, 2).join('; ')}`)
        setPersisting(false)
        return
      }
      notify.success('Added')
      const created = result.createdInitiatives
      setPending(null)
      advance(created)
    } catch (e: any) {
      notify.error(e?.message || 'Could not add')
    } finally {
      setPersisting(false)
    }
  }

  const skipSection = () => { setPending(null); advance([]) }

  const lastAiIdx = messages.reduce((acc, m, i) => (m.role === 'assistant' ? i : acc), -1)

  return (
    <div className="onboarding-chat">
      <div className="onboarding-chat-meta">
        <button type="button" onClick={onBackToOptions} className="app-btn app-btn-ghost app-btn-sm text-secondary-500 -ml-1">
          <ChevronLeft className="w-4 h-4" /> Options
        </button>
        <AnimatePresence mode="wait">
          <motion.span
            key={stage}
            className="onboarding-chat-stage-pill"
            initial={{ opacity: 0, y: -6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            transition={{ duration: 0.3, ease: easeOut }}
          >
            <span className="onboarding-label-dot" aria-hidden />
            {STAGE_LABEL[stage]}
          </motion.span>
        </AnimatePresence>
        {scopeLabel && (
          <span className="onboarding-chat-scope truncate">{scopeLabel}</span>
        )}
      </div>

      <div className="onboarding-chat-thread">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const isUser = m.role === 'user'
            const isLatestAi = !isUser && !sending && i === lastAiIdx
            return (
              <motion.div
                key={i}
                layout
                custom={isUser}
                variants={bubbleVariants}
                initial="hidden"
                animate="visible"
                className={`onboarding-msg ${isUser ? 'onboarding-msg--user' : 'onboarding-msg--ai'}`}
              >
                {!isUser && (
                  <span className={`onboarding-msg-avatar onboarding-msg-avatar--ai ${isLatestAi ? 'onboarding-msg-avatar--latest' : ''}`}>
                    <Sparkles className={isLatestAi ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'} />
                  </span>
                )}
                {isUser && (
                  <span className="onboarding-msg-avatar onboarding-msg-avatar--user">
                    <User className="w-3.5 h-3.5" />
                  </span>
                )}
                <div className={isUser ? 'onboarding-bubble-user' : 'onboarding-bubble-ai'}>
                  {m.content}
                </div>
              </motion.div>
            )
          })}

          {sending && (
            <motion.div
              key="typing"
              layout
              className="onboarding-msg onboarding-msg--ai"
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, ease: easeOut }}
            >
              <span className="onboarding-msg-avatar onboarding-msg-avatar--ai onboarding-msg-avatar--latest">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <div className="onboarding-bubble-ai onboarding-typing">
                <span className="onboarding-typing-dots" aria-hidden>
                  <span /><span /><span />
                </span>
                <span className="text-xs text-secondary-500">WorldSee is thinking…</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={endRef} />
      </div>

      {/* Pinned editable proposal — its own scroll so long lists stay visible */}
      <AnimatePresence>
        {pending && (
          <motion.div
            className="onboarding-review-dock"
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.4, ease: easeOut }}
          >
            <SectionReview
              stage={stage}
              items={pending}
              onChange={setPending}
              onConfirm={confirm}
              onSkip={skipSection}
              persisting={persisting}
              scopeLabel={scopeLabel}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="onboarding-chat-composer">
        {!pending && (
          <motion.div
            className="onboarding-chat-actions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: easeOut }}
          >
            <button type="button" onClick={suggest} disabled={sending} className="onboarding-chat-suggest">
              <Wand2 className="w-3.5 h-3.5" /> Suggest for me
            </button>
            <button type="button" onClick={skipSection} disabled={sending}
              className="text-xs text-secondary-400 hover:text-secondary-600 transition px-1">
              Skip this step
            </button>
          </motion.div>
        )}
        <div className="onboarding-chat-inputbar">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Type your answer…"
            rows={1}
            disabled={persisting}
            className="onboarding-chat-textarea"
          />
          <button type="button" onClick={send} disabled={sending || persisting || !input.trim()}
            className="app-btn app-btn-primary app-btn-icon flex-shrink-0 disabled:opacity-40" title="Send">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="onboarding-chat-footnote">
          <span>WorldSee can make mistakes — you review everything before it's saved.</span>
          <button type="button" onClick={onSkip} className="hover:text-secondary-600 transition shrink-0">Skip setup</button>
        </div>
      </div>
    </div>
  )
}
