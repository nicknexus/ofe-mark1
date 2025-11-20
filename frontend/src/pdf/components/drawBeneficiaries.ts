import jsPDF from 'jspdf'

export function drawBeneficiaries(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    width: number
): number {
    const height = 26 // More compact
    const padding = 8
    const borderRadius = 6
    const leftBarWidth = 4

    // Dark dashboard card - #1F2937
    doc.setFillColor(31, 41, 55) // #1F2937
    doc.setDrawColor(45, 55, 75) // #2D384B
    doc.setLineWidth(0.5)
    doc.roundedRect(x, y, width, height, borderRadius, borderRadius, 'FD')

    // Left accent bar - Primary Green #22C55E (rounded to match card)
    doc.setFillColor(34, 197, 94) // #22C55E
    doc.roundedRect(x, y, leftBarWidth, height, borderRadius, borderRadius, 'F')

    // Header - Light gray, bold, size 13 (reduced from 14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(243, 244, 246) // #F3F4F6
    doc.text('Beneficiary Breakdown', x + leftBarWidth + padding, y + 10)

    // Body text - Muted gray, size 9 (reduced from 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(156, 163, 175) // #9CA3AF
    const lines = doc.splitTextToSize(text || 'No beneficiary information available', width - leftBarWidth - (padding * 2))
    // Limit to 2 lines
    const limitedLines = lines.slice(0, 2)
    doc.text(limitedLines, x + leftBarWidth + padding, y + 17)

    return height
}

