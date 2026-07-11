import React from 'react'
import { Camera, FileText, MessageSquare, DollarSign } from 'lucide-react'
import { Evidence } from '../../types'

export type EvidenceTypeKey = Evidence['type']

export const EVIDENCE_TYPE_ORDER: EvidenceTypeKey[] = ['visual_proof', 'documentation', 'financials', 'testimony']

const TYPE_STYLE: Record<EvidenceTypeKey, { icon: typeof Camera; label: string; activeClass: string }> = {
 visual_proof: { icon: Camera, label: 'Photos & video', activeClass: 'text-pink-500' },
 documentation: { icon: FileText, label: 'Documents', activeClass: 'text-evidence-500' },
 financials: { icon: DollarSign, label: 'Financials', activeClass: 'text-primary-800' },
 testimony: { icon: MessageSquare, label: 'Testimonies', activeClass: 'text-orange-500' },
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
export default function EvidenceTypeCounts({ counts }: { counts: EvidenceTypeCountMap }) {
 return (
 <span className="inline-flex items-center gap-2.5">
 {EVIDENCE_TYPE_ORDER.map(type => {
 const { icon: Icon, label, activeClass } = TYPE_STYLE[type]
 const count = counts[type]
 const active = count > 0
 return (
 <span
 key={type}
 title={`${count} ${label.toLowerCase()}`}
 className={`inline-flex items-center gap-1 text-xs tabular-nums ${active ? 'text-gray-700' : 'text-gray-300'}`}
 >
 <Icon className={`w-3.5 h-3.5 ${active ? activeClass : 'text-gray-300'}`} />
 {count}
 </span>
 )
 })}
 </span>
 )
}
