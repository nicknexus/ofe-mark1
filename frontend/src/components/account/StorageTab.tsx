import { HardDrive, Info } from 'lucide-react'
import { motion } from 'framer-motion'
import type { StorageTabProps } from './accountTypes'
import { SectionLoader } from '../ui'
import { easeOut } from '../timeline/motion'

export function StorageTab({ storageUsage, storageLoading, formatBytes }: StorageTabProps) {
 return (
 <div className="app-card p-6">
 <div className="mb-5">
 <h2 className="text-base font-semibold text-gray-800">Storage</h2>
 <p className="text-sm text-secondary-500">Media uploaded as evidence and stories.</p>
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
 <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
 <motion.div
 className="h-full bg-evidence-500 rounded-full"
 initial={{ width: 0 }}
 animate={{ width: `${Math.min(storageUsage.used_percentage, 100)}%` }}
 transition={{ duration: 0.5, ease: easeOut, delay: 0.15 }}
 />
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
