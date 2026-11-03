import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import SupportModeBanner from './components/SupportModeBanner.tsx'
import './index.css'
import 'leaflet/dist/leaflet.css'

if ('serviceWorker' in navigator) {
 if (import.meta.env.DEV) {
  // Stale SWs from prod/mobile testing intercept Vite module fetches and break dev.
  navigator.serviceWorker.getRegistrations().then((regs) => {
   regs.forEach((reg) => reg.unregister())
  })
 } else if (/Mobi|Android/i.test(navigator.userAgent)) {
  window.addEventListener('load', () => {
   navigator.serviceWorker.register('/service-worker.js').catch(() => {})
  })
 }
}

// Completely separate admin console: when the URL is under /admin, mount the
// isolated AdminApp and never load the customer App at all — so admin changes
// can't affect the main app, and the main app's gates/providers don't load here.
const isAdminRoute =
 window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')

const AdminApp = lazy(() => import('./admin/AdminApp.tsx'))

ReactDOM.createRoot(document.getElementById('root')!).render(
 <React.StrictMode>
 {isAdminRoute ? (
 <Suspense fallback={null}>
 <AdminApp />
 </Suspense>
 ) : (
 <>
 <App />
 <SupportModeBanner />
 </>
 )}
 </React.StrictMode>,
)