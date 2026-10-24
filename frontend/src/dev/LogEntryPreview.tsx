/** Isolated manual QA fixture. Vite dev only; never calls upload or record-write APIs. */
import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import '../index.css'
import LogEntryStep from '../components/upload/LogEntryStep'
import LogReviewStep from '../components/upload/LogReviewStep'
import { INITIAL_WIZARD_STATE, WizardState, inferEvidenceType, validateAll } from '../components/upload/wizardTypes'
import { buildLogPlan, newLogRow, saveLogPlan, LogSaveProgress } from '../components/upload/logDraft'
import type { BeneficiaryGroup, KPI, Location, MetricTag } from '../types'

const kpis: KPI[] = [
 { id: 'people', title: 'People trained', unit_of_measurement: 'people', metric_type: 'number' },
 { id: 'kits', title: 'Sewing kits distributed', unit_of_measurement: 'kits', metric_type: 'number' },
 { id: 'hours', title: 'Training hours delivered', unit_of_measurement: 'hours', metric_type: 'number' },
] as KPI[]
const locations: Location[] = [{ id: 'centre', name: 'Community centre' }, { id: 'north', name: 'North campus' }] as Location[]
const tags: MetricTag[] = [{ id: 'sewing', name: 'Sewing' }, { id: 'digital', name: 'Digital skills' }] as MetricTag[]
const beneficiaryGroups = [{ id: 'cohort', name: 'October cohort' }] as BeneficiaryGroup[]
const extraKpis = Array.from({ length: 21 }, (_, i) => ({ id: `extra-${i}`, title: `Workshop metric ${i + 4}`, unit_of_measurement: 'people', metric_type: 'number' })) as KPI[]
const blank = (): WizardState => ({ ...INITIAL_WIZARD_STATE, entryMode: true, logRows: [], dateSingle: '2026-10-01' })
const sample = (): WizardState => ({
 ...blank(), evidenceTitle: 'October skills workshop', evidenceDescription: 'Practical training and starter kits for the new cohort.', locationIds: ['centre'], tagIds: ['sewing'],
 logRows: [{ ...newLogRow('people', 'people'), value: '24' }, { ...newLogRow('kits', 'kits'), value: '18' }],
 files: [
  { id: 'photo', name: 'Workshop photo.jpg', type: 'visual_proof', size: 1200000, url: '/fixture-photo', status: 'done', progress: 100 },
  { id: 'attendance', name: 'Attendance register.pdf', type: 'documentation', size: 280000, url: '/fixture-attendance', status: 'done', progress: 100 },
  { id: 'notes', name: 'Field notes.pdf', type: 'documentation', size: 42000, url: '/fixture-notes', status: 'done', progress: 100 },
 ],
})

const advancedSample = (): WizardState => {
 const state = sample()
 return { ...state, logMode: 'advanced',
  logRows: [...state.logRows!, { ...newLogRow('people', 'north-people'), value: '12', overrides: { locationIds: ['north'] } }],
  files: state.files.map(file => ({ ...file, rowIds: file.id === 'attendance' ? ['people'] : file.id === 'notes' ? [] : undefined })),
 }
}

function Preview() {
 const query = new URLSearchParams(window.location.search)
 const embedded = query.has('embedded')
 const [sampleKind, setSampleKind] = useState(query.get('sample') || 'simple')
 const [state, setState] = useState(() => sampleKind === 'empty' ? blank() : sampleKind === 'advanced' ? advancedSample() : sample())
 const [scenario, setScenario] = useState(0)
 const [manyMetrics, setManyMetrics] = useState(query.get('many') === '1')
 const availableKpis = manyMetrics ? [...kpis, ...extraKpis] : kpis
 const [mobile, setMobile] = useState(false)
 const [step, setStep] = useState<'entry' | 'review' | 'saved'>('entry')
 const [error, setError] = useState('')
 const progress = useRef<LogSaveProgress>({ claims: new Map(), evidence: new Set(), ownedUrls: new Set() })
 const reset = (next: WizardState, kind = 'simple') => { setSampleKind(kind); setScenario(s => s + 1); setState(next); setStep('entry'); setError(''); progress.current = { claims: new Map(), evidence: new Set(), ownedUrls: new Set() } }
 const update = (patch: Partial<WizardState>) => { setState(s => ({ ...s, ...patch })); setError('') }
 const save = async () => {
  await saveLogPlan(buildLogPlan(state, 'fixture'), {
   async createKPIUpdate() { return { id: crypto.randomUUID() } },
   async createEvidence() { return { id: crypto.randomUUID() } },
  }, progress.current, () => {})
  setStep('saved')
 }
 return <div className="min-h-dvh app-canvas text-secondary-700">
  {!embedded && <div className="px-5 py-3 bg-white border-b border-gray-200 flex flex-wrap gap-3 items-center justify-between">
   <p className="text-xs text-secondary-500">Development preview · Sample data only · No records are uploaded or saved</p>
   <div className="flex flex-wrap gap-2"><button className="app-btn app-btn-secondary app-btn-sm" onClick={() => reset(blank(), 'empty')}>Start empty</button><button className="app-btn app-btn-secondary app-btn-sm" onClick={() => reset(sample())}>Sample log</button><button className="app-btn app-btn-secondary app-btn-sm" onClick={() => reset(advancedSample(), 'advanced')}>Advanced sample</button><button className="app-btn app-btn-secondary app-btn-sm" onClick={() => setManyMetrics(!manyMetrics)}>{manyMetrics ? '3 metrics' : '24 metrics'}</button><button className="app-btn app-btn-secondary app-btn-sm" onClick={() => setMobile(!mobile)}>{mobile ? 'Desktop preview' : 'Mobile preview'}</button></div>
  </div>}
  {mobile ? <div className="py-6 flex justify-center"><iframe key={`${scenario}-${manyMetrics}`} title="Mobile log workspace" src={`/dev/log-entry.html?embedded=1&sample=${sampleKind}&many=${manyMetrics ? 1 : 0}`} className="w-[390px] h-[820px] max-w-full rounded-xl border border-gray-200 shadow-card" /></div> : <>
   <header className="bg-white border-b border-gray-200 px-5 py-3 text-xs text-secondary-500">{step === 'entry' ? '1. Add log' : '1. Add log  /  2. Review'}<span className="float-right">NEXUS</span></header>
   <main className={`${step === 'entry' ? 'w-full px-4 sm:px-6 py-4' : 'max-w-3xl mx-auto px-5 md:px-8 py-7'} pb-28`}>
    <p className="text-xs text-secondary-500 mb-1">Community skills program</p>
    <h1 className="app-page-title">{step === 'entry' ? 'Add log' : step === 'review' ? 'Review & save' : 'Preview saved'}</h1>
    {step === 'entry' ? <div className="mb-3" /> : <p className="app-page-subtitle mt-1 mb-6">{step === 'review' ? 'Check the details and connections before saving.' : 'The simulated save completed. No real records were created.'}</p>}
    {step === 'entry' && <LogEntryStep key={scenario} state={state} update={update} kpis={availableKpis} locations={locations} tags={tags} beneficiaryGroups={beneficiaryGroups} canCreateClaim canCreateEvidence datePickerRef={null}
     onAddFiles={files => update({ files: [...state.files, ...files.map(f => ({ id: crypto.randomUUID(), name: f.name, size: f.size, type: inferEvidenceType(f.name, f.type), status: 'done' as const, progress: 100, url: URL.createObjectURL(f), raw: f }))] })}
     onRemoveFile={id => update({ files: state.files.filter(f => f.id !== id) })} onRetryFile={() => {}}
     onSetFileType={(id, type) => update({ files: state.files.map(f => f.id === id ? { ...f, type } : f) })}
     onSetAllTypes={type => update({ files: state.files.map(f => ({ ...f, type })) })} />}
    {step === 'review' && <LogReviewStep state={state} kpis={availableKpis} locations={locations} tags={tags} beneficiaryGroups={beneficiaryGroups} existingClaims={[]} existingEvidence={[]} />}
    {step === 'saved' && <div className="app-card p-6"><Check className="w-6 h-6 text-primary-700 mb-3" /><p>{progress.current.claims.size} results and {progress.current.evidence.size} evidence records passed through the simulated save.</p><button className="app-btn app-btn-primary mt-4" onClick={() => reset(sample())}>Back to sample</button></div>}
   </main>
   {step !== 'saved' && <footer className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 px-5 py-3 flex items-center justify-between gap-4">
    <p className={`text-xs ${error ? 'text-red-600' : 'text-secondary-500'}`} role={error ? 'alert' : undefined}>{error || `${buildLogPlan(state).claims.length} results · ${state.files.length} files`}</p>
    <div className="flex gap-2 shrink-0">{step === 'review' && <button className="app-btn app-btn-secondary app-btn-sm" onClick={() => setStep('entry')}><ArrowLeft className="w-4 h-4" /> Back</button>}<button className="app-btn app-btn-primary app-btn-sm" onClick={() => { const invalid = validateAll(state, availableKpis); if (invalid) setError(invalid); else if (step === 'entry') { setStep('review'); window.scrollTo(0, 0) } else void save() }}>{step === 'entry' ? 'Review log' : 'Save preview log'}<ArrowRight className="w-4 h-4" /></button></div>
   </footer>}
  </>}
 </div>
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Preview />)
