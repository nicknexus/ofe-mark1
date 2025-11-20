import jsPDF from 'jspdf'

export function drawOverview(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    width: number
): number {
    const height = 42 // More compact
    const padding = 8
    const borderRadius = 6

    // Dark dashboard card - #1F2937
    doc.setFillColor(31, 41, 55) // #1F2937
    doc.setDrawColor(45, 55, 75) // #2D384B
    doc.setLineWidth(0.5)
    doc.roundedRect(x, y, width, height, borderRadius, borderRadius, 'FD')

    // Title - Light gray, bold, size 13 (reduced from 14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(243, 244, 246) // #F3F4F6
    doc.text('Overview Summary', x + padding, y + 10)

    // Body text - Muted gray, size 9 (reduced from 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(156, 163, 175) // #9CA3AF
    const lines = doc.splitTextToSize(text || 'No overview available', width - (padding * 2))
    // Limit lines to fit better
    const limitedLines = lines.slice(0, 4)
    doc.text(limitedLines, x + padding, y + 17)

    return height
}

