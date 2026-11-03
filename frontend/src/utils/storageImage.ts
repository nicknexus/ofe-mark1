const OBJECT_MARKER = '/storage/v1/object/public/'

/**
 * Resized variant of a public Supabase Storage image via the image
 * transformation endpoint. Non-Supabase URLs are returned unchanged, so callers
 * should fall back to the original `url` if the variant fails to load.
 */
export function resizedStorageImage(
  url: string,
  opts: { width: number; height?: number; quality?: number }
): string {
  const idx = url.indexOf(OBJECT_MARKER)
  if (idx === -1) return url
  const origin = url.slice(0, idx)
  const path = url.slice(idx + OBJECT_MARKER.length).split('?')[0]
  const params = new URLSearchParams({ width: String(opts.width), quality: String(opts.quality ?? 70) })
  // `cover` without a height crops to the original height; only crop when both are given.
  if (opts.height) {
    params.set('height', String(opts.height))
    params.set('resize', 'cover')
  } else {
    params.set('resize', 'contain')
  }
  return `${origin}/storage/v1/render/image/public/${path}?${params}`
}
