/** Bump to re-show What's New for everyone who already dismissed an older version. */
export const LAYOUT_INTRO_VERSION = 3
export const LAYOUT_INTRO_KEY = 'nexus-layout-intro-seen'
export const LAYOUT_INTRO_SESSION = 'nexus-layout-intro-session'
export const LAYOUT_INTRO_PENDING = 'nexus-layout-intro-pending'

export function introStorageKey(userId: string): string {
  return `${LAYOUT_INTRO_KEY}:${userId}`
}

export function beginLayoutIntroCheck(): void {
  try {
    sessionStorage.setItem(LAYOUT_INTRO_PENDING, '1')
  } catch {
    /* ignore */
  }
}

export function endLayoutIntroCheck(willShow: boolean): void {
  try {
    sessionStorage.removeItem(LAYOUT_INTRO_PENDING)
    if (willShow) sessionStorage.setItem(LAYOUT_INTRO_SESSION, '1')
  } catch {
    /* ignore */
  }
}

export function markLayoutIntroSeenLocal(userId?: string): void {
  try {
    if (userId) localStorage.setItem(introStorageKey(userId), String(LAYOUT_INTRO_VERSION))
    sessionStorage.setItem(LAYOUT_INTRO_SESSION, '1')
    sessionStorage.removeItem(LAYOUT_INTRO_PENDING)
  } catch {
    /* ignore quota / private mode */
  }
}

/** Hold the auto tutorial while the layout intro is pending or was shown this session. */
export function shouldHoldTutorialAutostart(): boolean {
  try {
    if (sessionStorage.getItem(LAYOUT_INTRO_SESSION) === '1') return true
    if (sessionStorage.getItem(LAYOUT_INTRO_PENDING) === '1') return true
    return false
  } catch {
    return false
  }
}
