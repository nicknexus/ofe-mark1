import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check, type LucideIcon } from 'lucide-react'
import { dropdownPop } from '../timeline/motion'

export interface FilterOption {
  id: string
  name: string
  color?: string
}

export interface FilterPillProps {
  icon: LucideIcon
  label: string
  /** Shown when multiple items selected, e.g. "locations" */
  pluralLabel?: string
  options: FilterOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  emptyText: string
  /** When set, pill acts as visibility toggle (active when some are hidden). */
  total?: number
  /** Fired when the dropdown opens/closes — useful to close sibling menus. */
  onOpenChange?: (open: boolean) => void
}

/** Portal-dropdown multi-select pill — same visual pattern as Logs + Metrics filter bars. */
export default function FilterPill({
  icon: Icon,
  label,
  pluralLabel,
  options,
  selected,
  onChange,
  emptyText,
  total,
  onOpenChange,
}: FilterPillProps) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const isVisibility = typeof total === 'number'
  const active = isVisibility ? selected.length < total! : selected.length > 0
  const displayPlural = pluralLabel || `${label.toLowerCase()}s`

  const setOpenAnnounced = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: rect.left })
    }
  }, [open])

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter(x => x !== id))
    else onChange([...selected, id])
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpenAnnounced(!open)}
        className={`inline-flex items-center gap-1.5 md:gap-2 h-7 md:h-9 px-2 md:px-3 rounded-full border text-xs md:text-sm font-medium transition-colors focus:outline-none ${active
          ? 'border-primary-300 bg-primary-50 text-primary-800 hover:bg-primary-100'
          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
      >
        <Icon className={`w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 ${active ? 'text-primary-600' : 'text-gray-400'}`} />
        <span className="truncate max-w-[100px] md:max-w-[140px]">
          {selected.length === 0
            ? label
            : selected.length === 1
              ? options.find(o => o.id === selected[0])?.name || `1 ${label.toLowerCase()}`
              : `${selected.length} ${displayPlural}`}
        </span>
        {active && selected.length > 1 && (
          <span className="inline-flex items-center justify-center min-w-[16px] md:min-w-[18px] h-4 md:h-[18px] px-1 rounded-full bg-primary-600 text-white text-[10px] md:text-[11px] font-semibold">
            {selected.length}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 md:w-3.5 md:h-3.5 -mr-0.5 transition-transform ${active ? 'text-primary-500' : 'text-gray-400'} ${open ? 'rotate-180' : ''}`} />
      </button>

      {buttonRef.current && createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setOpenAnnounced(false)} />
              <motion.div
                initial={dropdownPop.initial}
                animate={dropdownPop.animate}
                exit={dropdownPop.exit}
                className="fixed bg-white border border-gray-200 rounded-xl shadow-modal z-[9999] p-2 min-w-[220px] max-h-72 overflow-y-auto"
                style={{ top: `${position.top}px`, left: `${position.left}px`, transformOrigin: 'top left' }}
                onClick={(e) => e.stopPropagation()}
              >
                {options.length === 0 ? (
                  <p className="text-xs text-gray-500 px-2 py-1.5">{emptyText}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-gray-100">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{displayPlural}</span>
                      {active && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onChange(isVisibility ? options.map(o => o.id) : []) }}
                          className="text-xs font-medium text-primary-700 hover:text-primary-800"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {options.map(option => {
                      const checked = selected.includes(option.id)
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => toggle(option.id)}
                          className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors ${checked ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                        >
                          {option.color && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: option.color }} />
                          )}
                          <span className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors ${checked ? 'bg-primary-600 border-primary-600' : 'bg-white border-gray-300'}`}>
                            {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </span>
                          <span className={`text-sm truncate flex-1 ${checked ? 'text-primary-800 font-medium' : 'text-gray-700'}`}>{option.name}</span>
                        </button>
                      )
                    })}
                  </>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
