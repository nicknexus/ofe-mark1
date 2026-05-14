import React, { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Code2, Copy, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import type { WidgetTabProps } from './accountTypes'

export function WidgetTab({ orgSlug, isPublic }: WidgetTabProps) {
    const [copied, setCopied] = useState(false)
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
    const previewRef = useRef<HTMLIFrameElement>(null)
    const previewWrapRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(1)

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.nexusimpacts.ai'
    const previewSrc = orgSlug ? `${origin}/embed/${orgSlug}` : ''

    // Auto-grow the preview iframe in response to its postMessage events.
    // Track the natural (pre-scale) height so we can resize the visible wrapper.
    const [naturalHeight, setNaturalHeight] = useState(420)
    useEffect(() => {
        function onMessage(ev: MessageEvent) {
            if (!previewRef.current || ev.source !== previewRef.current.contentWindow) return
            const data: any = ev.data
            if (!data || data.type !== 'nexus:embed:height') return
            if (typeof data.height !== 'number') return
            setNaturalHeight(data.height)
            previewRef.current.style.height = `${data.height}px`
        }
        window.addEventListener('message', onMessage)
        return () => window.removeEventListener('message', onMessage)
    }, [])

    // Width of the natural iframe (matches what donors see) per mode.
    // Desktop: render wide so the proportions match a real donor's site.
    // Mobile: standard phone width.
    const naturalWidth = previewMode === 'desktop' ? 1200 : 380

    // Scale the rendered iframe down to fit the preview wrap. Reads computed
    // padding from the wrap so it stays correct across breakpoints (p-3 / p-4)
    // and any future styling tweaks — no hard-coded magic numbers.
    useEffect(() => {
        const wrap = previewWrapRef.current
        if (!wrap) return
        const apply = () => {
            const cs = window.getComputedStyle(wrap)
            const pl = parseFloat(cs.paddingLeft) || 0
            const pr = parseFloat(cs.paddingRight) || 0
            const inner = wrap.clientWidth - pl - pr
            // Tiny safety margin to absorb sub-pixel rounding + iframe shadow.
            const usable = Math.max(0, inner - 12)
            setScale(Math.min(1, usable / naturalWidth))
        }
        apply()
        const ro = new ResizeObserver(apply)
        ro.observe(wrap)
        // Recompute after layout paints (covers fonts/images causing reflow).
        const raf = requestAnimationFrame(apply)
        return () => {
            ro.disconnect()
            cancelAnimationFrame(raf)
        }
    }, [naturalWidth])

    const snippet = orgSlug
        ? `<div data-nexus-widget data-org="${orgSlug}"></div>
<script src="${origin}/embed.js" async></script>`
        : ''

    function copySnippet() {
        navigator.clipboard.writeText(snippet).then(() => {
            setCopied(true)
            toast.success('Copied to clipboard')
            window.setTimeout(() => setCopied(false), 1500)
        })
    }

    if (!orgSlug) {
        return (
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-8 text-center">
                <p className="text-sm text-gray-600">Set up your organization first to enable the embed widget.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Intro */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 bg-primary-50 rounded-xl"><Code2 className="w-5 h-5 text-primary-600" /></div>
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-gray-800">Embed Widget</h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Give donors a live, branded snapshot of your impact to drop into their websites,
                            newsletters, or fundraising pages. Updates automatically as your data changes.
                        </p>
                    </div>
                </div>

                {!isPublic && (
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-900">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                            Your organization isn't public yet. The widget can only render when your public profile is enabled.
                            Toggle it on under the <span className="font-medium">Account</span> tab.
                        </div>
                    </div>
                )}
            </div>

            {/* Live preview */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-800">Live preview</h3>
                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center bg-gray-100 rounded-lg p-0.5">
                            <button
                                onClick={() => setPreviewMode('desktop')}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${previewMode === 'desktop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                                    }`}
                            >
                                Desktop
                            </button>
                            <button
                                onClick={() => setPreviewMode('mobile')}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${previewMode === 'mobile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                                    }`}
                            >
                                Mobile
                            </button>
                        </div>
                        <a
                            href={previewSrc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 ml-1"
                        >
                            Open <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>
                <div
                    ref={previewWrapRef}
                    className="bg-gray-50 rounded-xl p-3 sm:p-4 overflow-hidden flex justify-center"
                    style={{
                        // The wrap is exactly as tall as the scaled iframe + padding,
                        // so the desktop preview reads as wide-and-short, not vertical.
                        height: naturalHeight * scale + 32,
                        transition: 'height 200ms ease',
                    }}
                >
                    <div
                        style={{
                            width: naturalWidth * scale,
                            height: naturalHeight * scale,
                            position: 'relative',
                        }}
                    >
                        <iframe
                            ref={previewRef}
                            src={previewSrc}
                            title="Widget preview"
                            style={{
                                width: naturalWidth,
                                height: naturalHeight,
                                border: 0,
                                borderRadius: 20,
                                background: '#fff',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(15,23,42,0.08)',
                                transform: `scale(${scale})`,
                                transformOrigin: 'top left',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                            }}
                            referrerPolicy="no-referrer-when-downgrade"
                            loading="lazy"
                        />
                    </div>
                </div>
                <p className="mt-2 text-xs text-gray-400 text-center">
                    {previewMode === 'desktop'
                        ? `Shown at ${Math.round(scale * 100)}% of desktop size — donors see it full-size on their site.`
                        : 'Mobile preview at native width.'}
                </p>
            </div>

            {/* Copy snippet */}
            <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-800">Drop-in snippet</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Paste this anywhere in your donor's HTML. The widget auto-resizes to its content.
                        </p>
                    </div>
                    <button
                        onClick={copySnippet}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <Copy className="w-3.5 h-3.5" />
                        {copied ? 'Copied!' : 'Copy snippet'}
                    </button>
                </div>
                <pre className="bg-gray-900 text-gray-100 text-xs leading-relaxed font-mono rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all">
{snippet}
                </pre>
            </div>
        </div>
    )
}
