import { clsx, type ClassValue } from 'clsx'

// Utility function for conditional class names
export function cn(...inputs: ClassValue[]) {
    return clsx(inputs)
}

// Format date for display
export function formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    }).format(new Date(date))
}

// Format date for inputs
export function formatDateForInput(date: string | Date): string {
    return new Date(date).toISOString().split('T')[0]
}

// Calculate evidence percentage color and status
export function getEvidenceColor(percentage: number): string {
    if (percentage >= 80) return 'text-green-600 bg-green-50'
    if (percentage >= 30) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
}

// Get evidence status text
export function getEvidenceStatus(percentage: number): string {
    if (percentage >= 80) return 'Fully Proven'
    if (percentage >= 30) return 'Some Proof'
    return 'Needs Evidence'
}

// Get evidence status with emoji
export function getEvidenceStatusEmoji(percentage: number): string {
    if (percentage >= 80) return '🟢 Fully Proven'
    if (percentage >= 30) return '🟡 Some Proof'
    return '🔴 Needs Evidence'
}

// Get category badge color
export function getCategoryColor(category: 'input' | 'output' | 'impact'): string {
    switch (category) {
        case 'input':
            return 'bg-blue-100 text-blue-800'
        case 'output':
            return 'bg-green-100 text-green-800'
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
            return { icon: '📷', color: 'bg-pink-100 text-pink-800', label: 'Visual Proof' }
        case 'documentation':
            return { icon: '📄', color: 'bg-blue-100 text-blue-800', label: 'Documentation' }
        case 'testimony':
            return { icon: '🗣️', color: 'bg-orange-100 text-orange-800', label: 'Testimony' }
        case 'financials':
            return { icon: '💰', color: 'bg-green-100 text-green-800', label: 'Financials' }
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

// Debounce function
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
