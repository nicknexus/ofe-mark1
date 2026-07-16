import React from 'react'
import { LayoutGrid, List } from 'lucide-react'

export type EvidenceViewMode = 'list' | 'gallery'

interface EvidenceViewModeToggleProps {
  mode: EvidenceViewMode
  onChange: (mode: EvidenceViewMode) => void
}

export default function EvidenceViewModeToggle({ mode, onChange }: EvidenceViewModeToggleProps) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-gray-100 border border-gray-200 flex-shrink-0">
      {([
        { id: 'list' as const, label: 'List', icon: List },
        { id: 'gallery' as const, label: 'Gallery', icon: LayoutGrid },
      ]).map(m => {
        const active = mode === m.id
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${active ? 'bg-white text-gray-900 shadow-card' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <m.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}
