import React from 'react'
import PublicDonateButton from './PublicDonateButton'
import PublicShareButton from './PublicShareButton'

interface PublicHeaderActionsProps {
    orgSlug?: string | null
    /** Optional pre-loaded donate values (org page already has them). */
    donationUrl?: string | null
    brandColor?: string | null
    orgName?: string | null
    /** Caption for share intents; falls back to org name / document.title. */
    shareTitle?: string | null
    /** Override shared URL (defaults to current page). */
    shareUrl?: string | null
    className?: string
}

/**
 * Share + Donate cluster for public sticky headers.
 * Share always renders; Donate only when the org has a donation URL.
 */
export default function PublicHeaderActions({
    orgSlug,
    donationUrl,
    brandColor,
    orgName,
    shareTitle,
    shareUrl,
    className = '',
}: PublicHeaderActionsProps) {
    return (
        <div className={`inline-flex items-center gap-1.5 flex-shrink-0 ${className}`}>
            <PublicDonateButton
                orgSlug={orgSlug}
                donationUrl={donationUrl}
                brandColor={brandColor}
                orgName={orgName}
            />
            <PublicShareButton title={shareTitle || orgName} url={shareUrl} />
        </div>
    )
}
