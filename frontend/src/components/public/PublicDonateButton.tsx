import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Heart } from 'lucide-react'
import { publicApi } from '../../services/publicApi'

interface PublicDonateButtonProps {
    orgSlug?: string | null
    /** Optional pre-loaded values to skip the fetch (used on org page where data is in-hand). */
    donationUrl?: string | null
    brandColor?: string | null
    orgName?: string | null
    /** Pass extra Tailwind classes (e.g. responsive visibility) without overriding core styling. */
    className?: string
}

/**
 * Branded donate pill that appears in the public-side top navbar across every
 * org-scoped page. Renders nothing if the org hasn't configured a donation URL.
 */
export default function PublicDonateButton({
    orgSlug,
    donationUrl: propDonationUrl,
    brandColor: propBrandColor,
    orgName: propOrgName,
    className = '',
}: PublicDonateButtonProps) {
    const [donationUrl, setDonationUrl] = useState<string | null>(propDonationUrl ?? null)
    const [brandColor, setBrandColor] = useState<string>(propBrandColor || '#c0dfa1')
    const [orgName, setOrgName] = useState<string>(propOrgName || '')
    const [confirmOpen, setConfirmOpen] = useState(false)

    useEffect(() => {
        // If caller already passed in any of the values OR there's no org slug,
        // skip the fetch — caller is providing data directly.
        if (propDonationUrl !== undefined || propBrandColor || propOrgName) {
            if (propDonationUrl !== undefined) setDonationUrl(propDonationUrl)
            if (propBrandColor) setBrandColor(propBrandColor)
            if (propOrgName) setOrgName(propOrgName)
            return
        }
        if (!orgSlug) return
        let cancelled = false
        publicApi.getOrganization(orgSlug)
            .then(data => {
                if (cancelled) return
                setDonationUrl(data.organization.donation_url || null)
                if (data.organization.brand_color) setBrandColor(data.organization.brand_color)
                if (data.organization.name) setOrgName(data.organization.name)
            })
            .catch(() => {
                // Silently swallow — button just won't render.
            })
        return () => { cancelled = true }
    }, [orgSlug, propDonationUrl, propBrandColor, propOrgName])

    useEffect(() => {
        if (!confirmOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setConfirmOpen(false)
        }
        window.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [confirmOpen])

    if (!donationUrl) return null

    const provider = orgName.trim() || 'this organization'

    const continueToSite = () => {
        window.open(donationUrl, '_blank', 'noopener,noreferrer')
        setConfirmOpen(false)
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 hover:shadow-md hover:-translate-y-0.5 flex-shrink-0 whitespace-nowrap ${className}`}
                style={{ backgroundColor: brandColor }}
                title={orgName ? `Support ${orgName}` : 'Support'}
            >
                <Heart className="w-3.5 h-3.5 fill-current" />
                <span>Support</span>
            </button>

            {confirmOpen && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    onClick={() => setConfirmOpen(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="leave-nexus-title"
                >
                    <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
                    <div
                        className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm p-5"
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 id="leave-nexus-title" className="text-base font-semibold text-gray-900 tracking-tight">
                            You're leaving Nexus Impacts
                        </h2>
                        <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                            This link will take you to an external website provided by {provider}. Nexus Impacts does not operate or control the external site and is not responsible for its content, privacy practices, or security.
                        </p>
                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmOpen(false)}
                                className="h-8 px-3 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={continueToSite}
                                className="h-8 px-3.5 rounded-lg text-xs font-semibold text-white shadow-sm hover:brightness-110 transition-all"
                                style={{ backgroundColor: brandColor }}
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </>
    )
}
