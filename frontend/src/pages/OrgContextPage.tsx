import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
    Compass, Save, AlertTriangle, Lightbulb, BarChart3, FileText,
    ExternalLink, Lock, Plus, Trash2, ArrowUp, ArrowDown, Hash, Quote, Workflow, Target,
    ChevronDown, Check, ArrowLeft, Video,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { apiService } from '../services/api'
import { useTeam } from '../context/TeamContext'
import {
    OrganizationContext, StatCard, StatCardType, TheoryStage, Strategy,
    MAX_STAT_CARDS, MAX_THEORY_STAGES, MAX_STRATEGIES,
} from '../types'
import { parseVideoUrl } from '../utils/videoEmbed'

type TextField = 'problem_statement' | 'theory_of_change' | 'additional_info'

interface TextFieldConfig {
    key: TextField
    label: string
    description: string
    placeholder: string
    icon: typeof AlertTriangle
    accent: string
}

const TEXT_FIELDS: TextFieldConfig[] = [
    {
        key: 'problem_statement',
        label: 'Problem Statement',
        description: 'The core problem your organization exists to solve.',
        placeholder: 'What is the problem? Who does it affect? Why does it matter?',
        icon: AlertTriangle,
        accent: 'bg-rose-50 text-rose-600',
    },
    {
        key: 'theory_of_change',
        label: 'Theory of Change',
        description: 'A short summary of how your work creates change. Add stages below for the full flow.',
        placeholder: 'By doing X, we expect Y, which leads to Z...',
        icon: Lightbulb,
        accent: 'bg-emerald-50 text-emerald-600',
    },
    {
        key: 'additional_info',
        label: 'More Context',
        description: 'Anything else a visitor should know: context, history, partnerships.',
        placeholder: 'Background, partnerships, beneficiaries, or anything else worth sharing.',
        icon: FileText,
        accent: 'bg-sky-50 text-sky-600',
    },
]

type TextValues = Record<TextField, string>

const EMPTY_TEXT: TextValues = {
    problem_statement: '',
    theory_of_change: '',
    additional_info: '',
}

function newId() {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function emptyCard(type: StatCardType = 'statement'): StatCard {
    return {
        id: newId(),
        type,
        value: '',
        title: '',
        description: '',
        source: '',
        source_url: '',
        created_at: new Date().toISOString(),
    }
}

function emptyStage(): TheoryStage {
    return { id: newId(), title: '', description: '' }
}

function emptyStrategy(): Strategy {
    return { id: newId(), title: '', description: '' }
}

function statsEqual(a: StatCard[], b: StatCard[]) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        const x = a[i], y = b[i]
        if (
            x.id !== y.id ||
            x.type !== y.type ||
            (x.value || '') !== (y.value || '') ||
            x.title !== y.title ||
            x.description !== y.description ||
            (x.source || '') !== (y.source || '') ||
            (x.source_url || '') !== (y.source_url || '') ||
            x.created_at !== y.created_at
        ) {
            return false
        }
    }
    return true
}

function titledListEqual<T extends { id: string; title: string; description: string }>(a: T[], b: T[]) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
        const x = a[i], y = b[i]
        if (x.id !== y.id || x.title !== y.title || x.description !== y.description) return false
    }
    return true
}

function normalizeStats(raw: unknown): StatCard[] {
    if (!Array.isArray(raw)) return []
    return raw.map((s: any) => ({
        id: s?.id || newId(),
        type: s?.type === 'stat' ? 'stat' : 'statement',
        value: s?.value || '',
        title: s?.title || '',
        description: s?.description || '',
        source: s?.source || '',
        source_url: s?.source_url || '',
        created_at: s?.created_at || new Date().toISOString(),
    }))
}

function normalizeTitledList<T extends { id: string; title: string; description: string }>(raw: unknown): T[] {
    if (!Array.isArray(raw)) return []
    return raw.map((s: any) => ({
        id: s?.id || newId(),
        title: s?.title || '',
        description: s?.description || '',
    })) as T[]
}

export default function OrgContextPage() {
    const { activeOrganization, loading: teamLoading } = useTeam()
    const orgId = activeOrganization?.id
    // Phase 1 (full-access baseline): any member of the active org can edit
    // the organization context. Phase 7 may reintroduce gating.
    const canEditContext = !!activeOrganization

    const [featuredVideoUrl, setFeaturedVideoUrl] = useState('')
    const [initialFeaturedVideoUrl, setInitialFeaturedVideoUrl] = useState('')
    const [textValues, setTextValues] = useState<TextValues>(EMPTY_TEXT)
    const [initialTextValues, setInitialTextValues] = useState<TextValues>(EMPTY_TEXT)
    const [stats, setStats] = useState<StatCard[]>([])
    const [initialStats, setInitialStats] = useState<StatCard[]>([])
    const [stages, setStages] = useState<TheoryStage[]>([])
    const [initialStages, setInitialStages] = useState<TheoryStage[]>([])
    const [strategies, setStrategies] = useState<Strategy[]>([])
    const [initialStrategies, setInitialStrategies] = useState<Strategy[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!orgId) return
        let cancelled = false
        setLoading(true)
        apiService.getOrgContext(orgId)
            .then((data) => {
                if (cancelled) return
                const nextText: TextValues = {
                    problem_statement: data?.problem_statement || '',
                    theory_of_change: data?.theory_of_change || '',
                    additional_info: data?.additional_info || '',
                }
                const nextStats = normalizeStats(data?.stats_and_statements)
                const nextStages = normalizeTitledList<TheoryStage>(data?.theory_of_change_stages)
                const nextStrategies = normalizeTitledList<Strategy>(data?.strategies)
                const nextVideo = data?.featured_video_url || ''
                setFeaturedVideoUrl(nextVideo)
                setInitialFeaturedVideoUrl(nextVideo)
                setTextValues(nextText)
                setInitialTextValues(nextText)
                setStats(nextStats)
                setInitialStats(nextStats)
                setStages(nextStages)
                setInitialStages(nextStages)
                setStrategies(nextStrategies)
                setInitialStrategies(nextStrategies)
                setError(null)
            })
            .catch((err) => {
                if (cancelled) return
                setError((err as Error).message || 'Failed to load context')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })
        return () => { cancelled = true }
    }, [orgId])

    const hasChanges = useMemo(() => {
        const textDirty = TEXT_FIELDS.some(f => textValues[f.key] !== initialTextValues[f.key])
        return textDirty
            || featuredVideoUrl.trim() !== initialFeaturedVideoUrl.trim()
            || !statsEqual(stats, initialStats)
            || !titledListEqual(stages, initialStages)
            || !titledListEqual(strategies, initialStrategies)
    }, [featuredVideoUrl, initialFeaturedVideoUrl, textValues, initialTextValues, stats, initialStats, stages, initialStages, strategies, initialStrategies])

    const handleSave = async () => {
        if (!orgId || !canEditContext) return

        for (const s of stats) {
            if (s.type === 'stat' && !(s.value || '').trim()) {
                toast.error('Every stat card needs a number/value. Fill it in or switch it to a statement.')
                return
            }
        }

        const trimmedVideoUrl = featuredVideoUrl.trim()
        if (trimmedVideoUrl && !parseVideoUrl(trimmedVideoUrl)) {
            toast.error('Featured video must be a YouTube or Vimeo URL.')
            return
        }

        setSaving(true)
        try {
            const cleanedStats = stats
                .map(s => ({
                    id: s.id,
                    type: s.type,
                    value: s.type === 'stat' ? (s.value || '').trim() : '',
                    title: s.title.trim(),
                    description: s.description.trim(),
                    source: (s.source || '').trim(),
                    source_url: (s.source_url || '').trim(),
                    created_at: s.created_at,
                }))
                .filter(s =>
                    s.type === 'stat'
                        ? !!s.value
                        : !!(s.title || s.description)
                )
                .slice(0, MAX_STAT_CARDS)

            const cleanedStages = stages
                .map(s => ({
                    id: s.id,
                    title: s.title.trim(),
                    description: s.description.trim(),
                }))
                .filter(s => s.title || s.description)
                .slice(0, MAX_THEORY_STAGES)

            const cleanedStrategies = strategies
                .map(s => ({
                    id: s.id,
                    title: s.title.trim(),
                    description: s.description.trim(),
                }))
                .filter(s => s.title || s.description)
                .slice(0, MAX_STRATEGIES)

            const payload: Partial<OrganizationContext> = {
                featured_video_url: trimmedVideoUrl,
                problem_statement: textValues.problem_statement.trim(),
                theory_of_change: textValues.theory_of_change.trim(),
                additional_info: textValues.additional_info.trim(),
                stats_and_statements: cleanedStats,
                theory_of_change_stages: cleanedStages,
                strategies: cleanedStrategies,
            }
            const saved = await apiService.updateOrgContext(orgId, payload)
            const nextText: TextValues = {
                problem_statement: saved.problem_statement || '',
                theory_of_change: saved.theory_of_change || '',
                additional_info: saved.additional_info || '',
            }
            const nextVideo = saved.featured_video_url || ''
            const nextStats = normalizeStats(saved.stats_and_statements)
            const nextStages = normalizeTitledList<TheoryStage>(saved.theory_of_change_stages)
            const nextStrategies = normalizeTitledList<Strategy>(saved.strategies)
            setFeaturedVideoUrl(nextVideo)
            setInitialFeaturedVideoUrl(nextVideo)
            setTextValues(nextText)
            setInitialTextValues(nextText)
            setStats(nextStats)
            setInitialStats(nextStats)
            setStages(nextStages)
            setInitialStages(nextStages)
            setStrategies(nextStrategies)
            setInitialStrategies(nextStrategies)
            toast.success('Context saved')
        } catch (err) {
            toast.error((err as Error).message || 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    const addStat = (type: StatCardType = 'statement') => {
        if (!canEditContext) return
        if (stats.length >= MAX_STAT_CARDS) {
            toast.error(`You've reached the max of ${MAX_STAT_CARDS} stats`)
            return
        }
        setStats(prev => [...prev, emptyCard(type)])
    }

    const updateStat = (id: string, patch: Partial<StatCard>) => {
        setStats(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
    }
    const removeStat = (id: string) => setStats(prev => prev.filter(s => s.id !== id))
    const moveStat = (index: number, direction: -1 | 1) => {
        setStats(prev => {
            const target = index + direction
            if (target < 0 || target >= prev.length) return prev
            const next = prev.slice()
            const [item] = next.splice(index, 1)
            next.splice(target, 0, item)
            return next
        })
    }

    const addStage = () => {
        if (!canEditContext) return
        if (stages.length >= MAX_THEORY_STAGES) {
            toast.error(`You've reached the max of ${MAX_THEORY_STAGES} stages`)
            return
        }
        setStages(prev => [...prev, emptyStage()])
    }
    const updateStage = (id: string, patch: Partial<TheoryStage>) => {
        setStages(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
    }
    const removeStage = (id: string) => setStages(prev => prev.filter(s => s.id !== id))
    const moveStage = (index: number, direction: -1 | 1) => {
        setStages(prev => {
            const target = index + direction
            if (target < 0 || target >= prev.length) return prev
            const next = prev.slice()
            const [item] = next.splice(index, 1)
            next.splice(target, 0, item)
            return next
        })
    }

    const addStrategy = () => {
        if (!canEditContext) return
        if (strategies.length >= MAX_STRATEGIES) {
            toast.error(`You've reached the max of ${MAX_STRATEGIES} strategies`)
            return
        }
        setStrategies(prev => [...prev, emptyStrategy()])
    }
    const updateStrategy = (id: string, patch: Partial<Strategy>) => {
        setStrategies(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
    }
    const removeStrategy = (id: string) => setStrategies(prev => prev.filter(s => s.id !== id))
    const moveStrategy = (index: number, direction: -1 | 1) => {
        setStrategies(prev => {
            const target = index + direction
            if (target < 0 || target >= prev.length) return prev
            const next = prev.slice()
            const [item] = next.splice(index, 1)
            next.splice(target, 0, item)
            return next
        })
    }

    const showLoader = teamLoading || loading
    const statsAtCap = stats.length >= MAX_STAT_CARDS
    const stagesAtCap = stages.length >= MAX_THEORY_STAGES
    const strategiesAtCap = strategies.length >= MAX_STRATEGIES

    return (
        <div className="min-h-screen pt-28 pb-16 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">

                <div className="mb-8">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to dashboard
                    </Link>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 rounded-2xl bg-primary-50 flex items-center justify-center">
                            <Compass className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Context &amp; Challenges</h1>
                            <p className="text-sm text-gray-500">Tell visitors the story behind your work.</p>
                        </div>
                    </div>
                    {activeOrganization?.slug && (
                        <Link
                            to={`/org/${activeOrganization.slug}/context`}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 transition-colors"
                        >
                            <ExternalLink className="w-3 h-3" />
                            Preview public page
                        </Link>
                    )}
                </div>

                {!canEditContext && !teamLoading && (
                    <div className="mb-6 flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                        <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <div className="text-sm text-amber-900">
                            <span className="font-medium">Read-only view.</span> Join an organization to edit these fields.
                        </div>
                    </div>
                )}

                {error && !showLoader && (
                    <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {showLoader ? (
                    <div className="space-y-4">
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-6 animate-pulse">
                                <div className="h-5 w-48 bg-gray-100 rounded mb-4" />
                                <div className="h-32 bg-gray-50 rounded-xl" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="space-y-4">
                            <FeaturedVideoCard
                                value={featuredVideoUrl}
                                onChange={setFeaturedVideoUrl}
                                readOnly={!canEditContext}
                            />

                            <TextCard
                                config={TEXT_FIELDS[0]}
                                value={textValues.problem_statement}
                                onChange={(v) => setTextValues(vals => ({ ...vals, problem_statement: v }))}
                                readOnly={!canEditContext}
                            />

                            <StatsSection
                                stats={stats}
                                readOnly={!canEditContext}
                                atCap={statsAtCap}
                                onAdd={addStat}
                                onUpdate={updateStat}
                                onRemove={removeStat}
                                onMove={moveStat}
                            />

                            <TheorySection
                                textConfig={TEXT_FIELDS[1]}
                                textValue={textValues.theory_of_change}
                                onTextChange={(v) => setTextValues(vals => ({ ...vals, theory_of_change: v }))}
                                stages={stages}
                                readOnly={!canEditContext}
                                atCap={stagesAtCap}
                                onAdd={addStage}
                                onUpdate={updateStage}
                                onRemove={removeStage}
                                onMove={moveStage}
                            />

                            <StrategiesSection
                                strategies={strategies}
                                readOnly={!canEditContext}
                                atCap={strategiesAtCap}
                                onAdd={addStrategy}
                                onUpdate={updateStrategy}
                                onRemove={removeStrategy}
                                onMove={moveStrategy}
                            />

                            <TextCard
                                config={TEXT_FIELDS[2]}
                                value={textValues.additional_info}
                                onChange={(v) => setTextValues(vals => ({ ...vals, additional_info: v }))}
                                readOnly={!canEditContext}
                            />
                        </div>

                        {canEditContext && (
                            <div className="mt-6 flex items-center justify-between px-6 py-4 bg-white rounded-2xl shadow-bubble border border-gray-100 sticky bottom-4 z-10 backdrop-blur-sm">
                                <p className="text-xs text-gray-500">
                                    {hasChanges ? 'You have unsaved changes' : 'All changes saved'}
                                </p>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !hasChanges}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

function StatusBadge({ complete }: { complete: boolean }) {
    if (complete) {
        return (
            <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex-shrink-0"
                title="Section has content"
            >
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
            </span>
        )
    }
    return (
        <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex-shrink-0 text-sm font-bold"
            title="Section is empty"
        >
            !
        </span>
    )
}

function SectionShell({
    icon: Icon,
    accent,
    title,
    description,
    complete,
    defaultOpen = false,
    children,
}: {
    icon: typeof AlertTriangle
    accent: string
    title: React.ReactNode
    description?: string
    complete: boolean
    defaultOpen?: boolean
    children: React.ReactNode
}) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50/60 transition-colors"
                aria-expanded={open}
            >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
                    <Icon className="w-[18px] h-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{title}</div>
                    {description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{description}</p>
                    )}
                </div>
                <StatusBadge complete={complete} />
                <ChevronDown
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                />
            </button>
            {open && (
                <div className="px-5 pb-5 pt-1 border-t border-gray-100">
                    {children}
                </div>
            )}
        </div>
    )
}

function FeaturedVideoCard({
    value,
    onChange,
    readOnly,
}: {
    value: string
    onChange: (v: string) => void
    readOnly: boolean
}) {
    const trimmed = value.trim()
    const parsed = parseVideoUrl(trimmed)
    const complete = !!parsed
    const showError = trimmed.length > 0 && !parsed
    return (
        <SectionShell
            icon={Video}
            accent="bg-purple-50 text-purple-600"
            title="Featured Video"
            description="Optional. A YouTube or Vimeo link shown at the top of your public context page."
            complete={complete}
        >
            <div className="pt-3 space-y-3">
                <input
                    type="url"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                    readOnly={readOnly}
                    className={`w-full px-4 py-3 border rounded-xl text-sm text-gray-800 focus:ring-1 focus:outline-none transition-all read-only:bg-gray-50 read-only:cursor-not-allowed ${
                        showError
                            ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500'
                            : 'border-gray-200 focus:border-primary-500 focus:ring-primary-500'
                    }`}
                />
                {showError && (
                    <p className="text-xs text-rose-600">Only YouTube or Vimeo links are supported.</p>
                )}
                {parsed && (
                    <div className="rounded-xl overflow-hidden border border-gray-200 bg-black">
                        <div className="relative w-full aspect-video">
                            <iframe
                                src={parsed.embedUrl}
                                title="Featured video preview"
                                className="absolute inset-0 w-full h-full"
                                frameBorder={0}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                            />
                        </div>
                    </div>
                )}
                {!trimmed && (
                    <p className="text-xs text-gray-400">Leave blank to hide the video on your public page.</p>
                )}
            </div>
        </SectionShell>
    )
}

function TextCard({
    config,
    value,
    onChange,
    readOnly,
}: {
    config: TextFieldConfig
    value: string
    onChange: (v: string) => void
    readOnly: boolean
}) {
    const complete = value.trim().length > 0
    return (
        <SectionShell
            icon={config.icon}
            accent={config.accent}
            title={config.label}
            description={config.description}
            complete={complete}
        >
            <div className="flex items-center justify-between mb-2 pt-3">
                <label htmlFor={`ctx-${config.key}`} className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Text
                </label>
                <span className="text-[11px] text-gray-400">{value.length.toLocaleString()} chars</span>
            </div>
            <textarea
                id={`ctx-${config.key}`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={config.placeholder}
                readOnly={readOnly}
                rows={6}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm leading-relaxed text-gray-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all resize-y min-h-[140px] read-only:bg-gray-50 read-only:cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-2">Use blank lines to separate paragraphs.</p>
        </SectionShell>
    )
}

function StatsSection({
    stats,
    readOnly,
    atCap,
    onAdd,
    onUpdate,
    onRemove,
    onMove,
}: {
    stats: StatCard[]
    readOnly: boolean
    atCap: boolean
    onAdd: (type?: StatCardType) => void
    onUpdate: (id: string, patch: Partial<StatCard>) => void
    onRemove: (id: string) => void
    onMove: (index: number, direction: -1 | 1) => void
}) {
    return (
        <SectionShell
            icon={BarChart3}
            accent="bg-amber-50 text-amber-600"
            title="Stats & Statements"
            description="Hard numbers and qualitative statements."
            complete={stats.length > 0}
        >
            <div className="pt-3" />
            {stats.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50/50">
                    <p className="text-sm text-gray-500 mb-3">No cards yet.</p>
                    {!readOnly && (
                        <div className="inline-flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onAdd('statement')}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors"
                            >
                                <Quote className="w-4 h-4" />
                                Add statement
                            </button>
                            <button
                                type="button"
                                onClick={() => onAdd('stat')}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors"
                            >
                                <Hash className="w-4 h-4" />
                                Add stat
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {stats.map((card, index) => (
                        <StatCardEditor
                            key={card.id}
                            card={card}
                            index={index}
                            total={stats.length}
                            readOnly={readOnly}
                            onUpdate={onUpdate}
                            onRemove={onRemove}
                            onMove={onMove}
                        />
                    ))}
                </div>
            )}

            {!readOnly && stats.length > 0 && (
                <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => onAdd('statement')}
                            disabled={atCap}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Quote className="w-4 h-4" />
                            Add statement
                        </button>
                        <button
                            type="button"
                            onClick={() => onAdd('stat')}
                            disabled={atCap}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Hash className="w-4 h-4" />
                            Add stat
                        </button>
                    </div>
                    {atCap && (
                        <span className="text-xs text-gray-400">Max {MAX_STAT_CARDS} reached</span>
                    )}
                </div>
            )}
        </SectionShell>
    )
}

function StatCardEditor({
    card,
    index,
    total,
    readOnly,
    onUpdate,
    onRemove,
    onMove,
}: {
    card: StatCard
    index: number
    total: number
    readOnly: boolean
    onUpdate: (id: string, patch: Partial<StatCard>) => void
    onRemove: (id: string) => void
    onMove: (index: number, direction: -1 | 1) => void
}) {
    const isStat = card.type === 'stat'
    return (
        <div className="border border-gray-200 rounded-xl bg-gray-50/40 hover:bg-white transition-colors">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white/60 rounded-t-xl">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 tracking-wide">
                        #{index + 1}
                    </span>
                    {!readOnly ? (
                        <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
                            <button
                                type="button"
                                onClick={() => onUpdate(card.id, { type: 'statement' })}
                                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors flex items-center gap-1 ${!isStat ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                                    }`}
                            >
                                <Quote className="w-3 h-3" />
                                Statement
                            </button>
                            <button
                                type="button"
                                onClick={() => onUpdate(card.id, { type: 'stat' })}
                                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors flex items-center gap-1 ${isStat ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                                    }`}
                            >
                                <Hash className="w-3 h-3" />
                                Stat
                            </button>
                        </div>
                    ) : (
                        <span className="text-[10px] uppercase tracking-wider font-medium text-gray-400">
                            {isStat ? 'Stat' : 'Statement'}
                        </span>
                    )}
                </div>
                {!readOnly && (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onMove(index, -1)}
                            disabled={index === 0}
                            title="Move up"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onMove(index, 1)}
                            disabled={index === total - 1}
                            title="Move down"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onRemove(card.id)}
                            title="Remove"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
            <div className="p-4 space-y-3">
                {isStat && (
                    <div>
                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                            Number / Stat <span className="text-rose-500 normal-case">*</span>
                        </label>
                        <input
                            type="text"
                            value={card.value || ''}
                            onChange={(e) => onUpdate(card.id, { value: e.target.value })}
                            readOnly={readOnly}
                            placeholder='e.g. "87%", "1 in 3", "2.4M"'
                            maxLength={20}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-2xl font-bold text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all read-only:bg-gray-50 read-only:cursor-not-allowed"
                        />
                    </div>
                )}
                <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                        {isStat ? 'Title' : 'Headline'} {!isStat && <span className="text-rose-500 normal-case">*</span>}
                    </label>
                    <input
                        type="text"
                        value={card.title}
                        onChange={(e) => onUpdate(card.id, { title: e.target.value })}
                        readOnly={readOnly}
                        placeholder={isStat ? 'Short label for this number' : 'The statement, in one line'}
                        maxLength={140}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-base font-semibold text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all read-only:bg-gray-50 read-only:cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Description
                    </label>
                    <textarea
                        value={card.description}
                        onChange={(e) => onUpdate(card.id, { description: e.target.value })}
                        readOnly={readOnly}
                        placeholder="More context. Shown truncated on the public card, full in the popup."
                        rows={2}
                        maxLength={500}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm leading-relaxed text-gray-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all resize-y read-only:bg-gray-50 read-only:cursor-not-allowed"
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                            Source title <span className="text-gray-300 normal-case font-normal">(optional)</span>
                        </label>
                        <input
                            type="text"
                            value={card.source || ''}
                            onChange={(e) => onUpdate(card.id, { source: e.target.value })}
                            readOnly={readOnly}
                            placeholder='e.g. "WHO, 2023"'
                            maxLength={120}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all read-only:bg-gray-50 read-only:cursor-not-allowed"
                        />
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                            Source link <span className="text-gray-300 normal-case font-normal">(optional)</span>
                        </label>
                        <input
                            type="url"
                            value={card.source_url || ''}
                            onChange={(e) => onUpdate(card.id, { source_url: e.target.value })}
                            readOnly={readOnly}
                            placeholder="https://..."
                            maxLength={500}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all read-only:bg-gray-50 read-only:cursor-not-allowed"
                        />
                    </div>
                </div>
                {(card.source_url || '').trim() && !(card.source || '').trim() && (
                    <p className="text-[11px] text-gray-400 -mt-1">
                        No source title — the link will show as "Source" on the public card.
                    </p>
                )}
            </div>
        </div>
    )
}

function TheorySection({
    textConfig,
    textValue,
    onTextChange,
    stages,
    readOnly,
    atCap,
    onAdd,
    onUpdate,
    onRemove,
    onMove,
}: {
    textConfig: TextFieldConfig
    textValue: string
    onTextChange: (v: string) => void
    stages: TheoryStage[]
    readOnly: boolean
    atCap: boolean
    onAdd: () => void
    onUpdate: (id: string, patch: Partial<TheoryStage>) => void
    onRemove: (id: string) => void
    onMove: (index: number, direction: -1 | 1) => void
}) {
    const complete = textValue.trim().length > 0 || stages.length > 0
    return (
        <SectionShell
            icon={textConfig.icon}
            accent={textConfig.accent}
            title="Theory of Change"
            description="A short summary plus the stages from inputs to impact."
            complete={complete}
        >
            {/* Overview text */}
            <div className="pt-3">
                <div className="flex items-center justify-between mb-2">
                    <label htmlFor={`ctx-${textConfig.key}`} className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                        Overview
                    </label>
                    <span className="text-[11px] text-gray-400">{textValue.length.toLocaleString()} chars</span>
                </div>
                <textarea
                    id={`ctx-${textConfig.key}`}
                    value={textValue}
                    onChange={(e) => onTextChange(e.target.value)}
                    placeholder={textConfig.placeholder}
                    readOnly={readOnly}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm leading-relaxed text-gray-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all resize-y min-h-[120px] read-only:bg-gray-50 read-only:cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-2">Shown on the public page with a "Read more" toggle.</p>
            </div>

            {/* Stages */}
            <div className="mt-6 pt-5 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                    <Workflow className="w-4 h-4 text-violet-500" />
                    <h4 className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Stages</h4>
                </div>

                {stages.length === 0 ? (
                    <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center bg-gray-50/50">
                        <p className="text-sm text-gray-500 mb-3">No stages yet.</p>
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={onAdd}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add your first stage
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {stages.map((stage, index) => (
                            <StageEditor
                                key={stage.id}
                                stage={stage}
                                index={index}
                                total={stages.length}
                                readOnly={readOnly}
                                onUpdate={onUpdate}
                                onRemove={onRemove}
                                onMove={onMove}
                            />
                        ))}
                    </div>
                )}

                {!readOnly && stages.length > 0 && (
                    <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                        <button
                            type="button"
                            onClick={onAdd}
                            disabled={atCap}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4" />
                            Add stage
                        </button>
                        {atCap && (
                            <span className="text-xs text-gray-400">Max {MAX_THEORY_STAGES} reached</span>
                        )}
                    </div>
                )}
            </div>
        </SectionShell>
    )
}

function StageEditor({
    stage,
    index,
    total,
    readOnly,
    onUpdate,
    onRemove,
    onMove,
}: {
    stage: TheoryStage
    index: number
    total: number
    readOnly: boolean
    onUpdate: (id: string, patch: Partial<TheoryStage>) => void
    onRemove: (id: string) => void
    onMove: (index: number, direction: -1 | 1) => void
}) {
    return (
        <div className="border border-gray-200 rounded-xl bg-gray-50/40 hover:bg-white transition-colors">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white/60 rounded-t-xl">
                <span className="text-xs font-semibold text-gray-500 tracking-wide">
                    Stage {index + 1}
                </span>
                {!readOnly && (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onMove(index, -1)}
                            disabled={index === 0}
                            title="Move up"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onMove(index, 1)}
                            disabled={index === total - 1}
                            title="Move down"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onRemove(stage.id)}
                            title="Remove"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
            <div className="p-4 space-y-3">
                <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Title
                    </label>
                    <input
                        type="text"
                        value={stage.title}
                        onChange={(e) => onUpdate(stage.id, { title: e.target.value })}
                        readOnly={readOnly}
                        placeholder='e.g. "Recruit volunteers"'
                        maxLength={80}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-base font-semibold text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all read-only:bg-gray-50 read-only:cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Description
                    </label>
                    <textarea
                        value={stage.description}
                        onChange={(e) => onUpdate(stage.id, { description: e.target.value })}
                        readOnly={readOnly}
                        placeholder="Shown in the popup when a visitor clicks this stage."
                        rows={3}
                        maxLength={500}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm leading-relaxed text-gray-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all resize-y read-only:bg-gray-50 read-only:cursor-not-allowed"
                    />
                </div>
            </div>
        </div>
    )
}

function StrategiesSection({
    strategies,
    readOnly,
    atCap,
    onAdd,
    onUpdate,
    onRemove,
    onMove,
}: {
    strategies: Strategy[]
    readOnly: boolean
    atCap: boolean
    onAdd: () => void
    onUpdate: (id: string, patch: Partial<Strategy>) => void
    onRemove: (id: string) => void
    onMove: (index: number, direction: -1 | 1) => void
}) {
    return (
        <SectionShell
            icon={Target}
            accent="bg-indigo-50 text-indigo-600"
            title="Strategies"
            description="Short, punchy bullet points about how you make change happen."
            complete={strategies.length > 0}
        >
            <div className="pt-3" />
            {strategies.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50/50">
                    <p className="text-sm text-gray-500 mb-3">No strategies yet.</p>
                    {!readOnly && (
                        <button
                            type="button"
                            onClick={onAdd}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add your first strategy
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {strategies.map((strategy, index) => (
                        <StrategyEditor
                            key={strategy.id}
                            strategy={strategy}
                            index={index}
                            total={strategies.length}
                            readOnly={readOnly}
                            onUpdate={onUpdate}
                            onRemove={onRemove}
                            onMove={onMove}
                        />
                    ))}
                </div>
            )}

            {!readOnly && strategies.length > 0 && (
                <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={onAdd}
                        disabled={atCap}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4" />
                        Add strategy
                    </button>
                    {atCap && (
                        <span className="text-xs text-gray-400">Max {MAX_STRATEGIES} reached</span>
                    )}
                </div>
            )}
        </SectionShell>
    )
}

function StrategyEditor({
    strategy,
    index,
    total,
    readOnly,
    onUpdate,
    onRemove,
    onMove,
}: {
    strategy: Strategy
    index: number
    total: number
    readOnly: boolean
    onUpdate: (id: string, patch: Partial<Strategy>) => void
    onRemove: (id: string) => void
    onMove: (index: number, direction: -1 | 1) => void
}) {
    return (
        <div className="border border-gray-200 rounded-xl bg-gray-50/40 hover:bg-white transition-colors">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white/60 rounded-t-xl">
                <span className="text-xs font-semibold text-gray-500 tracking-wide">
                    Strategy {index + 1}
                </span>
                {!readOnly && (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onMove(index, -1)}
                            disabled={index === 0}
                            title="Move up"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onMove(index, 1)}
                            disabled={index === total - 1}
                            title="Move down"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onRemove(strategy.id)}
                            title="Remove"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
            <div className="p-4 space-y-3">
                <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Title
                    </label>
                    <input
                        type="text"
                        value={strategy.title}
                        onChange={(e) => onUpdate(strategy.id, { title: e.target.value })}
                        readOnly={readOnly}
                        placeholder='e.g. "Train local educators"'
                        maxLength={100}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-base font-semibold text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all read-only:bg-gray-50 read-only:cursor-not-allowed"
                    />
                </div>
                <div>
                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1">
                        Description
                    </label>
                    <textarea
                        value={strategy.description}
                        onChange={(e) => onUpdate(strategy.id, { description: e.target.value })}
                        readOnly={readOnly}
                        placeholder="A sentence or two explaining this strategy."
                        rows={2}
                        maxLength={400}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm leading-relaxed text-gray-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none transition-all resize-y read-only:bg-gray-50 read-only:cursor-not-allowed"
                    />
                </div>
            </div>
        </div>
    )
}
