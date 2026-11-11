export const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'linkedin'] as const
export type SocialPlatform = typeof SOCIAL_PLATFORMS[number]

/** Photo-post caption ceilings. Instagram uses the title as the caption. */
export const SOCIAL_CAPTION_LIMIT: Record<SocialPlatform, number> = {
    instagram: 2200,
    facebook: 63206,
    linkedin: 3000,
}

export function socialCaption(parts: Array<string | null | undefined>): string {
    return parts.map(part => (part || '').replace(/\r\n/g, '\n').trim()).filter(Boolean).join('\n\n')
}

/**
 * Photo uploads. Instagram uses `title` as the caption. `instagram_title` overrides it.
 * The last photo sent only `instagram_title`, which was stored as post_title while post_caption
 * stayed empty, and the photo went out with no text. `description` is the Facebook and LinkedIn body.
 */
export function textCaptionFields(platform: SocialPlatform, text: string): Record<string, string> {
    const caption = text.replace(/\r\n/g, '\n').trim()
    if (platform === 'linkedin') {
        const headline = (caption.split('\n').find(line => line.trim()) || caption).slice(0, 200)
        return { title: headline, linkedin_title: headline, linkedin_description: caption, description: caption }
    }
    if (platform === 'facebook') return { description: caption, facebook_description: caption }
    return { title: caption, instagram_title: caption, description: caption }
}

export function photoCaptionFields(platform: SocialPlatform, text: string): Record<string, string> {
    const caption = text.replace(/\r\n/g, '\n').trim()
    if (platform === 'instagram') {
        return { title: caption, instagram_title: caption, description: caption }
    }
    if (platform === 'facebook') {
        return { title: caption, facebook_title: caption }
    }
    const headline = (caption.split('\n').find(line => line.trim()) || caption).slice(0, 200)
    return {
        title: headline,
        linkedin_title: headline,
        linkedin_description: caption,
        description: caption,
    }
}
