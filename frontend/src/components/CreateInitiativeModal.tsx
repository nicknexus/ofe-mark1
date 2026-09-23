import React, { useEffect, useState } from 'react'
import { FolderKanban, Copy } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from './ModalFrame'
import { CreateInitiativeForm, Initiative } from '../types'

export type CreateInitiativeSource =
  | { kind: 'blank' }
  | { kind: 'duplicate'; sourceInitiativeId: string }

interface CreateInitiativeModalProps {
  isOpen: boolean
  onClose: () => void
  /**
   * Create mode receives the chosen structure source alongside the form so
   * the parent can call the right endpoint. Edit mode ignores it.
   */
  onSubmit: (data: CreateInitiativeForm, source: CreateInitiativeSource) => Promise<void>
  editData?: any
  /** Existing programs offered under "Copy structure from". */
  duplicateCandidates?: Initiative[]
  /** Preselect a duplicate source (e.g. card menu "Duplicate structure"). */
  initialSource?: CreateInitiativeSource
}

/**
 * Create / edit a program. On create the user can start blank or copy
 * another program's structure. The legacy free-text Region / Location
 * inputs are gone: they were unrelated to the location entities that drive
 * matching and made people think they had set a location when they had not.
 */
export default function CreateInitiativeModal({
  isOpen,
  onClose,
  onSubmit,
  editData,
  duplicateCandidates = [],
  initialSource,
}: CreateInitiativeModalProps) {
  const [formData, setFormData] = useState<CreateInitiativeForm>({
    title: editData?.title || '',
    description: editData?.description || '',
    region: editData?.region || '',
    location: editData?.location || '',
  })
  const [source, setSource] = useState<CreateInitiativeSource>(initialSource || { kind: 'blank' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialSource) setSource(initialSource)
  }, [initialSource])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(formData, source)
      if (!editData) {
        setFormData({ title: '', description: '', region: '', location: '' })
        setSource({ kind: 'blank' })
      }
      onClose()
    } catch {
      // Parent surfaces the error; keep the modal open.
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  if (!isOpen) return null

  return (
    <ModalFrame zIndexClass="z-[60]" size={editData ? 'sm' : 'md'} onClose={onClose}>
      <ModalHeader
        title={editData ? 'Edit program' : 'New program'}
        subtitle={editData ? undefined : 'You can add metrics, locations and groups any time from Quick setup.'}
        icon={FolderKanban}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
        <ModalBody rail>
          <div className="space-y-4">
            <div>
              <label className="app-label">Program title <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="app-input"
                placeholder="e.g. Youth Training Program 2025"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="app-label">Description <span className="text-red-500">*</span></label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="app-input resize-none"
                rows={3}
                placeholder="What this program aims to achieve"
                required
              />
            </div>

            {!editData && duplicateCandidates.length > 0 && (
              <div>
                <label className="app-label">Start from</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <SourceCard
                    icon={FolderKanban}
                    title="Blank"
                    desc="Add metrics and locations yourself."
                    active={source.kind === 'blank'}
                    onClick={() => setSource({ kind: 'blank' })}
                  />
                  <SourceCard
                    icon={Copy}
                    title="Copy a program"
                    desc="Same structure, no data."
                    active={source.kind === 'duplicate'}
                    onClick={() => setSource({ kind: 'duplicate', sourceInitiativeId: duplicateCandidates[0]?.id || '' })}
                  />
                </div>

                {source.kind === 'duplicate' && (
                  <div className="mt-3">
                    <select
                      value={source.sourceInitiativeId}
                      onChange={(e) => setSource({ kind: 'duplicate', sourceInitiativeId: e.target.value })}
                      className="app-input"
                    >
                      {duplicateCandidates.map(i => (
                        <option key={i.id} value={i.id}>{i.title}</option>
                      ))}
                    </select>
                    <p className="app-help">Copies metrics (with tags), linked locations and beneficiary groups. Claims, evidence and stories are not copied.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={onClose} className="app-btn app-btn-secondary">Cancel</button>
          <button type="submit" disabled={loading || !formData.title.trim() || !formData.description.trim()} className="app-btn app-btn-primary">
            {loading ? (editData ? 'Saving' : 'Creating') : (editData ? 'Save changes' : 'Create program')}
          </button>
        </ModalFooter>
      </form>
    </ModalFrame>
  )
}

function SourceCard({ icon: Icon, title, desc, active, onClick }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-3 transition-colors ${active
        ? 'border-primary-500 bg-primary-50/60 ring-1 ring-primary-200'
        : 'border-gray-200 bg-white hover:bg-gray-50'}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${active ? 'text-primary-700' : 'text-gray-400'}`} />
        <span className="text-sm font-semibold text-gray-900">{title}</span>
      </div>
      <p className="text-xs text-gray-500 leading-snug">{desc}</p>
    </button>
  )
}
