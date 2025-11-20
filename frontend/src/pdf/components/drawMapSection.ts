import jsPDF from 'jspdf'

export async function drawMapSection(
    doc: jsPDF,
    mapImage: string,
    locations: Array<{
        name: string
        latitude: number
        longitude: number
    }>,
    x: number,
    y: number,
    width: number,
    maxHeight?: number // Optional max height constraint
): Promise<number> {
    const totalHeight = maxHeight || 55 // More compact
    const mapHeight = totalHeight - 20 // Reserve space for location list
    const locationListHeight = 20
    const padding = 8
    const borderRadius = 6

    // Dark dashboard card - #1F2937
    doc.setFillColor(31, 41, 55) // #1F2937
    doc.setDrawColor(45, 55, 75) // #2D384B
    doc.setLineWidth(0.5)
    doc.roundedRect(x, y, width, mapHeight, borderRadius, borderRadius, 'FD')

    // Add map image - full bleed inside card with subtle border
    doc.addImage(mapImage, 'PNG', x + 2, y + 2, width - 4, mapHeight - 4)

    // Location list below map with coordinates
    const locationListY = y + mapHeight + 4
    doc.setFontSize(8) // Smaller font for compact list
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(209, 213, 219) // #D1D5DB - Light gray for location text

    // Calculate how many locations fit
    const lineHeight = 3.2
    const maxLocations = Math.floor(locationListHeight / lineHeight)
    const locationsToShow = locations.slice(0, maxLocations)

    locationsToShow.forEach((loc, index) => {
        const locY = locationListY + (index * lineHeight)
        const locText = `• ${loc.name} (${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)})`
        // Truncate if too long
        const maxTextWidth = width - (padding * 2)
        const truncatedText = doc.splitTextToSize(locText, maxTextWidth)[0]
        doc.text(truncatedText, x + padding, locY)
    })

    // If there are more locations, indicate with "..."
    if (locations.length > maxLocations) {
        const remainingCount = locations.length - maxLocations
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(107, 114, 128) // #6B7280 - Muted gray
        doc.text(`...and ${remainingCount} more`, x + padding, locationListY + (maxLocations * lineHeight))
    }

    return totalHeight
}

