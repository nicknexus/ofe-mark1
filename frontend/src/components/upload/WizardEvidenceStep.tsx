import React from 'react'
import { Camera, FileText, MessageSquare, DollarSign } from 'lucide-react'
import { WizardState } from './wizardTypes'
import FileDropList from './FileDropList'

const EVIDENCE_TYPES = [
 { value: 'visual_proof', label: 'Photo / Video', description: 'Pictures or footage of the work', icon: Camera },
 { value: 'documentation', label: 'Document', description: 'Reports, lists, records', icon: FileText },
 { value: 'testimony', label: 'Testimony', description: 'Quotes and statements', icon: MessageSquare },
 { value: 'financials', label: 'Financials', description: 'Receipts and statements', icon: DollarSign },
] as const

interface WizardEvidenceStepProps {
 state: WizardState
 update: (patch: Partial<WizardState>) => void
 onAddFiles: (files: File[]) => void
 onRemoveFile: (fileId: string) => void
}

/**
 * Step — add the proof: drop the files, say what kind of evidence they are,
 * and give the record a recognisable title.
 */
export default function WizardEvidenceStep({ state, update, onAddFiles, onRemoveFile }: WizardEvidenceStepProps) {
 return (
 <div className="space-y-5 max-w-2xl">
 {/* 1 — files */}
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">1. Add your files</label>
 <FileDropList files={state.files} onAddFiles={onAddFiles} onRemoveFile={onRemoveFile} />
 </div>

 {/* 2 — what kind */}
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">2. What kind of evidence is this?</label>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 {EVIDENCE_TYPES.map(type => (
 <button
 key={type.value}
 type="button"
 onClick={() => update({ evidenceType: type.value })}
 className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 text-center transition-colors ${state.evidenceType === type.value
 ? 'border-primary-500 bg-primary-50'
 : 'border-gray-200 bg-white hover:bg-gray-50'
 }`}
 >
 <type.icon className={`w-5 h-5 ${state.evidenceType === type.value ? 'text-primary-700' : 'text-gray-500'}`} />
 <span className="text-xs font-medium text-gray-700">{type.label}</span>
 <span className="text-[10px] text-gray-400 leading-tight">{type.description}</span>
 </button>
 ))}
 </div>
 </div>

 {/* 3 — name it */}
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">3. Give it a title</label>
 <input
 type="text"
 value={state.evidenceTitle}
 onChange={(e) => update({ evidenceTitle: e.target.value })}
 placeholder="e.g. Attendance sheet — July training"
 className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">
 Description <span className="text-gray-400 font-normal">(optional)</span>
 </label>
 <textarea
 value={state.evidenceDescription}
 onChange={(e) => update({ evidenceDescription: e.target.value })}
 rows={2}
 placeholder="What does this evidence show?"
 className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
 />
 </div>
 </div>
 )
}
