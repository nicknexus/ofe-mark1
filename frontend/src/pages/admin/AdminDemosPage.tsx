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
    Sparkles,
    Globe2,
    Folder,
    FolderPlus,
    RefreshCw,
    AlertTriangle,
    ChevronDown,
} from 'lucide-react'
import { AdminApi, DemoOrg } from '../../services/adminApi'
import ConfirmDialog from '../../components/ConfirmDialog'
import ModalFrame from '../../components/ModalFrame'

const UNFILED = '__unfiled__'

const deriveNameFromUrl = (url: string): string => {
    try {
        const h = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '')
        const base = h.split('.')[0] || 'New demo'
        return base.charAt(0).toUpperCase() + base.slice(1)
    } catch {
        return 'New demo'
    }
}

const ACTIVE_ORG_STORAGE_KEY = 'nexus-active-org-id'

export default function AdminDemosPage() {
    const [demos, setDemos] = useState<DemoOrg[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [createMode, setCreateMode] = useState<'website' | 'manual'>('website')
    const [newName, setNewName] = useState('')
    const [websiteUrl, setWebsiteUrl] = useState('')
    const [websiteName, setWebsiteName] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [search, setSearch] = useState('')
    const [deleteConfirm, setDeleteConfirm] = useState<DemoOrg | null>(null)
    const [newFolder, setNewFolder] = useState('')
    const [activeFolder, setActiveFolder] = useState<string | null>(null)
    const [folderMenuFor, setFolderMenuFor] = useState<string | null>(null)
    // Modals
    const [generateModal, setGenerateModal] = useState<DemoOrg | null>(null)
    const [generateUrl, setGenerateUrl] = useState('')
    const [folderModalDemo, setFolderModalDemo] = useState<DemoOrg | null>(null)
    const [rowFolderName, setRowFolderName] = useState('')
    const [renameModal, setRenameModal] = useState<DemoOrg | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [cloneModal, setCloneModal] = useState<DemoOrg | null>(null)
    const [cloneValue, setCloneValue] = useState('')
    const [newFolderModal, setNewFolderModal] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')

    const folders = Array.from(
        new Set(demos.map((d) => (d.demo_folder || '').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b))
    const hasUnfiled = demos.some((d) => !d.demo_folder)

    const q = search.trim().toLowerCase()
    const filteredDemos = demos.filter((d) => {
        if (activeFolder === UNFILED && d.demo_folder) return false
        if (activeFolder && activeFolder !== UNFILED && d.demo_folder !== activeFolder) return false
        if (q && !(d.name.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q))) return false
        return true
    })

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

    // Auto-poll while any demo is generating so the status badge updates live.
    useEffect(() => {
        const hasGenerating = demos.some((d) => d.demo_generation_status === 'generating')
        if (!hasGenerating) return
        const id = setInterval(async () => {
            try {
                const data = await AdminApi.listDemos()
                setDemos(data)
            } catch { /* silent — don't toast on background polls */ }
        }, 4000)
        return () => clearInterval(id)
    }, [demos])

    const handleCreate = async () => {
        const name = newName.trim()
        if (!name) { toast.error('Name is required'); return }
        setCreating(true)
        try {
            const demo = await AdminApi.createDemo({ name, demo_folder: newFolder.trim() || undefined })
            toast.success(`Created "${demo.name}" with baseline content`)
            setNewName('')
            setNewFolder('')
            setShowCreate(false)
            await refresh()
        } catch (err) {
            toast.error((err as Error).message)
        } finally {
            setCreating(false)
        }
    }

    const handleGenerateFromWebsite = async () => {
        const url = websiteUrl.trim()
        if (!url) { toast.error('Website URL is required'); return }

        const name = websiteName.trim() || deriveNameFromUrl(url)
        const folder = newFolder.trim() || undefined

        setGenerating(true)
        let shellId: string
        try {
            const shell = await AdminApi.createDemoShell({ name, demo_folder: folder, website_url: url })
            shellId = shell.id
            setShowCreate(false)
            setWebsiteUrl('')
            setWebsiteName('')
            setNewFolder('')
            await refresh()
        } catch (err) {
            toast.error((err as Error).message)
            setGenerating(false)
            return
        } finally {
            setGenerating(false)
        }

        // Run generation in the background; polling useEffect keeps the status badge fresh.
        try {
            await AdminApi.generateInto(shellId, { website_url: url, name })
            toast.success(`Generated "${name}"`)
        } catch (err) {
            toast.error(`Generation failed: ${(err as Error).message}`)
        } finally {
            await refresh()
        }
    }

    const openGenerateModal = (demo: DemoOrg) => {
        setFolderMenuFor(null)
        setGenerateModal(demo)
        setGenerateUrl(demo.website_url || '')
    }

    const runGenerate = async () => {
        const demo = generateModal
        if (!demo) return
        const url = generateUrl.trim()
        if (!url) { toast.error('Website URL is required'); return }
        setGenerateModal(null)
        setDemos((prev) =>
            prev.map((d) => (d.id === demo.id ? { ...d, demo_generation_status: 'generating' } : d))
        )
        try {
            await AdminApi.generateInto(demo.id, { website_url: url, name: demo.name })
            toast.success(`Generated "${demo.name}"`)
        } catch (err) {
            toast.error(`Generation failed: ${(err as Error).message}`)
        } finally {
            await refresh()
        }
    }

    const handleMoveToFolder = async (demo: DemoOrg, folder: string | null) => {
        setFolderMenuFor(null)
        if ((demo.demo_folder || null) === folder) return
        try {
            const updated = await AdminApi.patchDemo(demo.id, { demo_folder: folder })
            setDemos((prev) => prev.map((d) => (d.id === demo.id ? { ...d, ...updated } : d)))
            toast.success(folder ? `Moved to "${folder}"` : 'Removed from folder')
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    const openNewFolderForDemo = (demo: DemoOrg) => {
        setFolderMenuFor(null)
        setFolderModalDemo(demo)
        setRowFolderName('')
    }

    const runNewFolderForDemo = async () => {
        const demo = folderModalDemo
        if (!demo) return
        const folder = rowFolderName.trim()
        if (!folder) { toast.error('Folder name is required'); return }
        setFolderModalDemo(null)
        await handleMoveToFolder(demo, folder)
    }

    const confirmNewFolder = () => {
        const name = newFolderName.trim()
        if (!name) { toast.error('Folder name is required'); return }
        setNewFolderModal(false)
        setNewFolderName('')
        setNewFolder(name)
        setCreateMode('website')
        setShowCreate(true)
    }

    const handleOpen = (demo: DemoOrg) => {
        localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, demo.id)
        window.location.href = '/dashboard'
    }

    const handleRename = (demo: DemoOrg) => {
        setRenameModal(demo)
        setRenameValue(demo.name)
    }

    const runRename = async () => {
        const demo = renameModal
        if (!demo) return
        const name = renameValue.trim()
        setRenameModal(null)
        if (!name || name === demo.name) return
        try {
            const updated = await AdminApi.patchDemo(demo.id, { name })
            toast.success('Renamed')
            setDemos((prev) => prev.map((d) => (d.id === demo.id ? { ...d, ...updated } : d)))
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    const handleClone = (demo: DemoOrg) => {
        setCloneModal(demo)
        setCloneValue(`${demo.name} (copy)`)
    }

    const runClone = async () => {
        const demo = cloneModal
        if (!demo) return
        const name = cloneValue.trim()
        setCloneModal(null)
        try {
            const newDemo = await AdminApi.cloneDemo(demo.id, name || undefined)
            toast.success(`Cloned to "${newDemo.name}"`)
            await refresh()
        } catch (err) {
            toast.error((err as Error).message)
        }
    }

    const handleDelete = async (demo: DemoOrg) => {
        setDeleteConfirm(null)
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
                        onClick={() => { setNewFolderModal(true); setNewFolderName('') }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                        <FolderPlus className="w-4 h-4" />
                        New folder
                    </button>
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
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div className="inline-flex p-1 bg-gray-100 rounded-full">
                                <button
                                    type="button"
                                    onClick={() => setCreateMode('website')}
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${createMode === 'website'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Generate from website
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCreateMode('manual')}
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${createMode === 'manual'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Manual seed
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCreate(false)
                                    setNewName('')
                                    setWebsiteUrl('')
                                    setWebsiteName('')
                                    setNewFolder('')
                                }}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                                aria-label="Close create panel"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {createMode === 'website' ? (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Website URL</label>
                                    <div className="relative">
                                        <Globe2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        <input
                                            type="url"
                                            value={websiteUrl}
                                            onChange={(e) => setWebsiteUrl(e.target.value)}
                                            placeholder="https://example.org"
                                            className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !generating) handleGenerateFromWebsite()
                                            }}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Demo name override</label>
                                    <input
                                        type="text"
                                        value={websiteName}
                                        onChange={(e) => setWebsiteName(e.target.value)}
                                        placeholder="Optional — derived from URL if blank"
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !generating) handleGenerateFromWebsite()
                                        }}
                                    />
                                </div>
                                <FolderField value={newFolder} onChange={setNewFolder} folders={folders} />
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
                                    <button
                                        onClick={handleGenerateFromWebsite}
                                        disabled={generating}
                                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50"
                                    >
                                        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        {generating ? 'Creating…' : 'Generate demo'}
                                    </button>
                                    <p className="text-xs text-gray-500">
                                        Scrapes the site and generates profile, initiative, metrics, locations, beneficiaries, and stories. Takes ~30–60 s.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="Acme Foundation (demo)"
                                        className="flex-1 px-4 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                                    />
                                    <button
                                        onClick={handleCreate}
                                        disabled={creating}
                                        className="px-5 py-2 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
                                    >
                                        {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Create + seed
                                    </button>
                                </div>
                                <div className="mt-3">
                                    <FolderField value={newFolder} onChange={setNewFolder} folders={folders} />
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    Auto-seeds with 1 initiative, 4 KPIs, 1 beneficiary group, 1 location, and 1 story. Ready to open immediately.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {!loading && demos.length > 0 && (folders.length > 0 || hasUnfiled) && (
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <button
                            onClick={() => setActiveFolder(null)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeFolder === null
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            All
                            <span className="opacity-60">{demos.length}</span>
                        </button>
                        {folders.map((f) => {
                            const count = demos.filter((d) => d.demo_folder === f).length
                            return (
                                <button
                                    key={f}
                                    onClick={() => setActiveFolder(f)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeFolder === f
                                            ? 'bg-gray-900 text-white'
                                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                >
                                    <Folder className="w-3.5 h-3.5" />
                                    {f}
                                    <span className="opacity-60">{count}</span>
                                </button>
                            )
                        })}
                        {hasUnfiled && (
                            <button
                                onClick={() => setActiveFolder(UNFILED)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${activeFolder === UNFILED
                                        ? 'bg-gray-900 text-white'
                                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                Unfiled
                                <span className="opacity-60">{demos.filter((d) => !d.demo_folder).length}</span>
                            </button>
                        )}
                    </div>
                )}

                {!loading && demos.length > 0 && (
                    <div className="mb-4 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search demos by name or slug…"
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
                        {filteredDemos.map((demo) => {
                            const isReady = !demo.demo_generation_status || demo.demo_generation_status === 'ready'
                            const openTitle = demo.demo_generation_status === 'draft'
                                ? 'Generate content first before opening'
                                : demo.demo_generation_status === 'generating'
                                    ? 'Generation in progress — please wait'
                                    : 'Open dashboard'
                            return (
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
                                            {demo.demo_generation_status === 'draft' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
                                                    Draft
                                                </span>
                                            )}
                                            {demo.demo_generation_status === 'generating' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Generating…
                                                </span>
                                            )}
                                            {demo.demo_generation_status === 'failed' && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Failed
                                                </span>
                                            )}
                                            {demo.demo_public_share && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold uppercase tracking-wide">
                                                    <Share2 className="w-3 h-3" />
                                                    Shared
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 truncate">
                                            <span className="truncate">/demo/{demo.slug}</span>
                                            {demo.demo_folder && (
                                                <span className="inline-flex items-center gap-1 text-gray-400">
                                                    <Folder className="w-3 h-3" />
                                                    {demo.demo_folder}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {demo.demo_generation_status === 'draft' && (
                                            <button
                                                onClick={() => openGenerateModal(demo)}
                                                title="Generate content from a website"
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-full hover:bg-purple-700 text-xs font-medium"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                                Generate
                                            </button>
                                        )}
                                        {demo.demo_generation_status === 'failed' && (
                                            <button
                                                onClick={() => openGenerateModal(demo)}
                                                title="Retry generation"
                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 text-xs font-medium"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                                Retry
                                            </button>
                                        )}
                                        <button
                                            onClick={() => isReady && handleOpen(demo)}
                                            disabled={!isReady}
                                            title={openTitle}
                                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                                isReady
                                                    ? 'bg-gray-900 text-white hover:bg-gray-800'
                                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            }`}
                                        >
                                            Open
                                        </button>
                                        <div className="relative">
                                            <button
                                                onClick={() => setFolderMenuFor(folderMenuFor === demo.id ? null : demo.id)}
                                                title="Move to folder"
                                                className={`p-2 rounded-full ${demo.demo_folder
                                                        ? 'text-gray-700 hover:bg-gray-100'
                                                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <Folder className="w-4 h-4" />
                                            </button>
                                            {folderMenuFor === demo.id && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setFolderMenuFor(null)} />
                                                    <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1 max-h-72 overflow-y-auto">
                                                        <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Move to folder</div>
                                                        {folders.map((f) => (
                                                            <button
                                                                key={f}
                                                                onClick={() => handleMoveToFolder(demo, f)}
                                                                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 ${demo.demo_folder === f ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
                                                            >
                                                                <Folder className="w-3.5 h-3.5 text-gray-400" />
                                                                <span className="truncate flex-1">{f}</span>
                                                                {demo.demo_folder === f && <span className="text-xs text-gray-400">current</span>}
                                                            </button>
                                                        ))}
                                                        {demo.demo_folder && (
                                                            <button
                                                                onClick={() => handleMoveToFolder(demo, null)}
                                                                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gray-600 hover:bg-gray-50 border-t border-gray-100"
                                                            >
                                                                <X className="w-3.5 h-3.5 text-gray-400" />
                                                                Remove from folder
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => openNewFolderForDemo(demo)}
                                                            className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50 border-t border-gray-100"
                                                        >
                                                            <FolderPlus className="w-3.5 h-3.5 text-gray-400" />
                                                            New folder…
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
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
                                            onClick={() => setDeleteConfirm(demo)}
                                            title="Delete"
                                            className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {deleteConfirm && (
                <ConfirmDialog
                    title="Delete demo"
                    message={`Delete demo "${deleteConfirm.name}"? This cannot be undone.`}
                    confirmLabel="Delete demo"
                    tone="danger"
                    onConfirm={() => handleDelete(deleteConfirm)}
                    onCancel={() => setDeleteConfirm(null)}
                />
            )}

            {generateModal && (
                <ModalFrame
                    zIndexClass="z-[90]"
                    panelClassName="bg-white rounded-2xl max-w-md w-full shadow-modal"
                >
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-purple-600" />
                                Generate &ldquo;{generateModal.name}&rdquo;
                            </h3>
                            <button
                                onClick={() => setGenerateModal(null)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Website URL</label>
                        <div className="relative">
                            <Globe2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input
                                type="url"
                                value={generateUrl}
                                onChange={(e) => setGenerateUrl(e.target.value)}
                                placeholder="https://example.org"
                                onKeyDown={(e) => { if (e.key === 'Enter') runGenerate() }}
                                className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                autoFocus
                            />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Pulls profile, context, initiative, metrics, locations, beneficiaries, and stories from this site. The card will show a &ldquo;Generating&hellip;&rdquo; badge and update automatically when done.
                        </p>
                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={() => setGenerateModal(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={runGenerate}
                                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-full inline-flex items-center gap-2"
                            >
                                <Sparkles className="w-4 h-4" />
                                Generate
                            </button>
                        </div>
                    </div>
                </ModalFrame>
            )}

            {folderModalDemo && (
                <ModalFrame
                    zIndexClass="z-[90]"
                    panelClassName="bg-white rounded-2xl max-w-md w-full shadow-modal"
                >
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                <FolderPlus className="w-4 h-4 text-gray-500" />
                                New folder
                            </h3>
                            <button
                                onClick={() => setFolderModalDemo(null)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Folder name</label>
                        <div className="relative">
                            <Folder className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={rowFolderName}
                                onChange={(e) => setRowFolderName(e.target.value)}
                                placeholder="e.g. Q3 Pitches"
                                onKeyDown={(e) => { if (e.key === 'Enter') runNewFolderForDemo() }}
                                className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                autoFocus
                            />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Moves &ldquo;{folderModalDemo.name}&rdquo; into this new folder.
                        </p>
                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={() => setFolderModalDemo(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={runNewFolderForDemo}
                                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-full inline-flex items-center gap-2"
                            >
                                <FolderPlus className="w-4 h-4" />
                                Create &amp; move
                            </button>
                        </div>
                    </div>
                </ModalFrame>
            )}

            {newFolderModal && (
                <ModalFrame
                    zIndexClass="z-[90]"
                    panelClassName="bg-white rounded-2xl max-w-md w-full shadow-modal"
                >
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                <FolderPlus className="w-4 h-4 text-gray-500" />
                                New folder
                            </h3>
                            <button
                                onClick={() => setNewFolderModal(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Folder name</label>
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') confirmNewFolder() }}
                            placeholder="e.g. Q3 Pitches"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                            autoFocus
                        />
                        <p className="mt-2 text-xs text-gray-500">
                            Opens the new demo form with this folder pre-filled — create your first demo inside it to finish.
                        </p>
                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={() => setNewFolderModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmNewFolder}
                                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-full inline-flex items-center gap-2"
                            >
                                <FolderPlus className="w-4 h-4" />
                                Next
                            </button>
                        </div>
                    </div>
                </ModalFrame>
            )}

            {renameModal && (
                <ModalFrame
                    zIndexClass="z-[90]"
                    panelClassName="bg-white rounded-2xl max-w-md w-full shadow-modal"
                >
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                <Edit3 className="w-4 h-4 text-gray-500" />
                                Rename demo
                            </h3>
                            <button
                                onClick={() => setRenameModal(null)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') runRename() }}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={() => setRenameModal(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={runRename}
                                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-full"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </ModalFrame>
            )}

            {cloneModal && (
                <ModalFrame
                    zIndexClass="z-[90]"
                    panelClassName="bg-white rounded-2xl max-w-md w-full shadow-modal"
                >
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                <Copy className="w-4 h-4 text-gray-500" />
                                Clone &ldquo;{cloneModal.name}&rdquo;
                            </h3>
                            <button
                                onClick={() => setCloneModal(null)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name for the copy</label>
                        <input
                            type="text"
                            value={cloneValue}
                            onChange={(e) => setCloneValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') runClone() }}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-5">
                            <button
                                onClick={() => setCloneModal(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={runClone}
                                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-full inline-flex items-center gap-2"
                            >
                                <Copy className="w-4 h-4" />
                                Clone
                            </button>
                        </div>
                    </div>
                </ModalFrame>
            )}
        </div>
    )
}

function FolderField({
    value,
    onChange,
    folders,
}: {
    value: string
    onChange: (v: string) => void
    folders: string[]
}) {
    const [open, setOpen] = useState(false)
    const [filter, setFilter] = useState('')
    const trimmed = filter.trim()
    const matches = folders.filter((f) => f.toLowerCase().includes(trimmed.toLowerCase()))
    const canCreate = !!trimmed && !folders.some((f) => f.toLowerCase() === trimmed.toLowerCase())

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Folder</label>
            <div className="relative">
                <button
                    type="button"
                    onClick={() => { setOpen((o) => !o); setFilter('') }}
                    className="w-full flex items-center gap-2 pl-11 pr-3 py-2.5 border border-gray-200 rounded-full text-sm text-left focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                    <Folder className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <span className={`flex-1 truncate ${value ? 'text-gray-900' : 'text-gray-400'}`}>
                        {value || 'No folder'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
                {open && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-1 max-h-64 overflow-y-auto">
                            <div className="px-2 pb-1">
                                <input
                                    autoFocus
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    placeholder="Filter or type a new folder…"
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => { onChange(''); setOpen(false) }}
                                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 ${value ? 'text-gray-600' : 'text-gray-900 font-medium'}`}
                            >
                                <X className="w-3.5 h-3.5 text-gray-400" />
                                No folder
                            </button>
                            {matches.map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => { onChange(f); setOpen(false) }}
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 ${value === f ? 'text-gray-900 font-medium' : 'text-gray-600'}`}
                                >
                                    <Folder className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="truncate flex-1">{f}</span>
                                    {value === f && <span className="text-xs text-gray-400">selected</span>}
                                </button>
                            ))}
                            {canCreate && (
                                <button
                                    type="button"
                                    onClick={() => { onChange(trimmed); setOpen(false) }}
                                    className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-50 border-t border-gray-100"
                                >
                                    <FolderPlus className="w-3.5 h-3.5 text-gray-400" />
                                    Create &ldquo;{trimmed}&rdquo;
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
