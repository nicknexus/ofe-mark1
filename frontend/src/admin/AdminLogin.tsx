import { useState } from 'react'
import { supabase } from '../services/supabase'
import { ShieldCheck, Loader2 } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Dedicated admin login. Authenticates against the same Supabase user system as
 * the customer app, then gates on platform-admin status: a non-admin who signs
 * in correctly is immediately signed back out and rejected.
 */
export default function AdminLogin({ onAuthed }: { onAuthed: () => void }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)
        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
            if (signInError || !data.session) {
                setError(signInError?.message || 'Invalid email or password')
                setLoading(false)
                return
            }

            // Gate: must be a platform admin.
            const resp = await fetch(`${API_URL}/api/auth/me`, {
                headers: { Authorization: `Bearer ${data.session.access_token}` },
            })
            const me = resp.ok ? await resp.json() : null
            if (!me?.is_admin) {
                await supabase.auth.signOut()
                setError('This account does not have admin access.')
                setLoading(false)
                return
            }

            onAuthed()
        } catch (err) {
            setError((err as Error).message || 'Something went wrong')
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
            <div className="w-full max-w-sm">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
                        <ShieldCheck className="w-7 h-7 text-emerald-400" />
                    </div>
                    <h1 className="text-xl font-semibold text-white">Admin Console</h1>
                    <p className="text-sm text-slate-400 mt-1">Platform support &amp; administration</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                            placeholder="you@company.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign in'}
                    </button>
                </form>

                <p className="text-center text-xs text-slate-500 mt-6">
                    Restricted access. Admin accounts only.
                </p>
            </div>
        </div>
    )
}
