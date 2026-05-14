import { HardDrive, Info } from 'lucide-react'
import type { StorageTabProps } from './accountTypes'

export function StorageTab({ storageUsage, storageLoading, formatBytes }: StorageTabProps) {
    return (
        <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-blue-50 rounded-xl"><HardDrive className="w-5 h-5 text-blue-600" /></div>
                <h2 className="text-lg font-semibold text-gray-800">Storage Usage</h2>
            </div>

            {storageLoading ? (
                <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                </div>
            ) : storageUsage ? (
                <div className="space-y-5">
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold text-gray-900">{storageUsage.used_gb.toFixed(2)}</span>
                        <span className="text-base text-gray-500">GB used</span>
                    </div>
                    <div className="space-y-2">
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500" style={{ width: `${Math.min(storageUsage.used_percentage, 100)}%` }} />
                        </div>
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>{formatBytes(storageUsage.storage_used_bytes)}</span>
                            <span>{storageUsage.placeholder_max_gb} GB limit</span>
                        </div>
                    </div>
                    <div className="flex items-start gap-2.5 p-3 bg-blue-50 rounded-xl">
                        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-600">Storage limits will be tied to subscription plans once billing is enabled.</p>
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 text-gray-500">
                    <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No storage data yet</p>
                </div>
            )}
        </div>
    )
}
