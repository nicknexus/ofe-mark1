import { useEffect, useMemo, useState } from 'react'
import { PDFViewer, pdf } from '@react-pdf/renderer'
import { Download, Loader2 } from 'lucide-react'
import ReportDocument, { type ReportDocumentProps } from './pdf/ReportDocument'
import { loadImages } from '../../utils/reportImages'
import { notify } from '../../lib/notify'

interface Props extends Omit<ReportDocumentProps, 'orgLogo' | 'nexusLogo' | 'story'> {
    /** Story with a raw media URL; resolved to a data URI before rendering. */
    story: (Omit<NonNullable<ReportDocumentProps['story']>, 'image'> & { imageUrl?: string | null }) | null
    orgLogoUrl?: string | null
    fileName: string
    canDownload: boolean
}

/**
 * Preview and download surface for the one-page report.
 *
 * Preview and download deliberately share one renderer: <PDFViewer> displays
 * the very document that pdf().toBlob() hands to the user. The previous export
 * screenshotted an HTML mock-up, so what you saw was only ever an approximation
 * of what you got — this makes them the same artifact by construction.
 */
export default function ReportPdfPanel({ story, orgLogoUrl, fileName, canDownload, ...rest }: Props) {
    const [images, setImages] = useState<{ org: string | null; nexus: string | null; story: string | null } | null>(null)
    const [downloading, setDownloading] = useState(false)

    // Images are resolved to data URIs up front so the render itself never
    // depends on the network — a slow or dead image can't stall or corrupt it.
    useEffect(() => {
        let cancelled = false
        setImages(null)
        loadImages({
            org: orgLogoUrl,
            nexus: '/Nexuslogo.png',
            story: story?.imageUrl,
        }).then((resolved) => {
            if (!cancelled) {
                setImages({ org: resolved.org, nexus: resolved.nexus, story: resolved.story })
            }
        })
        return () => { cancelled = true }
    }, [orgLogoUrl, story?.imageUrl])

    const document = useMemo(() => {
        if (!images) return null
        const props: ReportDocumentProps = {
            ...rest,
            orgLogo: images.org,
            nexusLogo: images.nexus,
            story: story ? { ...story, image: images.story } : null,
        }
        return <ReportDocument {...props} />
        // rest is spread fresh each render; depending on its fields keeps the
        // preview live as the user edits text without re-resolving images.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images, story, JSON.stringify(rest)])

    const handleDownload = async () => {
        if (!document) return
        setDownloading(true)
        try {
            notify.loading('Preparing PDF…', { id: 'pdf-download' })
            const blob = await pdf(document).toBlob()
            const url = URL.createObjectURL(blob)
            const link = window.document.createElement('a')
            link.href = url
            link.download = fileName
            window.document.body.appendChild(link)
            link.click()
            window.document.body.removeChild(link)
            URL.revokeObjectURL(url)
            notify.success('PDF downloaded', { id: 'pdf-download' })
        } catch (error) {
            console.error('Failed to generate PDF:', error)
            notify.error('Could not generate the PDF', { id: 'pdf-download' })
        } finally {
            setDownloading(false)
        }
    }

    return (
        <div className="space-y-3">
            {canDownload && (
                <div className="flex justify-end">
                    <button
                        onClick={handleDownload}
                        disabled={!document || downloading}
                        className="app-btn app-btn-primary app-btn-sm disabled:opacity-50"
                    >
                        {downloading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        <span>{downloading ? 'Preparing…' : 'Download PDF'}</span>
                    </button>
                </div>
            )}

            <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-100">
                {document ? (
                    <PDFViewer
                        style={{ width: '100%', height: 840, border: 'none' }}
                        showToolbar={false}
                    >
                        {document}
                    </PDFViewer>
                ) : (
                    <div className="h-[840px] flex items-center justify-center text-sm text-gray-500 gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Preparing preview…
                    </div>
                )}
            </div>

            <p className="text-xs text-gray-500 text-center">
                This preview is the exact file that downloads — one page, A4.
            </p>
        </div>
    )
}
