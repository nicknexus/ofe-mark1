import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'

export type UploadStatus = 'uploading' | 'confirming' | 'complete' | 'error' | 'cancelled'

export interface UploadItem {
    id: string
    fileName: string
    fileSize: number
    loaded: number
    status: UploadStatus
    error?: string
    progress: number // 0–100
}

export interface UploadTask {
    file: File
    onComplete: (result: { file_url: string; size: number }) => void
    onError?: (error: Error) => void
}

interface UploadContextType {
    uploads: UploadItem[]
    queueUpload: (task: UploadTask) => string
    cancelUpload: (id: string) => void
    dismissUpload: (id: string) => void
    dismissAll: () => void
    isMinimized: boolean
    setIsMinimized: (v: boolean) => void
}

const UploadContext = createContext<UploadContextType | null>(null)

export function useUploadManager() {
    const ctx = useContext(UploadContext)
    if (!ctx) throw new Error('useUploadManager must be used within UploadProvider')
    return ctx
}

let nextId = 1

export function UploadProvider({ children }: { children: React.ReactNode }) {
    const [uploads, setUploads] = useState<UploadItem[]>([])
    const [isMinimized, setIsMinimized] = useState(false)
    const abortControllers = useRef<Map<string, AbortController>>(new Map())

    const updateUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
        setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))
    }, [])

    const queueUpload = useCallback((task: UploadTask): string => {
        const id = `upload-${nextId++}-${Date.now()}`
        const controller = new AbortController()
        abortControllers.current.set(id, controller)

        const item: UploadItem = {
            id,
            fileName: task.file.name,
            fileSize: task.file.size,
            loaded: 0,
            status: 'uploading',
            progress: 0
        }

        setUploads(prev => [...prev, item])
        setIsMinimized(false)

        apiService.uploadFile(task.file, {
            onProgress: (loaded, total) => {
                const progress = Math.round((loaded / total) * 100)
                updateUpload(id, { loaded, progress, status: 'uploading' })
            },
            abortSignal: controller.signal
        }).then(result => {
            updateUpload(id, { status: 'complete', progress: 100, loaded: task.file.size })
            task.onComplete(result)
            abortControllers.current.delete(id)

            // Auto-dismiss after 8 seconds
            setTimeout(() => {
                setUploads(prev => prev.filter(u => u.id !== id))
            }, 8000)
        }).catch(error => {
            if ((error as Error).message === 'Upload cancelled') {
                updateUpload(id, { status: 'cancelled', error: 'Cancelled' })
            } else {
                updateUpload(id, { status: 'error', error: (error as Error).message })
                toast.error(`Upload failed: ${task.file.name}`)
            }
            task.onError?.(error as Error)
            abortControllers.current.delete(id)
        })

        return id
    }, [updateUpload])

    const cancelUpload = useCallback((id: string) => {
        const controller = abortControllers.current.get(id)
        if (controller) {
            controller.abort()
            abortControllers.current.delete(id)
        }
    }, [])

    const dismissUpload = useCallback((id: string) => {
        cancelUpload(id)
        setUploads(prev => prev.filter(u => u.id !== id))
    }, [cancelUpload])

    const dismissAll = useCallback(() => {
        abortControllers.current.forEach(c => c.abort())
        abortControllers.current.clear()
        setUploads([])
    }, [])

    return (
        <UploadContext.Provider value={{
            uploads,
            queueUpload,
            cancelUpload,
            dismissUpload,
            dismissAll,
            isMinimized,
            setIsMinimized
        }}>
            {children}
        </UploadContext.Provider>
    )
}
