import readExcelFile from 'read-excel-file/browser'

export type SpreadsheetCell = string | number | boolean | Date | null

export interface ParsedSpreadsheetSheet {
 name: string
 rows: SpreadsheetCell[][]
}

const HEADER_TERMS = [
 'date', 'metric', 'value', 'number', 'total', 'count', 'people', 'participant',
 'location', 'city', 'town', 'province', 'country', 'program', 'initiative',
 'school', 'organization', 'event', 'name', 'title', 'note', 'description',
]

export function cellText(value: SpreadsheetCell | undefined): string {
 if (value == null) return ''
 if (value instanceof Date) return formatSpreadsheetDate(value)
 return String(value).trim()
}

export function normalizeImportText(value: unknown): string {
 return String(value ?? '')
 .normalize('NFKD')
 .replace(/[\u0300-\u036f]/g, '')
 .toLowerCase()
 .replace(/&/g, ' and ')
 .replace(/[^a-z0-9]+/g, ' ')
 .trim()
}

function parseCsv(text: string): SpreadsheetCell[][] {
 const rows: string[][] = []
 let row: string[] = []
 let value = ''
 let quoted = false

 for (let index = 0; index < text.length; index += 1) {
 const character = text[index]
 if (quoted) {
 if (character === '"' && text[index + 1] === '"') {
 value += '"'
 index += 1
 } else if (character === '"') {
 quoted = false
 } else {
 value += character
 }
 continue
 }

 if (character === '"') quoted = true
 else if (character === ',') {
 row.push(value)
 value = ''
 } else if (character === '\n') {
 row.push(value)
 rows.push(row)
 row = []
 value = ''
 } else if (character !== '\r') value += character
 }

 row.push(value)
 if (row.some((cell) => cell.length > 0) || rows.length === 0) rows.push(row)
 if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '')
 return rows
}

export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheetSheet[]> {
 const extension = file.name.split('.').pop()?.toLowerCase()
 if (extension === 'csv') {
 return [{ name: file.name.replace(/\.csv$/i, ''), rows: parseCsv(await file.text()) }]
 }
 if (extension !== 'xlsx') throw new Error('Please choose a .csv or .xlsx file')

 const sheets = await readExcelFile(file)
 return sheets.map(({ sheet, data }) => ({
 name: sheet,
 rows: data as SpreadsheetCell[][],
 }))
}

export function detectHeaderRow(rows: SpreadsheetCell[][]): number {
 let bestIndex = 0
 let bestScore = -1
 rows.slice(0, 60).forEach((row, index) => {
 const populated = row.filter((cell) => cellText(cell) !== '')
 if (populated.length < 2) return
 const strings = populated.filter((cell) => typeof cell === 'string')
 const keywordScore = strings.reduce((score, cell) => {
 const normalized = normalizeImportText(cell)
 return score + HEADER_TERMS.filter((term) => normalized.includes(term)).length
 }, 0)
 const score = populated.length + strings.length * 0.75 + keywordScore * 2.5
 if (score > bestScore) {
 bestScore = score
 bestIndex = index
 }
 })
 return bestIndex
}

export function makeColumnLabels(row: SpreadsheetCell[]): string[] {
 return row.map((cell, index) => cellText(cell) || `Column ${columnLetter(index)}`)
}

export function columnLetter(index: number): string {
 let value = index + 1
 let label = ''
 while (value > 0) {
 const remainder = (value - 1) % 26
 label = String.fromCharCode(65 + remainder) + label
 value = Math.floor((value - 1) / 26)
 }
 return label
}

export function suggestColumn(headers: string[], aliases: string[]): number | null {
 let best: { index: number; score: number } | null = null
 for (let index = 0; index < headers.length; index += 1) {
 const header = headers[index]
 const normalized = normalizeImportText(header)
 if (!normalized) continue
 const score = Math.max(...aliases.map((alias) => {
 const normalizedAlias = normalizeImportText(alias)
 if (normalized === normalizedAlias) return 10
 if (normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized)) return 6
 return tokenSimilarity(normalized, normalizedAlias) * 4
 }))
 if (!best || score > best.score) best = { index, score }
 }
 return best && best.score >= 3 ? best.index : null
}

export function parseImportNumber(value: SpreadsheetCell | undefined): number | null {
 if (typeof value === 'number') return Number.isFinite(value) ? value : null
 if (typeof value !== 'string') return null
 const trimmed = value.trim()
 if (!trimmed) return null
 const negative = /^\(.*\)$/.test(trimmed)
 const cleaned = trimmed.replace(/[%,$£€\s]/g, '').replace(/[()]/g, '')
 const parsed = Number(cleaned)
 if (!Number.isFinite(parsed)) return null
 return negative ? -parsed : parsed
}

export function formatSpreadsheetDate(date: Date): string {
 const year = date.getUTCFullYear()
 const month = String(date.getUTCMonth() + 1).padStart(2, '0')
 const day = String(date.getUTCDate()).padStart(2, '0')
 return `${year}-${month}-${day}`
}

export function parseImportDate(value: SpreadsheetCell | undefined): string | null {
 if (value instanceof Date && !Number.isNaN(value.getTime())) return formatSpreadsheetDate(value)
 if (typeof value === 'number' && value > 20000 && value < 100000) {
 const excelEpoch = Date.UTC(1899, 11, 30)
 return formatSpreadsheetDate(new Date(excelEpoch + value * 86400000))
 }
 if (typeof value !== 'string' || !value.trim()) return null
 const text = value.trim()
 const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
 if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
 const numeric = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/)
 if (numeric) {
 const year = numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]
 // Default to North American month/day; the review editor makes ambiguity visible.
 return `${year}-${numeric[1].padStart(2, '0')}-${numeric[2].padStart(2, '0')}`
 }
 // Handles values such as "Jun 27 & 28 2026" by using the first represented day.
 const range = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2}).*?(\d{4})$/)
 const parseable = range ? `${range[1]} ${range[2]}, ${range[3]}` : text
 const timestamp = Date.parse(parseable)
 if (Number.isNaN(timestamp)) return null
 return formatSpreadsheetDate(new Date(timestamp))
}

export function tokenSimilarity(left: string, right: string): number {
 const leftTokens = new Set(normalizeImportText(left).split(' ').filter(Boolean))
 const rightTokens = new Set(normalizeImportText(right).split(' ').filter(Boolean))
 if (!leftTokens.size || !rightTokens.size) return 0
 let overlap = 0
 leftTokens.forEach((token) => { if (rightTokens.has(token)) overlap += 1 })
 return overlap / Math.max(leftTokens.size, rightTokens.size)
}

export function bestTextMatch<T>(
 source: string,
 options: T[],
 getText: (option: T) => string,
 minimumScore = 0.5,
): { option: T; score: number } | null {
 const normalizedSource = normalizeImportText(source)
 if (!normalizedSource) return null
 let best: { option: T; score: number } | null = null
 for (const option of options) {
 const target = normalizeImportText(getText(option))
 let score = tokenSimilarity(normalizedSource, target)
 if (target === normalizedSource) score = 1
 else if (target.includes(normalizedSource) || normalizedSource.includes(target)) score = Math.max(score, 0.8)
 if (!best || score > best.score) best = { option, score }
 }
 return best && best.score >= minimumScore ? best : null
}
