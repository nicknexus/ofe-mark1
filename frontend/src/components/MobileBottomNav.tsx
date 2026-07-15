import React from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Activity,
  MapPin,
  Users,
  BookOpen,
  FileBarChart,
  ArrowLeft
} from 'lucide-react'

interface MobileBottomNavProps {
 activeTab: string
 onTabChange: (tab: string) => void
}

export default function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  const tabs = [
    { id: 'metrics', label: 'Metrics', icon: LayoutDashboard },
    { id: 'logs', label: 'Logs', icon: Activity },
    { id: 'location', label: 'Locations', icon: MapPin },
 { id: 'beneficiaries', label: 'People', icon: Users },
 { id: 'stories', label: 'Stories', icon: BookOpen },
 { id: 'report', label: 'Report', icon: FileBarChart },
 ]

 return (
 <div className="mobile-bottom-nav">
 {/* Back to Dashboard */}
 <Link
 to="/"
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
 <Icon className="w-6 h-6" />
 <span className="text-sm font-semibold">{tab.label}</span>
 </button>
 )
 })}
 </div>
 )
}
