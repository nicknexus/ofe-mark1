import jsPDF from 'jspdf'

export function drawFooter(
    doc: jsPDF,
    pageWidth: number,
    pageHeight: number
): void {
    const totalPages = doc.getNumberOfPages()
    const footerY = pageHeight - 10
    const margin = 12

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)

        // Dark separator line above footer - #2D384B
        doc.setDrawColor(45, 55, 75) // #2D384B
        doc.setLineWidth(0.3)
        doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4)

        // Footer text - Muted gray #6B7280, size 8
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(107, 114, 128) // #6B7280

        doc.text(
            'Nexus Impacts | Know Your Mark On The World',
            pageWidth / 2,
            footerY,
            { align: 'center' }
        )

        doc.text(
            `Page ${i} of ${totalPages}`,
            pageWidth - margin,
            footerY,
            { align: 'right' }
        )
    }
}

