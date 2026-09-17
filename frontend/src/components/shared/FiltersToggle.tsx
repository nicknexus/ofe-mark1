import React from 'react'
import { SlidersHorizontal } from 'lucide-react'

/** Compact Filters button matching the Logs toolbar. */
export default function FiltersToggle({
  open,
  count,
  onClick,
  title,
}: {
  open: boolean
  count: number
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      title={title || 'Filters'}
      className={`app-btn app-btn-sm ${open || count > 0 ? 'app-btn-secondary border-primary-200 bg-primary-50 text-primary-900' : 'app-btn-ghost text-gray-600'}`}
    >
      <SlidersHorizontal className="w-4 h-4" />
      <span className="hidden sm:inline">Filters</span>
      {count > 0 && (
        <span className="min-w-[1.1rem] px-1 py-px rounded-full bg-primary-600 text-white text-[10px] font-bold tabular-nums text-center">
          {count}
        </span>
      )}
    </button>
  )
}
