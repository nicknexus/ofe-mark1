import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { sheetBackdrop, sheetPanel, tapScale } from '../mobile/motion'

/** Compact label for a draft date value shown on a closed filter pill. */
export function mobileDateSummary(
  value?: { singleDate?: string; startDate?: string; endDate?: string } | null,
): string | undefined {
  if (!value) return undefined
  if (value.singleDate) return value.singleDate
  if (value.startDate && value.endDate) {
    return value.startDate === value.endDate
      ? value.startDate
      : `${value.startDate} – ${value.endDate}`
  }
  if (value.startDate) return value.startDate
  return undefined
}

export function mobileMultiSummary(count: number, unit = 'selected'): string | undefined {
  if (count <= 0) return undefined
  if (unit === 'selected') return `${count} selected`
  const plural = count === 1 ? unit : unit.endsWith('s') ? unit : `${unit}s`
  return `${count} ${plural}`
}

/** Compact filter icon for public sticky headers (phone only). */
export function PublicMobileFilterButton({
  activeCount,
  onClick,
  className = '',
}: {
  activeCount: number
  onClick: () => void
  className?: string
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={tapScale}
      aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'}
      className={`relative md:hidden flex-shrink-0 w-9 h-9 rounded-xl border border-gray-200 bg-white text-gray-600 active:bg-gray-50 flex items-center justify-center ${className}`}
    >
      <SlidersHorizontal className="w-4 h-4" />
      {activeCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-600 text-white text-[10px] font-semibold flex items-center justify-center">
          {activeCount}
        </span>
      )}
    </motion.button>
  )
}

/** Bottom sheet: draft filters inside, Apply commits. */
export function PublicMobileFilterSheet({
  open,
  onClose,
  onApply,
  onClear,
  children,
}: {
  open: boolean
  onClose: () => void
  onApply: () => void
  onClear?: () => void
  children: React.ReactNode
}) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] md:hidden">
          <motion.div
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            {...sheetBackdrop}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-app-modal border-t border-gray-100 max-h-[85dvh] flex flex-col safe-area-pb"
            {...sheetPanel}
          >
            <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="flex items-center justify-between px-4 pt-1 pb-3 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-base font-semibold text-gray-900">Filters</h2>
              <div className="flex items-center gap-2">
                {onClear && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="text-xs font-medium text-gray-500 active:text-gray-800 px-2 py-1"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="p-2 -mr-1 rounded-xl text-gray-400 active:bg-gray-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* min-h-0 is required so flex child can scroll to the last item */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-2.5">
              {children}
            </div>

            <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="app-btn app-btn-secondary flex-1 py-3"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onApply}
                className="app-btn app-btn-primary flex-1 py-3"
              >
                Apply
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Closed pill that expands on tap to reveal the filter control. */
export function PublicMobileFilterSection({
  title,
  summary,
  active = false,
  children,
}: {
  title: string
  /** Short value shown on the right when closed (e.g. "3 selected"). */
  summary?: string
  active?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-colors ${
        active
          ? 'border-primary-300 bg-primary-50/50'
          : 'border-gray-200 bg-white'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3.5 py-3 text-left active:bg-gray-50/80"
      >
        <span
          className={`flex-1 min-w-0 text-sm font-medium truncate ${
            active ? 'text-primary-800' : 'text-gray-800'
          }`}
        >
          {title}
        </span>
        {!open && summary && (
          <span
            className={`text-xs truncate max-w-[42%] ${
              active ? 'text-primary-600' : 'text-gray-500'
            }`}
          >
            {summary}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100/80">
          {children}
        </div>
      )}
    </div>
  )
}

/** Multi-select checklist for locations / tags / groups inside the sheet. */
export function PublicMobileFilterChecks({
  options,
  selected,
  onChange,
  emptyText = 'None available',
}: {
  options: Array<{ id: string; name: string }>
  selected: string[]
  onChange: (ids: string[]) => void
  emptyText?: string
}) {
  if (options.length === 0) {
    return <p className="text-sm text-gray-400 py-2">{emptyText}</p>
  }

  return (
    <div className="space-y-0.5 pt-1">
      {options.map((opt) => {
        const checked = selected.includes(opt.id)
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              onChange(
                checked ? selected.filter((id) => id !== opt.id) : [...selected, opt.id],
              )
            }}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left transition-colors ${
              checked ? 'bg-primary-50' : 'active:bg-gray-50'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-md flex items-center justify-center border flex-shrink-0 ${
                checked
                  ? 'bg-primary-600 border-primary-600'
                  : 'bg-white border-gray-300'
              }`}
            >
              {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span
              className={`text-sm ${
                checked ? 'text-primary-800 font-medium' : 'text-gray-700'
              }`}
            >
              {opt.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Single-select list (e.g. initiative). */
export function PublicMobileFilterRadio({
  options,
  selected,
  onChange,
  allLabel,
}: {
  options: Array<{ id: string; name: string }>
  selected: string | 'all'
  onChange: (id: string | 'all') => void
  allLabel?: string
}) {
  const rows = allLabel
    ? [{ id: 'all' as const, name: allLabel }, ...options]
    : options

  return (
    <div className="space-y-0.5 pt-1">
      {rows.map((opt) => {
        const checked = selected === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id === 'all' ? 'all' : opt.id)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left transition-colors ${
              checked ? 'bg-primary-50' : 'active:bg-gray-50'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center border flex-shrink-0 ${
                checked
                  ? 'bg-primary-600 border-primary-600'
                  : 'bg-white border-gray-300'
              }`}
            >
              {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span
              className={`text-sm ${
                checked ? 'text-primary-800 font-medium' : 'text-gray-700'
              }`}
            >
              {opt.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
