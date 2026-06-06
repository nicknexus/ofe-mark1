import { Toaster } from 'react-hot-toast'

/**
 * Single shared Toaster configuration for the entire app. Replaces the ~16
 * ad-hoc `<Toaster position="top-center" />` mounts scattered through App.tsx
 * (mount this once near the app root instead).
 */
export default function AppToaster() {
 return (
 <Toaster
 position="top-center"
 toastOptions={{
 duration: 3500,
 style: {
 borderRadius: '10px',
 background: '#ffffff',
 color: '#465360',
 border: '1px solid #e5e7eb',
 boxShadow: '0 4px 12px -2px rgba(16,24,40,0.10), 0 12px 32px -8px rgba(16,24,40,0.10)',
 fontSize: '14px',
 fontWeight: 500,
 maxWidth: '420px',
 },
 success: { iconTheme: { primary: '#3DBE78', secondary: '#ffffff' } },
 error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } },
 }}
 />
 )
}
