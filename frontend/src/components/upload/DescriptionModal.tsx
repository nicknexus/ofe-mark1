import React, { useState } from 'react'
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

export default function DescriptionModal({ value, onSave, onClose }: Props) {
 const [draft, setDraft] = useState(value)
 const [previous, setPrevious] = useState<string | null>(null)
 const [cleaning, setCleaning] = useState(false)
 const [error, setError] = useState<string | null>(null)

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

 return (
  <ModalFrame size="sm" zIndexClass="z-[130]" onClose={onClose}>
   <div className="contents" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
   <ModalHeader title="Description" onClose={onClose} />
   <ModalBody>
    <label htmlFor="log-description-modal" className="sr-only">Description</label>
    <textarea
     id="log-description-modal"
     autoFocus
     rows={8}
     maxLength={MAX_CHARS}
     className="app-input resize-y"
     value={draft}
     onChange={e => { setDraft(e.target.value); setPrevious(null) }}
     placeholder="What happened? Rough notes are fine."
    />
    <div className="flex items-center gap-2 mt-2">
     <button type="button" onClick={cleanUp} disabled={cleaning || !draft.trim()} className="app-btn app-btn-secondary app-btn-sm">
      {cleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary-700" />}
      {cleaning ? 'Cleaning up' : 'Clean up with AI'}
     </button>
     {previous !== null && <button type="button" onClick={() => { setDraft(previous); setPrevious(null) }} className="app-btn app-btn-ghost app-btn-sm"><Undo2 className="w-3.5 h-3.5" /> Undo</button>}
     <span className="ml-auto text-[11px] text-gray-400 tabular-nums">{draft.length}/{MAX_CHARS}</span>
    </div>
    {error && <p role="alert" className="text-xs text-red-600 mt-2">{error}</p>}
   </ModalBody>
   <ModalFooter>
    <Button variant="ghost" onClick={onClose}>Cancel</Button>
    <Button onClick={() => { onSave(draft.trim()); onClose() }}>Save</Button>
   </ModalFooter>
   </div>
  </ModalFrame>
 )
}
