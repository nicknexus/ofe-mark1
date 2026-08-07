/**
 * Image loading for the PDF report.
 *
 * @react-pdf/renderer can take a remote URL directly, but that makes the render
 * depend on a network fetch completing mid-render — which is precisely the
 * failure mode that made the old html2canvas export unreliable. Instead every
 * image is resolved to a data URI *before* the document is constructed, with a
 * timeout, and any failure yields null so the report renders without it rather
 * than throwing.
 *
 * SVG is rasterised, because react-pdf's <Image> only handles PNG/JPEG.
 */

/** Longest we'll wait for any single image. */
const TIMEOUT_MS = 8000

/** Cap the raster size — a 4000px logo would bloat the PDF for no visible gain. */
const MAX_EDGE = 900

export async function loadImageAsDataUrl(url?: string | null): Promise<string | null> {
    if (!url) return null

    try {
        const blob = await fetchWithTimeout(url)
        if (!blob) return null

        // react-pdf can't draw SVG through <Image>, so rasterise it first.
        if (blob.type.includes('svg')) {
            return await rasterize(blob)
        }

        const dataUrl = await blobToDataUrl(blob)
        if (!dataUrl) return null

        // Very large bitmaps get downscaled; small ones pass through untouched.
        return await maybeDownscale(dataUrl)
    } catch {
        // Any failure here is non-fatal by design — the report just omits it.
        return null
    }
}

/** Resolve several images at once; failures come back as null in place. */
export async function loadImages(
    urls: Record<string, string | null | undefined>
): Promise<Record<string, string | null>> {
    const keys = Object.keys(urls)
    const results = await Promise.all(keys.map((k) => loadImageAsDataUrl(urls[k])))
    return Object.fromEntries(keys.map((k, i) => [k, results[i]]))
}

async function fetchWithTimeout(url: string): Promise<Blob | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
        const res = await fetch(url, { signal: controller.signal, mode: 'cors' })
        if (!res.ok) return null
        return await res.blob()
    } catch {
        return null
    } finally {
        clearTimeout(timer)
    }
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
    })
}

function loadBitmap(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        const img = new Image()
        const timer = setTimeout(() => resolve(null), TIMEOUT_MS)
        img.onload = () => { clearTimeout(timer); resolve(img) }
        img.onerror = () => { clearTimeout(timer); resolve(null) }
        img.src = src
    })
}

async function rasterize(blob: Blob): Promise<string | null> {
    const objectUrl = URL.createObjectURL(blob)
    try {
        const img = await loadBitmap(objectUrl)
        if (!img) return null
        // SVGs may report no intrinsic size; fall back to a sane square.
        const w = img.naturalWidth || 512
        const h = img.naturalHeight || 512
        return draw(img, w, h)
    } finally {
        URL.revokeObjectURL(objectUrl)
    }
}

async function maybeDownscale(dataUrl: string): Promise<string> {
    const img = await loadBitmap(dataUrl)
    if (!img) return dataUrl
    const { naturalWidth: w, naturalHeight: h } = img
    if (Math.max(w, h) <= MAX_EDGE) return dataUrl
    return draw(img, w, h) ?? dataUrl
}

function draw(img: HTMLImageElement, w: number, h: number): string | null {
    const scale = Math.min(1, MAX_EDGE / Math.max(w, h))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    try {
        return canvas.toDataURL('image/png')
    } catch {
        // Tainted canvas (image served without CORS headers).
        return null
    }
}
