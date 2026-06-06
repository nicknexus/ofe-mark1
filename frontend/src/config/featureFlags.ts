// Runtime feature flags backed by localStorage so a user (or support) can flip
// them from the browser console without redeploying.
//
// Usage in DevTools to kill the new evidence-upload Kanban flow and fall back
// to the legacy single-record AddEvidenceModal:
// localStorage.setItem('nexus-new-evidence-upload-disabled', '1')
// To re-enable, remove the key:
// localStorage.removeItem('nexus-new-evidence-upload-disabled')

const NEW_EVIDENCE_UPLOAD_KILL_KEY = 'nexus-new-evidence-upload-disabled'

export function isNewEvidenceUploadEnabled(): boolean {
 if (typeof window === 'undefined') return true
 try {
 return window.localStorage.getItem(NEW_EVIDENCE_UPLOAD_KILL_KEY) !== '1'
 } catch {
 return true
 }
}
