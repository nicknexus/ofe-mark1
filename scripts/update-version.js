import { mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dirname, '../frontend/dist')
const versionFile = resolve(distDir, 'version.json')

mkdirSync(distDir, { recursive: true })
writeFileSync(versionFile, JSON.stringify({ version: String(Date.now()) }) + '\n')
console.log(`[update-version] Wrote version ${Date.now()} to ${versionFile}`)
