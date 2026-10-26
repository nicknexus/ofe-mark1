import sharp from 'sharp'

const DEFAULT_BRAND = '#c0dfa1'
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i
const FONT = 'DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif'

export type GraphicLayout = 'clean' | 'title' | 'stats'
export type GraphicAspect = 'square' | 'landscape' | 'portrait'
export const GRAPHIC_LAYOUTS: GraphicLayout[] = ['clean', 'title', 'stats']
export const GRAPHIC_ASPECTS: GraphicAspect[] = ['square', 'landscape', 'portrait']

export type GraphicChrome = {
    logo: boolean
    orgName: boolean
    title: boolean
    metric: boolean
    location: boolean
}

export type GraphicCopy = {
    orgName?: string
    title?: string
    metricText?: string
    metricLabel?: string
    location?: string
}

export function parseGraphicLayout(value: unknown): GraphicLayout {
    return GRAPHIC_LAYOUTS.includes(value as GraphicLayout) ? (value as GraphicLayout) : 'clean'
}

export function parseGraphicAspect(value: unknown): GraphicAspect {
    return GRAPHIC_ASPECTS.includes(value as GraphicAspect) ? (value as GraphicAspect) : 'square'
}

export function chromeFromLayout(layout: GraphicLayout): GraphicChrome {
    if (layout === 'stats') return { logo: true, orgName: true, title: true, metric: true, location: true }
    if (layout === 'title') return { logo: true, orgName: true, title: true, metric: false, location: false }
    return { logo: true, orgName: true, title: false, metric: false, location: false }
}

function canvasSize(aspect: GraphicAspect): { w: number; h: number } {
    if (aspect === 'landscape') return { w: 1200, h: 627 }
    if (aspect === 'portrait') return { w: 1080, h: 1350 }
    return { w: 1080, h: 1080 }
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
    aspect?: GraphicAspect
    chrome?: Partial<GraphicChrome>
    copy?: GraphicCopy
}): Promise<Buffer> {
    const layout = parseGraphicLayout(input.layout)
    const aspect = parseGraphicAspect(input.aspect)
    const { w, h } = canvasSize(aspect)
    const chrome: GraphicChrome = { ...chromeFromLayout(layout) }
    if (input.chrome) {
        (Object.keys(input.chrome) as (keyof GraphicChrome)[]).forEach(key => {
            const val = input.chrome?.[key]
            if (val != null) chrome[key] = val
        })
    }
    const brand = contrastBand(normalizeHex(input.brandColor) || DEFAULT_BRAND)
    const photo = await sharp(input.photo)
        .rotate()
        .resize(w, h, { fit: 'cover', position: 'centre' })
        .toBuffer()

    const minSide = Math.min(w, h)
    const logoSize = Math.round(minSide * 0.096)
    let logoBuf: Buffer | null = null
    if (chrome.logo && input.logo) {
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

    const metricText = input.copy?.metricText != null
        ? input.copy.metricText.trim()
        : (input.overlay ? formatHeadline(input.overlay) : '')
    const svg = Buffer.from(layoutSvg({
        w,
        h,
        chrome,
        brand,
        orgName: (input.copy?.orgName || input.orgName || 'Impact').trim(),
        photoTitle: (input.copy?.title || input.photoTitle || '').trim(),
        location: (input.copy?.location || input.location || '').trim(),
        metricText,
        metricLabel: (input.copy?.metricLabel || input.overlay?.label || '').trim(),
        hasLogo: !!logoBuf,
        logoSize,
    }))

    const layers: sharp.OverlayOptions[] = [{ input: svg, top: 0, left: 0 }]
    if (logoBuf) {
        const inset = Math.round(minSide * 0.048)
        layers.push({ input: logoBuf, left: inset, top: inset })
    }

    return sharp(photo)
        .composite(layers)
        .png({ compressionLevel: 8 })
        .toBuffer()
}

function layoutSvg(opts: {
    w: number
    h: number
    chrome: GraphicChrome
    brand: string
    orgName: string
    photoTitle: string
    location: string
    metricText: string
    metricLabel: string
    hasLogo: boolean
    logoSize: number
}): string {
    const { w, h, chrome } = opts
    const minSide = Math.min(w, h)
    const padX = Math.round(minSide * 0.044)
    const chip = opts.hasLogo ? Math.round(opts.logoSize + minSide * 0.03) : 0
    const nameX = opts.hasLogo ? Math.round(padX + chip + minSide * 0.012) : padX
    const logoChip = opts.hasLogo
        ? `<rect x="${Math.round(padX - minSide * 0.011)}" y="${Math.round(padX - minSide * 0.011)}" width="${chip}" height="${chip}" rx="${Math.round(minSide * 0.022)}" fill="#ffffff"/>`
        : ''
    const orgLines = chrome.orgName ? wrapText(opts.orgName || 'Impact', Math.round(minSide * 0.033), w - nameX - padX, 2) : []
    const orgBlock = textBlock({
        x: nameX,
        y: opts.hasLogo ? Math.round(padX + chip * 0.52) : Math.round(minSide * 0.067),
        fontSize: Math.round(minSide * 0.033),
        fontWeight: 700,
        lines: orgLines,
        filter: 'sn',
    })

    const titleSize = Math.round(minSide * 0.065)
    const statSize = Math.round(minSide * 0.043)
    const labelSize = Math.round(minSide * 0.026)
    const locSize = Math.round(minSide * 0.022)
    const maxW = w - padX * 2
    const titleLines = chrome.title ? wrapText(opts.photoTitle, titleSize, maxW, 3) : []
    const statLines = chrome.metric && opts.metricText ? wrapText(opts.metricText, statSize, maxW, 2) : []
    const labelLines = chrome.metric && opts.metricLabel ? wrapText(opts.metricLabel, labelSize, maxW, 2) : []
    const locLines = chrome.location && opts.location ? wrapText(opts.location, locSize, maxW, 2) : []
    const hasBottom = titleLines.length + statLines.length + labelLines.length + locLines.length > 0

    if (!hasBottom) {
        return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  ${filters()}
  ${logoChip}
  ${orgBlock}
</svg>`
    }

    const stack: string[] = []
    let y = h - Math.round(minSide * 0.052)
    const stackUp = (lines: string[], fontSize: number, fontWeight: number, opacity = 1) => {
        if (!lines.length) return
        const lh = Math.round(fontSize * 1.2)
        const firstY = y - (lines.length - 1) * lh
        stack.push(textBlock({ x: padX, y: firstY, fontSize, fontWeight, lines, lineHeight: lh, opacity }))
        y = firstY - fontSize - Math.round(minSide * 0.017)
    }

    stackUp(locLines, locSize, 600, 0.92)
    stackUp(labelLines, labelSize, 500, 0.9)
    stackUp(statLines, statSize, 700)
    stackUp(titleLines, titleSize, 700)

    const fadeTop = Math.min(h - Math.round(minSide * 0.26), Math.max(Math.round(h * 0.44), y - Math.round(minSide * 0.065)))
    const fadeH = h - fadeTop
    const bar = Math.max(8, Math.round(minSide * 0.009))

    return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  ${filters()}
  <rect y="${fadeTop}" width="${w}" height="${fadeH}" fill="url(#fade)"/>
  <rect y="${h - bar}" width="${w}" height="${bar}" fill="${opts.brand}"/>
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
    filter?: string
}): string {
    if (!opts.lines.length) return ''
    const lh = opts.lineHeight ?? Math.round(opts.fontSize * 1.2)
    const opacity = opts.opacity == null ? '' : ` opacity="${opts.opacity}"`
    const filter = opts.filter || 's'
    return opts.lines.map((line, i) => (
        `<text x="${opts.x}" y="${opts.y + i * lh}" font-family="${FONT}" font-size="${opts.fontSize}" font-weight="${opts.fontWeight}" fill="#ffffff"${opacity} filter="url(#${filter})">${escapeXml(line)}</text>`
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
  <filter id="sn" x="-10%" y="-10%" width="120%" height="140%">
    <feDropShadow dx="0" dy="1" stdDeviation="1.4" flood-color="#000000" flood-opacity="0.7"/>
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
