import React from 'react'
import { cn } from '../../lib/utils'

/** Single shimmering placeholder block. Compose to build skeletons. */
export function Skeleton({ className }: { className?: string }) {
 return <div className={cn('animate-pulse rounded-md bg-gray-200/70', className)} />
}

/** Multi-line text placeholder. Last line is shortened. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
 return (
 <div className={cn('space-y-2', className)}>
 {Array.from({ length: lines }).map((_, i) => (
 <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
 ))}
 </div>
 )
}

/** Card-shaped placeholder, matches `.app-card` chrome. */
export function SkeletonCard({ className }: { className?: string }) {
 return (
 <div className={cn('app-card app-pad', className)}>
 <Skeleton className="h-4 w-1/3 mb-3" />
 <SkeletonText lines={3} />
 </div>
 )
}

export default Skeleton
