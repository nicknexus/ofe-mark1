export const LAYOUT_INTRO_VERSION = 1
export const LAYOUT_INTRO_KEY = 'nexus-layout-intro-seen'
export const LAYOUT_INTRO_SESSION = 'nexus-layout-intro-session'

export function hasSeenLayoutIntro(): boolean {
  try {
    return Number(localStorage.getItem(LAYOUT_INTRO_KEY) || 0) >= LAYOUT_INTRO_VERSION
  } catch {
    return true
  }
}

export function markLayoutIntroSeenLocal(): void {
  try {
    localStorage.setItem(LAYOUT_INTRO_KEY, String(LAYOUT_INTRO_VERSION))
    sessionStorage.setItem(LAYOUT_INTRO_SESSION, '1')
  } catch {
    /* ignore quota / private mode */
  }
}

/** Hold the auto tutorial while the layout intro is pending or was shown this session. */
export function shouldHoldTutorialAutostart(): boolean {
  try {
    if (sessionStorage.getItem(LAYOUT_INTRO_SESSION) === '1') return true
    return !hasSeenLayoutIntro()
  } catch {
    return false
  }
}
