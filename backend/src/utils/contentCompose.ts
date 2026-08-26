import sharp from 'sharp'

const SIZE = 1080
const DEFAULT_BRAND = '#c0dfa1'
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i
const FONT = 'DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif'

export type GraphicLayout = 'clean' | 'title' | 'stats'

export const GRAPHIC_LAYOUTS: GraphicLayout[] = ['clean', 'title', 'stats']

export function parseGraphicLayout(value: unknown): GraphicLayout {
    return GRAPHIC_LAYOUTS.includes(value as GraphicLayout) ? (value as GraphicLayout) : 'clean'
}

export type ComposeOverlay = {
    label: string
    value: number
    unit: string
}

export async function composeBrandedPng(input: {
    photo: Buffer
    logo?: Buffer | null
    orgName: string
    photoTitle?: string
    location?: string | null
    brandColor?: string | null
    overlay?: ComposeOverlay | null
    layout?: GraphicLayout
}): Promise<Buffer> {
    const layout = parseGraphicLayout(input.layout)
    const brand = contrastBand(normalizeHex(input.brandColor) || DEFAULT_BRAND)
    const photo = await sharp(input.photo)
        .rotate()
        .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
        .toBuffer()

    const logoSize = 104
    let logoBuf: Buffer | null = null
    if (input.logo) {
        try {
            logoBuf = await sharp(input.logo)
                .rotate()
                .resize(logoSize, logoSize, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                })
                .png()
                .toBuffer()
        } catch {
            logoBuf = null
        }
    }

    const svg = Buffer.from(layoutSvg({
        layout,
        brand,
        orgName: input.orgName || 'Impact',
        photoTitle: input.photoTitle || '',
        location: input.location || '',
        overlay: input.overlay,
        hasLogo: !!logoBuf,
    }))

    const layers: sharp.OverlayOptions[] = [{ input: svg, top: 0, left: 0 }]
    if (logoBuf) {
        layers.push({ input: logoBuf, left: 52, top: 52 })
    }

    return sharp(photo)
        .composite(layers)
        .png({ compressionLevel: 8 })
        .toBuffer()
}

function layoutSvg(opts: {
    layout: GraphicLayout
    brand: string
    orgName: string
    photoTitle: string
    location: string
    overlay?: ComposeOverlay | null
    hasLogo: boolean
}): string {
    const padX = 48
    const nameX = opts.hasLogo ? 188 : padX
    const logoChip = opts.hasLogo
        ? `<rect x="36" y="36" width="136" height="136" rx="24" fill="#ffffff"/>`
        : ''
    const orgLines = wrapText(opts.orgName || 'Impact', 36, SIZE - nameX - padX, 2)
    const orgBlock = textBlock({
        x: nameX,
        y: opts.hasLogo ? 104 : 72,
        fontSize: 36,
        fontWeight: 700,
        lines: orgLines,
    })

    if (opts.layout === 'clean') {
        return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  ${filters()}
  ${logoChip}
  ${orgBlock}
</svg>`
    }

    const maxW = SIZE - padX * 2
    const titleSize = 70
    const statSize = 46
    const labelSize = 28
    const locSize = 24
    const titleLines = wrapText(opts.photoTitle, titleSize, maxW, 3)
    const hasStat = !!(opts.overlay && opts.overlay.value != null && !Number.isNaN(Number(opts.overlay.value)))
    const statLines = opts.layout === 'stats' && hasStat ? wrapText(formatHeadline(opts.overlay!), statSize, maxW, 2) : []
    const labelLines = opts.layout === 'stats' && hasStat ? wrapText(opts.overlay?.label || 'Result', labelSize, maxW, 2) : []
    const locLines = opts.layout === 'stats' && opts.location ? wrapText(opts.location, locSize, maxW, 2) : []

    const stack: string[] = []
    let y = SIZE - 56
    const stackUp = (lines: string[], fontSize: number, fontWeight: number, opacity = 1) => {
        if (!lines.length) return
        const lh = Math.round(fontSize * 1.2)
        const firstY = y - (lines.length - 1) * lh
        stack.push(textBlock({ x: padX, y: firstY, fontSize, fontWeight, lines, lineHeight: lh, opacity }))
        y = firstY - fontSize - 18
    }

    stackUp(locLines, locSize, 600, 0.92)
    stackUp(labelLines, labelSize, 500, 0.9)
    stackUp(statLines, statSize, 700)
    stackUp(titleLines, titleSize, 700)

    const fadeTop = Math.min(SIZE - 280, Math.max(480, y - 70))
    const fadeH = SIZE - fadeTop

    return `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  ${filters()}
  <rect y="${fadeTop}" width="${SIZE}" height="${fadeH}" fill="url(#fade)"/>
  <rect y="${SIZE - 10}" width="${SIZE}" height="10" fill="${opts.brand}"/>
  ${logoChip}
  ${orgBlock}
  ${stack.join('\n  ')}
</svg>`
}

function textBlock(opts: {
    x: number
    y: number
    fontSize: number
    fontWeight: number
    lines: string[]
    lineHeight?: number
    opacity?: number
}): string {
    if (!opts.lines.length) return ''
    const lh = opts.lineHeight ?? Math.round(opts.fontSize * 1.2)
    const opacity = opts.opacity == null ? '' : ` opacity="${opts.opacity}"`
    return opts.lines.map((line, i) => (
        `<text x="${opts.x}" y="${opts.y + i * lh}" font-family="${FONT}" font-size="${opts.fontSize}" font-weight="${opts.fontWeight}" fill="#ffffff"${opacity} filter="url(#s)">${escapeXml(line)}</text>`
    )).join('\n  ')
}

function wrapText(value: string, fontSize: number, maxWidth: number, maxLines: number): string[] {
    const text = value.replace(/\s+/g, ' ').trim()
    if (!text) return []
    const maxChars = Math.max(8, Math.floor(maxWidth / (fontSize * 0.56)))
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''
    for (let i = 0; i < words.length; i++) {
        const word = words[i]
        const trial = current ? `${current} ${word}` : word
        if (trial.length <= maxChars) {
            current = trial
            continue
        }
        if (current) lines.push(current)
        if (lines.length >= maxLines - 1) {
            const rest = [word, ...words.slice(i + 1)].join(' ')
            lines.push(truncate(rest, maxChars))
            return lines
        }
        current = word.length > maxChars ? truncate(word, maxChars) : word
    }
    if (current) lines.push(current)
    return lines.slice(0, maxLines)
}

function filters(): string {
    return `<defs>
  <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
  </filter>
  <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000000" stop-opacity="0.58"/>
  </linearGradient>
</defs>`
}

function formatHeadline(overlay: ComposeOverlay): string {
    const raw = Number(overlay.value)
    const n = Number.isInteger(raw)
        ? raw.toLocaleString('en-US')
        : raw.toLocaleString('en-US', { maximumFractionDigits: 1 })
    const unit = (overlay.unit || '').trim()
    return unit ? `${n} ${unit}` : n
}

function normalizeHex(input?: string | null): string | null {
    if (!input) return null
    const m = HEX.exec(input.trim())
    if (!m) return null
    let hex = m[1]
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
    return `#${hex.toLowerCase()}`
}

function toRgb(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
    const channels = toRgb(hex).map(v => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function shade(hex: string, amount: number): string {
    const [r, g, b] = toRgb(hex)
    const mix = (c: number) => Math.round(c * (1 - amount))
    return `#${[mix(r), mix(g), mix(b)].map(c => c.toString(16).padStart(2, '0')).join('')}`
}

function contrastBand(hex: string): string {
    let out = hex
    for (let i = 0; i < 10 && luminance(out) > 0.62; i++) out = shade(out, 0.08)
    return out
}

function truncate(value: string, max: number): string {
    const text = value.replace(/\s+/g, ' ').trim()
    return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}
