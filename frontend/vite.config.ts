import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

function stampVersion() {
    let root = __dirname
    let outDir = 'dist'
    return {
        name: 'stamp-version',
        configResolved(config) {
            root = config.root
            outDir = config.build.outDir
        },
        closeBundle() {
            const dir = resolve(root, outDir)
            mkdirSync(dir, { recursive: true })
            writeFileSync(
                resolve(dir, 'version.json'),
                JSON.stringify({ version: String(Date.now()) }) + '\n',
            )
        },
    }
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
    plugins: [react(), ...(command === 'build' ? [stampVersion()] : [])],
    server: {
        port: 3000,
    },
    build: {
        outDir: 'dist',
    },
    define: {
        global: 'globalThis',
    },
    // Without this, our direct `three` dep and the copy bundled by
    // `react-globe.gl` end up as two separate modules → "Multiple instances
    // of Three.js" warning + double the WebGL context churn during HMR.
    resolve: {
        dedupe: ['three'],
    },
    optimizeDeps: {
        include: ['three'],
    },
}))
