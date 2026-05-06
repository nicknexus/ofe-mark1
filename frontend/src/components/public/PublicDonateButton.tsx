import React, { useEffect, useState } from 'react'
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

    if (!donationUrl) return null

    return (
        <a
            href={donationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:brightness-110 hover:shadow-md hover:-translate-y-0.5 flex-shrink-0 whitespace-nowrap ${className}`}
            style={{ backgroundColor: brandColor }}
            title={orgName ? `Donate to ${orgName}` : 'Donate'}
        >
            <Heart className="w-3.5 h-3.5 fill-current" />
            <span>Donate</span>
        </a>
    )
}
