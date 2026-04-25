import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
    Plus,
    Copy,
    Trash2,
    Share2,
    ExternalLink,
    Edit3,
    Loader2,
    FlaskConical,
    Building2,
    Search,
    X,
} from 'lucide-react'
import { AdminApi, DemoOrg } from '../../services/adminApi'

const ACTIVE_ORG_STORAGE_KEY = 'nexus-active-org-id'

export default function AdminDemosPage() {
    const [demos, setDemos] = useState<DemoOrg[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [newName, setNewName] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [search, setSearch] = useState('')

    const q = search.trim().toLowerCase()
    const filteredDemos = q
        ? demos.filter(
            (d) =>
                d.name.toLowerCase().includes(q) ||
                d.slug.toLowerCase().includes(q)
        )
        : demos

    const refresh = async () => {
        setLoading(true)
        try {
            const data = await AdminApi.listDemos()
            setDemos(data)
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        refresh()
    }, [])

    const handleCreate = async () => {
        const name = newName.trim()
        if (!name) {
            toast.error('Name is required')
            return
        }
        setCreating(true)
        try {
            const demo = await AdminApi.createDemo({ name })
            toast.success(`Created "${demo.name}" with baseline content`)
            setNewName('')
            setShowCreate(false)
            await refresh()
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setCreating(false)
        }
    }

    const handleOpen = (demo: DemoOrg) => {
        // Switch the active org (TeamContext reads this on mount) and go to dashboard.
        localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, demo.id)
        // Full reload so TeamContext picks up the new active org cleanly.
        window.location.href = '/dashboard'
    }

    const handleClone = async (demo: DemoOrg) => {
        const cloneName = window.prompt(
            `Clone "${demo.name}"?\nEnter a name for the copy:`,
            `${demo.name} (copy)`
        )
        if (cloneName === null) return
        try {
            const newDemo = await AdminApi.cloneDemo(demo.id, cloneName.trim() || undefined)
            toast.success(`Cloned to "${newDemo.name}"`)
            await refresh()
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    const handleDelete = async (demo: DemoOrg) => {
        if (!window.confirm(`Delete demo "${demo.name}"? This cannot be undone.`)) return
        try {
            await AdminApi.deleteDemo(demo.id)
            toast.success(`Deleted "${demo.name}"`)
            await refresh()
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    const handleToggleShare = async (demo: DemoOrg) => {
        const next = !demo.demo_public_share
        try {
            const updated = await AdminApi.patchDemo(demo.id, { demo_public_share: next })
            toast.success(next ? 'Public share link enabled' : 'Public share link disabled')
            setDemos((prev) => prev.map((d) => (d.id === demo.id ? { ...d, ...updated } : d)))
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    const handleCopyShareLink = (demo: DemoOrg) => {
        const url = `${window.location.origin}/demo/${demo.slug}`
        navigator.clipboard.writeText(url).then(
            () => toast.success('Share link copied'),
            () => toast.error('Could not copy link')
        )
    }

    const handleRename = async (demo: DemoOrg) => {
        const name = window.prompt('Rename demo:', demo.name)
        if (!name || name.trim() === demo.name) return
        try {
            const updated = await AdminApi.patchDemo(demo.id, { name: name.trim() })
            toast.success('Renamed')
            setDemos((prev) => prev.map((d) => (d.id === demo.id ? { ...d, ...updated } : d)))
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 pt-24 pb-12 px-4">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <FlaskConical className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">Demo Charities</h1>
                            <p className="text-sm text-gray-500">
                                Sandbox organizations for client pitches. Hidden from /explore and public search.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreate((v) => !v)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors text-sm font-medium"
                    >
                        <Plus className="w-4 h-4" />
                        New demo
                    </button>
                </div>

                {showCreate && (
                    <div className="mb-6 p-4 bg-white border border-gray-200 rounded-2xl shadow-bubble-sm">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Acme Foundation (demo)"
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCreate()
                                }}
                                autoFocus
                            />
                            <button
                                onClick={handleCreate}
                                disabled={creating}
                                className="px-5 py-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                                Create + seed
                            </button>
                            <button
                                onClick={() => {
                                    setShowCreate(false)
                                    setNewName('')
                                }}
                                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-full hover:bg-gray-50 text-sm font-medium"
                            >
                                Cancel
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Auto-seeds with 1 initiative, 4 KPIs (with updates), 1 beneficiary group, 1 location, and 1 story.
                        </p>
                    </div>
                )}

                {!loading && demos.length > 0 && (
                    <div className="mb-4 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search demos by name or slug..."
                            className="w-full pl-11 pr-10 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                aria-label="Clear search"
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-24 text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : demos.length === 0 ? (
                    <div className="py-24 text-center text-gray-500">
                        <Building2 className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                        <p>No demo charities yet. Click &quot;New demo&quot; to create your first one.</p>
                    </div>
                ) : filteredDemos.length === 0 ? (
                    <div className="py-24 text-center text-gray-500">
                        <Search className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                        <p>No demos match &quot;{search}&quot;.</p>
                        <button
                            onClick={() => setSearch('')}
                            className="mt-3 text-sm text-gray-700 hover:text-gray-900 underline"
                        >
                            Clear search
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {filteredDemos.map((demo) => (
                            <div
                                key={demo.id}
                                className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 transition-colors"
                            >
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                                    style={{ backgroundColor: demo.brand_color || '#f3f4f6' }}
                                >
                                    {demo.logo_url ? (
                                        <img src={demo.logo_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <Building2
                                            className="w-5 h-5"
                                            style={{ color: demo.brand_color ? '#fff' : '#9ca3af' }}
                                        />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-semibold text-gray-900 truncate">{demo.name}</h3>
                                        {demo.demo_public_share && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-semibold uppercase tracking-wide">
                                                <Share2 className="w-3 h-3" />
                                                Shared
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">/demo/{demo.slug}</p>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleOpen(demo)}
                                        title="Open dashboard"
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-full hover:bg-gray-800 text-xs font-medium"
                                    >
                                        Open
                                    </button>
                                    <button
                                        onClick={() => handleRename(demo)}
                                        title="Rename"
                                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                                    >
                                        <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleToggleShare(demo)}
                                        title={demo.demo_public_share ? 'Disable share link' : 'Enable share link'}
                                        className={`p-2 rounded-full ${demo.demo_public_share
                                                ? 'text-emerald-700 hover:bg-emerald-50'
                                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Share2 className="w-4 h-4" />
                                    </button>
                                    {demo.demo_public_share && (
                                        <>
                                            <button
                                                onClick={() => handleCopyShareLink(demo)}
                                                title="Copy share link"
                                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                            <Link
                                                to={`/demo/${demo.slug}`}
                                                target="_blank"
                                                title="Open public page"
                                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </Link>
                                        </>
                                    )}
                                    <button
                                        onClick={() => handleClone(demo)}
                                        title="Clone"
                                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(demo)}
                                        title="Delete"
                                        className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
