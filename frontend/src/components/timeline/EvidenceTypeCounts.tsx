import React from 'react'
import { Camera, FileText, MessageSquare, DollarSign } from 'lucide-react'
import { Evidence } from '../../types'
import { getEvidenceTypeInfo } from '../../utils'

export type EvidenceTypeKey = Evidence['type']

export const EVIDENCE_TYPE_ORDER: EvidenceTypeKey[] = ['visual_proof', 'documentation', 'financials', 'testimony']

/**
 * Canonical evidence-type visuals — the single source of truth so the four
 * types read the same colour everywhere (upload picker, logs, connections,
 * claims, metric pages). Visual = red, Documents = blue, Financials = green,
 * Testimonies = gold. (Deliberately off the brand token palette: the user
 * wants fixed, universally recognisable type colours.)
 */
export const EVIDENCE_TYPE_STYLE: Record<EvidenceTypeKey, {
 icon: typeof Camera
 label: string
 shortLabel: string
 /** Icon / text colour. */
 text: string
 /** Icon container: tinted bg + readable icon colour. */
 iconBox: string
 /** Active filter-chip styling. */
 chip: string
 /** Raw colour for charts / inline styles. */
 hex: string
}> = {
 visual_proof: { icon: Camera, label: 'Photos & video', shortLabel: 'Visual', text: 'text-red-600', iconBox: 'bg-red-100 text-red-700', chip: 'border-red-300 bg-red-50 text-red-700', hex: '#ef4444' },
 documentation: { icon: FileText, label: 'Documents', shortLabel: 'Document', text: 'text-blue-600', iconBox: 'bg-blue-100 text-blue-700', chip: 'border-blue-300 bg-blue-50 text-blue-700', hex: '#3b82f6' },
 financials: { icon: DollarSign, label: 'Financials', shortLabel: 'Financial', text: 'text-green-600', iconBox: 'bg-green-100 text-green-700', chip: 'border-green-300 bg-green-50 text-green-700', hex: '#22c55e' },
 testimony: { icon: MessageSquare, label: 'Testimonies', shortLabel: 'Testimony', text: 'text-amber-500', iconBox: 'bg-amber-100 text-amber-700', chip: 'border-amber-300 bg-amber-50 text-amber-700', hex: '#f59e0b' },
}

export type EvidenceTypeCountMap = Record<EvidenceTypeKey, number>

export function countEvidenceTypes(evidence: Array<{ type: EvidenceTypeKey }>): EvidenceTypeCountMap {
 const counts: EvidenceTypeCountMap = { visual_proof: 0, documentation: 0, financials: 0, testimony: 0 }
 for (const ev of evidence) {
 if (counts[ev.type] !== undefined) counts[ev.type] += 1
 }
 return counts
}

/**
 * Glanceable per-type evidence counts: four small icons with numbers
 * (photos, documents, financials, testimonies). Types with zero evidence
 * are dimmed so gaps read instantly.
 */
/** Single evidence-type label with the same icon + colour as the claims tab. */
export function EvidenceTypeLabel({
 type,
 className = 'text-sm text-gray-500',
}: {
 type: EvidenceTypeKey
 className?: string
}) {
 const { icon: Icon, text } = EVIDENCE_TYPE_STYLE[type]
 const { label } = getEvidenceTypeInfo(type)
 return (
 <span className={`inline-flex items-center gap-1 min-w-0 ${className}`}>
 <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${text}`} />
 <span className="truncate">{label}</span>
 </span>
 )
}

export default function EvidenceTypeCounts({ counts }: { counts: EvidenceTypeCountMap }) {
 return (
 <span className="inline-flex items-center gap-2.5">
      {EVIDENCE_TYPE_ORDER.map(type => {
        const { icon: Icon, label, text } = EVIDENCE_TYPE_STYLE[type]
        const count = counts[type]
        const active = count > 0
        return (
          <span
            key={type}
            title={`${count} ${label.toLowerCase()}`}
            className={`inline-flex items-center gap-1 text-xs tabular-nums ${active ? 'text-gray-700' : 'text-gray-300'}`}
          >
            <Icon className={`w-3.5 h-3.5 ${active ? text : 'text-gray-300'}`} />
            {count}
          </span>
        )
      })}
 </span>
 )
}
