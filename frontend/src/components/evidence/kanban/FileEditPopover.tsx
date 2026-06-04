import React, { useEffect, useState } from 'react'
import { X, Check, File as FileIcon, Image as ImageIcon, Film, FileText, AlertCircle, ChevronRight } from 'lucide-react'
import { FileItem, Group, GroupMetadata } from '../types'
import { KPI, Location, BeneficiaryGroup, MetricTag } from '../../../types'
import MetadataForm from './MetadataForm'
import { metadataEqual } from '../utils/metadataEqual'
import { composeGroupName } from '../utils/composeGroupName'

interface FileEditPopoverProps {
 file: FileItem
 groups: Group[]
 isOpen: boolean
 initiativeId: string
 kpis: KPI[]
 locations: Location[]
 beneficiaryGroups: BeneficiaryGroup[]
 tags: MetricTag[]
 onClose: () => void
 onSave: (effective: GroupMetadata, autoName: string) => void
 onLocationsChanged: () => void
}

function fileIconFor(f: File) {
 if (f.type.startsWith('image/')) return ImageIcon
 if (f.type.startsWith('video/')) return Film
 return FileIcon
}

export default function FileEditPopover({
 file,
 groups,
 isOpen,
 initiativeId,
 kpis,
 locations,
 beneficiaryGroups,
 tags,
 onClose,
 onSave,
 onLocationsChanged,
}: FileEditPopoverProps) {
 const currentGroup = groups.find(g => g.id === file.groupId)
 const baseline: GroupMetadata = currentGroup?.metadata ?? {
 title: '',
 description: '',
 type: 'visual_proof',
 location_ids: [],
 kpi_ids: [],
 tag_ids: [],
 beneficiary_group_ids: [],
 }
 const [draft, setDraft] = useState<GroupMetadata>(baseline)

 useEffect(() => {
 if (!isOpen) return
 setDraft(baseline)
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [isOpen, file.id])

 if (!isOpen) return null

 // Predict what happens on save: stays in current group, moves to existing matching group,
 // or spawns a new auto-created group.
 const matchedGroup = groups.find(g => metadataEqual(g.metadata, draft))
 const willStay = matchedGroup?.id === file.groupId
 const willMoveTo = matchedGroup && !willStay ? matchedGroup : undefined
 const willSplit = !matchedGroup

 const Icon = fileIconFor(file.file)
 const isImage = file.file.type.startsWith('image/')

 return (
 <div className="fixed inset-0 z-[90] flex">
 <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
 <div className="w-full max-w-xl app-card-elevated flex flex-col h-full border-l border-gray-200 rounded-none">
 {/* Header */}
 <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-br from-evidence-50/80 via-white to-white flex-shrink-0">
 <div className="flex items-center gap-3 min-w-0">
 <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
 {isImage && file.previewUrl ? (
 <img src={file.previewUrl} alt="" className="w-full h-full object-cover" />
 ) : (
 <Icon className="w-5 h-5 text-gray-500" />
 )}
 </div>
 <div className="min-w-0">
 <h3 className="text-lg font-semibold text-gray-900 truncate">{file.file.name}</h3>
 <p className="text-xs text-gray-500 mt-0.5">
 Editing one file · currently in <span className="font-medium text-gray-700">{currentGroup?.name || '—'}</span>
 </p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
 <X className="w-5 h-5 text-gray-500" />
 </button>
 </div>

 {/* Live prediction banner */}
 <div className="px-5 py-2.5 border-b border-gray-200 bg-white/60 flex-shrink-0">
 {willStay && (
 <div className="flex items-center gap-2 text-xs text-gray-600">
 <Check className="w-3.5 h-3.5 text-impact-600" />
 <span>Matches the current group — no change.</span>
 </div>
 )}
 {willMoveTo && (
 <div className="flex items-center gap-2 text-xs text-evidence-700">
 <ChevronRight className="w-3.5 h-3.5" />
 <span>
 Will move to <span className="font-semibold">{willMoveTo.name}</span> (matching settings).
 </span>
 </div>
 )}
 {willSplit && (
 <div className="flex items-center gap-2 text-xs text-amber-700">
 <AlertCircle className="w-3.5 h-3.5" />
 <span>
 Will create a new group <span className="font-semibold">
 {composeGroupName(draft, { locations, kpis, tags, beneficiaryGroups })}
 </span>{' '}for this file.
 </span>
 </div>
 )}
 </div>

 <div className="flex-1 overflow-y-auto px-6 py-5 bg-gradient-to-b from-white to-gray-50/30">
 <MetadataForm
 initialMetadata={draft}
 initiativeId={initiativeId}
 kpis={kpis}
 locations={locations}
 beneficiaryGroups={beneficiaryGroups}
 onChange={setDraft}
 onLocationsChanged={onLocationsChanged}
 showTitleField
 titleLabel="Title"
 titleHelper="Changing the title splits this file into its own evidence group."
 />
 </div>

 <div className="px-6 py-3.5 border-t border-gray-100 bg-white flex items-center justify-end gap-2 flex-shrink-0">
 <button
 onClick={onClose}
 className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={() => {
 const autoName = composeGroupName(draft, { locations, kpis, tags, beneficiaryGroups })
 onSave(draft, autoName)
 onClose()
 }}
 className="flex items-center gap-1.5 px-5 py-2 text-sm bg-evidence-500 text-white rounded-lg hover:bg-evidence-600 font-semibold shadow-sm shadow-evidence-500/25 transition-colors"
 >
 <Check className="w-4 h-4" /> Apply
 </button>
 </div>
 </div>
 </div>
 )
}
