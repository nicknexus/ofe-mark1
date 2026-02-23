import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const versionFile = resolve(__dirname, '../frontend/public/version.json')

writeFileSync(versionFile, JSON.stringify({ version: String(Date.now()) }) + '\n')
console.log(`[update-version] Wrote version ${Date.now()} to ${versionFile}`)
