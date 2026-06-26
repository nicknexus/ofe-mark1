import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { Building2, Users, FlaskConical, ScrollText, ShieldCheck, LogOut } from 'lucide-react'

const navItems = [
    { to: '/admin/orgs', label: 'Organizations', icon: Building2, superOnly: false },
    { to: '/admin/demos', label: 'Demos', icon: FlaskConical, superOnly: false },
    { to: '/admin/agents', label: 'Support Agents', icon: Users, superOnly: true },
    { to: '/admin/audit', label: 'Audit Log', icon: ScrollText, superOnly: false },
]

export default function AdminLayout({ email, role }: { email: string | null; role: 'super' | 'support' | null }) {
    const navigate = useNavigate()
    const visibleNav = navItems.filter(item => !item.superOnly || role === 'super')

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        navigate('/admin/login', { replace: true })
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 flex">
            {/* Sidebar */}
            <aside className="w-60 shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col">
                <div className="px-5 py-5 flex items-center gap-2 border-b border-slate-800">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white leading-tight">Admin Console</p>
                        <p className="text-[11px] text-slate-500">Nexus Impacts</p>
                    </div>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1">
                    {visibleNav.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                    isActive
                                        ? 'bg-slate-800 text-white'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                }`
                            }
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                <div className="px-3 py-4 border-t border-slate-800">
                    {email && <p className="px-3 text-[11px] text-slate-500 mb-2 truncate">{email}</p>}
                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 min-w-0 bg-slate-100 text-slate-900 overflow-auto">
                <Outlet />
            </main>
        </div>
    )
}
