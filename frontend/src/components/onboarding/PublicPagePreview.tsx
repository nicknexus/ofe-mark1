import React from 'react'
import { Building2 } from 'lucide-react'

/**
 * Lightweight, recolorable graphic that evokes the public organization page —
 * not pixel-accurate, just enough to preview how the brand color reads.
 */
export default function PublicPagePreview({ color, logoUrl, orgName }: { color: string; logoUrl?: string; orgName?: string }) {
  const tint = (pct: string) => `${color}${pct}` // color + alpha hex
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2 px-1">Public page preview</p>
      <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-card bg-white">
        {/* Browser chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border-b border-gray-200">
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          <div className="ml-2 h-3.5 flex-1 rounded-full bg-white/80 border border-gray-200" />
        </div>

        {/* Page */}
        <div className="p-4" style={{ background: `linear-gradient(180deg, ${tint('1f')} 0%, #ffffff 55%)` }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow ring-1 ring-black/5 flex items-center justify-center flex-shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-5 h-5" style={{ color }} />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-800 truncate">{orgName || 'Your Organization'}</div>
                <div className="h-1.5 w-20 rounded-full bg-gray-200 mt-1" />
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-full text-[10px] font-semibold text-white shadow-sm flex-shrink-0" style={{ backgroundColor: color }}>
              Support
            </span>
          </div>

          {/* Hero band */}
          <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: tint('24') }}>
            <div className="h-2.5 w-28 rounded-full" style={{ backgroundColor: color }} />
            <div className="h-1.5 w-40 max-w-full rounded-full bg-gray-300/70 mt-2" />
            <div className="h-1.5 w-32 max-w-full rounded-full bg-gray-300/50 mt-1.5" />
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {['1.2k', '38', '6'].map((n, i) => (
              <div key={i} className="rounded-lg border border-gray-100 bg-white p-2 shadow-sm">
                <div className="text-sm font-bold leading-none" style={{ color }}>{n}</div>
                <div className="h-1 w-8 rounded-full bg-gray-200 mt-1.5" />
              </div>
            ))}
          </div>

          {/* Initiative cards */}
          <div className="space-y-2">
            {[0, 1].map(i => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-white p-2.5 shadow-sm">
                <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: color }} />
                <div className="flex-1">
                  <div className="h-1.5 w-24 rounded-full bg-gray-300/80" />
                  <div className="h-1.5 w-32 max-w-full rounded-full bg-gray-200 mt-1.5" />
                </div>
                <span className="text-[10px] font-medium" style={{ color }}>→</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
