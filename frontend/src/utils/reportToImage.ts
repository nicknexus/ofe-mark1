import { toBlob } from 'html-to-image'

// Capture resolution multiplier. 2x ≈ retina/print-crisp.
const PIXEL_RATIO = 2

/**
 * Renders the report element to a high-resolution PNG. Uses html-to-image
 * (SVG <foreignObject> + the browser's own renderer) rather than html2canvas,
 * so modern CSS the report relies on — object-fit: cover, aspect-ratio,
 * gradients, shadows — is reproduced exactly. The result is a pixel-faithful
 * photo of the on-screen report.
 *
 * All images in the report must be data URLs (already the case) because
 * foreignObject cannot fetch cross-origin resources.
 */
export async function convertReportToImage(elementId: string): Promise<Blob> {
    const element = document.getElementById(elementId)
    if (!element) {
        throw new Error(`Element with id "${elementId}" not found`)
    }

    // Ensure the web font (Inter) is fully loaded before snapshotting, otherwise
    // html-to-image can rasterise with a fallback font whose different letter
    // widths shift/overlap the text in the capture.
    if (document.fonts?.ready) {
        try { await document.fonts.ready } catch { /* non-fatal */ }
    }

    const width = element.offsetWidth
    const height = element.scrollHeight

    const blob = await toBlob(element, {
        pixelRatio: PIXEL_RATIO,
        backgroundColor: '#ffffff',
        cacheBust: true,
        width,
        height,
        // Pin the clone's box so a scaled/off-screen wrapper can't distort it.
        style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: 'none',
            margin: '0'
        }
    })

    if (!blob) {
        throw new Error('Failed to render report image')
    }

    return blob
}
