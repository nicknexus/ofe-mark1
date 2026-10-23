export interface EvidenceFileReference {
 file_url: string
 file_size?: number | null
}

export interface EvidenceFileCleanupStore {
 isReferenced: (url: string) => Promise<boolean>
 deleteFile: (url: string) => Promise<void>
 decrementStorage: (size: number) => Promise<void>
}

/** Several scope records may own the same upload. Release it only after the last reference. */
export async function releaseEvidenceFiles(files: EvidenceFileReference[], store: EvidenceFileCleanupStore): Promise<void> {
 const unique = new Map<string, number>()
 for (const file of files) unique.set(file.file_url, Math.max(unique.get(file.file_url) || 0, file.file_size || 0))
 for (const [url, size] of unique) {
  // A failed reference lookup must fail closed: never remove a possibly owned file.
  if (await store.isReferenced(url)) continue
  await store.deleteFile(url)
  if (size > 0) await store.decrementStorage(size)
 }
}
