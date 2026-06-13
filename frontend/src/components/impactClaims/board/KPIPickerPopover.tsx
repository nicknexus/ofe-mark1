import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Search, Plus, X, Target } from 'lucide-react'
import { KPI } from '../../../types'

const CATEGORY_LABELS: Record<string, string> = {
  input: 'Input',
  output: 'Output',
  impact: 'Impact',
}

const PANEL_HEIGHT = 320

interface KPIPickerPopoverProps {
  allKPIs: KPI[]
  usedKPIIds: string[]
  onPick: (kpi: KPI) => void
}

export default function KPIPickerPopover({ allKPIs, usedKPIIds, onPick }: KPIPickerPopoverProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const available = allKPIs.filter((k) => k.id && !usedKPIIds.includes(k.id))
  const filtered = query.trim()
    ? available.filter((k) => k.title.toLowerCase().includes(query.toLowerCase()))
    : available

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - r.bottom - 8
    const spaceAbove = r.top - 8

    let top: number
    if (spaceBelow >= PANEL_HEIGHT || spaceBelow >= spaceAbove) {
      // Show below, cap height to available space
      top = r.bottom + 8
    } else {
      // Show above
      top = r.top - Math.min(PANEL_HEIGHT, spaceAbove) - 8
    }

    let left = r.left
    // Prevent overflowing right edge
    if (left + 288 > window.innerWidth - 8) {
      left = window.innerWidth - 288 - 8
    }
    left = Math.max(8, left)

    setPos({ top, left })
    setOpen(true)
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const maxListHeight = Math.min(
    PANEL_HEIGHT - 90, // subtract header + search bar height
    window.innerHeight - pos.top - 16
  )

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className="w-72 flex-shrink-0 flex flex-col items-center justify-center gap-2 h-40 rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50/30 transition-all"
      >
        <Plus className="w-5 h-5" />
        <span className="text-xs font-medium">Add Metric Column</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: pos.top, left: pos.left }}
            className="fixed z-[90] w-72 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-700">Select a metric</span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-md hover:bg-gray-100 text-gray-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search metrics…"
                  className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none"
                />
              </div>
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto py-1" style={{ maxHeight: maxListHeight }}>
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-xs text-gray-400 text-center">
                  {available.length === 0 ? 'All metrics already added' : 'No metrics match'}
                </p>
              ) : (
                filtered.map((kpi) => (
                  <button
                    key={kpi.id}
                    onClick={() => { onPick(kpi); setOpen(false) }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-start gap-2.5 transition-colors"
                  >
                    <Target className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{kpi.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {kpi.category && (
                          <span className="text-[10px] text-gray-400 capitalize">
                            {CATEGORY_LABELS[kpi.category] ?? kpi.category}
                          </span>
                        )}
                        {kpi.unit_of_measurement && (
                          <span className="text-[10px] text-gray-400">· {kpi.unit_of_measurement}</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
