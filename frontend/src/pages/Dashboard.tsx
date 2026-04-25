import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    Plus,
    MapPin,
    Edit,
    Trash2,
    GraduationCap,
    Zap,
    X,
    ArrowRight,
    Users,
    Check,
    AlertCircle,
    Globe,
    Compass,
    Sparkles,
    BarChart3,
    Palette,
    Image as ImageIcon,
    FileText
} from 'lucide-react'
import { apiService } from '../services/api'
import { Initiative, LoadingState, CreateInitiativeForm, KPI, Location, OrganizationContext } from '../types'
import { formatDate, truncateText } from '../utils'
import toast from 'react-hot-toast'
import CreateInitiativeModal from '../components/CreateInitiativeModal'
import LocationMap from '../components/LocationMap'
import { useTutorial } from '../context/TutorialContext'
import { useTeam } from '../context/TeamContext'

// ============ Small widgets ============
function scoreColor(pct: number): string {
    if (pct >= 80) return '#22c55e'
    if (pct >= 50) return '#f59e0b'
    return '#ef4444'
}

function CompletionRing({ pct, size = 56 }: { pct: number; size?: number }) {
    const stroke = 6
    const r = (size - stroke) / 2
    const c = 2 * Math.PI * r
    const dash = (pct / 100) * c
    const color = scoreColor(pct)
    return (
        <svg width={size} height={size} className="flex-shrink-0">
            <circle cx={size / 2} cy={size / 2} r={r} stroke="#f1f5f9" strokeWidth={stroke} fill="none" />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${dash} ${c}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ transition: 'stroke-dasharray 500ms ease' }}
            />
            <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={size * 0.28}
                fontWeight={700}
                fill="#374151"
            >{pct}%</text>
        </svg>
    )
}

function PublicScoreCard({
    score,
    checks,
}: {
    score: { done: number; total: number; pct: number }
    checks: { id: string; label: string; done: boolean; to: string }[]
}) {
    const [open, setOpen] = useState(false)
    return (
        <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-4 flex flex-col min-h-0">
            <div className="flex items-center gap-3">
                <CompletionRing pct={score.pct} size={48} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-gray-500" />
                        <h3 className="text-sm font-semibold text-gray-800">Public Page</h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{score.done} of {score.total} complete</p>
                </div>
                <button
                    onClick={() => setOpen(v => !v)}
                    className="text-xs font-medium text-gray-500 hover:text-gray-800"
                >
                    {open ? 'Hide' : 'View'}
                </button>
            </div>
            {open && (
                <div className="mt-3 space-y-1 overflow-y-auto min-h-0 flex-1">
                    {checks.map(c => (
                        <Link
                            key={c.id}
                            to={c.to}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${c.done ? 'text-gray-400 line-through' : 'text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            {c.done
                                ? <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                : <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                            <span className="truncate flex-1">{c.label}</span>
                            {!c.done && <ArrowRight className="w-3 h-3 text-gray-400" />}
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}

function ContextScoreCard({
    score,
    checks,
}: {
    score: { done: number; total: number; pct: number }
    checks: { id: string; label: string; done: boolean }[]
}) {
    const color = scoreColor(score.pct)
    return (
        <Link
            to="/context"
            className="group bg-white rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] ring-1 ring-gray-900/[0.04] p-4 flex flex-col gap-2.5 hover:ring-primary-200/60 hover:-translate-y-0.5 transition-all duration-200 min-h-0"
        >
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 ring-1 ring-primary-100/50 flex items-center justify-center">
                    <Compass className="w-4 h-4 text-primary-600" />
                </div>
                <h3 className="text-[13px] font-semibold text-gray-900 tracking-tight flex-1">Context Page</h3>
                <span className="text-[11px] font-semibold text-gray-500">{score.done}/{score.total}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="w-full h-1.5 bg-gray-100/80 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,0,0,0.08)]"
                    style={{ width: `${score.pct}%`, backgroundColor: color }}
                />
            </div>
            <div className="flex flex-wrap gap-1">
                {checks.map(c => (
                    <span
                        key={c.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${c.done
                                ? 'bg-green-50 text-green-700 ring-1 ring-green-100'
                                : 'bg-gray-50 text-gray-500 ring-1 ring-gray-100'
                            }`}
                        title={c.label}
                    >
                        {c.done ? <Check className="w-2.5 h-2.5" /> : <span className="w-1 h-1 rounded-full bg-current" />}
                        {c.label}
                    </span>
                ))}
            </div>
        </Link>
    )
}

function NextStepsCard({
    steps,
    loading,
}: {
    steps: { id: string; label: string; icon: React.ReactNode; to?: string; onClick?: () => void }[]
    loading?: boolean
}) {
    const rowClass = "group w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-gradient-to-br from-white to-gray-50/40 hover:from-primary-50/40 hover:to-primary-50/10 border border-gray-100 hover:border-primary-200/70 transition-all"
    return (
        <div className="bg-white rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] ring-1 ring-gray-900/[0.04] p-4 flex flex-col min-h-0 flex-1">
            <div className="flex items-center gap-2.5 mb-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-xl bg-primary-50 ring-1 ring-primary-100/50 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary-600" />
                </div>
                <h3 className="text-[13px] font-semibold text-gray-900 tracking-tight">Next Steps</h3>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
                {loading ? (
                    <>
                        <div className="h-[38px] rounded-xl bg-gray-100/70 animate-pulse" />
                        <div className="h-[38px] rounded-xl bg-gray-100/70 animate-pulse" />
                        <div className="h-[38px] rounded-xl bg-gray-100/60 animate-pulse" />
                    </>
                ) : steps.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-50 to-green-100 ring-1 ring-green-200/50 flex items-center justify-center mb-2">
                            <Check className="w-5 h-5 text-green-600" />
                        </div>
                        <p className="text-xs font-medium text-gray-700">All caught up!</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Your dashboard is in great shape.</p>
                    </div>
                ) : (
                    steps.map(s => {
                        const inner = (
                            <>
                                <div className="w-7 h-7 rounded-lg bg-white ring-1 ring-gray-200/70 shadow-sm flex items-center justify-center text-gray-500 group-hover:text-primary-600 group-hover:ring-primary-200/70 flex-shrink-0 transition-colors">
                                    {s.icon}
                                </div>
                                <span className="text-xs font-medium text-gray-700 group-hover:text-primary-700 flex-1 truncate">
                                    {s.label}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                            </>
                        )
                        return s.onClick ? (
                            <button key={s.id} type="button" onClick={s.onClick} className={rowClass}>{inner}</button>
                        ) : (
                            <Link key={s.id} to={s.to || '#'} className={rowClass}>{inner}</Link>
                        )
                    })
                )}
            </div>
        </div>
    )
}

export default function Dashboard() {
    const navigate = useNavigate()
    const { startTutorial } = useTutorial()
    const { isOwner, isSharedMember, organizationName, ownedOrganization } = useTeam()
    // Phase 1 (full-access baseline): any member of the active org can create/edit/delete
    // initiatives. Account-level widgets (logo, branding, public toggle) remain owner-only.
    const canManageInitiatives = isOwner || isSharedMember
    const [initiatives, setInitiatives] = useState<Initiative[]>([])
    const [allKPIs, setAllKPIs] = useState<KPI[]>([])
    const [allLocations, setAllLocations] = useState<Location[]>([])
    const [totalEvidence, setTotalEvidence] = useState<number>(0)
    const [orgContext, setOrgContext] = useState<OrganizationContext | null>(null)
    const [contextLoaded, setContextLoaded] = useState(false)
    // Organization info now comes from TeamContext
    const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })
    const [isLoadingStats, setIsLoadingStats] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [deleteConfirmInitiative, setDeleteConfirmInitiative] = useState<Initiative | null>(null)
    const [deleteConfirmText, setDeleteConfirmText] = useState('')
    const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [upgradeUsage, setUpgradeUsage] = useState<{ current: number; limit: number } | null>(null)

    // Add loading cache to prevent duplicate requests
    const [isLoadingData, setIsLoadingData] = useState(false)
    const loadingPromise = useRef<Promise<void> | null>(null)

    useEffect(() => {
        if (!isOwner || !ownedOrganization?.id) return
        let cancelled = false
        setContextLoaded(false)
        apiService.getOrgContext(ownedOrganization.id)
            .then(ctx => { if (!cancelled) { setOrgContext(ctx); setContextLoaded(true) } })
            .catch(() => { if (!cancelled) { setOrgContext(null); setContextLoaded(true) } })
        return () => { cancelled = true }
    }, [isOwner, ownedOrganization?.id])

    useEffect(() => {
        // Only load if not already loading and no promise in progress
        if (!isLoadingData && !loadingPromise.current) {
            loadingPromise.current = loadAllData()
        }

        // Listen for tutorial trigger from header
        const handleShowTutorial = () => {
            startTutorial()
        }
        window.addEventListener('show-tutorial', handleShowTutorial)
        return () => {
            window.removeEventListener('show-tutorial', handleShowTutorial)
        }
    }, [])

    const loadAllData = async (): Promise<void> => {
        if (isLoadingData || loadingPromise.current) {
            console.log('Load already in progress, skipping...')
            return loadingPromise.current || Promise.resolve()
        }

        // Check if all data is already cached - if so, load from cache without API calls
        const [initiativesCached, kpisCached, evidenceCached] = await Promise.all([
            apiService.isDataCached('/initiatives'),
            apiService.isDataCached('/kpis'),
            apiService.isDataCached('/evidence')
        ])
        const hasCachedData = initiativesCached && kpisCached && evidenceCached

        if (hasCachedData) {
            console.log('All dashboard data is cached, loading from cache...')
        } else {
            console.log('Loading dashboard data...')
        }

        setIsLoadingData(true)
        setLoadingState({ isLoading: true })

        try {
            // Load initiatives - organization comes from TeamContext now
            const initiatives = await apiService.loadInitiativesOnly()
            setInitiatives(initiatives)
            setLoadingState({ isLoading: false }) // Show initiatives immediately

            // Load KPIs, evidence, and locations in background
            const [{ kpis, evidence }, locations] = await Promise.all([
                apiService.loadKPIsAndEvidence(),
                apiService.getLocations() // Get all locations across all initiatives
            ])
            setAllKPIs(kpis)
            setTotalEvidence(evidence.length)
            setAllLocations(locations)
            setIsLoadingStats(false)

            console.log('Dashboard data loaded successfully')

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load dashboard data'
            setLoadingState({ isLoading: false, error: message })
            toast.error(message)
            console.error('Dashboard loading error:', error)
        } finally {
            setIsLoadingData(false)
            loadingPromise.current = null
        }
    }

    // Smart refresh function - only refresh specific data when needed
    const refreshInitiatives = async () => {
        try {
            const initiatives = await apiService.getInitiatives()
            setInitiatives(initiatives)
        } catch (error) {
            console.error('Failed to refresh initiatives:', error)
        }
    }

    const refreshKPIsAndEvidence = async () => {
        try {
            setIsLoadingStats(true)
            const [kpis, evidence, locations] = await Promise.all([
                apiService.getKPIs(),
                apiService.getEvidence(),
                apiService.getLocations()
            ])
            setAllKPIs(kpis)
            setTotalEvidence(evidence.length)
            setAllLocations(locations)
            setIsLoadingStats(false)
        } catch (error) {
            console.error('Failed to refresh KPIs and evidence:', error)
            setIsLoadingStats(false)
        }
    }

    const handleCreateInitiative = async (formData: CreateInitiativeForm) => {
        try {
            const newInitiative = await apiService.createInitiative(formData)
            toast.success('Initiative created successfully!')
            // Only refresh initiatives, not all data
            await refreshInitiatives()

        } catch (error: any) {
            // Check if it's an initiative limit error
            if (error?.code === 'INITIATIVE_LIMIT_REACHED' || error?.message?.includes('Initiative limit reached')) {
                setUpgradeUsage(error.usage || { current: initiatives.length, limit: 2 })
                setShowUpgradeModal(true)
                setShowCreateModal(false)
                return // Don't throw, we're handling it with UI
            }
            const message = error instanceof Error ? error.message : 'Failed to create initiative'
            toast.error(message)
            throw error
        }
    }

    const handleEditInitiative = async (formData: CreateInitiativeForm) => {
        if (!selectedInitiative?.id) return
        try {
            await apiService.updateInitiative(selectedInitiative.id, formData)
            toast.success('Initiative updated successfully!')
            // Only refresh initiatives, not all data
            await refreshInitiatives()
            setShowEditModal(false)
            setSelectedInitiative(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update initiative'
            toast.error(message)
            throw error
        }
    }

    const handleDeleteInitiative = async (initiative: Initiative) => {
        if (!initiative.id) return
        if (deleteConfirmText !== 'DELETE MY INITIATIVE') {
            toast.error('Please type "DELETE MY INITIATIVE" exactly to confirm')
            return
        }
        try {
            await apiService.deleteInitiative(initiative.id)
            toast.success('Initiative deleted successfully!')
            // Refresh all data since deleting initiative affects KPIs and evidence too
            setIsLoadingStats(true)
            await loadAllData()
            setDeleteConfirmInitiative(null)
            setDeleteConfirmText('')
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete initiative'
            toast.error(message)
        }
    }

    const openEditModal = (initiative: Initiative) => {
        setSelectedInitiative(initiative)
        setShowEditModal(true)
    }

    const openDeleteConfirm = (initiative: Initiative) => {
        setDeleteConfirmInitiative(initiative)
    }


    // ============ Completeness + Next Steps (owner only) ============
    // IMPORTANT: these hooks MUST run before any early return to preserve hook order.
    const publicChecks = useMemo(() => {
        const o = ownedOrganization
        const firstInit = initiatives[0]?.id
        return [
            { id: 'logo', label: 'Upload organization logo', done: !!o?.logo_url, to: '/account?tab=organization' },
            { id: 'brand', label: 'Set brand color', done: !!o?.brand_color, to: '/account?tab=branding' },
            { id: 'statement', label: 'Write mission statement', done: !!(o?.statement && o.statement.trim().length > 0), to: '/account?tab=organization' },
            { id: 'public', label: 'Make organization public', done: !!o?.is_public, to: '/account?tab=organization' },
            { id: 'initiative', label: 'Create an initiative', done: initiatives.length > 0, to: '/' },
            { id: 'metric', label: 'Add at least one metric', done: allKPIs.length > 0, to: firstInit ? `/initiatives/${firstInit}?tab=metrics` : '/' },
            { id: 'location', label: 'Add at least one location', done: allLocations.length > 0, to: firstInit ? `/initiatives/${firstInit}?tab=location` : '/' },
            { id: 'evidence', label: 'Add at least one evidence', done: totalEvidence > 0, to: firstInit ? `/initiatives/${firstInit}?tab=evidence` : '/' },
        ]
    }, [ownedOrganization, initiatives, allKPIs, allLocations, totalEvidence])

    const publicScore = useMemo(() => {
        const done = publicChecks.filter(c => c.done).length
        return { done, total: publicChecks.length, pct: Math.round((done / publicChecks.length) * 100) }
    }, [publicChecks])

    const contextChecks = useMemo(() => {
        const c = orgContext
        const hasText = (v?: string | null) => !!(v && v.trim().length > 0)
        const hasList = (v?: any[] | null) => Array.isArray(v) && v.length > 0
        return [
            { id: 'problem', label: 'Problem Statement', done: hasText(c?.problem_statement) },
            { id: 'stats', label: 'Stats & Statements', done: hasList(c?.stats_and_statements) },
            { id: 'theory', label: 'Theory of Change', done: hasText(c?.theory_of_change) || hasList(c?.theory_of_change_stages) },
            { id: 'strategies', label: 'Strategies', done: hasList(c?.strategies) },
            { id: 'more', label: 'More Context', done: hasText(c?.additional_info) },
        ]
    }, [orgContext])

    const contextScore = useMemo(() => {
        const done = contextChecks.filter(c => c.done).length
        return { done, total: contextChecks.length, pct: Math.round((done / contextChecks.length) * 100) }
    }, [contextChecks])

    const nextSteps = useMemo(() => {
        type Step = { id: string; label: string; icon: React.ReactNode; to?: string; onClick?: () => void }
        const steps: Step[] = []
        const o = ownedOrganization
        const firstInit = initiatives[0]?.id
        if (!o?.logo_url) steps.push({ id: 'logo', label: 'Upload your logo', to: '/account?tab=branding', icon: <ImageIcon className="w-4 h-4" /> })
        if (!o?.brand_color) steps.push({ id: 'brand', label: 'Pick a brand color', to: '/account?tab=branding', icon: <Palette className="w-4 h-4" /> })
        if (!o?.statement) steps.push({ id: 'statement', label: 'Add a mission statement', to: '/account?tab=organization', icon: <FileText className="w-4 h-4" /> })
        if (!o?.is_public) steps.push({ id: 'public', label: 'Publish your organization', to: '/account?tab=account', icon: <Globe className="w-4 h-4" /> })
        if (initiatives.length === 0) steps.push({ id: 'initiative', label: 'Create your first initiative', onClick: () => setShowCreateModal(true), icon: <Plus className="w-4 h-4" /> })
        initiatives.forEach((init) => {
            const initKpis = allKPIs.filter(k => k.initiative_id === init.id)
            if (initKpis.length === 0) steps.push({ id: `metrics-${init.id}`, label: `Add metrics to "${init.title}"`, to: `/initiatives/${init.id}?tab=metrics`, icon: <BarChart3 className="w-4 h-4" /> })
        })
        if (allLocations.length === 0 && firstInit) {
            steps.push({ id: 'locations', label: 'Add locations to an initiative', to: `/initiatives/${firstInit}?tab=location`, icon: <MapPin className="w-4 h-4" /> })
        }
        if (totalEvidence === 0 && firstInit) {
            steps.push({ id: 'evidence', label: 'Add evidence to an initiative', to: `/initiatives/${firstInit}?tab=evidence`, icon: <FileText className="w-4 h-4" /> })
        }
        if (contextScore.done < contextScore.total) {
            steps.push({ id: 'context', label: `Finish context page (${contextScore.done}/${contextScore.total})`, to: '/context', icon: <Compass className="w-4 h-4" /> })
        }
        return steps.slice(0, 4)
    }, [ownedOrganization, initiatives, allKPIs, allLocations, totalEvidence, contextScore])

    const showOwnerWidgets = isOwner && !!ownedOrganization

    if (loadingState.isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (loadingState.error) {
        return (
            <div className="text-center py-12">
                <div className="text-red-600 mb-4">{loadingState.error}</div>
                <button
                    onClick={() => {
                        if (!isLoadingData && !loadingPromise.current) {
                            loadingPromise.current = loadAllData()
                        }
                    }}
                    className="btn-primary"
                    disabled={isLoadingData || !!loadingPromise.current}
                >
                    {(isLoadingData || loadingPromise.current) ? 'Loading...' : 'Try Again'}
                </button>
            </div>
        )
    }

    const handleLocationClick = (location: Location) => {
        if (location.initiative_id) {
            navigate(`/initiatives/${location.initiative_id}?tab=locations`)
        }
    }

    return (
        <>
            <div className="h-screen overflow-hidden pt-24 pb-6 px-4 sm:px-6 flex flex-col">
                {/* Mobile Header - only visible on mobile */}
                <div className="mobile-only mb-4 -mt-8">
                    <h1 className="text-xl font-semibold text-gray-800">Your Initiatives</h1>
                </div>

                {/* Bento Layout - fills remaining height */}
                <div className="flex-1 min-h-0">
                    <div className={`grid grid-cols-1 ${showOwnerWidgets ? 'lg:grid-cols-5' : 'lg:grid-cols-3'} gap-4 h-full`}>
                        {/* Initiatives Module - narrower on desktop (2/5), full width on mobile */}
                        <div className={`col-span-1 ${showOwnerWidgets ? 'lg:col-span-2' : 'lg:col-span-2'} bg-white rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] ring-1 ring-gray-900/[0.04] overflow-hidden flex flex-col min-h-0`}>
                            {/* Team Member Banner */}
                            {isSharedMember && organizationName && (
                                <div className="px-6 py-3 bg-purple-50 border-b border-purple-100 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-purple-600" />
                                    <span className="text-sm text-purple-800">
                                        You're viewing <strong>{organizationName}</strong>'s initiatives as a team member
                                    </span>
                                </div>
                            )}

                            <div className="px-6 py-4 border-b border-gray-100/70 bg-gradient-to-b from-gray-50/50 to-transparent flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-primary-50 ring-1 ring-primary-100/50 flex items-center justify-center">
                                        <img src="/Nexuslogo.png" alt="" className="w-4 h-4 object-contain" />
                                    </div>
                                    <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">
                                        {isSharedMember ? 'Team Initiatives' : 'Your Initiatives'}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={startTutorial}
                                        className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all duration-200 flex items-center gap-1.5"
                                        title="Start Tutorial"
                                    >
                                        <GraduationCap className="w-4 h-4" />
                                        <span className="hidden sm:inline">Tutorial</span>
                                    </button>
                                    {canManageInitiatives && (
                                        <button
                                            onClick={() => setShowCreateModal(true)}
                                            className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-all duration-200 flex items-center gap-1.5 shadow-bubble-sm"
                                        >
                                            <Plus className="w-4 h-4" />
                                            {initiatives.length === 0 ? 'Get Started' : 'New Initiative'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 flex-1 overflow-y-auto min-h-0">
                                {initiatives.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="icon-bubble mx-auto mb-4">
                                            <img src="/Nexuslogo.png" alt="Nexus Logo" className="w-6 h-6 object-contain" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                                            {isSharedMember ? 'No Initiatives Yet' : 'Welcome to OFE'}
                                        </h3>
                                        <p className="text-gray-500 mb-6 max-w-md mx-auto text-sm">
                                            {isSharedMember
                                                ? `Your organization doesn't have any initiatives yet. Create the first one to start tracking impact.`
                                                : 'Create your first initiative to start tracking impact.'}
                                        </p>
                                        {canManageInitiatives && (
                                            <button
                                                onClick={() => setShowCreateModal(true)}
                                                className="px-5 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-all duration-200 shadow-bubble-sm"
                                            >
                                                Create Your First Initiative
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {initiatives.map((initiative) => (
                                            <div
                                                key={initiative.id}
                                                className="group bg-gradient-to-br from-white to-gray-50/40 hover:from-primary-50/40 hover:to-primary-50/10 border border-gray-100 hover:border-primary-200/70 rounded-2xl p-3.5 transition-all duration-200 relative"
                                            >
                                                <Link
                                                    to={`/initiatives/${initiative.id}`}
                                                    className="block"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                            <div className="w-10 h-10 rounded-xl bg-white ring-1 ring-gray-200/70 shadow-sm flex items-center justify-center flex-shrink-0 group-hover:ring-primary-200/70 transition-colors">
                                                                <img src="/Nexuslogo.png" alt="Nexus Logo" className="w-5 h-5 object-contain" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-sm font-semibold text-gray-800 group-hover:text-primary-600 transition-colors truncate">
                                                                    {initiative.title}
                                                                </h3>
                                                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                                                    {truncateText(initiative.description, 60)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="text-primary-500 text-sm font-medium group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-2">
                                                            →
                                                        </span>
                                                    </div>
                                                </Link>

                                                {/* Action Buttons - any org member */}
                                                {canManageInitiatives && (
                                                    <div className="absolute top-2 right-8 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                openEditModal(initiative)
                                                            }}
                                                            className="p-1.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                                                            title="Edit Initiative"
                                                        >
                                                            <Edit className="w-3 h-3 text-gray-500" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                openDeleteConfirm(initiative)
                                                            }}
                                                            className="p-1.5 bg-white border border-red-200 rounded-lg shadow-sm hover:bg-red-50 hover:border-red-300 transition-all duration-200"
                                                            title="Delete Initiative"
                                                        >
                                                            <Trash2 className="w-3 h-3 text-red-500" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Locations Map Module - hidden on mobile */}
                        <div className={`col-span-1 ${showOwnerWidgets ? 'lg:col-span-2' : 'lg:col-span-1'} bg-white rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] ring-1 ring-gray-900/[0.04] overflow-hidden hidden md:flex flex-col min-h-0`}>
                            <div className="px-6 py-4 border-b border-gray-100/70 bg-gradient-to-b from-gray-50/50 to-transparent flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-primary-50 ring-1 ring-primary-100/50 flex items-center justify-center">
                                        <MapPin className="w-4 h-4 text-primary-600" />
                                    </div>
                                    <h2 className="text-[15px] font-semibold text-gray-900 tracking-tight">All Locations</h2>
                                </div>
                                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100/70 text-gray-600">
                                    {allLocations.length} location{allLocations.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="flex-1 min-h-0 rounded-b-2xl overflow-hidden">
                                <LocationMap
                                    locations={allLocations}
                                    onLocationClick={handleLocationClick}
                                    hideEmptyBanner
                                />
                            </div>
                        </div>

                        {/* Right Rail - Owner widgets (Context Score / Next Steps) */}
                        {showOwnerWidgets && (
                            <div className="col-span-1 hidden lg:flex flex-col gap-4 min-h-0">
                                <ContextScoreCard score={contextScore} checks={contextChecks} />
                                <NextStepsCard steps={nextSteps} loading={isLoadingStats || !contextLoaded} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showCreateModal && (
                <CreateInitiativeModal
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    onSubmit={handleCreateInitiative}
                />
            )}

            {/* Edit Initiative Modal */}
            {selectedInitiative && (
                <CreateInitiativeModal
                    isOpen={showEditModal}
                    onClose={() => {
                        setShowEditModal(false)
                        setSelectedInitiative(null)
                    }}
                    onSubmit={handleEditInitiative}
                    editData={selectedInitiative}
                />
            )}


            {/* Delete Confirmation Dialog */}
            {deleteConfirmInitiative && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-bubble-lg border border-gray-100">
                        <div className="flex items-start space-x-4 mb-6">
                            <div className="icon-bubble">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-800 mb-1">Delete Initiative</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                            Are you sure you want to delete "<strong className="font-medium text-gray-800">{deleteConfirmInitiative.title}</strong>"?
                            This will also delete all associated KPIs, impact claims, and evidence.
                        </p>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Type <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">DELETE MY INITIATIVE</span> to confirm:
                            </label>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="DELETE MY INITIATIVE"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500"
                            />
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => { setDeleteConfirmInitiative(null); setDeleteConfirmText('') }}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteInitiative(deleteConfirmInitiative)}
                                disabled={deleteConfirmText !== 'DELETE MY INITIATIVE'}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-2xl transition-all duration-200 shadow-bubble-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Delete Initiative
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upgrade Modal - Initiative Limit Reached */}
            {showUpgradeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] transform transition-all duration-200 ease-out animate-slide-up-fast">
                        {/* Header */}
                        <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 p-6 text-center border-b border-amber-100">
                            <button
                                onClick={() => setShowUpgradeModal(false)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/50 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Zap className="w-8 h-8 text-amber-600" />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-1">Initiative Limit Reached</h2>
                            <p className="text-gray-600 text-sm">
                                You're using {upgradeUsage?.current || initiatives.length} of {upgradeUsage?.limit || 2} initiatives
                            </p>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 mb-6 border border-amber-100">
                                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <span className="text-amber-600">⚡</span>
                                    Initiative Limit Reached
                                </h3>
                                <div className="space-y-2 text-sm text-gray-700">
                                    <p className="flex items-start gap-2">
                                        <span className="text-amber-500 mt-0.5">•</span>
                                        <span>You've used all {upgradeUsage?.limit || 2} initiatives in your plan</span>
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <span className="text-amber-500 mt-0.5">•</span>
                                        <span><strong>+$1/day</strong> per additional initiative (coming soon)</span>
                                    </p>
                                    <p className="flex items-start gap-2">
                                        <span className="text-amber-500 mt-0.5">•</span>
                                        <span>Delete an existing initiative to create a new one</span>
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        setShowUpgradeModal(false)
                                        navigate('/account')
                                    }}
                                    className="w-full bg-emerald-500 text-white py-3 px-6 rounded-xl hover:bg-emerald-600 transition-all font-medium flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40"
                                >
                                    Manage Subscription
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setShowUpgradeModal(false)}
                                    className="w-full py-2.5 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    Maybe Later
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </>
    )
} 