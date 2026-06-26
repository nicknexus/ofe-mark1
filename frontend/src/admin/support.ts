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
} as const

export function enterSupportMode(org: { id: string; name: string }): void {
    localStorage.setItem(SUPPORT_KEYS.activeOrg, org.id)
    localStorage.setItem(SUPPORT_KEYS.supportOrgId, org.id)
    localStorage.setItem(SUPPORT_KEYS.supportOrgName, org.name)
    // Hard navigation so the customer App mounts fresh with this active org.
    window.location.href = '/'
}

export function exitSupportMode(): void {
    localStorage.removeItem(SUPPORT_KEYS.supportOrgId)
    localStorage.removeItem(SUPPORT_KEYS.supportOrgName)
    localStorage.removeItem(SUPPORT_KEYS.activeOrg)
    window.location.href = '/admin/orgs'
}

export function getSupportContext(): { id: string; name: string } | null {
    const id = localStorage.getItem(SUPPORT_KEYS.supportOrgId)
    if (!id) return null
    return { id, name: localStorage.getItem(SUPPORT_KEYS.supportOrgName) || 'this organization' }
}
