import { clsx, type ClassValue } from 'clsx'

// Utility function for conditional class names
export function cn(...inputs: ClassValue[]) {
    return clsx(inputs)
}

// Parse a date string as a local date, avoiding UTC timezone shift.
// Handles "YYYY-MM-DD", full ISO timestamps, and Date objects.
export function parseLocalDate(date: string | Date): Date {
    if (date instanceof Date) return date
    // Extract just YYYY-MM-DD from any ISO-like string to avoid UTC shift
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    }
    return new Date(date)
}

// Format date for display — default "Feb 24, 2025", pass options to customize
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat('en-US', options ?? {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(parseLocalDate(date))
}

// Format date for inputs
export function formatDateForInput(date: string | Date): string {
    const dateToFormat = parseLocalDate(date)

    // Return in YYYY-MM-DD format for input fields
    const year = dateToFormat.getFullYear()
    const month = String(dateToFormat.getMonth() + 1).padStart(2, '0')
    const day = String(dateToFormat.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

// Calculate evidence percentage color and status
export function getEvidenceColor(percentage: number): string {
    if (percentage >= 80) return 'text-primary-500 bg-primary-50'
    if (percentage >= 30) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
}

// Get evidence status text
export function getEvidenceStatus(percentage: number): string {
    if (percentage >= 80) return 'Fully Supported'
    if (percentage >= 30) return 'Some Supporting Evidence'
    return 'Needs Evidence'
}

// Get evidence status with emoji
export function getEvidenceStatusEmoji(percentage: number): string {
    if (percentage >= 80) return '🟢 Fully Supported'
    if (percentage >= 30) return '🟡 Some Supporting Evidence'
    return '🔴 Needs Evidence'
}

// Get category badge color
export function getCategoryColor(category: 'input' | 'output' | 'impact'): string {
    switch (category) {
        case 'input':
            return 'bg-blue-100 text-blue-800'
        case 'output':
            return 'bg-primary-100 text-primary-800'
        case 'impact':
            return 'bg-purple-100 text-purple-800'
        default:
            return 'bg-gray-100 text-gray-800'
    }
}

// Get evidence type icon and color
export function getEvidenceTypeInfo(type: 'visual_proof' | 'documentation' | 'testimony' | 'financials') {
    switch (type) {
        case 'visual_proof':
            return { icon: '📷', color: 'bg-pink-100 text-pink-800', label: 'Visual Support' }
        case 'documentation':
            return { icon: '📄', color: 'bg-evidence-100 text-evidence-700', label: 'Documentation' }
        case 'testimony':
            return { icon: '🗣️', color: 'bg-orange-100 text-orange-800', label: 'Testimonies' }
        case 'financials':
            return { icon: '💰', color: 'bg-primary-100 text-primary-800', label: 'Financials' }
        default:
            return { icon: '📎', color: 'bg-gray-100 text-gray-800', label: 'Other' }
    }
}

// Truncate text
export function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
}

// Generate random ID (for temporary use)
export function generateId(): string {
    return Math.random().toString(36).substr(2, 9)
}

// Get date-only string (YYYY-MM-DD) from a Date object, normalized to local timezone
export function getLocalDateString(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

// Compare two dates by their date-only values (ignoring time)
export function compareDates(date1: Date, date2: Date): number {
    const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate())
    const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate())
    return d1.getTime() - d2.getTime()
}

// Check if two dates are on the same day
export function isSameDay(date1: Date, date2: Date): boolean {
    return compareDates(date1, date2) === 0
}

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout
    return (...args: Parameters<T>) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), wait)
    }
}
