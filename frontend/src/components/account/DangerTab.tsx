import React from 'react'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import ModalFrame from '../ModalFrame'
import type { DangerTabProps } from './accountTypes'

export function DangerTab({ hasOwnOrganization, showDeleteModal, setShowDeleteModal, deleteConfirmation, setDeleteConfirmation, deleting, handleDeleteAccount }: DangerTabProps) {
    return (
        <>
            <div className="bg-white rounded-2xl shadow-bubble border border-red-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-50 rounded-xl"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                    <h2 className="text-lg font-semibold text-red-800">Danger Zone</h2>
                </div>
                <div className="space-y-4">
                    <div>
                        <h3 className="font-medium text-gray-900">Delete Account</h3>
                        <p className="text-sm text-gray-600 mt-1">Permanently delete your account and all associated data. This action cannot be undone.</p>
                        {hasOwnOrganization && (
                            <p className="text-sm text-red-600 mt-2"><strong>Warning:</strong> This will also delete your organization, all initiatives, metrics, evidence, stories, and team members.</p>
                        )}
                    </div>
                    <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-xl transition-colors flex items-center gap-2 border border-red-200">
                        <Trash2 className="w-4 h-4" />Delete My Account
                    </button>
                </div>
            </div>

            {/* Delete Modal */}
            {showDeleteModal && (
                <ModalFrame zIndexClass="z-50" backdropClassName="bg-black/50" panelClassName="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
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
                                    {hasOwnOrganization && <><li>Your organization</li><li>All initiatives and metrics</li><li>All evidence and stories</li><li>All team members</li></>}
                                    <li>Your subscription</li>
                                </ul>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Type <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">DELETE MY ACCOUNT</span> to confirm:</label>
                                <input type="text" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)} placeholder="DELETE MY ACCOUNT" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500" disabled={deleting} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setShowDeleteModal(false); setDeleteConfirmation('') }} disabled={deleting} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors">Cancel</button>
                                <button onClick={handleDeleteAccount} disabled={deleting || deleteConfirmation !== 'DELETE MY ACCOUNT'} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                    {deleting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Deleting...</> : <><Trash2 className="w-4 h-4" />Delete Forever</>}
                                </button>
                            </div>
                        </div>
                </ModalFrame>
            )}
        </>
    )
}
