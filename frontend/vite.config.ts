import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

function stampVersion() {
    return {
        name: 'stamp-version',
        buildStart() {
            const file = resolve(__dirname, 'public/version.json')
            writeFileSync(file, JSON.stringify({ version: String(Date.now()) }) + '\n')
        },
    }
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react(), stampVersion()],
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
})
