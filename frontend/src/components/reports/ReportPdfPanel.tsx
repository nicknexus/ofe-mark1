import { useEffect, useMemo, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { Download } from 'lucide-react'
import ReportDocument, { type ReportDocumentProps } from './pdf/ReportDocument'
import { loadImages } from '../../utils/reportImages'
import { notify } from '../../lib/notify'
import { SectionLoader, Spinner } from '../ui'

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
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
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

    const storyKey = JSON.stringify(story ?? null)
    const restKey = JSON.stringify(rest)
    const document = useMemo(() => {
        if (!images) return null
        const props: ReportDocumentProps = {
            ...rest,
            orgLogo: images.org,
            nexusLogo: images.nexus,
            story: story ? { ...story, image: images.story } : null,
        }
        return <ReportDocument {...props} />
        // story/rest are read from the render that produced storyKey/restKey.
        // Depending on the objects themselves rebuilds the PDF every parent render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images, storyKey, restKey])

    // Render the same document the download uses, but as a page in the modal
    // scroll instead of a native PDF iframe. The browser PDF plugin swallows
    // wheel events, which is why the report modal could not be scrolled.
    useEffect(() => {
        if (!document) {
            setPreviewUrl(null)
            return
        }
        setPreviewUrl(null)
        let cancelled = false
        const task = pdf(document).toBlob().then((blob) => {
            if (cancelled) return null
            return URL.createObjectURL(blob)
        }).catch((error) => {
            console.error('Failed to prepare report preview:', error)
            if (!cancelled) notify.error('Could not prepare the preview')
            return null
        })
        task.then((url) => {
            if (url) setPreviewUrl(url)
        })
        return () => {
            cancelled = true
            task.then((url) => {
                if (url) URL.revokeObjectURL(url)
            })
        }
    }, [document])

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
                            <Spinner className="w-4 h-4" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        <span>{downloading ? 'Preparing…' : 'Download PDF'}</span>
                    </button>
                </div>
            )}

            <div
                className="relative mx-auto overflow-hidden rounded-xl border border-gray-200 bg-gray-100"
                style={{ height: 'min(68vh, 900px)', width: 'min(100%, calc(min(68vh, 900px) * 210 / 297))' }}
            >
                {previewUrl ? (
                    <>
                        <iframe
                            title="Report preview"
                            src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
                            className="pointer-events-none absolute inset-0 h-full w-full border-0"
                        />
                        {/* Sits above the PDF plugin so wheel events scroll this modal. */}
                        <div className="absolute inset-0 z-10" aria-hidden />
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <SectionLoader label="Preparing preview…" />
                    </div>
                )}
            </div>

            <p className="text-xs text-gray-500 text-center">
                This preview is the exact file that downloads. One page, A4.
            </p>
        </div>
    )
}
