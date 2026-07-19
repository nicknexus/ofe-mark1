import React from 'react'
import { Check, type LucideIcon } from 'lucide-react'

/**
 * One scope dimension as a card: icon header, optional done tick, scroll body.
 * Matches the Add Log wizard scope step.
 */
export function ScopeColumn({
  icon: Icon,
  title,
  optional,
  done,
  bodyClassName,
  children,
}: {
  icon: LucideIcon
  title: string
  optional?: boolean
  done: boolean
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white shadow-card flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50/70 flex-shrink-0">
        <span className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-gray-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{title}</p>
          {optional && (
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide leading-tight">Optional</p>
          )}
        </div>
        {done && (
          <span className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </span>
        )}
      </div>
      <div className={`px-4 py-3 flex-1 overflow-y-auto ${bodyClassName ?? 'max-h-[200px]'}`}>{children}</div>
    </div>
  )
}

export interface ScopeOption {
  id: string
  name: string
}

/** Chip multi-select with an explicit "All" shortcut. */
export function ScopeChips({
  icon: Icon,
  label,
  hint,
  options,
  selected,
  onChange,
  single = false,
  allowAll = true,
  hideHeader = false,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  options: ScopeOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  single?: boolean
  allowAll?: boolean
  hideHeader?: boolean
}) {
  const allSelected = options.length > 0 && selected.length === options.length

  const toggle = (id: string) => {
    if (single) {
      onChange(selected.includes(id) ? [] : [id])
      return
    }
    if (selected.includes(id)) onChange(selected.filter(s => s !== id))
    else onChange([...selected, id])
  }

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${active
      ? 'border-primary-500 bg-primary-50 text-primary-800'
      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
    }`

  return (
    <div>
      {!hideHeader && (
        <div className="flex items-center justify-between mb-1.5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
            <Icon className="w-3.5 h-3.5 text-gray-400" />
            {label}
          </label>
          {!single && allowAll && options.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(allSelected ? [] : options.map(o => o.id))}
              className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${allSelected
                ? 'border-primary-500 bg-primary-50 text-primary-800'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
            >
              {allSelected ? 'All selected' : 'Select all'}
            </button>
          )}
        </div>
      )}
      {!hideHeader && hint && <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p>}
      <div className="flex flex-wrap gap-1.5">
        {options.length === 0 ? (
          <p className="text-xs text-gray-400">None available</p>
        ) : (
          <>
            {hideHeader && !single && allowAll && options.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(allSelected ? [] : options.map(o => o.id))}
                className={chipClass(allSelected)}
              >
                All
              </button>
            )}
            {options.map(option => {
              const active = selected.includes(option.id)
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  className={chipClass(active)}
                >
                  {option.name}
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
