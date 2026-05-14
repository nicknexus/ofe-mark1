import React, { useState, useCallback, useMemo } from 'react'
import { Plus, X as XIcon, MoveRight } from 'lucide-react'
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    closestCenter,
} from '@dnd-kit/core'
import { FileItem, Group } from '../types'
import { KPI, Location, BeneficiaryGroup, MetricTag } from '../../../types'
import FileLibrary from '../kanban/FileLibrary'
import GroupColumn from '../kanban/GroupColumn'
import DragOverlayCard from '../kanban/DragOverlayCard'
import MoveToGroupSheet from '../kanban/MoveToGroupSheet'

interface OrganizeStepProps {
    files: FileItem[]
    groups: Group[]
    filesByGroup: (groupId: string) => FileItem[]
    onToggleFileSelect: (fileId: string) => void
    onSelectAllVisible: (selected: boolean, ids: string[]) => void
    onClearSelection: () => void
    onRemoveFile: (fileId: string) => void
    onAddGroup: () => void
    onEditGroup: (groupId: string) => void
    onDeleteGroup: (groupId: string) => void
    onMoveSelectedToGroup: (groupId: string) => void
    onMoveFilesToGroup: (fileIds: string[], groupId: string) => void
    onEditFile: (fileId: string) => void
    onTitleChange: (groupId: string, title: string) => void
    // Reference data — currently unused inside OrganizeStep but threaded through
    // for future live column-auto-naming. Accept silently to keep the call site happy.
    kpis?: KPI[]
    locations?: Location[]
    beneficiaryGroups?: BeneficiaryGroup[]
    tags?: MetricTag[]
}

export default function OrganizeStep({
    files,
    groups,
    filesByGroup,
    onToggleFileSelect,
    onSelectAllVisible,
    onClearSelection,
    onRemoveFile,
    onAddGroup,
    onEditGroup,
    onDeleteGroup,
    onMoveSelectedToGroup,
    onMoveFilesToGroup,
    onEditFile,
    onTitleChange,
}: OrganizeStepProps) {
    const selectedFileIds = files.filter(f => f.selected).map(f => f.id)
    const selectedCount = selectedFileIds.length

    const [activeDrag, setActiveDrag] = useState<{ ids: string[]; primary: FileItem } | null>(null)
    const [isMoveSheetOpen, setIsMoveSheetOpen] = useState(false)

    // For "current" highlight in the mobile bottom sheet: if all selected files
    // share the same groupId, mark that group as the current one.
    const currentSharedGroupId = useMemo(() => {
        if (selectedCount === 0) return undefined
        const first = files.find(f => f.id === selectedFileIds[0])?.groupId
        if (!first) return undefined
        return selectedFileIds.every(id => files.find(f => f.id === id)?.groupId === first)
            ? first
            : undefined
    }, [selectedFileIds, files, selectedCount])

    const sensors = useSensors(
        // 8px distance constraint on touch keeps scrolling working — drag only kicks
        // in on a deliberate hold-and-move, not the start of a scroll gesture.
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor),
    )

    const handleDragStart = useCallback((e: DragStartEvent) => {
        const draggedId = e.active.id as string
        const dragged = files.find(f => f.id === draggedId)
        if (!dragged) return

        const ids = dragged.selected && selectedFileIds.length > 1
            ? selectedFileIds
            : [draggedId]

        setActiveDrag({ ids, primary: dragged })
    }, [files, selectedFileIds])

    const handleDragEnd = useCallback((e: DragEndEvent) => {
        const dropData = e.over?.data?.current as { groupId?: string } | undefined
        const targetGroupId = dropData?.groupId
        if (targetGroupId && activeDrag) {
            const allHere = activeDrag.ids.every(id => files.find(f => f.id === id)?.groupId === targetGroupId)
            if (!allHere) onMoveFilesToGroup(activeDrag.ids, targetGroupId)
        }
        setActiveDrag(null)
    }, [activeDrag, files, onMoveFilesToGroup])

    const handleDragCancel = useCallback(() => setActiveDrag(null), [])

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <div className="flex flex-col md:flex-row h-full min-h-0">
                {/* Left: File Library (desktop only — mobile uses the columns themselves) */}
                <div className="hidden md:block w-80 flex-shrink-0">
                    <FileLibrary
                        files={files}
                        groups={groups}
                        onToggleSelect={onToggleFileSelect}
                        onSelectAllVisible={onSelectAllVisible}
                        onClearSelection={onClearSelection}
                        onEditFile={onEditFile}
                        onRemoveFile={onRemoveFile}
                    />
                </div>

                {/* Right: Kanban — horizontal on desktop, vertical stack on mobile */}
                <div className="flex-1 min-w-0 md:overflow-x-auto overflow-y-auto md:overflow-y-hidden pb-24 md:pb-0">
                    <div className="flex flex-col md:flex-row md:items-stretch gap-3 p-3 md:h-full md:w-max">
                        {groups.map((g, i) => (
                            <GroupColumn
                                key={g.id}
                                group={g}
                                groupIndex={i}
                                files={filesByGroup(g.id)}
                                selectedFileIds={selectedFileIds}
                                onEditGroup={() => onEditGroup(g.id)}
                                onDeleteGroup={() => onDeleteGroup(g.id)}
                                onMoveSelectedHere={() => onMoveSelectedToGroup(g.id)}
                                onToggleFileSelect={onToggleFileSelect}
                                onEditFile={onEditFile}
                                onRemoveFile={onRemoveFile}
                                onTitleChange={(title) => onTitleChange(g.id, title)}
                                isOnlyGroup={groups.length === 1}
                            />
                        ))}
                        <button
                            onClick={onAddGroup}
                            className="w-full md:w-72 md:flex-shrink-0 flex items-center md:flex-col justify-center gap-2 border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-xl text-gray-500 hover:text-gray-700 transition-colors py-4 md:py-0 md:min-h-[140px]"
                        >
                            <Plus className="w-4 h-4 md:w-5 md:h-5" />
                            <span className="text-sm font-medium">Add Evidence Group</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile floating selection bar */}
            {selectedCount > 0 && (
                <div className="md:hidden fixed left-3 right-3 bottom-16 z-[80] bg-white border border-gray-200 rounded-2xl shadow-2xl p-2.5 flex items-center gap-2 animate-slide-up-fast">
                    <span className="text-xs font-semibold text-gray-700 ml-1.5">
                        {selectedCount} selected
                    </span>
                    <button
                        onClick={onClearSelection}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                        aria-label="Clear selection"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                    <div className="flex-1" />
                    <button
                        onClick={() => setIsMoveSheetOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-evidence-500 hover:bg-evidence-600 rounded-lg shadow-sm shadow-evidence-500/25"
                    >
                        <MoveRight className="w-3.5 h-3.5" />
                        Move to evidence group
                    </button>
                </div>
            )}

            <MoveToGroupSheet
                isOpen={isMoveSheetOpen}
                groups={groups}
                selectedCount={selectedCount}
                currentSharedGroupId={currentSharedGroupId}
                onClose={() => setIsMoveSheetOpen(false)}
                onPick={(groupId) => onMoveSelectedToGroup(groupId)}
                onAddGroup={onAddGroup}
            />

            <DragOverlay dropAnimation={null}>
                {activeDrag ? (
                    <DragOverlayCard primary={activeDrag.primary} count={activeDrag.ids.length} />
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}
