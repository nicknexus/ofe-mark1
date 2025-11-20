import jsPDF from 'jspdf'

export async function drawStoryBox(
    doc: jsPDF,
    story: {
        title: string
        description?: string
        media_url?: string
        media_type?: 'photo' | 'video' | 'recording'
    },
    x: number,
    y: number,
    width: number,
    loadImageAsBase64?: (url: string) => Promise<string>,
    maxHeight?: number // Optional max height constraint
): Promise<number> {
    const hasPhoto = story.media_url && story.media_type === 'photo'
    const fixedHeight = maxHeight || 55 // More compact
    const padding = 8
    const textPadding = 3
    const borderRadius = 6
    const leftBarWidth = 4

    // Media type color indicator
    let accentColor: [number, number, number] = [59, 130, 246] // Photo blue #3B82F6
    if (story.media_type === 'video') {
        accentColor = [249, 115, 22] // Video orange #F97316
    } else if (story.media_type === 'recording') {
        accentColor = [168, 85, 247] // Audio purple #A855F7
    }

    // Dark dashboard card - #1F2937
    doc.setFillColor(31, 41, 55) // #1F2937
    doc.setDrawColor(45, 55, 75) // #2D384B
    doc.setLineWidth(0.5)
    doc.roundedRect(x, y, width, fixedHeight, borderRadius, borderRadius, 'FD')

    // Left accent bar - colored by media type (rounded to match card)
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2])
    doc.roundedRect(x, y, leftBarWidth, fixedHeight, borderRadius, borderRadius, 'F')

    let currentY = y + padding

    // Story photo (if available) - maintain aspect ratio, make it bigger
    if (hasPhoto && loadImageAsBase64) {
        try {
            const base64 = await loadImageAsBase64(story.media_url!)
            const format = base64.startsWith('data:image/png') ? 'PNG' : 'JPEG'

            // Calculate photo dimensions maintaining aspect ratio
            // Standard photo aspect ratio is typically 4:3 or 3:2
            // Use 4:3 ratio for better fit
            const photoAspectRatio = 4 / 3
            const availableWidth = width - leftBarWidth - (padding * 2)
            // Reserve less space for text to make photo bigger
            const availableHeight = fixedHeight - 20 // More compact

            // Calculate dimensions that fit within available space while maintaining aspect ratio
            // Use more of the available height for bigger photo
            let photoHeight = availableHeight * 0.85 // Use 85% of available height
            let photoWidth = photoHeight * photoAspectRatio

            // If width exceeds available space, scale down based on width
            if (photoWidth > availableWidth) {
                photoWidth = availableWidth
                photoHeight = photoWidth / photoAspectRatio
            }

            // Center the photo horizontally within the card (accounting for left bar)
            const photoX = x + leftBarWidth + padding + (availableWidth - photoWidth) / 2

            doc.addImage(base64, format, photoX, currentY, photoWidth, photoHeight)
            currentY += photoHeight + textPadding
        } catch (error) {
            console.error('Failed to load story image:', error)
            // Fallback placeholder with proper aspect ratio
            const placeholderAvailableWidth = width - leftBarWidth - (padding * 2)
            const placeholderWidth = placeholderAvailableWidth
            const placeholderHeight = placeholderWidth / (4 / 3)
            const placeholderX = x + leftBarWidth + padding + (placeholderAvailableWidth - placeholderWidth) / 2

            doc.setFillColor(50, 60, 80)
            doc.setDrawColor(150, 150, 150)
            doc.setLineWidth(1)
            doc.rect(placeholderX, currentY, placeholderWidth, placeholderHeight, 'FD')
            doc.setFontSize(7)
            doc.setFont('helvetica', 'italic')
            doc.setTextColor(200, 200, 200)
            doc.text('[Photo]', x + width / 2, currentY + placeholderHeight / 2, { align: 'center' })
            currentY += placeholderHeight + textPadding
        }
    }

    // Story title - White text, bold, size 12 (reduced from 14)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(249, 250, 251) // #F9FAFB
    const titleText = story.title.length > 30 ? story.title.substring(0, 27) + '...' : story.title
    doc.text(titleText, x + leftBarWidth + padding, currentY + 4)

    // Story description - Muted gray, regular, size 8 (reduced from 9)
    if (story.description) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(156, 163, 175) // #9CA3AF
        const lines = doc.splitTextToSize(story.description, width - leftBarWidth - (padding * 2))
        // Limit to 2 lines max to save space
        const limitedLines = lines.slice(0, 2)
        doc.text(limitedLines, x + leftBarWidth + padding, currentY + 7)
    }

    return fixedHeight
}

