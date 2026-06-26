import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import AdminApp from './admin/AdminApp.tsx'
import SupportModeBanner from './components/SupportModeBanner.tsx'
import './index.css'
import 'leaflet/dist/leaflet.css'

if ('serviceWorker' in navigator && /Mobi|Android/i.test(navigator.userAgent)) {
 window.addEventListener('load', () => {
 navigator.serviceWorker.register('/service-worker.js').catch(() => {})
 })
}

// Completely separate admin console: when the URL is under /admin, mount the
// isolated AdminApp and never load the customer App at all — so admin changes
// can't affect the main app, and the main app's gates/providers don't load here.
const isAdminRoute =
 window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')

ReactDOM.createRoot(document.getElementById('root')!).render(
 <React.StrictMode>
 {isAdminRoute ? (
 <AdminApp />
 ) : (
 <>
 <App />
 <SupportModeBanner />
 </>
 )}
 </React.StrictMode>,
)