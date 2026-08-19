import React from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import ModalFrame from '../ModalFrame'
import { Spinner } from '../ui'
import type { DangerTabProps } from './accountTypes'

export function DangerTab({ hasOwnOrganization, showDeleteModal, setShowDeleteModal, deleteConfirmation, setDeleteConfirmation, deleting, handleDeleteAccount }: DangerTabProps) {
 return (
 <>
 <div className="app-card border border-red-200 p-6">
 <h2 className="text-base font-semibold text-red-800">Delete account</h2>
 <p className="text-sm text-secondary-500 mt-1">Permanently delete your account and all associated data. This cannot be undone.</p>
 {hasOwnOrganization && (
 <p className="text-sm text-red-600 mt-2">This also deletes the organization, programs, metrics, evidence, stories, and team members.</p>
 )}
 <button onClick={() => setShowDeleteModal(true)} className="app-btn app-btn-danger mt-5">
 <Trash2 className="w-4 h-4" />Delete my account
 </button>
 </div>

 {/* Delete Modal */}
 {showDeleteModal && (
 <ModalFrame zIndexClass="z-50" size="sm" panelClassName="bg-white rounded-xl shadow-app-modal max-w-md w-full p-6">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-red-100 rounded-xl"><AlertTriangle className="w-6 h-6 text-red-600" /></div>
 <h2 className="text-xl font-bold text-gray-900">Delete Account</h2>
 </div>
 <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmation('') }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
 <X className="w-5 h-5 text-gray-500" />
 </button>
 </div>
 <div className="space-y-4">
 <div className="p-4 bg-red-50 rounded-xl border border-red-100">
 <p className="text-sm text-red-800 font-medium mb-2">This action is permanent and cannot be undone.</p>
 <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
 <li>Your account and profile</li>
 {hasOwnOrganization && <><li>Your organization</li><li>All programs and metrics</li><li>All evidence and stories</li><li>All team members</li></>}
 <li>Your subscription</li>
 </ul>
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Type <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">DELETE MY ACCOUNT</span> to confirm:</label>
 <input type="text" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder="DELETE MY ACCOUNT" className="app-input" disabled={deleting} />
 </div>
 <div className="flex gap-3 pt-2">
 <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmation('') }} disabled={deleting} className="app-btn app-btn-secondary flex-1">Cancel</button>
 <button onClick={handleDeleteAccount} disabled={deleting || deleteConfirmation !== 'DELETE MY ACCOUNT'} className="app-btn app-btn-danger flex-1 flex items-center justify-center gap-2">
 {deleting ? <><Spinner className="w-4 h-4 border-white border-t-white/30" />Deleting...</> : <><Trash2 className="w-4 h-4" />Delete Forever</>}
 </button>
 </div>
 </div>
 </ModalFrame>
 )}
 </>
 )
}
