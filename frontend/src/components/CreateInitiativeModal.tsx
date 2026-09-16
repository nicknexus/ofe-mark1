import React, { useEffect, useState } from 'react'
import { FolderKanban, Sparkles, Copy, LayoutTemplate } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from './ModalFrame'
import { CreateInitiativeForm, Initiative, ProgramTemplate } from '../types'
import { apiService } from '../services/api'

export type CreateInitiativeSource =
  | { kind: 'blank' }
  | { kind: 'template'; templateId: string }
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
 * Create / edit a program. On create the user also picks how to scaffold
 * it: blank, from a template (metrics + tags + groups), or by copying
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
  const [templates, setTemplates] = useState<ProgramTemplate[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || editData) return
    apiService.getProgramTemplates().then(setTemplates).catch(() => setTemplates([]))
  }, [isOpen, editData])

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

  const selectedTemplate = source.kind === 'template' ? templates.find(t => t.id === source.templateId) : null

  return (
    <ModalFrame zIndexClass="z-[60]" size={editData ? 'sm' : 'md'} onClose={onClose}>
      <ModalHeader
        title={editData ? 'Edit program' : 'New program'}
        subtitle={editData ? undefined : 'Name it, then pick how to start. You can add metrics, locations and groups any time from Set up.'}
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

            {!editData && (
              <div>
                <label className="app-label">Start from</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <SourceCard
                    icon={FolderKanban}
                    title="Blank"
                    desc="Add metrics and locations yourself."
                    active={source.kind === 'blank'}
                    onClick={() => setSource({ kind: 'blank' })}
                  />
                  <SourceCard
                    icon={LayoutTemplate}
                    title="Template"
                    desc="Ready-made metrics, tags and groups."
                    active={source.kind === 'template'}
                    onClick={() => setSource({ kind: 'template', templateId: templates[0]?.id || '' })}
                    disabled={templates.length === 0}
                  />
                  <SourceCard
                    icon={Copy}
                    title="Copy a program"
                    desc="Same structure, no data."
                    active={source.kind === 'duplicate'}
                    onClick={() => setSource({ kind: 'duplicate', sourceInitiativeId: duplicateCandidates[0]?.id || '' })}
                    disabled={duplicateCandidates.length === 0}
                  />
                </div>

                {source.kind === 'template' && templates.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {templates.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSource({ kind: 'template', templateId: t.id })}
                          className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${source.templateId === t.id
                            ? 'border-primary-500 bg-primary-50 text-primary-800'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                    {selectedTemplate && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                        <p className="text-xs text-gray-600 mb-2">{selectedTemplate.description}</p>
                        <ul className="space-y-1">
                          {selectedTemplate.metrics.map(m => (
                            <li key={m.title} className="text-xs text-gray-700 flex items-start gap-1.5">
                              <Sparkles className="w-3 h-3 text-primary-600 mt-0.5 flex-shrink-0" />
                              <span>
                                <span className="font-medium">{m.title}</span>
                                {m.tags && m.tags.length > 0 && <span className="text-gray-500"> · {m.tags.join(', ')}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {selectedTemplate.groups && selectedTemplate.groups.length > 0 && (
                          <p className="text-xs text-gray-500 mt-2">Groups: {selectedTemplate.groups.map(g => g.name).join(', ')}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {source.kind === 'duplicate' && duplicateCandidates.length > 0 && (
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

function SourceCard({ icon: Icon, title, desc, active, onClick, disabled }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
  active: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left rounded-xl border p-3 transition-colors ${active
        ? 'border-primary-500 bg-primary-50/60 ring-1 ring-primary-200'
        : 'border-gray-200 bg-white hover:bg-gray-50'} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${active ? 'text-primary-700' : 'text-gray-400'}`} />
        <span className="text-sm font-semibold text-gray-900">{title}</span>
      </div>
      <p className="text-xs text-gray-500 leading-snug">{desc}</p>
    </button>
  )
}
