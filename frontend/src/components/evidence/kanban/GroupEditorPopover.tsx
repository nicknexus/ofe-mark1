import React, { useEffect, useState } from 'react'
import { X, Check, Layers } from 'lucide-react'
import { Group, GroupMetadata } from '../types'
import { KPI, Location, BeneficiaryGroup } from '../../../types'
import MetadataForm from './MetadataForm'

interface GroupEditorPopoverProps {
    group: Group
    isOpen: boolean
    initiativeId: string
    kpis: KPI[]
    locations: Location[]
    beneficiaryGroups: BeneficiaryGroup[]
    onClose: () => void
    onSave: (metadata: GroupMetadata) => void
    onLocationsChanged: () => void
}

export default function GroupEditorPopover({
    group,
    isOpen,
    initiativeId,
    kpis,
    locations,
    beneficiaryGroups,
    onClose,
    onSave,
    onLocationsChanged,
}: GroupEditorPopoverProps) {
    const [draft, setDraft] = useState<GroupMetadata>(group.metadata)

    useEffect(() => {
        if (!isOpen) return
        setDraft(group.metadata)
    }, [isOpen, group.id])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[90] flex">
            <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="w-full max-w-xl bg-white shadow-[0_30px_80px_-12px_rgba(0,0,0,0.35)] flex flex-col h-full border-l border-gray-200">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-br from-evidence-50/80 via-white to-white flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-evidence-500/10 flex items-center justify-center border border-evidence-300/40 flex-shrink-0">
                            <Layers className="w-5 h-5 text-evidence-600" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900 truncate">Edit Evidence Group</h3>
                            <p className="text-xs text-gray-500 mt-0.5">These settings apply to every file in this group.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
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
                        titleLabel="Title"
                        titleHelper="Used for every evidence item in this group and shown as the column label."
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
                            onSave(draft)
                            onClose()
                        }}
                        className="flex items-center gap-1.5 px-5 py-2 text-sm bg-evidence-500 text-white rounded-lg hover:bg-evidence-600 font-semibold shadow-sm shadow-evidence-500/25 transition-colors"
                    >
                        <Check className="w-4 h-4" /> Save
                    </button>
                </div>
            </div>
        </div>
    )
}
