import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Upload, X } from 'lucide-react'
import ModalFrame, { ModalBody, ModalFooter, ModalHeader } from '../ModalFrame'
import { Spinner } from '../ui'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { getLocalDateString } from '../../utils'
import type { ContentSource, Initiative } from '../../types'

const MAX_FILES = 10

export default function ContentUploadModal({
  programs,
  defaultInitiativeId,
  defaultTitle,
  subtitle = 'Saved as visual evidence on the program, so it counts as tracked proof.',
  noteLabel = "What's happening? (optional)",
  notePlaceholder = 'Nexus uses this when it drafts the post.',
  onClose,
  onUploaded,
}: {
  programs: Initiative[]
  defaultInitiativeId?: string | null
  defaultTitle?: string
  subtitle?: string
  noteLabel?: string
  notePlaceholder?: string
  onClose: () => void
  onUploaded: (sources: ContentSource[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [initiativeId, setInitiativeId] = useState(defaultInitiativeId || (programs.length === 1 ? programs[0].id || '' : ''))
  const [title, setTitle] = useState(defaultTitle || '')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(getLocalDateString(new Date()))
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const previews = useMemo(() => files.map(file => URL.createObjectURL(file)), [files])
  useEffect(() => () => previews.forEach(url => URL.revokeObjectURL(url)), [previews])

  const addFiles = (list: FileList | null) => {
    const picked = Array.from(list || []).filter(file => file.type.startsWith('image/'))
    if (picked.length === 0) return
    setFiles(prev => [...prev, ...picked].slice(0, MAX_FILES))
  }

  const busy = progress !== null
  const canSubmit = files.length > 0 && !!initiativeId && !!title.trim() && !!date && !busy

  const submit = async () => {
    if (!canSubmit) return
    const program = programs.find(p => p.id === initiativeId)
    const uploaded: ContentSource[] = []
    let pending = false
    setProgress({ done: 0, total: files.length })
    try {
      for (const file of files) {
        const { file_url, size } = await apiService.uploadFile(file)
        const evidence = await apiService.createEvidence({
          title: title.trim(),
          description: description.trim() || undefined,
          type: 'visual_proof',
          date_represented: date,
          initiative_id: initiativeId,
          file_url,
          file_urls: [file_url],
          file_sizes: [size],
        })
        if (evidence.approval_status === 'pending') pending = true
        if (evidence.id) {
          uploaded.push({
            source_type: 'evidence',
            source_id: evidence.id,
            title: evidence.title || title.trim(),
            description: evidence.description || description.trim() || undefined,
            date_represented: evidence.date_represented || date,
            image_url: file_url,
            initiative_id: initiativeId,
            initiative_title: program?.title || 'Program',
          })
        }
        setProgress(prev => (prev ? { ...prev, done: prev.done + 1 } : prev))
      }
      notify.success(
        pending
          ? 'Saved as evidence. It stays pending until someone approves it.'
          : uploaded.length === 1 ? 'Photo added to evidence' : `${uploaded.length} photos added to evidence`
      )
      onUploaded(uploaded)
    } catch (error) {
      notify.error((error as Error).message || 'Upload failed')
      if (uploaded.length) onUploaded(uploaded)
      setProgress(null)
    }
  }

  return (
    <ModalFrame size="md" onClose={busy ? undefined : onClose}>
      <ModalHeader
        icon={ImagePlus}
        title="Upload photos"
        subtitle={subtitle}
        onClose={busy ? undefined : onClose}
      />
      <ModalBody rail>
        <div className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { addFiles(e.target.files); e.target.value = '' }}
            />
            {files.length === 0 ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
                className="w-full app-card-muted border-dashed py-10 flex flex-col items-center gap-2 text-secondary-500 hover:border-primary-300 hover:text-primary-800 transition-colors"
              >
                <Upload className="w-6 h-6" />
                <span className="text-sm font-medium">Choose photos or drop them here</span>
                <span className="text-[12px] text-secondary-400">Up to {MAX_FILES}</span>
              </button>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {previews.map((url, i) => (
                  <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    {!busy && (
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {files.length < MAX_FILES && !busy && (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="aspect-square rounded-lg border border-dashed border-gray-300 text-secondary-400 hover:text-primary-800 hover:border-primary-300 flex items-center justify-center"
                    aria-label="Add more"
                  >
                    <ImagePlus className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="app-label">Program</label>
            <select className="app-input" value={initiativeId} disabled={busy} onChange={e => setInitiativeId(e.target.value)}>
              <option value="">Pick a program</option>
              {programs.filter(p => p.id).map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-3">
            <div>
              <label className="app-label">Title</label>
              <input className="app-input" value={title} disabled={busy} onChange={e => setTitle(e.target.value)} placeholder="First day of reading club" />
            </div>
            <div>
              <label className="app-label">Date</label>
              <input type="date" className="app-input" value={date} disabled={busy} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="app-label">{noteLabel}</label>
            <textarea
              className="app-input resize-none"
              rows={3}
              value={description}
              disabled={busy}
              onChange={e => setDescription(e.target.value)}
              placeholder={notePlaceholder}
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="app-btn app-btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className="app-btn app-btn-primary" disabled={!canSubmit} onClick={submit}>
          {busy ? <Spinner className="w-3.5 h-3.5" /> : null}
          {busy ? `Uploading ${Math.min(progress!.done + 1, progress!.total)} of ${progress!.total}` : files.length > 1 ? `Upload ${files.length} photos` : 'Upload'}
        </button>
      </ModalFooter>
    </ModalFrame>
  )
}
