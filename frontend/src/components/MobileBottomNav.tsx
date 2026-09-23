import React from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Activity,
  MapPin,
  Users,
  BookOpen,
  ArrowLeft
} from 'lucide-react'

interface MobileBottomNavProps {
 activeTab: string
 onTabChange: (tab: string) => void
 alerts?: Partial<Record<string, boolean>>
}

export default function MobileBottomNav({ activeTab, onTabChange, alerts }: MobileBottomNavProps) {
  const tabs = [
    { id: 'logs', label: 'Logs', icon: Activity },
    { id: 'metrics', label: 'Metrics', icon: LayoutDashboard },
    { id: 'location', label: 'Locations', icon: MapPin },
 { id: 'beneficiaries', label: 'People', icon: Users },
 { id: 'stories', label: 'Stories', icon: BookOpen },
 ]

 return (
 <div className="mobile-bottom-nav">
 {/* Back to Dashboard */}
 <Link
 to="/tracking/programs"
 className="mobile-nav-item"
 >
 <ArrowLeft className="w-6 h-6" />
 <span className="text-sm font-semibold">Back</span>
 </Link>

 {/* Tab Items */}
 {tabs.map((tab) => {
 const Icon = tab.icon
 const isActive = activeTab === tab.id

 return (
 <button
 key={tab.id}
 onClick={() => onTabChange(tab.id)}
 className={`mobile-nav-item ${isActive ? 'mobile-nav-item-active' : ''}`}
 >
 <span className="relative">
 <Icon className="w-6 h-6" />
 {alerts?.[tab.id] && (
 <span className="absolute -top-1.5 -right-2 text-[12px] font-bold leading-none text-amber-600" aria-label="None yet">!</span>
 )}
 </span>
 <span className="text-sm font-semibold">{tab.label}</span>
 </button>
 )
 })}
 </div>
 )
}
