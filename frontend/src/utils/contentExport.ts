/** Copy caption, then native-share the photo (phones) or download it (desktop). */

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  if (typeof navigator.canShare !== 'function') return false
  try {
    const probe = new File(['x'], 'probe.jpg', { type: 'image/jpeg' })
    return navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

export function triggerDownload(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function exportPhotoWithCaption(opts: {
  file: File
  caption: string
  preferShare: boolean
}): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (opts.caption.trim()) {
    try {
      await navigator.clipboard.writeText(opts.caption)
    } catch {
      // Still share/download the photo.
    }
  }

  if (opts.preferShare) {
    try {
      await navigator.share({
        files: [opts.file],
        text: opts.caption || undefined,
        title: opts.file.name,
      })
      return 'shared'
    } catch (error) {
      const name = (error as Error)?.name
      if (name === 'AbortError') return 'cancelled'
    }
  }

  triggerDownload(opts.file)
  return 'downloaded'
}
