import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../services/supabase'
import { AdminApi } from '../services/adminApi'
import AdminLogin from './AdminLogin'
import AdminLayout from './AdminLayout'
import AdminOrgsPage from './pages/AdminOrgsPage'
import AdminAgentsPage from './pages/AdminAgentsPage'
import AdminAuditPage from './pages/AdminAuditPage'
import AdminDemosPage from '../pages/admin/AdminDemosPage'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

type AuthState = 'loading' | 'unauthed' | 'authed'

/**
 * Completely isolated admin application. Mounted by main.tsx ONLY when the URL
 * starts with /admin, so the customer app never loads here (and vice-versa).
 * Has its own Router, its own login, and its own platform-admin auth gate.
 */
export default function AdminApp() {
    const [state, setState] = useState<AuthState>('loading')
    const [email, setEmail] = useState<string | null>(null)
    const [role, setRole] = useState<'super' | 'support' | null>(null)

    const checkAdmin = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                setState('unauthed')
                return
            }
            const resp = await fetch(`${API_URL}/api/auth/me`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
            })
            const me = resp.ok ? await resp.json() : null
            if (me?.is_admin) {
                setEmail(me.email ?? null)
                try {
                    const adminMe = await AdminApi.getMe()
                    setRole(adminMe.role)
                } catch {
                    setRole('super') // resilient fallback (e.g. pre-migration)
                }
                setState('authed')
            } else {
                setState('unauthed')
            }
        } catch {
            setState('unauthed')
        }
    }

    useEffect(() => {
        checkAdmin()
    }, [])

    if (state === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        )
    }

    return (
        <BrowserRouter>
            <Routes>
                <Route
                    path="/admin/login"
                    element={state === 'authed' ? <Navigate to="/admin/orgs" replace /> : <AdminLogin onAuthed={checkAdmin} />}
                />
                {state === 'authed' ? (
                    <Route path="/admin" element={<AdminLayout email={email} role={role} />}>
                        <Route index element={<Navigate to="/admin/orgs" replace />} />
                        <Route path="orgs" element={<AdminOrgsPage />} />
                        <Route path="demos" element={<AdminDemosPage />} />
                        {role === 'super' && <Route path="agents" element={<AdminAgentsPage />} />}
                        <Route path="audit" element={<AdminAuditPage />} />
                    </Route>
                ) : (
                    <Route path="/admin/*" element={<Navigate to="/admin/login" replace />} />
                )}
                <Route path="*" element={<Navigate to="/admin/orgs" replace />} />
            </Routes>
        </BrowserRouter>
    )
}
