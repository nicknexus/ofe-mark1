// Loads an image URL (same-origin or remote) and re-encodes it as a PNG data
// URL. Feeding the report canvas data URLs (instead of remote src) keeps the
// html2canvas capture free of CORS/taint failures, and gives us a single
// failure point: any error (404, CORS, tainted canvas) resolves to null so the
// report simply omits the image.
export async function imageToDataUrl(url: string): Promise<string | null> {
    try {
        const img = new Image()
        img.crossOrigin = 'anonymous'

        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
            img.src = url
        })

        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        if (canvas.width === 0 || canvas.height === 0) return null

        const ctx = canvas.getContext('2d')
        if (!ctx) return null
        ctx.drawImage(img, 0, 0)

        return canvas.toDataURL('image/png')
    } catch {
        return null
    }
}
