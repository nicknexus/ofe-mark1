const TUS_VERSION = '1.0.0'
const CHUNK_SIZE = 6 * 1024 * 1024

function encodeMetadata(meta: Record<string, string>): string {
  return Object.entries(meta)
    .map(([key, value]) => {
      const bytes = new TextEncoder().encode(value)
      let binary = ''
      bytes.forEach((b) => { binary += String.fromCharCode(b) })
      return `${key} ${btoa(binary)}`
    })
    .join(',')
}

function storageProjectHost(supabaseUrl: string): string {
  try {
    const host = new URL(supabaseUrl).hostname // <ref>.supabase.co
    const ref = host.split('.')[0]
    return `https://${ref}.storage.supabase.co`
  } catch {
    return supabaseUrl
  }
}

/**
 * TUS resumable upload against Supabase Storage. Used for files > 6MB —
 * a single PUT to a signed URL is flaky past that and was surfacing as
 * a bogus "file too large" error.
 */
export function tusUploadToSupabase(opts: {
  file: File
  filePath: string
  contentType: string
  supabaseUrl: string
  accessToken: string
  anonKey: string
  signedToken?: string
  onProgress?: (loaded: number, total: number) => void
  abortSignal?: AbortSignal
}): Promise<void> {
  const endpoint = `${storageProjectHost(opts.supabaseUrl)}/storage/v1/upload/resumable`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.accessToken}`,
    apikey: opts.anonKey,
    'Tus-Resumable': TUS_VERSION,
    'Upload-Length': String(opts.file.size),
    'Upload-Metadata': encodeMetadata({
      bucketName: 'evidence-files',
      objectName: opts.filePath,
      contentType: opts.contentType,
      cacheControl: '3600',
    }),
  }
  if (opts.signedToken) headers['x-signature'] = opts.signedToken

  return new Promise((resolve, reject) => {
    if (opts.abortSignal?.aborted) {
      reject(new Error('Upload cancelled'))
      return
    }

    const xhr = new XMLHttpRequest()
    const abort = () => {
      xhr.abort()
      reject(new Error('Upload cancelled'))
    }
    opts.abortSignal?.addEventListener('abort', abort, { once: true })

    xhr.addEventListener('load', () => {
      if (xhr.status !== 201 && xhr.status !== 200) {
        opts.abortSignal?.removeEventListener('abort', abort)
        reject(new Error(`Resumable upload failed to start (${xhr.status})`))
        return
      }
      const location = xhr.getResponseHeader('Location')
      if (!location) {
        opts.abortSignal?.removeEventListener('abort', abort)
        reject(new Error('Resumable upload did not return a session URL'))
        return
      }
      patchChunks(location, 0)
    })
    xhr.addEventListener('error', () => {
      opts.abortSignal?.removeEventListener('abort', abort)
      reject(new Error('Resumable upload network error'))
    })
    xhr.open('POST', endpoint)
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
    xhr.send()

    const patchChunks = (location: string, offset: number) => {
      if (opts.abortSignal?.aborted) {
        reject(new Error('Upload cancelled'))
        return
      }
      if (offset >= opts.file.size) {
        opts.abortSignal?.removeEventListener('abort', abort)
        opts.onProgress?.(opts.file.size, opts.file.size)
        resolve()
        return
      }

      const end = Math.min(offset + CHUNK_SIZE, opts.file.size)
      const chunk = opts.file.slice(offset, end)
      const patch = new XMLHttpRequest()
      const abortPatch = () => {
        patch.abort()
        reject(new Error('Upload cancelled'))
      }
      opts.abortSignal?.addEventListener('abort', abortPatch, { once: true })

      patch.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) opts.onProgress?.(offset + e.loaded, opts.file.size)
      })
      patch.addEventListener('load', () => {
        opts.abortSignal?.removeEventListener('abort', abortPatch)
        if (patch.status < 200 || patch.status >= 300) {
          reject(new Error(`Resumable upload chunk failed (${patch.status})`))
          return
        }
        const next = Number(patch.getResponseHeader('Upload-Offset') || end)
        patchChunks(location, Number.isFinite(next) ? next : end)
      })
      patch.addEventListener('error', () => {
        opts.abortSignal?.removeEventListener('abort', abortPatch)
        reject(new Error('Resumable upload network error'))
      })
      patch.open('PATCH', location)
      patch.setRequestHeader('Tus-Resumable', TUS_VERSION)
      patch.setRequestHeader('Upload-Offset', String(offset))
      patch.setRequestHeader('Content-Type', 'application/offset+octet-stream')
      patch.setRequestHeader('Authorization', headers.Authorization)
      patch.setRequestHeader('apikey', headers.apikey)
      if (opts.signedToken) patch.setRequestHeader('x-signature', opts.signedToken)
      patch.send(chunk)
    }
  })
}
