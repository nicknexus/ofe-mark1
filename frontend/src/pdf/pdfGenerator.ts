import jsPDF from 'jspdf'
import { drawHeader } from './components/drawHeader'
import { drawOverview } from './components/drawOverview'
import { drawTotalsGrid } from './components/drawTotalsGrid'
import { drawBeneficiaries } from './components/drawBeneficiaries'
import { drawStoryBox } from './components/drawStoryBox'
import { drawMapSection } from './components/drawMapSection'
import { drawFooter } from './components/drawFooter'

interface BuildImpactPDFParams {
    dashboard: {
        initiative: {
            title: string
        }
    }
    overviewSummary: string
    totals: Array<{
        kpi_id: string
        kpi_title: string
        kpi_description?: string
        unit_of_measurement: string
        total_value: number
        count: number
    }>
    beneficiaryText: string
    selectedStory?: {
        id: string
        title: string
        description?: string
        date_represented: string
        location_name?: string
        media_url?: string
        media_type?: 'photo' | 'video' | 'recording'
    } | null
    mapImage?: string | null
    locations: Array<{
        id: string
        name: string
        description?: string
        latitude: number
        longitude: number
    }>
    dateStart?: string
    dateEnd?: string
    loadImageAsBase64?: (url: string) => Promise<string>
}

export async function buildImpactPDF({
    dashboard,
    overviewSummary,
    totals,
    beneficiaryText,
    selectedStory,
    mapImage,
    locations,
    dateStart,
    dateEnd,
    loadImageAsBase64
}: BuildImpactPDFParams): Promise<Blob> {
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 12
    const contentWidth = pageWidth - margin * 2
    const colWidth = (contentWidth - 10) / 2
    const sectionGap = 10 // Spacing between sections

    // Dark dashboard background - #111827
    doc.setFillColor(17, 24, 39) // #111827
    doc.rect(0, 0, pageWidth, pageHeight, 'F')

    // SECTION: Header
    let y = drawHeader(doc, dashboard, dateStart, dateEnd, margin)

    // SECTION: Overview (Left Column) and Totals Grid (Right Column)
    const overviewHeight = drawOverview(doc, overviewSummary, margin, y, colWidth)
    drawTotalsGrid(doc, totals, margin + colWidth + 10, y, colWidth)
    y += Math.max(overviewHeight, 42) + sectionGap

    // SECTION: Beneficiaries (full width)
    y += drawBeneficiaries(doc, beneficiaryText, margin, y, contentWidth) + sectionGap

    // SECTION: Story and Map side by side (both optional, same height)
    const storyMapHeight = 55 // More compact height
    const storyMapY = y
    
    if (selectedStory && mapImage && locations.length > 0) {
        // Both exist - place side by side
        const storyWidth = colWidth * 0.55 // Slightly wider story
        const mapWidth = colWidth * 0.9 + 10 // Narrower map - doesn't span too far
        await drawStoryBox(doc, selectedStory, margin, storyMapY, storyWidth, loadImageAsBase64, storyMapHeight)
        await drawMapSection(doc, mapImage, locations, margin + storyWidth + 10, storyMapY, mapWidth, storyMapHeight)
        y += storyMapHeight + sectionGap
    } else if (selectedStory) {
        // Only story - use narrower width for bigger photo
        const storyWidth = colWidth * 0.55
        await drawStoryBox(doc, selectedStory, margin, storyMapY, storyWidth, loadImageAsBase64, storyMapHeight)
        y += storyMapHeight + sectionGap
    } else if (mapImage && locations.length > 0) {
        // Only map - use narrower width
        const mapWidth = colWidth * 0.9
        await drawMapSection(doc, mapImage, locations, margin, storyMapY, mapWidth, storyMapHeight)
        y += storyMapHeight + sectionGap
    }

    // Footer
    drawFooter(doc, pageWidth, pageHeight)

    return doc.output('blob')
}

