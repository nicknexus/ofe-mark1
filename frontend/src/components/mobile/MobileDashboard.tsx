import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Plus, ChevronRight, Edit, Trash2, Users, Settings, Lock, Sparkles } from 'lucide-react'
import { Initiative, CreateInitiativeForm } from '../../types'
import { apiService } from '../../services/api'
import { SubscriptionService } from '../../services/subscription'
import { useTeam } from '../../context/TeamContext'
import CreateInitiativeModal from '../CreateInitiativeModal'
import UpgradeModal from '../UpgradeModal'
import { notify } from '../../lib/notify'
import { EmptyState, SectionLoader } from '../ui'
import { fadeUp, staggerContainer, tapScaleSoft } from './motion'

interface MobileDashboardProps {
 initiatives: Initiative[]
 onEnterInitiative: (initiative: Initiative) => void
 onRefresh: () => void
 loading: boolean
 onNavigateToAccount?: () => void
}

export default function MobileDashboard({
 initiatives,
 onEnterInitiative,
 onRefresh,
 loading,
 onNavigateToAccount
}: MobileDashboardProps) {
 const { isSharedMember, organizationName, canCreateInitiatives, canEditInitiatives, canDelete, activeOrganization } = useTeam()
 const orgLogoUrl = activeOrganization?.logo_url
 const [showCreateModal, setShowCreateModal] = useState(false)
 const [showEditModal, setShowEditModal] = useState(false)
 const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null)
 const [deleteConfirmInitiative, setDeleteConfirmInitiative] = useState<Initiative | null>(null)
 const [deleteConfirmText, setDeleteConfirmText] = useState('')
 const [openMenuId, setOpenMenuId] = useState<string | null>(null)
 const [showUpgradeModal, setShowUpgradeModal] = useState(false)
 const [upgradeUsage, setUpgradeUsage] = useState<{ current: number; limit: number } | null>(null)
 const [initiativesLimit, setInitiativesLimit] = useState<number | null>(null)

 useEffect(() => {
 SubscriptionService.getInitiativesUsage()
 .then(u => setInitiativesLimit(u.limit))
 .catch(() => { /* non-fatal — no locking if the lookup fails */ })
 }, [])

 // Over-limit initiatives are locked (oldest `limit` stay active) — mirrors
 // the desktop dashboard + backend entitlement rule.
 const lockedIds = useMemo(() => {
 const set = new Set<string>()
 if (initiativesLimit === null || initiatives.length <= initiativesLimit) return set
 const byAge = [...initiatives].sort((a, b) => {
 const ta = a.created_at ? new Date(a.created_at).getTime() : 0
 const tb = b.created_at ? new Date(b.created_at).getTime() : 0
 return ta - tb
 })
 byAge.slice(initiativesLimit).forEach(i => { if (i.id) set.add(i.id) })
 return set
 }, [initiatives, initiativesLimit])

 const handleCreateInitiative = async (formData: CreateInitiativeForm) => {
 try {
 const newInitiative = await apiService.createInitiative(formData)
 notify.success('Initiative created!')
 onRefresh()
 if (newInitiative?.id) {
 // Enter the newly created initiative
 onEnterInitiative(newInitiative)
 }
 } catch (error: any) {
 // Check if it's an initiative limit error
 if (error?.code === 'INITIATIVE_LIMIT_REACHED' || error?.message?.includes('Initiative limit reached')) {
 setUpgradeUsage(error.usage || { current: initiatives.length, limit: 2 })
 setShowUpgradeModal(true)
 setShowCreateModal(false)
 return
 }
 const message = error instanceof Error ? error.message : 'Failed to create initiative'
 notify.error(message)
 throw error
 }
 }

 const handleEditInitiative = async (formData: CreateInitiativeForm) => {
 if (!editingInitiative?.id) return
 try {
 await apiService.updateInitiative(editingInitiative.id, formData)
 notify.success('Initiative updated!')
 onRefresh()
 setShowEditModal(false)
 setEditingInitiative(null)
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Failed to update initiative'
 notify.error(message)
 throw error
 }
 }

 const handleDeleteInitiative = async (initiative: Initiative) => {
 if (!initiative.id) return
 if (deleteConfirmText !== 'DELETE MY INITIATIVE') {
 notify.error('Please type "DELETE MY INITIATIVE" exactly to confirm')
 return
 }
 try {
 await apiService.deleteInitiative(initiative.id)
 notify.success('Initiative deleted!')
 onRefresh()
 setDeleteConfirmInitiative(null)
 setDeleteConfirmText('')
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Failed to delete initiative'
 notify.error(message)
 }
 }

 if (loading) {
 return <SectionLoader className="h-64" />
 }

 return (
 <div className="px-4 pt-5 pb-2">
 {isSharedMember && (
 <div className="mb-4 p-3 bg-evidence-50 border border-evidence-100 rounded-2xl flex items-center gap-3">
 <div className="w-9 h-9 bg-evidence-100 rounded-xl flex items-center justify-center flex-shrink-0">
 <Users className="w-4 h-4 text-evidence-700" />
 </div>
 <div className="min-w-0">
 <p className="text-sm font-semibold text-evidence-800 truncate">
 Viewing {organizationName}'s initiatives
 </p>
 <p className="text-xs text-evidence-600">Team member</p>
 </div>
 </div>
 )}

 <div className="mb-5">
 <div className="flex items-center gap-2 mb-1">
 <Sparkles className="w-4 h-4 text-primary-600" />
 <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Workspace</p>
 </div>
 <h1 className="text-2xl font-bold tracking-tight text-gray-900">
 {isSharedMember ? 'Initiatives' : 'Your Initiatives'}
 </h1>
 <p className="text-sm text-gray-500 mt-1">
 {initiatives.length} initiative{initiatives.length !== 1 ? 's' : ''}
 </p>
 </div>

 {canCreateInitiatives && (
 <motion.button
 type="button"
 onClick={() => setShowCreateModal(true)}
 whileTap={tapScaleSoft}
 className="app-btn app-btn-primary app-btn-lg w-full mb-5 py-3.5 text-base shadow-card"
 >
 <Plus className="w-5 h-5" />
 {initiatives.length === 0 ? 'Create Your First Initiative' : 'New Initiative'}
 </motion.button>
 )}

 {initiatives.length === 0 ? (
 <EmptyState
 className="rounded-2xl border border-gray-200/70 bg-white shadow-card"
 title={isSharedMember ? 'No Initiatives Yet' : 'Welcome to Nexus Impacts AI'}
 description={
 isSharedMember
 ? `Your organization doesn't have any initiatives yet. Tap "New Initiative" above to add one.`
 : 'Create your first initiative to start tracking impact.'
 }
 />
 ) : (
 <motion.div
 className="space-y-2.5"
 variants={staggerContainer}
 initial="hidden"
 animate="visible"
 >
 {initiatives.map((initiative) => {
 const locked = !!initiative.id && lockedIds.has(initiative.id)
 const showMenu = !locked && (canEditInitiatives || canDelete)
 return (
 <motion.div
 key={initiative.id}
 variants={fadeUp}
 className={`flex items-stretch bg-white rounded-2xl border shadow-card ${
 locked
 ? 'border-gray-200/70 opacity-90'
 : 'border-gray-200/70'
 }`}
 >
 <motion.button
 type="button"
 whileTap={tapScaleSoft}
 onClick={() => locked ? setShowUpgradeModal(true) : onEnterInitiative(initiative)}
 className="flex-1 min-w-0 text-left p-4 flex items-center gap-3"
 >
 {locked ? (
 <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 bg-amber-50 text-amber-600 ring-amber-100">
 <Lock className="w-4 h-4" />
 </div>
 ) : (
 <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white ring-1 ring-gray-100 overflow-hidden">
 <img
 src={orgLogoUrl || '/Nexuslogo.png'}
 alt=""
 className="w-full h-full object-contain"
 onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Nexuslogo.png' }}
 />
 </div>
 )}
 <h3
 className={`flex-1 min-w-0 text-sm font-semibold leading-snug line-clamp-2 ${
 locked ? 'text-gray-500' : 'text-gray-900'
 }`}
 title={initiative.title}
 >
 {initiative.title}
 </h3>
 {locked
 ? <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
 : <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
 </motion.button>

 {showMenu && (
 <button
 type="button"
 onClick={() => setOpenMenuId(openMenuId === initiative.id ? null : initiative.id!)}
 className="px-3 flex items-center text-gray-300 active:bg-gray-50 active:text-gray-600 rounded-r-2xl"
 aria-label="Options"
 >
 <Settings className="w-4 h-4" />
 </button>
 )}
 </motion.div>
 )
 })}
 </motion.div>
 )}

 {/* Settings popup - compact centered bubble */}
 {openMenuId && (() => {
 const initiative = initiatives.find(i => i.id === openMenuId)
 if (!initiative) return null
 return createPortal(
 <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setOpenMenuId(null)}>
 <div className="absolute inset-0 bg-black/20" />
 <div
 className="relative app-card-elevated w-64 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
 <p className="text-sm font-semibold text-gray-800 truncate">{initiative.title}</p>
 </div>
 <div className="py-1">
 {canEditInitiatives && (
 <button
 onClick={() => {
 setEditingInitiative(initiative)
 setShowEditModal(true)
 setOpenMenuId(null)
 }}
 className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
 >
 <Edit className="w-4 h-4 text-gray-400" />
 Edit Initiative
 </button>
 )}
 {canDelete && (
 <button
 onClick={() => {
 setDeleteConfirmInitiative(initiative)
 setOpenMenuId(null)
 }}
 className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
 >
 <Trash2 className="w-4 h-4" />
 Delete
 </button>
 )}
 </div>
 </div>
 </div>,
 document.body
 )
 })()}

 {/* Create Modal */}
 {showCreateModal && (
 <CreateInitiativeModal
 isOpen={showCreateModal}
 onClose={() => setShowCreateModal(false)}
 onSubmit={handleCreateInitiative}
 />
 )}

 {/* Edit Modal */}
 {showEditModal && editingInitiative && (
 <CreateInitiativeModal
 isOpen={showEditModal}
 onClose={() => {
 setShowEditModal(false)
 setEditingInitiative(null)
 }}
 onSubmit={handleEditInitiative}
 editData={editingInitiative}
 />
 )}

 {/* Delete Confirmation */}
 {deleteConfirmInitiative && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]">
 <div className="app-card max-w-sm w-full p-6">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
 <Trash2 className="w-5 h-5 text-red-600" />
 </div>
 <div>
 <h3 className="font-semibold text-gray-900">Delete Initiative</h3>
 <p className="text-xs text-gray-500">This cannot be undone</p>
 </div>
 </div>
 <p className="text-sm text-gray-600 mb-4">
 Delete "<strong>{deleteConfirmInitiative.title}</strong>"? This will also delete all KPIs, evidence, and stories.
 </p>
 <div className="mb-4">
 <label className="app-label text-xs">
 Type <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">DELETE MY INITIATIVE</span> to confirm:
 </label>
 <input
 type="text"
 value={deleteConfirmText}
 onChange={(e) => setDeleteConfirmText(e.target.value)}
 placeholder="DELETE MY INITIATIVE"
 className="app-input focus:border-red-500 focus:ring-red-100"
 />
 </div>
 <div className="flex gap-3">
 <button
 onClick={() => { setDeleteConfirmInitiative(null); setDeleteConfirmText('') }}
 className="app-btn app-btn-secondary flex-1 py-3"
 >
 Cancel
 </button>
 <button
 onClick={() => handleDeleteInitiative(deleteConfirmInitiative)}
 disabled={deleteConfirmText !== 'DELETE MY INITIATIVE'}
 className="app-btn app-btn-danger flex-1 py-3"
 >
 Delete
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Upgrade Modal - Initiative Limit Reached */}
 <UpgradeModal
 isOpen={showUpgradeModal}
 onClose={() => setShowUpgradeModal(false)}
 title="You've hit your initiative limit"
 subtitle={`You're using ${upgradeUsage?.current ?? initiatives.length} of ${upgradeUsage?.limit ?? 1} initiatives. Upgrade for more.`}
 />
 </div>
 )
}

