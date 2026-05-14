import React, { useMemo, useState } from 'react'
import { Search, CheckSquare, Square, Loader2 } from 'lucide-react'
import { FileItem, Group } from '../types'
import { paletteFor } from '../utils/groupPalette'
import FileTile from './FileTile'

interface FileLibraryProps {
    files: FileItem[]
    groups: Group[]
    onToggleSelect: (fileId: string) => void
    onSelectAllVisible: (selected: boolean, visibleIds: string[]) => void
    onClearSelection: () => void
    onEditFile: (fileId: string) => void
    onRemoveFile: (fileId: string) => void
}

export default function FileLibrary({
    files,
    groups,
    onToggleSelect,
    onSelectAllVisible,
    onClearSelection,
    onEditFile,
    onRemoveFile,
}: FileLibraryProps) {
    const [search, setSearch] = useState('')

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return files
        return files.filter(f => f.file.name.toLowerCase().includes(q))
    }, [files, search])

    const allVisibleSelected = visible.length > 0 && visible.every(f => f.selected)
    const selectedCount = files.filter(f => f.selected).length
    const groupIndexById = useMemo(() => {
        const map: Record<string, number> = {}
        groups.forEach((g, i) => { map[g.id] = i })
        return map
    }, [groups])

    return (
        <div className="flex flex-col h-full bg-white border-r border-gray-200/80 min-w-0">
            <div className="px-3.5 py-3 border-b border-gray-100 space-y-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">
                        All files <span className="text-gray-400 font-normal">({files.length})</span>
                    </h4>
                    {selectedCount > 0 && (
                        <button
                            onClick={onClearSelection}
                            className="text-[11px] text-gray-500 hover:text-gray-700"
                        >
                            Clear ({selectedCount})
                        </button>
                    )}
                </div>
                <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search files…"
                        className="w-full text-xs pl-7 pr-2 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-evidence-400"
                    />
                </div>
                <button
                    onClick={() => onSelectAllVisible(!allVisibleSelected, visible.map(f => f.id))}
                    className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-900"
                >
                    {allVisibleSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-evidence-600" />
                    ) : (
                        <Square className="w-3.5 h-3.5" />
                    )}
                    {allVisibleSelected ? 'Deselect all' : 'Select all'}
                </button>
                {selectedCount > 0 && (
                    <p className="text-[10px] text-gray-500 leading-tight">
                        Drag any selected file to move all {selectedCount} together.
                    </p>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
                {visible.length === 0 ? (
                    <div className="text-center text-xs text-gray-400 py-6">
                        {files.length === 0 ? 'No files yet' : 'No matches'}
                    </div>
                ) : (
                    visible.map(f => {
                        const gIdx = groupIndexById[f.groupId] ?? 0
                        const palette = paletteFor(gIdx)
                        return (
                            <FileTile
                                key={f.id}
                                file={f}
                                selectionDragCount={selectedCount}
                                palette={palette}
                                onToggleSelect={() => onToggleSelect(f.id)}
                                onEdit={() => onEditFile(f.id)}
                                onRemove={() => onRemoveFile(f.id)}
                            />
                        )
                    })
                )}
            </div>

            {files.some(f => f.status === 'uploading') && (
                <div className="px-3 py-2 border-t border-gray-200 bg-evidence-50/40 flex items-center gap-2 text-[11px] text-evidence-700 flex-shrink-0">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Uploading {files.filter(f => f.status === 'uploading').length} file
                    {files.filter(f => f.status === 'uploading').length === 1 ? '' : 's'}…
                </div>
            )}
        </div>
    )
}
