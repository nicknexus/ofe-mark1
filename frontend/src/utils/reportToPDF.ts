import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function convertReportToPDF(elementId: string, filename: string): Promise<Blob> {
    const element = document.getElementById(elementId)
    if (!element) {
        throw new Error(`Element with id "${elementId}" not found`)
    }

    // 1. Capture natural rendered size
    const widthPx = element.offsetWidth
    const heightPx = element.offsetHeight

    // 2. Convert px → mm (PDF units) at 96 DPI
    const PX_TO_MM = 0.264583
    const pdfWidthMM = widthPx * PX_TO_MM
    const pdfHeightMM = heightPx * PX_TO_MM

    // 3. Capture screenshot at proper resolution
    const canvas = await html2canvas(element, {
        scale: window.devicePixelRatio || 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: false
    })

    const imgData = canvas.toDataURL('image/png', 1.0)

    // 4. Create a perfect-size PDF (dynamic height matching dashboard)
    const pdf = new jsPDF({
        orientation: pdfWidthMM > pdfHeightMM ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pdfWidthMM, pdfHeightMM], // dynamic 1:1 size
        putOnlyUsedFonts: true,
        compress: true
    })

    // 5. Insert dashboard EXACT SIZE → no stretching
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthMM, pdfHeightMM)

    return pdf.output('blob')
}
