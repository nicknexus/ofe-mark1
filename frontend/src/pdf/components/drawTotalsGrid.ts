import jsPDF from 'jspdf'

export function drawTotalsGrid(
    doc: jsPDF,
    totals: Array<{
        kpi_title: string
        unit_of_measurement: string
        total_value: number
    }>,
    x: number,
    y: number,
    width: number
): void {
    const boxH = 24 // More compact
    const gap = 5
    const columns = 3
    const boxW = (width - (gap * (columns - 1))) / columns
    const accentBarHeight = 3
    const borderRadius = 5
    const padding = 6 // Reduced padding

    // Accent colors for different KPIs
    const accentColors = [
        [34, 197, 94],   // #22C55E - Green
        [59, 130, 246],  // #3B82F6 - Blue
        [245, 158, 11]   // #F59E0B - Yellow
    ]

    totals.slice(0, 6).forEach((t, i) => {
        const col = i % columns
        const row = Math.floor(i / columns)
        const bx = x + col * (boxW + gap)
        const by = y + row * (boxH + gap)

        // Dark KPI card - #111827
        doc.setFillColor(17, 24, 39) // #111827
        doc.setDrawColor(45, 55, 75) // #2D384B
        doc.setLineWidth(0.5)
        doc.roundedRect(bx, by, boxW, boxH, borderRadius, borderRadius, 'FD')

        // Top accent bar with rounded corners to match card
        const accentColor = accentColors[i % 3]
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2])
        // Draw rounded rectangle for accent bar
        doc.roundedRect(bx, by, boxW, accentBarHeight, borderRadius, borderRadius, 'F')

        // KPI Value - Green, bold, size 16 (reduced from 18)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(16)
        doc.setTextColor(34, 197, 94) // #22C55E
        const valueText = `${t.total_value} ${t.unit_of_measurement}`
        // Ensure value fits - truncate if needed
        const valueLines = doc.splitTextToSize(valueText, boxW - (padding * 2))
        doc.text(valueLines[0], bx + padding, by + accentBarHeight + 10)

        // KPI Label - Light gray, size 9 (reduced from 10)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(209, 213, 219) // #D1D5DB
        const titleLines = doc.splitTextToSize(t.kpi_title, boxW - (padding * 2))
        // Limit to 2 lines max and ensure they fit
        const maxTitleLines = titleLines.slice(0, 2)
        let titleY = by + accentBarHeight + 17
        maxTitleLines.forEach((line: string, idx: number) => {
            if (titleY + (idx * 4) <= by + boxH - 2) {
                doc.text(line, bx + padding, titleY + (idx * 4))
            }
        })
    })
}

