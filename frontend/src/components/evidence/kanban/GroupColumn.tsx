import React, { useEffect, useRef, useState } from 'react'
import {
    Pencil, Trash2, Sparkles, MapPin, Calendar, Target, Tag, Plus, MoveRight,
} from 'lucide-react'
import { useDroppable } from '@dnd-kit/core'
import { FileItem, Group, GroupMetadata } from '../types'
import { validateGroup } from '../utils/groupValidation'
import { paletteFor, GroupPalette } from '../utils/groupPalette'
import FileTile from './FileTile'

interface GroupColumnProps {
    group: Group
    files: FileItem[]
    selectedFileIds: string[]
    groupIndex: number
    onEditGroup: () => void
    onDeleteGroup: () => void
    onMoveSelectedHere: () => void
    onToggleFileSelect: (fileId: string) => void
    onEditFile: (fileId: string) => void
    onRemoveFile: (fileId: string) => void
    onTitleChange: (title: string) => void
    isOnlyGroup: boolean
}

function shortDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00')
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateLabel(m: GroupMetadata): string | null {
    if (m.date_range_start && m.date_range_end) {
        return `${shortDate(m.date_range_start)} → ${shortDate(m.date_range_end)}`
    }
    return m.date_represented ? shortDate(m.date_represented) : null
}

export default function GroupColumn({
    group,
    files,
    selectedFileIds,
    groupIndex,
    onEditGroup,
    onDeleteGroup,
    onMoveSelectedHere,
    onToggleFileSelect,
    onEditFile,
    onRemoveFile,
    onTitleChange,
    isOnlyGroup,
}: GroupColumnProps) {
    const v = validateGroup(group.metadata)
    const palette = paletteFor(groupIndex)
    const canReceive = selectedFileIds.length > 0 && !selectedFileIds.every(id => files.some(f => f.id === id))
    const selectionDragCount = selectedFileIds.length

    const { setNodeRef: setBodyRef, isOver: bodyOver } = useDroppable({
        id: `group-${group.id}`,
        data: { groupId: group.id },
    })

    const titleSet = !!group.metadata.title?.trim()
    const displayTitle = titleSet ? group.metadata.title!.trim() : ''
    const dateLabel = formatDateLabel(group.metadata)
    const locationCount = group.metadata.location_ids.length
    const metricCount = group.metadata.kpi_ids.length
    const tagCount = group.metadata.tag_ids.length

    return (
        <div
            className={`w-full md:w-72 md:flex-shrink-0 flex flex-col bg-white border rounded-xl overflow-hidden max-h-full transition-all ${
                bodyOver
                    ? `border-gray-300 ring-2 ${palette.ring} shadow-md`
                    : 'border-gray-200/80 shadow-sm'
            }`}
        >
            {/* Top highlight bar + white header */}
            <div className={`flex flex-col flex-shrink-0 ${palette.headerBg} border-b border-gray-100`}>
                <div className={`h-[3px] w-full flex-shrink-0 ${palette.barBg}`} aria-hidden />
                <div className="px-3.5 pt-3 pb-3">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <EditableTitle
                            value={displayTitle}
                            placeholderEmpty={!titleSet}
                            autoCreated={group.autoCreated}
                            titleColor={palette.titleText}
                            onCommit={(next) => {
                                const trimmed = next.trim()
                                if (trimmed && trimmed !== displayTitle) onTitleChange(trimmed)
                                else if (!trimmed && titleSet) onTitleChange('')
                            }}
                        />
                        {!isOnlyGroup && (
                            <button
                                onClick={onDeleteGroup}
                                className={`p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-gray-100 transition-colors flex-shrink-0`}
                                title="Delete group (files return to first group)"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Inline status chips */}
                    <div className="flex flex-wrap gap-1 mb-2.5">
                        {dateLabel ? (
                            <SetChip Icon={Calendar} palette={palette}>{dateLabel}</SetChip>
                        ) : (
                            <MissingChip Icon={Calendar} label="date" onClick={onEditGroup} />
                        )}
                        {locationCount > 0 ? (
                            <SetChip Icon={MapPin} palette={palette}>
                                {locationCount} location{locationCount === 1 ? '' : 's'}
                            </SetChip>
                        ) : (
                            <MissingChip Icon={MapPin} label="location" onClick={onEditGroup} />
                        )}
                        {metricCount > 0 ? (
                            <SetChip Icon={Target} palette={palette}>
                                {metricCount} metric{metricCount === 1 ? '' : 's'}
                            </SetChip>
                        ) : (
                            <MissingChip Icon={Target} label="metric" onClick={onEditGroup} />
                        )}
                        {tagCount > 0 && (
                            <SetChip Icon={Tag} palette={palette}>
                                {tagCount} tag{tagCount === 1 ? '' : 's'}
                            </SetChip>
                        )}
                    </div>

                    {/* Edit button + status row */}
                    <div className="flex items-center justify-between gap-2">
                        <button
                            onClick={onEditGroup}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md ${palette.chipBg} border ${palette.chipBorder} ${palette.chipText} text-xs font-semibold hover:bg-gray-50 transition-all`}
                            title="Edit this evidence group"
                        >
                            <Pencil className="w-3 h-3" />
                            Edit details
                        </button>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${v.ready ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                            <span className={`text-xs font-medium ${v.ready ? 'text-emerald-700' : 'text-gray-700'}`}>
                                {v.ready ? 'Ready' : `${v.missing.length} left`}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="px-3.5 pb-2 text-xs text-gray-500 font-medium border-t border-gray-100">
                    {files.length} file{files.length === 1 ? '' : 's'}
                </div>
            </div>

            {/* Move-selected-here button */}
            {canReceive && (
                <button
                    onClick={onMoveSelectedHere}
                    className={`mx-2 mt-2 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium border ${palette.chipBorder} ${palette.chipText} ${palette.chipBg} hover:bg-gray-50 rounded-md transition-colors flex-shrink-0`}
                >
                    <MoveRight className="w-3 h-3" />
                    Move {selectedFileIds.length} selected here
                </button>
            )}

            {/* Files (drop target) */}
            <div
                ref={setBodyRef}
                className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0 bg-white"
            >
                {files.length === 0 ? (
                    <div className={`text-center text-xs py-10 border border-dashed rounded-lg transition-colors ${
                        bodyOver
                            ? `${palette.softBorder} ${palette.softText} ${palette.chipBg}`
                            : 'border-gray-200 text-gray-400 bg-gray-50/40'
                    }`}>
                        {bodyOver ? 'Drop here' : 'Drop files here'}
                    </div>
                ) : (
                    files.map(f => (
                        <FileTile
                            key={f.id}
                            file={f}
                            palette={palette}
                            selectionDragCount={selectionDragCount}
                            onToggleSelect={() => onToggleFileSelect(f.id)}
                            onEdit={() => onEditFile(f.id)}
                            onRemove={() => onRemoveFile(f.id)}
                        />
                    ))
                )}
            </div>
        </div>
    )
}

function EditableTitle({
    value,
    placeholderEmpty,
    autoCreated,
    titleColor,
    onCommit,
}: {
    value: string
    placeholderEmpty: boolean
    autoCreated?: boolean
    titleColor: string
    onCommit: (next: string) => void
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value)
    const inputRef = useRef<HTMLInputElement>(null)
    const placeholder = 'Insert title'

    useEffect(() => {
        if (!editing) setDraft(value)
    }, [value, editing])

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus()
            inputRef.current?.select()
        }
    }, [editing])

    const baseInputBox = 'w-full text-[15px] font-semibold leading-tight bg-white/90 backdrop-blur-sm border border-gray-300/80 rounded-lg px-3 py-1.5 shadow-sm transition-colors'

    if (editing) {
        return (
            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                <input
                    ref={inputRef}
                    type="text"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onBlur={() => { onCommit(draft); setEditing(false) }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur() }
                        if (e.key === 'Escape') { e.preventDefault(); setDraft(value); setEditing(false) }
                    }}
                    placeholder={placeholder}
                    className={`${baseInputBox} bg-white border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-500 text-gray-900 placeholder:text-gray-400 placeholder:font-normal`}
                />
            </div>
        )
    }

    return (
        <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <button
                type="button"
                onClick={() => setEditing(true)}
                title="Click to set title"
                className={`min-w-0 flex-1 text-left truncate ${baseInputBox} hover:bg-white hover:border-gray-400 hover:shadow ${
                    placeholderEmpty
                        ? 'text-gray-400 font-normal'
                        : titleColor
                }`}
            >
                {placeholderEmpty ? placeholder : value}
            </button>
            {autoCreated && (
                <span title="Auto-created from a file edit" className="flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                </span>
            )}
        </div>
    )
}

function SetChip({
    Icon,
    palette,
    children,
}: {
    Icon: React.ComponentType<{ className?: string }>
    palette: GroupPalette
    children: React.ReactNode
}) {
    return (
        <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-semibold rounded-md ${palette.chipBg} border ${palette.chipBorder} ${palette.chipText} max-w-full`}
        >
            <Icon className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate max-w-[160px]">{children}</span>
        </span>
    )
}

function MissingChip({
    Icon,
    label,
    onClick,
}: {
    Icon: React.ComponentType<{ className?: string }>
    label: string
    onClick: () => void
}) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick() }}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded-md border border-dashed border-gray-400 text-gray-600 bg-white/70 hover:border-gray-500 hover:text-gray-800 hover:bg-white transition-colors"
        >
            <Plus className="w-2.5 h-2.5 flex-shrink-0" />
            <Icon className="w-2.5 h-2.5 flex-shrink-0" />
            <span>{label}</span>
        </button>
    )
}
