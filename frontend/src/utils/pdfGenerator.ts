import jsPDF from 'jspdf'

interface GeneratePDFOptions {
    initiativeTitle: string
    dateRange: {
        start: string
        end: string
    }
    reportText: string
    totals?: Array<{
        kpi_title: string
        kpi_description: string
        unit_of_measurement: string
        total_value: number
        count: number
    }>
    locations?: Array<{
        name: string
        description?: string
    }>
}

export function generatePDF(options: GeneratePDFOptions): void {
    const { initiativeTitle, dateRange, reportText, totals = [], locations = [] } = options

    // Create PDF document (A4 size)
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const contentWidth = pageWidth - (margin * 2)
    let yPosition = margin

    // Helper function to add a new page if needed
    const checkPageBreak = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
            doc.addPage()
            yPosition = margin
        }
    }

    // Helper function to format date
    const formatDate = (dateStr: string) => {
        if (!dateStr) return ''
        try {
            const date = new Date(dateStr)
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        } catch {
            return dateStr
        }
    }

    // Header
    doc.setFillColor(34, 197, 94) // Primary green color
    doc.rect(0, 0, pageWidth, 30, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text(initiativeTitle, margin, 20)

    // Date range
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    const dateRangeText = dateRange.start && dateRange.end
        ? `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}`
        : dateRange.start || dateRange.end || 'Date range not specified'
    doc.text(dateRangeText, margin, 28)

    yPosition = 40

    // Parse and format report text
    const lines = doc.splitTextToSize(reportText, contentWidth)
    
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')

    let currentSection = ''
    let inList = false

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        
        // Skip empty lines
        if (!line) {
            yPosition += 5
            checkPageBreak(5)
            continue
        }

        // Detect headers
        if (line.startsWith('# ')) {
            checkPageBreak(15)
            yPosition += 10
            doc.setFontSize(18)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(34, 197, 94)
            doc.text(line.replace(/^#+\s*/, ''), margin, yPosition)
            yPosition += 8
            doc.setFontSize(11)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(0, 0, 0)
            continue
        }

        if (line.startsWith('## ')) {
            checkPageBreak(12)
            yPosition += 8
            doc.setFontSize(14)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(50, 50, 50)
            doc.text(line.replace(/^#+\s*/, ''), margin, yPosition)
            yPosition += 7
            doc.setFontSize(11)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(0, 0, 0)
            continue
        }

        if (line.startsWith('### ')) {
            checkPageBreak(10)
            yPosition += 6
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(70, 70, 70)
            doc.text(line.replace(/^#+\s*/, ''), margin, yPosition)
            yPosition += 6
            doc.setFontSize(11)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(0, 0, 0)
            continue
        }

        // Detect bold text
        if (line.includes('**')) {
            const parts = line.split('**')
            let xPos = margin
            for (let j = 0; j < parts.length; j++) {
                if (j % 2 === 0) {
                    // Normal text
                    doc.setFont('helvetica', 'normal')
                    doc.text(parts[j], xPos, yPosition)
                    xPos += doc.getTextWidth(parts[j])
                } else {
                    // Bold text
                    doc.setFont('helvetica', 'bold')
                    doc.text(parts[j], xPos, yPosition)
                    xPos += doc.getTextWidth(parts[j])
                }
            }
            yPosition += 6
            checkPageBreak(6)
            continue
        }

        // Regular text
        checkPageBreak(6)
        doc.setFont('helvetica', 'normal')
        doc.text(line, margin, yPosition)
        yPosition += 6
    }

    // Add metrics table if totals exist
    if (totals.length > 0) {
        checkPageBreak(30)
        yPosition += 15

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(50, 50, 50)
        doc.text('Metrics Summary', margin, yPosition)
        yPosition += 10

        // Table header
        doc.setFillColor(240, 240, 240)
        doc.rect(margin, yPosition - 5, contentWidth, 8, 'F')
        
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.text('Metric', margin + 2, yPosition)
        doc.text('Total', margin + contentWidth - 50, yPosition)
        yPosition += 8

        // Table rows
        doc.setFont('helvetica', 'normal')
        totals.forEach((total, index) => {
            checkPageBreak(10)
            
            if (index > 0 && index % 2 === 0) {
                doc.setFillColor(250, 250, 250)
                doc.rect(margin, yPosition - 5, contentWidth, 8, 'F')
            }

            doc.text(total.kpi_title, margin + 2, yPosition)
            doc.text(`${total.total_value} ${total.unit_of_measurement}`, margin + contentWidth - 50, yPosition)
            yPosition += 8
        })
    }

    // Add locations if provided
    if (locations.length > 0) {
        checkPageBreak(20)
        yPosition += 10

        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(50, 50, 50)
        doc.text('Locations', margin, yPosition)
        yPosition += 8

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        locations.forEach(location => {
            checkPageBreak(8)
            doc.text(`• ${location.name}`, margin + 5, yPosition)
            if (location.description) {
                yPosition += 5
                doc.setFontSize(9)
                doc.setTextColor(100, 100, 100)
                const descLines = doc.splitTextToSize(location.description, contentWidth - 10)
                doc.text(descLines, margin + 10, yPosition)
                yPosition += descLines.length * 4
                doc.setFontSize(10)
                doc.setTextColor(0, 0, 0)
            } else {
                yPosition += 6
            }
        })
    }

    // Footer on each page
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text(
            'Nexus Impacts | Know Your Mark On The World',
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        )
        doc.text(
            `Page ${i} of ${totalPages}`,
            pageWidth - margin,
            pageHeight - 10,
            { align: 'right' }
        )
    }

    // Generate filename
    const filename = `${initiativeTitle.replace(/[^a-z0-9]/gi, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`

    // Save PDF
    doc.save(filename)
}

