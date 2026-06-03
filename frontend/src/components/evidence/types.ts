export type EvidenceType = 'visual_proof' | 'documentation' | 'testimony' | 'financials'

export interface GroupMetadata {
    title: string
    description?: string
    type: EvidenceType
    location_ids: string[]
    kpi_ids: string[]
    tag_ids: string[]
    beneficiary_group_ids: string[]
    date_represented?: string
    date_range_start?: string
    date_range_end?: string
}

export interface Group {
    id: string
    name: string
    metadata: GroupMetadata
    autoCreated?: boolean
}

export type FileUploadStatus = 'uploading' | 'done' | 'error'

export interface FileItem {
    id: string
    file: File
    uploadId: string
    status: FileUploadStatus
    progress: number
    uploadedUrl?: string
    uploadedSize?: number
    error?: string
    groupId: string
    selected: boolean
    previewUrl?: string
    isLink?: boolean
    linkUrl?: string
}

export function emptyMetadata(overrides?: Partial<GroupMetadata>): GroupMetadata {
    return {
        title: '',
        description: '',
        type: 'visual_proof',
        location_ids: [],
        kpi_ids: [],
        tag_ids: [],
        beneficiary_group_ids: [],
        date_represented: undefined,
        date_range_start: undefined,
        date_range_end: undefined,
        ...overrides,
    }
}
