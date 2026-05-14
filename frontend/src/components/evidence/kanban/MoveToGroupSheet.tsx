import React from 'react'
import { X, MoveRight, Plus, Check, AlertTriangle } from 'lucide-react'
import { Group } from '../types'
import { validateGroup } from '../utils/groupValidation'
import { paletteFor } from '../utils/groupPalette'

interface MoveToGroupSheetProps {
    isOpen: boolean
    groups: Group[]
    selectedCount: number
    /** groupId all selected files currently share, if any — that row is dimmed. */
    currentSharedGroupId?: string
    onClose: () => void
    onPick: (groupId: string) => void
    onAddGroup: () => void
}

export default function MoveToGroupSheet({
    isOpen,
    groups,
    selectedCount,
    currentSharedGroupId,
    onClose,
    onPick,
    onAddGroup,
}: MoveToGroupSheetProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[95] flex flex-col justify-end md:hidden">
            <div className="flex-1 bg-black/40" onClick={onClose} />
            <div className="bg-white rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col animate-slide-up-fast">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">
                            Move {selectedCount} file{selectedCount === 1 ? '' : 's'} to…
                        </h3>
                        <p className="text-xs text-gray-500">Tap an evidence group or create a new one.</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    {groups.map((g, i) => {
                        const v = validateGroup(g.metadata)
                        const isCurrent = g.id === currentSharedGroupId
                        const palette = paletteFor(i)
                        return (
                            <button
                                key={g.id}
                                disabled={isCurrent}
                                onClick={() => { onPick(g.id); onClose() }}
                                className={`w-full flex flex-col rounded-xl border-2 text-left transition overflow-hidden ${
                                    isCurrent
                                        ? 'bg-gray-50 border-gray-200 text-gray-400'
                                        : 'bg-white border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <div
                                    className={`h-[3px] w-full flex-shrink-0 ${isCurrent ? 'bg-gray-300' : palette.barBg}`}
                                    aria-hidden
                                />
                                <div className="flex items-stretch gap-3 px-3 py-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-semibold text-gray-800 truncate">{g.name}</span>
                                            {isCurrent && (
                                                <span className="text-xs text-gray-400">(current)</span>
                                            )}
                                        </div>
                                        <div className="mt-0.5">
                                            {v.ready ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-green-700 font-semibold">
                                                    <Check className="w-2.5 h-2.5" /> Ready
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-semibold">
                                                    <AlertTriangle className="w-2.5 h-2.5" />
                                                    Missing: {v.missing.join(', ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {!isCurrent && <MoveRight className="w-4 h-4 text-gray-400 flex-shrink-0 self-center" />}
                                </div>
                            </button>
                        )
                    })}

                    <button
                        onClick={() => { onAddGroup(); onClose() }}
                        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-evidence-400 hover:bg-evidence-50/30 text-gray-600 hover:text-evidence-600 transition"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">New evidence group</span>
                    </button>
                </div>

                <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex-shrink-0">
                    Tip: tap a group's header to fill in its title, date, location, and metric.
                </div>
            </div>
        </div>
    )
}
