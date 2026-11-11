/** Composer routes stay on one layout key so ContentEngine does not remount mid-draft. */
export function isStudioComposer(pathname: string) {
  return /^\/studio\/(new|journeys|capture|todos)(\/|$)/.test(pathname)
    || /^\/studio\/(post|journey|idea)\//.test(pathname)
}

/** Capture, ideas, and the journey folder still use the dark composer. */
export function isDarkStudioPath(pathname: string) {
  return pathname.startsWith('/studio/capture')
    || pathname.startsWith('/studio/todos')
    || pathname.startsWith('/studio/idea/')
    || pathname === '/studio/journeys'
    || /^\/studio\/journey\/[^/]+$/.test(pathname)
    || pathname.startsWith('/share/content/capture')
}

export function isStudioMode(pathname: string) {
  return pathname === '/studio' || pathname.startsWith('/studio/')
}

export function studioNavActive(pathname: string, to: string) {
  if (to === '/studio') return pathname === '/studio'
  if (to === '/studio/library') {
    return pathname === '/studio/library'
      || pathname.startsWith('/studio/post/')
      || pathname === '/studio/new'
      || pathname.startsWith('/studio/journey')
  }
  return pathname === to
}
