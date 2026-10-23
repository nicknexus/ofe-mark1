// node -r sucrase/register --test backend/src/utils/evidenceFileCleanup.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { releaseEvidenceFiles } from './evidenceFileCleanup'

test('shared files survive removal from one scope and are released after the last reference', async () => {
 const references = new Set(['shared.jpg'])
 const deleted: string[] = []
 const decrements: number[] = []
 const store = {
  async isReferenced(url: string) { return references.has(url) },
  async deleteFile(url: string) { deleted.push(url) },
  async decrementStorage(size: number) { decrements.push(size) },
 }
 const files = [{ file_url: 'shared.jpg', file_size: 100 }, { file_url: 'only-here.pdf', file_size: 200 }]
 await releaseEvidenceFiles(files, store)
 assert.deepEqual(deleted, ['only-here.pdf'])
 assert.deepEqual(decrements, [200])
 references.delete('shared.jpg')
 await releaseEvidenceFiles([files[0], { file_url: 'shared.jpg' }], store)
 assert.deepEqual(deleted, ['only-here.pdf', 'shared.jpg'])
 assert.deepEqual(decrements, [200, 100])
})

test('a failed reference lookup never deletes or decrements a possibly shared file', async () => {
 let mutations = 0
 await assert.rejects(releaseEvidenceFiles([{ file_url: 'photo.jpg', file_size: 100 }], {
  async isReferenced() { throw new Error('Unavailable') },
  async deleteFile() { mutations++ },
  async decrementStorage() { mutations++ },
 }), /Unavailable/)
 assert.equal(mutations, 0)
})
