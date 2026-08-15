const EXT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mpeg: 'video/mpeg',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  m4v: 'video/x-m4v',
  avi: 'video/x-msvideo',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
}

/** Browsers leave `file.type` empty for a lot of real-world files (.mov, Office). */
export function inferContentType(file: File): string {
  if (file.type && file.type.trim()) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  return EXT_TYPES[ext] || 'application/octet-stream'
}

/** Existing + legacy single `file_url` as a stable URL list for edit payloads. */
export function existingEvidenceFileUrls(evidence: {
  file_url?: string
  files?: { file_url: string }[]
}): string[] {
  const fromFiles = (evidence.files || []).map(f => f.file_url).filter(Boolean)
  if (fromFiles.length > 0) return fromFiles
  return evidence.file_url ? [evidence.file_url] : []
}
