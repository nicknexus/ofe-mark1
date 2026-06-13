import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
 Rocket,
 Target,
 ListOrdered,
 Gauge,
 MapPin,
 Plus,
 Trash2,
 Building2,
 Loader2,
 Search,
} from 'lucide-react'
import { apiService } from '../services/api'
import { useTeam } from '../context/TeamContext'
import { notify } from '../lib/notify'
import { PageHeader, AppCard, SectionHeader, Button, InlineAlert, Badge } from '../components/ui'
import { MetricTag } from '../types'

// ───────────────────────────────────────────────────────────────────────────
// Guided onboarding / "Initiative Setup" page.
//
// This is the simplified, document-style entry flow described in the setup
// form. It maps the plain-language form onto the real app entities and creates
// them in one pass:
//   • Initiative description  → Initiative (title + description)
//   • Theory of change        → OrganizationContext.theory_of_change (summary)
//   • Ordered ToC steps       → OrganizationContext.theory_of_change_stages
//   • Metrics                 → KPIs (+ MetricTags)
//   • Operating locations     → Locations (geocoded via Nominatim)
//
// After it runs, users continue refining everything through the normal app
// surfaces (Initiative page, Org context page, metric/location modals).
// ───────────────────────────────────────────────────────────────────────────

const MAX_STEPS = 10
const MAX_METRICS = 5

let _uid = 0
const newId = () => {
 try {
 if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
 } catch { /* fall through */ }
 return `row-${Date.now()}-${++_uid}`
}

// ToC step categories. These mirror the three buckets in the setup form. The
// app's theory_of_change_stages only persist { title, description }, so the
// category + notes are folded into the description so nothing the user enters
// is lost. Order is preserved (the stages array is ordered).
const STEP_CATEGORIES = [
 { value: 'situation', label: 'Situation / Baseline', hint: 'Need, context, starting condition' },
 { value: 'intervention', label: 'Intervention', hint: 'Work, activities, supports delivered' },
 { value: 'outcome', label: 'Outcome', hint: 'Change, result, progress created' },
] as const
type StepCategory = (typeof STEP_CATEGORIES)[number]['value']

// Metric "high-level phase" in the form lines up with the KPI category the app
// already uses (input / output / impact).
const METRIC_CATEGORIES = [
 { value: 'input', label: 'Situation / Baseline', desc: 'Resources & starting conditions (Input)' },
 { value: 'output', label: 'Intervention', desc: 'Activities & direct results (Output)' },
 { value: 'impact', label: 'Outcome', desc: 'Change & long-term effects (Impact)' },
] as const
type MetricCategory = (typeof METRIC_CATEGORIES)[number]['value']

interface StepRow {
 id: string
 title: string
 category: StepCategory
 whatHappens: string
 notes: string
}

interface MetricRow {
 id: string
 name: string
 unit: string
 metricType: 'number' | 'percentage'
 category: MetricCategory
 description: string
 tagsText: string
 // 1-based indexes of the ToC steps this metric connects to
 linkedSteps: number[]
}

interface LocationRow {
 id: string
 country: string
 region: string
 city: string
 latitude: string
 longitude: string
 notes: string
 geocoding?: boolean
}

const emptyStep = (): StepRow => ({ id: newId(), title: '', category: 'situation', whatHappens: '', notes: '' })
const emptyMetric = (): MetricRow => ({
 id: newId(),
 name: '',
 unit: '',
 metricType: 'number',
 category: 'output',
 description: '',
 tagsText: '',
 linkedSteps: [],
})
const emptyLocation = (): LocationRow => ({
 id: newId(),
 country: '',
 region: '',
 city: '',
 latitude: '',
 longitude: '',
 notes: '',
})

const categoryLabel = (value: StepCategory) => STEP_CATEGORIES.find(c => c.value === value)?.label ?? value

async function geocode(query: string): Promise<{ lat: number; lng: number; country?: string } | null> {
 try {
 const res = await fetch(
 `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`,
 { headers: { 'User-Agent': 'OFE App' } }
 )
 const data = await res.json()
 if (Array.isArray(data) && data[0]) {
 return {
 lat: parseFloat(data[0].lat),
 lng: parseFloat(data[0].lon),
 country: data[0].address?.country,
 }
 }
 } catch (err) {
 console.error('Geocoding failed:', err)
 }
 return null
}

export default function SetupPage() {
 const navigate = useNavigate()
 const {
 activeOrganization,
 canEditInitiatives,
 canEditOrgContext,
 canEditMetrics,
 canEditLocations,
 canEditTags,
 } = useTeam()

 const orgId = activeOrganization?.id

 // Section 1 — initiative
 const [initiativeTitle, setInitiativeTitle] = useState('')
 const [initiativeDescription, setInitiativeDescription] = useState('')

 // Section 2 — theory of change summary
 const [tocSummary, setTocSummary] = useState('')

 // Section 3 — ordered ToC steps
 const [steps, setSteps] = useState<StepRow[]>([emptyStep()])

 // Section 4 — metrics
 const [metrics, setMetrics] = useState<MetricRow[]>([emptyMetric()])

 // Section 5 — operating locations
 const [locations, setLocations] = useState<LocationRow[]>([emptyLocation()])

 const [submitting, setSubmitting] = useState(false)

 // The labelled steps that have any content — used to drive the metric → step
 // linkage checkboxes so users only see steps that actually exist.
 const filledSteps = useMemo(
 () => steps.map((s, i) => ({ ...s, index: i + 1 })).filter(s => s.title.trim() || s.whatHappens.trim()),
 [steps]
 )

 // ── step helpers ──────────────────────────────────────────────────────────
 const addStep = () => setSteps(prev => (prev.length >= MAX_STEPS ? prev : [...prev, emptyStep()]))
 const updateStep = (id: string, patch: Partial<StepRow>) =>
 setSteps(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
 const removeStep = (id: string) => setSteps(prev => (prev.length <= 1 ? prev : prev.filter(s => s.id !== id)))

 // ── metric helpers ────────────────────────────────────────────────────────
 const addMetric = () => setMetrics(prev => (prev.length >= MAX_METRICS ? prev : [...prev, emptyMetric()]))
 const updateMetric = (id: string, patch: Partial<MetricRow>) =>
 setMetrics(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)))
 const removeMetric = (id: string) => setMetrics(prev => (prev.length <= 1 ? prev : prev.filter(m => m.id !== id)))
 const toggleMetricStep = (id: string, stepIndex: number) =>
 setMetrics(prev =>
 prev.map(m =>
 m.id === id
 ? {
 ...m,
 linkedSteps: m.linkedSteps.includes(stepIndex)
 ? m.linkedSteps.filter(n => n !== stepIndex)
 : [...m.linkedSteps, stepIndex].sort((a, b) => a - b),
 }
 : m
 )
 )

 // ── location helpers ──────────────────────────────────────────────────────
 const addLocation = () => setLocations(prev => [...prev, emptyLocation()])
 const updateLocation = (id: string, patch: Partial<LocationRow>) =>
 setLocations(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)))
 const removeLocation = (id: string) =>
 setLocations(prev => (prev.length <= 1 ? prev : prev.filter(l => l.id !== id)))

 const lookupLocation = async (row: LocationRow) => {
 const query = [row.city, row.region, row.country].map(v => v.trim()).filter(Boolean).join(', ')
 if (!query) {
 notify.error('Enter a city, region, or country first')
 return
 }
 updateLocation(row.id, { geocoding: true })
 const result = await geocode(query)
 if (result) {
 updateLocation(row.id, {
 latitude: String(result.lat),
 longitude: String(result.lng),
 country: row.country.trim() || result.country || row.country,
 geocoding: false,
 })
 notify.success('Coordinates found')
 } else {
 updateLocation(row.id, { geocoding: false })
 notify.error('Could not find coordinates — enter them manually')
 }
 }

 // ── submit orchestration ──────────────────────────────────────────────────
 const handleSubmit = async () => {
 if (!orgId) {
 notify.error('No active organization')
 return
 }
 if (!initiativeTitle.trim()) {
 notify.error('Initiative name is required')
 return
 }
 if (!initiativeDescription.trim()) {
 notify.error('Initiative description is required')
 return
 }

 setSubmitting(true)
 const warnings: string[] = []

 try {
 // 1) Initiative — the anchor everything else hangs off.
 const initiative = await apiService.createInitiative({
 title: initiativeTitle.trim(),
 description: initiativeDescription.trim(),
 })
 const initiativeId = initiative.id!

 // 2) Theory of change (owner-only). Merge into existing context so we
 // never clobber other org-context fields (the backend upserts the row).
 if (canEditOrgContext) {
 const cleanedStages = steps
 .map(s => {
 const title = s.title.trim()
 const what = s.whatHappens.trim()
 const notes = s.notes.trim()
 const descParts = [`Category: ${categoryLabel(s.category)}`]
 if (what) descParts.push(what)
 if (notes) descParts.push(`Notes: ${notes}`)
 return { id: s.id, title, description: descParts.join('\n\n'), hasContent: !!(title || what || notes) }
 })
 .filter(s => s.hasContent)
 .slice(0, MAX_STEPS)
 .map(({ hasContent, ...stage }) => stage)

 if (tocSummary.trim() || cleanedStages.length) {
 try {
 const existing = (await apiService.getOrgContext(orgId)) || ({} as any)
 await apiService.updateOrgContext(orgId, {
 featured_video_url: existing.featured_video_url,
 problem_statement: existing.problem_statement,
 additional_info: existing.additional_info,
 stats_and_statements: existing.stats_and_statements ?? [],
 strategies: existing.strategies ?? [],
 theory_of_change: tocSummary.trim() || existing.theory_of_change || '',
 theory_of_change_stages: cleanedStages.length
 ? cleanedStages
 : existing.theory_of_change_stages ?? [],
 })
 } catch (err) {
 warnings.push('Theory of change could not be saved.')
 console.error(err)
 }
 }
 }

 // 3) Metrics → KPIs. Resolve tag names to ids (reusing existing tags,
 // creating any that are new) when the user is allowed to manage tags.
 if (canEditMetrics) {
 const filledMetrics = metrics.filter(m => m.name.trim())
 let existingTags: MetricTag[] = []
 const needTags = canEditTags && filledMetrics.some(m => m.tagsText.trim())
 if (needTags) {
 try {
 existingTags = await apiService.getMetricTags()
 } catch {
 /* non-fatal — we'll just create fresh tags below */
 }
 }
 const tagCache = new Map<string, string>()
 existingTags.forEach(t => tagCache.set(t.name.trim().toLowerCase(), t.id))

 const resolveTags = async (tagsText: string): Promise<string[]> => {
 if (!canEditTags) return []
 const names = Array.from(
 new Set(
 tagsText
 .split(',')
 .map(n => n.trim())
 .filter(Boolean)
 )
 )
 const ids: string[] = []
 for (const name of names) {
 const key = name.toLowerCase()
 if (tagCache.has(key)) {
 ids.push(tagCache.get(key)!)
 continue
 }
 try {
 const created = await apiService.createMetricTag(name)
 tagCache.set(key, created.id)
 ids.push(created.id)
 } catch {
 warnings.push(`Tag "${name}" could not be created.`)
 }
 }
 return ids
 }

 for (const m of filledMetrics) {
 try {
 const tagIds = await resolveTags(m.tagsText)
 const descParts = [m.description.trim()].filter(Boolean)
 if (m.linkedSteps.length) {
 descParts.push(`Linked theory-of-change steps: ${m.linkedSteps.join(', ')}`)
 }
 await apiService.createKPI({
 title: m.name.trim(),
 description: descParts.join('\n\n'),
 metric_type: m.metricType,
 unit_of_measurement: m.unit.trim(),
 category: m.category,
 initiative_id: initiativeId,
 tag_ids: tagIds,
 })
 } catch (err) {
 warnings.push(`Metric "${m.name.trim()}" could not be created.`)
 console.error(err)
 }
 }
 }

 // 4) Operating locations → Locations. Geocode missing coordinates.
 if (canEditLocations) {
 const filledLocations = locations.filter(l => l.city.trim() || l.country.trim())
 for (const l of filledLocations) {
 const name = l.city.trim() || l.region.trim() || l.country.trim()
 let lat = parseFloat(l.latitude)
 let lng = parseFloat(l.longitude)
 let country = l.country.trim() || undefined

 if (isNaN(lat) || isNaN(lng)) {
 const query = [l.city, l.region, l.country].map(v => v.trim()).filter(Boolean).join(', ')
 const result = query ? await geocode(query) : null
 if (result) {
 lat = result.lat
 lng = result.lng
 country = country || result.country
 } else {
 warnings.push(`Location "${name}" was skipped (no coordinates found).`)
 continue
 }
 }

 const descParts = [l.region.trim(), l.notes.trim()].filter(Boolean)
 try {
 await apiService.createLocation({
 initiative_id: initiativeId,
 name,
 description: descParts.join(' · ') || undefined,
 latitude: lat,
 longitude: lng,
 country,
 })
 } catch (err) {
 warnings.push(`Location "${name}" could not be created.`)
 console.error(err)
 }
 }
 }

 if (warnings.length) {
 notify.success('Initiative created — some items need a second look')
 warnings.slice(0, 4).forEach(w => notify.error(w))
 } else {
 notify.success('Setup complete — your initiative is ready')
 }

 navigate(`/initiatives/${initiativeId}`)
 } catch (err) {
 notify.error((err as Error).message || 'Setup failed — please try again')
 } finally {
 setSubmitting(false)
 }
 }

 if (!canEditInitiatives) {
 return (
 <div className="min-h-screen app-canvas pt-24 pb-12 px-4 sm:px-6">
 <div className="max-w-3xl mx-auto">
 <PageHeader title="Guided setup" subtitle="Set up a new initiative" backTo="/" icon={Rocket} />
 <InlineAlert tone="warning" title="You don't have access to create initiatives">
 Ask an organization owner or admin to run the guided setup, or to grant you edit access.
 </InlineAlert>
 </div>
 </div>
 )
 }

 return (
 <div className="min-h-screen app-canvas pt-24 pb-28 px-4 sm:px-6">
 <div className="max-w-3xl mx-auto">
 <PageHeader
 title="Guided setup"
 subtitle="Describe your initiative in plain language — we'll create the initiative, theory of change, metrics, and locations for you."
 backTo="/"
 icon={Rocket}
 />

 {/* Cover / context */}
 <AppCard padded="lg" className="mb-5">
 <div className="flex items-center gap-3">
 <div className="app-icon-tile app-icon-tile-accent">
 <Building2 className="w-5 h-5" />
 </div>
 <div className="min-w-0">
 <p className="app-section-title">Organization</p>
 <p className="text-[15px] font-semibold text-secondary-900 truncate">
 {activeOrganization?.name || '—'}
 </p>
 </div>
 </div>
 <p className="app-help mt-3">
 Everything below is a starting point. After setup you can keep editing through the normal
 initiative, metric, and organization pages.
 </p>
 </AppCard>

 {/* 1. Initiative */}
 <AppCard padded="lg" className="mb-5">
 <SectionHeader title="1 · Initiative" />
 <p className="app-help -mt-2 mb-4">What is this initiative and who/what does it serve?</p>
 <div className="space-y-4">
 <div>
 <label className="app-label">
 Initiative name <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 value={initiativeTitle}
 onChange={e => setInitiativeTitle(e.target.value)}
 className="app-input"
 placeholder="e.g., Youth Training Program 2025"
 />
 </div>
 <div>
 <label className="app-label">
 Description <span className="text-red-500">*</span>
 </label>
 <textarea
 value={initiativeDescription}
 onChange={e => setInitiativeDescription(e.target.value)}
 className="app-input resize-none"
 rows={4}
 placeholder="Describe the initiative in plain language. This is the basic description of the work, not the full theory of change yet."
 />
 </div>
 </div>
 </AppCard>

 {/* 2. Theory of change summary */}
 {canEditOrgContext ? (
 <AppCard padded="lg" className="mb-5">
 <SectionHeader title="2 · Theory of change summary" />
 <p className="app-help -mt-2 mb-4">
 Summarize the pathway from the problem or baseline condition, to the work delivered, to the
 change expected or created.
 </p>
 <textarea
 value={tocSummary}
 onChange={e => setTocSummary(e.target.value)}
 className="app-input resize-none"
 rows={4}
 placeholder="In plain language, how does your work create change?"
 />
 </AppCard>
 ) : (
 <AppCard padded="lg" className="mb-5">
 <SectionHeader title="2 · Theory of change summary" />
 <InlineAlert tone="info" title="Owner-only section">
 Theory of change is managed by the organization owner. This section will be skipped.
 </InlineAlert>
 </AppCard>
 )}

 {/* 3. Ordered ToC steps */}
 {canEditOrgContext && (
 <AppCard padded="lg" className="mb-5">
 <SectionHeader
 title="3 · Ordered theory of change steps"
 count={steps.length}
 actions={
 <Button
 size="sm"
 variant="secondary"
 onClick={addStep}
 disabled={steps.length >= MAX_STEPS}
 >
 <Plus className="w-4 h-4" />
 Add step
 </Button>
 }
 />
 <p className="app-help -mt-2 mb-4">
 List up to {MAX_STEPS} steps in order. Categorize each as Situation / Baseline, Intervention,
 or Outcome.
 </p>
 <div className="space-y-4">
 {steps.map((step, idx) => (
 <div key={step.id} className="app-card-muted app-pad">
 <div className="flex items-start justify-between gap-3 mb-3">
 <div className="flex items-center gap-2">
 <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
 {idx + 1}
 </span>
 <ListOrdered className="w-4 h-4 text-secondary-400" />
 </div>
 {steps.length > 1 && (
 <button
 type="button"
 onClick={() => removeStep(step.id)}
 className="app-btn app-btn-icon app-btn-ghost"
 aria-label="Remove step"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 <div className="space-y-3">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div>
 <label className="app-label">Step</label>
 <input
 type="text"
 value={step.title}
 onChange={e => updateStep(step.id, { title: e.target.value })}
 className="app-input"
 placeholder="Short name for this step"
 />
 </div>
 <div>
 <label className="app-label">Category</label>
 <select
 value={step.category}
 onChange={e => updateStep(step.id, { category: e.target.value as StepCategory })}
 className="app-input"
 >
 {STEP_CATEGORIES.map(c => (
 <option key={c.value} value={c.value}>
 {c.label}
 </option>
 ))}
 </select>
 </div>
 </div>
 <div>
 <label className="app-label">What happens here?</label>
 <textarea
 value={step.whatHappens}
 onChange={e => updateStep(step.id, { whatHappens: e.target.value })}
 className="app-input resize-none"
 rows={2}
 placeholder="Describe this step"
 />
 </div>
 <div>
 <label className="app-label">Notes (optional)</label>
 <input
 type="text"
 value={step.notes}
 onChange={e => updateStep(step.id, { notes: e.target.value })}
 className="app-input"
 placeholder="Anything else worth capturing"
 />
 </div>
 </div>
 </div>
 ))}
 </div>
 </AppCard>
 )}

 {/* 4. Metrics */}
 {canEditMetrics && (
 <AppCard padded="lg" className="mb-5">
 <SectionHeader
 title="4 · Metrics"
 count={metrics.length}
 actions={
 <Button
 size="sm"
 variant="secondary"
 onClick={addMetric}
 disabled={metrics.length >= MAX_METRICS}
 >
 <Plus className="w-4 h-4" />
 Add metric
 </Button>
 }
 />
 <p className="app-help -mt-2 mb-4">
 Add up to {MAX_METRICS} metrics. Each one becomes a tracked metric on the initiative.
 </p>
 <div className="space-y-4">
 {metrics.map((metric, idx) => (
 <div key={metric.id} className="app-card-muted app-pad">
 <div className="flex items-start justify-between gap-3 mb-3">
 <div className="flex items-center gap-2">
 <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
 {idx + 1}
 </span>
 <Gauge className="w-4 h-4 text-secondary-400" />
 </div>
 {metrics.length > 1 && (
 <button
 type="button"
 onClick={() => removeMetric(metric.id)}
 className="app-btn app-btn-icon app-btn-ghost"
 aria-label="Remove metric"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 <div className="space-y-3">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <div className="sm:col-span-1">
 <label className="app-label">Metric name</label>
 <input
 type="text"
 value={metric.name}
 onChange={e => updateMetric(metric.id, { name: e.target.value })}
 className="app-input"
 placeholder="e.g., Students trained"
 />
 </div>
 <div>
 <label className="app-label">Unit</label>
 <input
 type="text"
 value={metric.unit}
 onChange={e => updateMetric(metric.id, { unit: e.target.value })}
 className="app-input"
 placeholder="People, Hours, USD"
 />
 </div>
 <div>
 <label className="app-label">Value type</label>
 <select
 value={metric.metricType}
 onChange={e =>
 updateMetric(metric.id, { metricType: e.target.value as 'number' | 'percentage' })
 }
 className="app-input"
 >
 <option value="number">Number</option>
 <option value="percentage">Percentage</option>
 </select>
 </div>
 </div>
 <div>
 <label className="app-label">Theory of change phase</label>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
 {METRIC_CATEGORIES.map(cat => (
 <label
 key={cat.value}
 className={`flex flex-col p-3 border rounded-lg cursor-pointer transition-all ${
 metric.category === cat.value
 ? 'border-primary-400 bg-primary-50/70'
 : 'border-gray-200 bg-white hover:border-gray-300'
 }`}
 >
 <input
 type="radio"
 name={`metric-cat-${metric.id}`}
 value={cat.value}
 checked={metric.category === cat.value}
 onChange={() => updateMetric(metric.id, { category: cat.value as MetricCategory })}
 className="sr-only"
 />
 <span className="text-[13px] font-semibold text-secondary-800">{cat.label}</span>
 <span className="text-[11px] text-secondary-500 mt-0.5">{cat.desc}</span>
 </label>
 ))}
 </div>
 </div>
 <div>
 <label className="app-label">Description</label>
 <textarea
 value={metric.description}
 onChange={e => updateMetric(metric.id, { description: e.target.value })}
 className="app-input resize-none"
 rows={2}
 placeholder="What does this metric count or measure? Include any counting rule."
 />
 </div>
 {filledSteps.length > 0 && (
 <div>
 <label className="app-label">Connects to theory-of-change step(s)</label>
 <div className="flex flex-wrap gap-2">
 {filledSteps.map(s => {
 const active = metric.linkedSteps.includes(s.index)
 return (
 <button
 key={s.id}
 type="button"
 onClick={() => toggleMetricStep(metric.id, s.index)}
 className={`app-chip ${active ? 'app-chip-accent' : ''}`}
 title={s.title.trim() || s.whatHappens.trim()}
 >
 Step {s.index}
 </button>
 )
 })}
 </div>
 </div>
 )}
 {canEditTags && (
 <div>
 <label className="app-label">Tags (optional)</label>
 <input
 type="text"
 value={metric.tagsText}
 onChange={e => updateMetric(metric.id, { tagsText: e.target.value })}
 className="app-input"
 placeholder="Comma-separated, e.g. Grade 1, Grade 2, Female"
 />
 <p className="app-help mt-1">
 Tags act as sub-categories. Separate multiple tags with commas. Existing tags are reused.
 </p>
 </div>
 )}
 </div>
 </div>
 ))}
 </div>
 </AppCard>
 )}

 {/* 5. Operating locations */}
 {canEditLocations && (
 <AppCard padded="lg" className="mb-5">
 <SectionHeader
 title="5 · Operating locations"
 count={locations.length}
 actions={
 <Button size="sm" variant="secondary" onClick={addLocation}>
 <Plus className="w-4 h-4" />
 Add location
 </Button>
 }
 />
 <p className="app-help -mt-2 mb-4">
 Where does this initiative operate? We'll look up coordinates from the place name, or you can
 enter them manually.
 </p>
 <div className="space-y-4">
 {locations.map((loc, idx) => (
 <div key={loc.id} className="app-card-muted app-pad">
 <div className="flex items-start justify-between gap-3 mb-3">
 <div className="flex items-center gap-2">
 <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
 {idx + 1}
 </span>
 <MapPin className="w-4 h-4 text-secondary-400" />
 </div>
 {locations.length > 1 && (
 <button
 type="button"
 onClick={() => removeLocation(loc.id)}
 className="app-btn app-btn-icon app-btn-ghost"
 aria-label="Remove location"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 <div className="space-y-3">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <div>
 <label className="app-label">City / location</label>
 <input
 type="text"
 value={loc.city}
 onChange={e => updateLocation(loc.id, { city: e.target.value })}
 className="app-input"
 placeholder="e.g., Nairobi"
 />
 </div>
 <div>
 <label className="app-label">Region</label>
 <input
 type="text"
 value={loc.region}
 onChange={e => updateLocation(loc.id, { region: e.target.value })}
 className="app-input"
 placeholder="e.g., Nairobi County"
 />
 </div>
 <div>
 <label className="app-label">Country</label>
 <input
 type="text"
 value={loc.country}
 onChange={e => updateLocation(loc.id, { country: e.target.value })}
 className="app-input"
 placeholder="e.g., Kenya"
 />
 </div>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 sm:items-end">
 <div>
 <label className="app-label">Latitude</label>
 <input
 type="text"
 value={loc.latitude}
 onChange={e => updateLocation(loc.id, { latitude: e.target.value })}
 className="app-input"
 placeholder="-1.2921"
 />
 </div>
 <div>
 <label className="app-label">Longitude</label>
 <input
 type="text"
 value={loc.longitude}
 onChange={e => updateLocation(loc.id, { longitude: e.target.value })}
 className="app-input"
 placeholder="36.8219"
 />
 </div>
 <Button
 type="button"
 variant="secondary"
 onClick={() => lookupLocation(loc)}
 disabled={loc.geocoding}
 >
 {loc.geocoding ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Search className="w-4 h-4" />
 )}
 Find
 </Button>
 </div>
 <div>
 <label className="app-label">Notes / context (optional)</label>
 <input
 type="text"
 value={loc.notes}
 onChange={e => updateLocation(loc.id, { notes: e.target.value })}
 className="app-input"
 placeholder="Delivery site, partner, etc."
 />
 </div>
 </div>
 </div>
 ))}
 </div>
 <p className="app-help mt-3">
 Coordinates are required to plot a location on the map. Use <strong>Find</strong> to look them
 up automatically — any location still missing coordinates at submit will be skipped.
 </p>
 </AppCard>
 )}
 </div>

 {/* Sticky action bar */}
 <div className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
 <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
 <div className="hidden sm:flex items-center gap-2 text-sm text-secondary-500">
 <Badge tone="accent">Setup</Badge>
 <span>Creates 1 initiative + theory of change, metrics, and locations</span>
 </div>
 <div className="flex items-center gap-2 ml-auto">
 <button
 type="button"
 onClick={() => navigate('/')}
 className="app-btn app-btn-secondary"
 disabled={submitting}
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={handleSubmit}
 disabled={submitting || !initiativeTitle.trim() || !initiativeDescription.trim()}
 className="app-btn app-btn-primary"
 >
 {submitting ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Creating…
 </>
 ) : (
 <>
 <Rocket className="w-4 h-4" />
 Create initiative & finish
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 </div>
 )
}
