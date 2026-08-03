/**
 * Support-mode handoff between the admin console and the customer app.
 *
 * "Entering support mode" just sets the customer app's active org to the target
 * org and a marker flag, then hard-navigates to the customer app. The backend
 * grants a platform admin full edit access to that org; the banner (rendered in
 * main.tsx) shows the warning and the exit control.
 */
export const SUPPORT_KEYS = {
    activeOrg: 'nexus-active-org-id', // the key the customer app already reads
    supportOrgId: 'nexus-support-org-id',
    supportOrgName: 'nexus-support-org-name',
    supportStartedAt: 'nexus-support-started-at',
} as const

/**
 * Support sessions self-expire. Without this the flag lives in localStorage
 * forever — close the tab, come back next week, and you're still silently
 * inside a customer's account with their data on screen.
 */
export const SUPPORT_SESSION_TTL_MS = 60 * 60 * 1000 // 1 hour

export function enterSupportMode(org: { id: string; name: string }): void {
    localStorage.setItem(SUPPORT_KEYS.activeOrg, org.id)
    localStorage.setItem(SUPPORT_KEYS.supportOrgId, org.id)
    localStorage.setItem(SUPPORT_KEYS.supportOrgName, org.name)
    localStorage.setItem(SUPPORT_KEYS.supportStartedAt, String(Date.now()))
    // Hard navigation so the customer App mounts fresh with this active org.
    window.location.href = '/'
}

/** Clear the support flags without navigating (used by TTL expiry). */
export function clearSupportMode(): void {
    localStorage.removeItem(SUPPORT_KEYS.supportOrgId)
    localStorage.removeItem(SUPPORT_KEYS.supportOrgName)
    localStorage.removeItem(SUPPORT_KEYS.supportStartedAt)
    localStorage.removeItem(SUPPORT_KEYS.activeOrg)
}

export function exitSupportMode(): void {
    clearSupportMode()
    window.location.href = '/admin/orgs'
}

export function getSupportContext(): { id: string; name: string } | null {
    const id = localStorage.getItem(SUPPORT_KEYS.supportOrgId)
    if (!id) return null

    const startedAt = Number(localStorage.getItem(SUPPORT_KEYS.supportStartedAt) || 0)
    // A missing/!valid timestamp means a session from before TTL existed —
    // treat it as expired rather than trusting it indefinitely.
    if (!startedAt || Date.now() - startedAt > SUPPORT_SESSION_TTL_MS) {
        clearSupportMode()
        return null
    }

    return { id, name: localStorage.getItem(SUPPORT_KEYS.supportOrgName) || 'this organization' }
}
