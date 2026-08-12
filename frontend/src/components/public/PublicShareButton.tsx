import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, Link2, Share2, X } from 'lucide-react'
import { notify } from '../../lib/notify'
import { dropdownPop } from '../timeline/motion'

interface PublicShareButtonProps {
    /** Optional caption used in share intents (defaults to document.title). */
    title?: string | null
    /**
     * Absolute or path URL to share. Defaults to the current page.
     * Use this for in-gallery / card shares that should point at a detail route
     * while the browser is still on a list URL.
     */
    url?: string | null
    className?: string
}

const MENU_WIDTH = 240
const MOBILE_MQ = '(max-width: 767px)'

function FacebookIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
            <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12" />
        </svg>
    )
}

function LinkedInIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
            <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.46c.98 0 1.77-.77 1.77-1.73V1.73C24 .77 23.21 0 22.23 0z" />
        </svg>
    )
}

function measureDesktopPosition(button: HTMLElement) {
    const rect = button.getBoundingClientRect()
    const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - MENU_WIDTH - 8,
    )
    return { top: rect.bottom + 6, left }
}

/**
 * Share control for public-page headers. Opens Facebook / LinkedIn share
 * intents in a new tab, or copies the current URL.
 *
 * Desktop: anchored popover (position measured before paint — no flash).
 * Mobile: bottom sheet + native share when available.
 */
function resolveShareUrl(url?: string | null): string {
    if (typeof window === 'undefined') return url || ''
    if (!url) return window.location.href
    if (/^https?:\/\//i.test(url)) return url
    return `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`
}

export default function PublicShareButton({ title, url, className = '' }: PublicShareButtonProps) {
    const [open, setOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [copied, setCopied] = useState(false)
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const mq = window.matchMedia(MOBILE_MQ)
        const sync = () => setIsMobile(mq.matches)
        sync()
        mq.addEventListener('change', sync)
        return () => mq.removeEventListener('change', sync)
    }, [])

    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open])

    // Reposition desktop menu on scroll/resize while open.
    useEffect(() => {
        if (!open || isMobile) return
        const update = () => {
            if (!buttonRef.current) return
            setPosition(measureDesktopPosition(buttonRef.current))
        }
        window.addEventListener('resize', update)
        window.addEventListener('scroll', update, true)
        return () => {
            window.removeEventListener('resize', update)
            window.removeEventListener('scroll', update, true)
        }
    }, [open, isMobile])

    // Lock body scroll for the mobile sheet.
    useEffect(() => {
        if (!open || !isMobile) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = prev }
    }, [open, isMobile])

    const close = () => {
        setOpen(false)
        setPosition(null)
    }

    const openMenu = () => {
        const mobile = window.matchMedia(MOBILE_MQ).matches
        setIsMobile(mobile)
        if (!mobile && buttonRef.current) {
            setPosition(measureDesktopPosition(buttonRef.current))
        } else {
            setPosition(null)
        }
        setOpen(true)
    }

    const toggle = () => {
        if (open) close()
        else openMenu()
    }

    const shareUrl = resolveShareUrl(url)
    const shareTitle = title || (typeof document !== 'undefined' ? document.title : 'Nexus Impacts')

    const openIntent = (href: string) => {
        window.open(href, '_blank', 'noopener,noreferrer')
        close()
    }

    const shareFacebook = () => {
        openIntent(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`)
    }

    const shareLinkedIn = () => {
        openIntent(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`)
    }

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl)
            setCopied(true)
            notify.success('Link copied')
            window.setTimeout(() => setCopied(false), 1500)
            close()
        } catch {
            notify.error('Could not copy link')
        }
    }

    const nativeShare = async () => {
        if (!navigator.share) return
        try {
            await navigator.share({ title: shareTitle, url: shareUrl })
            close()
        } catch (err) {
            // User dismissed the sheet — not an error.
            if ((err as Error)?.name !== 'AbortError') {
                notify.error('Could not open share sheet')
            }
        }
    }

    const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

    const actions = (
        <>
            {canNativeShare && (
                <button
                    type="button"
                    role="menuitem"
                    onClick={nativeShare}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-gray-900 active:bg-gray-50 sm:gap-2.5 sm:rounded-lg sm:px-2.5 sm:py-2 sm:text-sm sm:hover:bg-gray-50"
                >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700 sm:h-7 sm:w-7 sm:rounded-lg">
                        <Share2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                    </span>
                    Share via…
                </button>
            )}
            <button
                type="button"
                role="menuitem"
                onClick={shareFacebook}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-gray-900 active:bg-gray-50 sm:gap-2.5 sm:rounded-lg sm:px-2.5 sm:py-2 sm:text-sm sm:hover:bg-gray-50"
            >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1877F2]/10 text-[#1877F2] sm:h-7 sm:w-7 sm:rounded-lg">
                    <FacebookIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </span>
                Facebook
            </button>
            <button
                type="button"
                role="menuitem"
                onClick={shareLinkedIn}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-gray-900 active:bg-gray-50 sm:gap-2.5 sm:rounded-lg sm:px-2.5 sm:py-2 sm:text-sm sm:hover:bg-gray-50"
            >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0A66C2]/10 text-[#0A66C2] sm:h-7 sm:w-7 sm:rounded-lg">
                    <LinkedInIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                </span>
                LinkedIn
            </button>
            <button
                type="button"
                role="menuitem"
                onClick={copyLink}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-medium text-gray-900 active:bg-gray-50 sm:gap-2.5 sm:rounded-lg sm:px-2.5 sm:py-2 sm:text-sm sm:hover:bg-gray-50"
            >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600 sm:h-7 sm:w-7 sm:rounded-lg">
                    {copied ? <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" /> : <Copy className="h-4 w-4 sm:h-3.5 sm:w-3.5" />}
                </span>
                {copied ? 'Copied' : 'Copy link'}
            </button>
        </>
    )

    return (
        <div className={`relative flex-shrink-0 ${className}`}>
            <button
                ref={buttonRef}
                type="button"
                onClick={toggle}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Share this page"
                className="inline-flex items-center justify-center gap-1.5 h-8 w-8 sm:w-auto sm:px-3 rounded-full text-xs font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm transition-colors active:bg-gray-100 sm:hover:bg-gray-50 sm:hover:border-gray-300"
                title="Share"
            >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Share</span>
            </button>

            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {open && isMobile && (
                        <div className="fixed inset-0 z-[100]" key="share-sheet">
                            <motion.div
                                className="absolute inset-0 bg-black/40"
                                onClick={close}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.16 }}
                            />
                            <motion.div
                                role="menu"
                                aria-label="Share this page"
                                className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-app-modal border-t border-gray-100 safe-area-pb"
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-gray-200" />
                                <div className="flex items-center justify-between px-4 pt-1 pb-2">
                                    <h2 className="text-base font-semibold text-gray-900">Share page</h2>
                                    <button
                                        type="button"
                                        onClick={close}
                                        aria-label="Close"
                                        className="p-2 -mr-1 rounded-xl text-gray-400 active:bg-gray-50"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="px-2 pb-2">{actions}</div>
                                <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                                    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-gray-400">
                                        <Link2 className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                        <span className="line-clamp-2 break-all">{shareUrl}</span>
                                    </p>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {open && !isMobile && position && (
                        <React.Fragment key="share-menu">
                            <div className="fixed inset-0 z-[9998]" onClick={close} />
                            <motion.div
                                role="menu"
                                aria-label="Share this page"
                                className="fixed z-[9999] rounded-xl border border-gray-200 bg-white p-1.5 shadow-modal"
                                style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
                                initial={dropdownPop.initial}
                                animate={dropdownPop.animate}
                                exit={dropdownPop.exit}
                            >
                                <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                    Share page
                                </p>
                                {actions}
                                <div className="mt-1 border-t border-gray-100 px-2.5 py-2">
                                    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-gray-400">
                                        <Link2 className="mt-0.5 h-3 w-3 flex-shrink-0" />
                                        <span className="line-clamp-2 break-all">{shareUrl}</span>
                                    </p>
                                </div>
                            </motion.div>
                        </React.Fragment>
                    )}
                </AnimatePresence>,
                document.body,
            )}
        </div>
    )
}
