import { useReducer, useCallback } from 'react'
import { FileItem, FileUploadStatus, Group, GroupMetadata, emptyMetadata } from '../types'
import { metadataEqual } from '../utils/metadataEqual'

let _gid = 1
const newId = (prefix: string) => `${prefix}-${_gid++}-${Date.now().toString(36)}`

export interface State {
    files: FileItem[]
    groups: Group[]
    step: 'upload' | 'organize'
    initialGroupId: string
}

type Action =
    | { type: 'init'; preSelectedKPIId?: string }
    | { type: 'addFiles'; files: { file: File; uploadId: string }[] }
    | { type: 'removeFile'; fileId: string }
    | { type: 'setFileStatus'; fileId: string; patch: { status?: FileUploadStatus; progress?: number; uploadedUrl?: string; uploadedSize?: number; error?: string; previewUrl?: string } }
    | { type: 'setFileSelected'; fileId: string; selected: boolean }
    | { type: 'selectAll'; ids: string[]; selected: boolean }
    | { type: 'clearSelection' }
    | { type: 'addGroup'; metadata?: Partial<GroupMetadata>; name?: string }
    | { type: 'updateGroupMetadata'; groupId: string; patch: Partial<GroupMetadata> }
    | { type: 'renameGroup'; groupId: string; name: string }
    | { type: 'removeGroup'; groupId: string; fallbackGroupId?: string }
    | { type: 'moveFiles'; fileIds: string[]; targetGroupId: string }
    | { type: 'editFileMetadata'; fileId: string; effective: GroupMetadata; autoName?: string }
    | { type: 'goToStep'; step: State['step'] }

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case 'init': {
            const initialId = newId('group')
            const meta = emptyMetadata({
                kpi_ids: action.preSelectedKPIId ? [action.preSelectedKPIId] : [],
            })
            return {
                files: [],
                groups: [{ id: initialId, name: 'Evidence Group 1', metadata: meta }],
                step: 'upload',
                initialGroupId: initialId,
            }
        }
        case 'addFiles': {
            const targetGroupId = state.initialGroupId
            const newFiles: FileItem[] = action.files.map(({ file, uploadId }) => ({
                id: newId('file'),
                file,
                uploadId,
                status: 'uploading',
                progress: 0,
                groupId: targetGroupId,
                selected: false,
            }))
            return { ...state, files: [...state.files, ...newFiles] }
        }
        case 'removeFile': {
            return { ...state, files: state.files.filter(f => f.id !== action.fileId) }
        }
        case 'setFileStatus': {
            return {
                ...state,
                files: state.files.map(f =>
                    f.uploadId === action.fileId || f.id === action.fileId
                        ? { ...f, ...action.patch }
                        : f,
                ),
            }
        }
        case 'setFileSelected': {
            return {
                ...state,
                files: state.files.map(f =>
                    f.id === action.fileId ? { ...f, selected: action.selected } : f,
                ),
            }
        }
        case 'selectAll': {
            const ids = new Set(action.ids)
            return {
                ...state,
                files: state.files.map(f => (ids.has(f.id) ? { ...f, selected: action.selected } : f)),
            }
        }
        case 'clearSelection': {
            return { ...state, files: state.files.map(f => ({ ...f, selected: false })) }
        }
        case 'addGroup': {
            const id = newId('group')
            const idx = state.groups.length + 1
            return {
                ...state,
                groups: [
                    ...state.groups,
                    {
                        id,
                        name: action.name ?? `Evidence Group ${idx}`,
                        metadata: emptyMetadata(action.metadata),
                    },
                ],
            }
        }
        case 'updateGroupMetadata': {
            return {
                ...state,
                groups: state.groups.map(g =>
                    g.id === action.groupId ? { ...g, metadata: { ...g.metadata, ...action.patch } } : g,
                ),
            }
        }
        case 'renameGroup': {
            return {
                ...state,
                groups: state.groups.map(g => (g.id === action.groupId ? { ...g, name: action.name } : g)),
            }
        }
        case 'removeGroup': {
            // Reassign files to fallback (default: initial group) before deleting.
            // Refuse to delete the last remaining group.
            if (state.groups.length <= 1) return state
            const fallback = action.fallbackGroupId
                ?? (state.initialGroupId === action.groupId
                    ? state.groups.find(g => g.id !== action.groupId)!.id
                    : state.initialGroupId)
            const newInitialId = action.groupId === state.initialGroupId ? fallback : state.initialGroupId
            return {
                ...state,
                groups: state.groups.filter(g => g.id !== action.groupId),
                files: state.files.map(f => (f.groupId === action.groupId ? { ...f, groupId: fallback } : f)),
                initialGroupId: newInitialId,
            }
        }
        case 'moveFiles': {
            const ids = new Set(action.fileIds)
            return {
                ...state,
                files: state.files.map(f =>
                    ids.has(f.id) ? { ...f, groupId: action.targetGroupId, selected: false } : f,
                ),
            }
        }
        case 'editFileMetadata': {
            // The user edited a single file's metadata in the file-edit popover.
            // Find a group whose metadata matches; if none, spawn a new autoCreated group.
            const match = state.groups.find(g => metadataEqual(g.metadata, action.effective))
            if (match) {
                return {
                    ...state,
                    files: state.files.map(f =>
                        f.id === action.fileId ? { ...f, groupId: match.id, selected: false } : f,
                    ),
                }
            }
            const id = newId('group')
            const name = action.autoName || `Evidence Group ${state.groups.length + 1}`
            return {
                ...state,
                groups: [
                    ...state.groups,
                    { id, name, metadata: action.effective, autoCreated: true },
                ],
                files: state.files.map(f =>
                    f.id === action.fileId ? { ...f, groupId: id, selected: false } : f,
                ),
            }
        }
        case 'goToStep': {
            return { ...state, step: action.step }
        }
        default:
            return state
    }
}

function buildInitialState(preSelectedKPIId?: string): State {
    const initialId = newId('group')
    return {
        files: [],
            groups: [
                {
                    id: initialId,
                    name: 'Evidence Group 1',
                    metadata: emptyMetadata({
                        kpi_ids: preSelectedKPIId ? [preSelectedKPIId] : [],
                    }),
                },
            ],
        step: 'upload',
        initialGroupId: initialId,
    }
}

export function useEvidenceUploadState(preSelectedKPIId?: string) {
    const [state, dispatch] = useReducer(reducer, preSelectedKPIId, buildInitialState)

    const filesByGroup = useCallback(
        (groupId: string) => state.files.filter((f: FileItem) => f.groupId === groupId),
        [state.files],
    )

    return { state, dispatch, filesByGroup }
}
