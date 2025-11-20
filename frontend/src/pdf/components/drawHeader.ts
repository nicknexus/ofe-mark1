import jsPDF from 'jspdf'

export function drawHeader(
    doc: jsPDF,
    dashboard: { initiative: { title: string } },
    dateStart?: string,
    dateEnd?: string,
    margin: number = 12
): number {
    const headerHeight = 24 // More compact
    const pageWidth = doc.internal.pageSize.getWidth()

    // Dark navy header background - #0F172A
    doc.setFillColor(15, 23, 42) // #0F172A
    doc.rect(0, 0, pageWidth, headerHeight, 'F')

    // Gradient overlay effect - darker navy to lighter
    doc.setFillColor(30, 41, 59) // #1E293B
    doc.rect(0, headerHeight * 0.5, pageWidth, headerHeight * 0.5, 'F')

    // Format date helper
    const formatDate = (dateStr?: string): string => {
        if (!dateStr) return ''
        try {
            const date = new Date(dateStr)
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        } catch {
            return dateStr
        }
    }

    // Title - white, bold, size 20 (reduced from 22)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(249, 250, 251) // #F9FAFB
    doc.text(dashboard.initiative.title, margin, 15)

    // Date range - muted gray, regular, size 10 (reduced from 11)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(156, 163, 175) // #9CA3AF
    const dateRangeText = dateStart && dateEnd
        ? `${formatDate(dateStart)} - ${formatDate(dateEnd)}`
        : dateStart || dateEnd || 'Date range not specified'
    doc.text(dateRangeText, margin, 21)

    return headerHeight + 5
}

