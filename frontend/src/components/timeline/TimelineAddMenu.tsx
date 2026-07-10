import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, TrendingUp, FileText, Layers, ChevronDown } from 'lucide-react'

export interface TimelineAddMenuProps {
 /** Present only when the user can create impact claims. */
 onAddClaim?: () => void
 /** Present only when the user can upload evidence. */
 onAddEvidence?: () => void
 /** Present only when the user can do both (claim first, then evidence). */
 onAddBoth?: () => void
}

/**
 * Single creation entry point for the Timeline. Options are permission-gated
 * by the caller passing/omitting handlers: evidence-only contributors get a
 * plain "Add evidence" button, users with one capability skip the menu.
 */
export default function TimelineAddMenu({ onAddClaim, onAddEvidence, onAddBoth }: TimelineAddMenuProps) {
 const [open, setOpen] = useState(false)
 const buttonRef = useRef<HTMLButtonElement>(null)
 const [position, setPosition] = useState({ top: 0, left: 0 })

 useEffect(() => {
 if (open && buttonRef.current) {
 const rect = buttonRef.current.getBoundingClientRect()
 setPosition({ top: rect.bottom + 4, left: rect.right - 224 })
 }
 }, [open])

 const items = [
 onAddClaim && { label: 'Add impact claim', icon: TrendingUp, action: onAddClaim },
 onAddEvidence && { label: 'Upload evidence', icon: FileText, action: onAddEvidence },
 onAddClaim && onAddEvidence && onAddBoth && { label: 'Add claim + evidence', icon: Layers, action: onAddBoth },
 ].filter(Boolean) as Array<{ label: string; icon: typeof Plus; action: () => void }>

 if (items.length === 0) return null

 // Single capability — no menu needed.
 if (items.length === 1) {
 return (
 <button onClick={items[0].action} className="app-btn app-btn-primary app-btn-sm">
 <Plus className="w-4 h-4" />
 <span className="hidden sm:inline">{items[0].label}</span>
 <span className="sm:hidden">Add</span>
 </button>
 )
 }

 return (
 <div className="relative">
 <button ref={buttonRef} onClick={() => setOpen(!open)} className="app-btn app-btn-primary app-btn-sm">
 <Plus className="w-4 h-4" />
 <span className="hidden sm:inline">Add</span>
 <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
 </button>

 {open && buttonRef.current && createPortal(
 <>
 <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
 <div
 className="fixed bg-white border border-gray-100 rounded-xl shadow-modal z-[9999] p-1.5 w-56"
 style={{ top: `${position.top}px`, left: `${position.left}px` }}
 >
 {items.map(item => (
 <button
 key={item.label}
 onClick={() => {
 setOpen(false)
 item.action()
 }}
 className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
 >
 <item.icon className="w-4 h-4 text-gray-500" />
 <span>{item.label}</span>
 </button>
 ))}
 </div>
 </>,
 document.body
 )}
 </div>
 )
}
