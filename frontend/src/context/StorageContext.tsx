import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { apiService } from '../services/api'

interface StorageUsage {
    storage_used_bytes: number
    used_gb: number
    used_percentage: number
    placeholder_max_gb: number
}

interface StorageContextType {
    storageUsage: StorageUsage | null
    loading: boolean
    refreshStorage: () => Promise<void>
}

const StorageContext = createContext<StorageContextType | undefined>(undefined)

export function StorageProvider({ children }: { children: ReactNode }) {
    const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null)
    const [loading, setLoading] = useState(true)

    const refreshStorage = useCallback(async () => {
        try {
            const usage = await apiService.getStorageUsage()
            setStorageUsage(usage)
        } catch (error) {
            console.error('Failed to load storage:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    // Load on mount
    useEffect(() => {
        refreshStorage()
    }, [refreshStorage])

    // Listen for storage update events
    useEffect(() => {
        const handleStorageUpdate = () => {
            refreshStorage()
        }
        window.addEventListener('storage-updated', handleStorageUpdate)
        return () => {
            window.removeEventListener('storage-updated', handleStorageUpdate)
        }
    }, [refreshStorage])

    return (
        <StorageContext.Provider value={{ storageUsage, loading, refreshStorage }}>
            {children}
        </StorageContext.Provider>
    )
}

export function useStorage() {
    const context = useContext(StorageContext)
    if (context === undefined) {
        throw new Error('useStorage must be used within a StorageProvider')
    }
    return context
}

// Helper to trigger storage refresh from anywhere
export function triggerStorageRefresh() {
    window.dispatchEvent(new Event('storage-updated'))
}







