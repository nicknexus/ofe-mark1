import { HardDrive, Info } from 'lucide-react'
import type { StorageTabProps } from './accountTypes'
import { SectionLoader } from '../ui'

export function StorageTab({ storageUsage, storageLoading, formatBytes }: StorageTabProps) {
 return (
 <div className="app-card p-6">
 <div className="flex items-center gap-3 mb-5">
 <div className="p-2 bg-evidence-50 rounded-xl"><HardDrive className="w-5 h-5 text-primary-700" /></div>
 <h2 className="text-lg font-semibold text-gray-800">Storage Usage</h2>
 </div>

 {storageLoading ? (
 <SectionLoader className="py-10" />
 ) : storageUsage ? (
 <div className="space-y-5">
 <div className="flex items-baseline gap-2">
 <span className="text-4xl font-bold text-gray-900">{storageUsage.used_gb.toFixed(2)}</span>
 <span className="text-base text-gray-500">GB used</span>
 </div>
 <div className="space-y-2">
 <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
 <div className="h-full bg-gradient-to-r from-evidence-500 to-evidence-600 rounded-full transition-all duration-500" style={{ width: `${Math.min(storageUsage.used_percentage, 100)}%` }} />
 </div>
 <div className="flex justify-between text-sm text-gray-500">
 <span>{formatBytes(storageUsage.storage_used_bytes)}</span>
 <span>{storageUsage.placeholder_max_gb} GB limit</span>
 </div>
 </div>
 <div className="flex items-start gap-2.5 p-3 bg-evidence-50 rounded-xl">
 <Info className="w-4 h-4 text-evidence-500 flex-shrink-0 mt-0.5" />
 <p className="text-sm text-primary-700">Storage limits will be tied to subscription plans once billing is enabled.</p>
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
