import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Sparkles, Undo2 } from 'lucide-react'
import ModalFrame, { ModalBody, ModalFooter, ModalHeader } from '../ModalFrame'
import { Button } from '../ui'
import { apiService } from '../../services/api'

interface Props {
 value: string
 onSave: (value: string) => void
 onClose: () => void
}

const MAX_CHARS = 4000

/** Phone sheet tracks the visual viewport so the keyboard cannot cover Save. */
function usePhoneViewportBox() {
 const [box, setBox] = useState<{ top: number; height: number } | null>(null)
 useEffect(() => {
  const mq = window.matchMedia('(max-width: 767px)')
  const vv = window.visualViewport
  const update = () => {
   if (!mq.matches || !vv) {
    setBox(null)
    return
   }
   setBox({ top: vv.offsetTop, height: vv.height })
  }
  update()
  mq.addEventListener('change', update)
  vv?.addEventListener('resize', update)
  vv?.addEventListener('scroll', update)
  return () => {
   mq.removeEventListener('change', update)
   vv?.removeEventListener('resize', update)
   vv?.removeEventListener('scroll', update)
  }
 }, [])
 return box
}

export default function DescriptionModal({ value, onSave, onClose }: Props) {
 const [draft, setDraft] = useState(value)
 const [previous, setPrevious] = useState<string | null>(null)
 const [cleaning, setCleaning] = useState(false)
 const [error, setError] = useState<string | null>(null)
 const phoneBox = usePhoneViewportBox()

 const cleanUp = async () => {
  setCleaning(true)
  setError(null)
  try {
   const { text } = await apiService.cleanUpDescription(draft)
   setPrevious(draft)
   setDraft(text)
  } catch (e) {
   setError((e as Error).message || 'Could not clean up the description.')
  } finally {
   setCleaning(false)
  }
 }

 return createPortal(
  <ModalFrame
   size="sm"
   zIndexClass="z-[130]"
   onClose={onClose}
   paddingClassName="p-0 md:p-4"
   overlayStyle={phoneBox ? { top: phoneBox.top, height: phoneBox.height, bottom: 'auto' } : undefined}
   panelClassName="bg-white w-full max-md:self-stretch max-md:h-full max-h-[100dvh] overflow-hidden flex flex-col rounded-none border-0 shadow-none md:rounded-xl md:border md:border-gray-200 md:shadow-app-modal md:h-auto md:max-h-[90vh] md:max-w-md"
  >
   <div className="contents" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
   <ModalHeader title="Description" onClose={onClose} className="max-md:!pt-[max(1rem,env(safe-area-inset-top))]" />
   <ModalBody className="max-md:!flex max-md:!flex-col max-md:!overflow-y-auto">
    <label htmlFor="log-description-modal" className="sr-only">Description</label>
    <textarea
     id="log-description-modal"
     autoFocus
     rows={8}
     maxLength={MAX_CHARS}
     className="app-input max-md:min-h-[8rem] max-md:flex-1 max-md:resize-none max-md:overflow-y-auto max-md:text-base md:resize-y"
     value={draft}
     onChange={e => { setDraft(e.target.value); setPrevious(null) }}
     placeholder="What happened? Rough notes are fine."
    />
    <div className="flex flex-wrap items-center gap-2 mt-3 shrink-0">
     <button type="button" onClick={cleanUp} disabled={cleaning || !draft.trim()} className="app-btn app-btn-secondary app-btn-sm">
      {cleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary-700" />}
      {cleaning ? 'Cleaning up' : 'Clean up with AI'}
     </button>
     {previous !== null && <button type="button" onClick={() => { setDraft(previous); setPrevious(null) }} className="app-btn app-btn-ghost app-btn-sm"><Undo2 className="w-3.5 h-3.5" /> Undo</button>}
     <span className="ml-auto text-[11px] text-gray-400 tabular-nums">{draft.length}/{MAX_CHARS}</span>
    </div>
    {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
   </ModalBody>
   <ModalFooter className="max-md:!pb-[max(1rem,env(safe-area-inset-bottom))]">
    <Button variant="ghost" onClick={onClose}>Cancel</Button>
    <Button onClick={() => { onSave(draft.trim()); onClose() }}>Save</Button>
   </ModalFooter>
   </div>
  </ModalFrame>,
  document.body,
 )
}
