import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
 AlertTriangle,
 ArrowRight,
 Check,
 CheckCircle2,
 FileSpreadsheet,
 FileUp,
 Layers3,
 Plus,
 RotateCcw,
 ShieldCheck,
 Trash2,
 UploadCloud,
 Sparkles,
} from 'lucide-react'
import { apiService, DataImportAnalysis } from '../services/api'
import { Initiative, KPI, Location } from '../types'
import { notify } from '../lib/notify'
import { useTeam } from '../context/TeamContext'
import { AppCard, Badge, Button, InlineAlert, PageHeader, PageLoader, Spinner } from '../components/ui'
import {
 bestTextMatch,
 cellText,
 columnLetter,
 detectHeaderRow,
 makeColumnLabels,
 normalizeImportText,
 parseImportDate,
 parseImportNumber,
 parseSpreadsheet,
 ParsedSpreadsheetSheet,
 suggestColumn,
} from '../utils/spreadsheetImport'

type ImportStep = 'upload' | 'analyzing' | 'map' | 'review' | 'complete'

interface MetricMapping {
 id: string
 kpiId: string
 valueColumn: number | null
 constantValue: number
}

interface ImportMapping {
 headerRow: number
 dataStartRow: number
 dateColumn: number | null
 defaultDate: string
 locationColumns: Array<number | null>
 fallbackLocationId: string
 titleColumn: number | null
 noteColumn: number | null
 initiativeColumn: number | null
 metricNameColumn: number | null
 metricValueColumn: number | null
 metrics: MetricMapping[]
}

interface ReviewRecord {
 id: string
 sourceRow: number
 sourceSheet: string
 sourceCell: string
 rawMetric: string
 rawLocation: string
 rawValue: string
 valueMode: 'cell' | 'row_count' | 'inferred'
 rationale: string
 origin: 'ai' | 'manual'
 checked: boolean
 kpiId: string
 value: number | null
 date: string
 dateRangeStart: string
 dateRangeEnd: string
 locationId: string
 label: string
 note: string
 confidence: number
 possibleDuplicate: boolean
 issues: string[]
}

const PAGE_SIZE = 40
const today = new Date().toISOString().slice(0, 10)

function recordGroupKey(record: Pick<ReviewRecord, 'sourceSheet' | 'kpiId' | 'rawMetric'>): string {
 return `${record.sourceSheet}::${record.kpiId || normalizeImportText(record.rawMetric) || 'unmapped'}`
}

function createId(): string {
 return typeof crypto !== 'undefined' && crypto.randomUUID
 ? crypto.randomUUID()
 : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function blankMapping(): ImportMapping {
 return {
 headerRow: 0,
 dataStartRow: 1,
 dateColumn: null,
 defaultDate: '',
 locationColumns: [null, null],
 fallbackLocationId: '',
 titleColumn: null,
 noteColumn: null,
 initiativeColumn: null,
 metricNameColumn: null,
 metricValueColumn: null,
 metrics: [],
 }
}

function recordIssues(record: Pick<ReviewRecord, 'kpiId' | 'value' | 'date' | 'dateRangeStart' | 'dateRangeEnd' | 'locationId' | 'label' | 'possibleDuplicate'>): string[] {
 const issues: string[] = []
 if (!record.kpiId) issues.push('Choose a metric')
 if (record.value == null || !Number.isFinite(record.value)) issues.push('Enter a numeric value')
 else if (record.value < 0) issues.push('Value cannot be negative')
 if (!record.date) issues.push('Choose a date')
 else if (record.date > today) issues.push('Date cannot be in the future')
 if (!!record.dateRangeStart !== !!record.dateRangeEnd) issues.push('Complete both dates in the range')
 else if (record.dateRangeStart && record.dateRangeEnd && record.dateRangeStart > record.dateRangeEnd) issues.push('Date range is reversed')
 else if (record.dateRangeStart && record.dateRangeEnd && (record.dateRangeStart > today || record.dateRangeEnd > today)) issues.push('Date range cannot be in the future')
 if (!record.locationId) issues.push('Choose a location')
 if (!record.label.trim()) issues.push('Enter a title')
 if (record.possibleDuplicate) issues.push('Possible duplicate of an existing claim')
 return issues
}

function headerSignature(sheet: ParsedSpreadsheetSheet, headerRow: number): string {
 return `${sheet.name}::${makeColumnLabels(sheet.rows[headerRow] || []).map(normalizeImportText).join('|')}`
}

const ANALYZING_STAGES = ['Understand layouts', 'Match account data', 'Build review proposals'] as const

function AnalyzingPanel({ fileName }: { fileName: string }) {
 const [stage, setStage] = useState(0)

 useEffect(() => {
 const advance = window.setTimeout(() => setStage(1), 2800)
 const finish = window.setTimeout(() => setStage(2), 7800)
 return () => {
 window.clearTimeout(advance)
 window.clearTimeout(finish)
 }
 }, [])

 return (
 <AppCard padded className="!p-10">
 <div className="text-center">
 <h2 className="text-xl font-semibold text-secondary-900">AI is interpreting {fileName}</h2>
 <p className="app-muted mt-2 max-w-xl mx-auto">It is inspecting every sheet, finding meaningful tables, and comparing spreadsheet terminology with the initiatives, metrics, and locations already in this account.</p>
 </div>
 <ol className="mt-8 max-w-md mx-auto space-y-2">
 {ANALYZING_STAGES.map((label, index) => {
 const done = index < stage
 const active = index === stage
 return (
 <li
 key={label}
 className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${active ? 'bg-primary-50 text-secondary-900' : done ? 'bg-gray-50 text-secondary-700' : 'bg-gray-50 text-secondary-400'}`}
 >
 <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${done ? 'bg-impact-100 text-impact-700' : active ? 'bg-primary-500 text-white' : 'bg-gray-200 text-secondary-500'}`}>
 {done ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs font-semibold">{index + 1}</span>}
 </span>
 <span className={active ? 'font-medium' : ''}>{label}</span>
 {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />}
 </li>
 )
 })}
 </ol>
 <p className="app-help text-center mt-6">Complex workbooks can take a minute or two. No data is being added during this analysis.</p>
 </AppCard>
 )
}

function FieldSelect({
 label,
 value,
 headers,
 onChange,
 optional = true,
}: {
 label: string
 value: number | null
 headers: string[]
 onChange: (value: number | null) => void
 optional?: boolean
}) {
 return (
 <label className="block">
 <span className="app-label">{label}</span>
 <select
 className="app-input mt-1"
 value={value ?? ''}
 onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
 >
 {optional && <option value="">Not in this sheet</option>}
 {headers.map((header, index) => (
 <option key={`${index}-${header}`} value={index}>{columnLetter(index)} · {header}</option>
 ))}
 </select>
 </label>
 )
}

function EditableNumberInput({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
 const [draft, setDraft] = useState(value == null ? '' : String(value))

 useEffect(() => {
 setDraft(value == null ? '' : String(value))
 }, [value])

 const commit = () => {
 const parsed = parseImportNumber(draft)
 onChange(parsed)
 if (parsed != null) setDraft(String(parsed))
 }

 return (
 <input
 className="app-input !py-2 text-xs"
 type="text"
 inputMode="decimal"
 value={draft}
 placeholder="Enter value"
 onChange={(event) => setDraft(event.target.value)}
 onBlur={commit}
 onKeyDown={(event) => {
 if (event.key === 'Enter') event.currentTarget.blur()
 }}
 />
 )
}

export default function DataImportPage() {
 const { canAddImpactClaims, canAccessInitiative, canAccessLocation, organizationId } = useTeam()
 const inputRef = useRef<HTMLInputElement>(null)
 const [step, setStep] = useState<ImportStep>('upload')
 const [loadingReferences, setLoadingReferences] = useState(true)
 const [parsing, setParsing] = useState(false)
 const [importing, setImporting] = useState(false)
 const [dragging, setDragging] = useState(false)
 const [fileName, setFileName] = useState('')
 const [aiAnalysis, setAiAnalysis] = useState<DataImportAnalysis | null>(null)
 const [manualFallbackReason, setManualFallbackReason] = useState('')
 const [sheets, setSheets] = useState<ParsedSpreadsheetSheet[]>([])
 const [sheetIndex, setSheetIndex] = useState(0)
 const [mapping, setMapping] = useState<ImportMapping>(blankMapping)
 const [initiatives, setInitiatives] = useState<Initiative[]>([])
 const [kpis, setKpis] = useState<KPI[]>([])
 const [locations, setLocations] = useState<Location[]>([])
 const [records, setRecords] = useState<ReviewRecord[]>([])
 const [filter, setFilter] = useState<'all' | 'ready' | 'issues'>('all')
 const [groupFilter, setGroupFilter] = useState('all')
 const [bulkScope, setBulkScope] = useState<'missing' | 'filtered'>('missing')
 const [bulkKpiId, setBulkKpiId] = useState('')
 const [bulkLocationId, setBulkLocationId] = useState('')
 const [bulkValueDraft, setBulkValueDraft] = useState('')
 const [page, setPage] = useState(1)
 const [approvalChecked, setApprovalChecked] = useState(false)
 const [importedCount, setImportedCount] = useState(0)

 useEffect(() => {
 Promise.all([apiService.getInitiatives(), apiService.getKPIs(), apiService.getLocations()])
 .then(([initiativeRows, metricRows, locationRows]) => {
 const visibleInitiatives = initiativeRows.filter((initiative) => !initiative.id || canAccessInitiative(initiative.id))
 const initiativeIds = new Set(visibleInitiatives.map((initiative) => initiative.id))
 setInitiatives(visibleInitiatives)
 setKpis(metricRows.filter((metric) => !metric.initiative_id || initiativeIds.has(metric.initiative_id)))
 setLocations(locationRows.filter((location) => !location.id || canAccessLocation(location.id)))
 })
 .catch((error) => notify.error(error instanceof Error ? error.message : 'Could not load import options'))
 .finally(() => setLoadingReferences(false))
 }, [canAccessInitiative, canAccessLocation])

 const sheet = sheets[sheetIndex]
 const headers = useMemo(
 () => makeColumnLabels(sheet?.rows[mapping.headerRow] || []),
 [sheet, mapping.headerRow],
 )
 const initiativeById = useMemo(
 () => new Map(initiatives.map((initiative) => [initiative.id, initiative])),
 [initiatives],
 )
 const metricById = useMemo(() => new Map(kpis.map((kpi) => [kpi.id, kpi])), [kpis])

 const reset = () => {
 setStep('upload')
 setFileName('')
 setAiAnalysis(null)
 setManualFallbackReason('')
 setSheets([])
 setSheetIndex(0)
 setMapping(blankMapping())
 setRecords([])
 setGroupFilter('all')
 setBulkScope('missing')
 setBulkKpiId('')
 setBulkLocationId('')
 setBulkValueDraft('')
 setApprovalChecked(false)
 setImportedCount(0)
 if (inputRef.current) inputRef.current.value = ''
 }

 const buildSuggestedMapping = (selectedSheet: ParsedSpreadsheetSheet): ImportMapping => {
 const headerRow = detectHeaderRow(selectedSheet.rows)
 const nextHeaders = makeColumnLabels(selectedSheet.rows[headerRow] || [])
 const dateColumn = suggestColumn(nextHeaders, ['date', 'session date', 'reporting date', 'period'])
 const locationPrimary = suggestColumn(nextHeaders, ['location', 'city', 'town', 'community'])
 const locationSecondary = suggestColumn(nextHeaders, ['province', 'state', 'country', 'region'])
 const titleColumn = suggestColumn(nextHeaders, ['title', 'event name', 'organization name', 'school organization event name', 'school', 'name'])
 const noteColumn = suggestColumn(nextHeaders, ['note', 'notes', 'description', 'details', 'presenter role note'])
 const initiativeColumn = suggestColumn(nextHeaders, ['initiative', 'program', 'project'])
 const metricNameColumn = suggestColumn(nextHeaders, ['metric', 'indicator', 'measure', 'kpi'])
 const metricValueColumn = suggestColumn(nextHeaders, ['value', 'amount', 'result', 'total'])
 let dataStartRow = headerRow + 1
 if (dateColumn != null) {
 const firstDateOffset = selectedSheet.rows
 .slice(headerRow + 1, Math.min(selectedSheet.rows.length, headerRow + 30))
 .findIndex((row) => parseImportDate(row[dateColumn]) != null)
 if (firstDateOffset >= 0) dataStartRow = headerRow + 1 + firstDateOffset
 }

 const suggestedMetrics: MetricMapping[] = []
 nextHeaders.forEach((header, column) => {
 const sample = selectedSheet.rows.slice(dataStartRow, dataStartRow + 80)
 .map((row) => row[column])
 .filter((value) => cellText(value) !== '')
 if (sample.length < 2) return
 const numericRatio = sample.filter((value) => parseImportNumber(value) != null).length / sample.length
 if (numericRatio < 0.65) return
 const match = bestTextMatch(header, kpis, (kpi) => kpi.title, 0.48)
 if (!match?.option.id || suggestedMetrics.some((item) => item.kpiId === match.option.id)) return
 suggestedMetrics.push({ id: createId(), kpiId: match.option.id, valueColumn: column, constantValue: 1 })
 })

 const suggested: ImportMapping = {
 headerRow,
 dataStartRow,
 dateColumn,
 defaultDate: '',
 locationColumns: [locationPrimary, locationSecondary === locationPrimary ? null : locationSecondary],
 fallbackLocationId: locations.length === 1 ? locations[0].id || '' : '',
 titleColumn,
 noteColumn,
 initiativeColumn,
 metricNameColumn,
 metricValueColumn: metricValueColumn === metricNameColumn ? null : metricValueColumn,
 metrics: suggestedMetrics,
 }

 try {
 const saved = localStorage.getItem(`nexus-import-map:${organizationId || 'organization'}:${headerSignature(selectedSheet, headerRow)}`)
 if (saved) {
 const parsed = JSON.parse(saved) as ImportMapping
 const metricsStillExist = parsed.metrics?.every((item) => kpis.some((kpi) => kpi.id === item.kpiId))
 const fallbackStillExists = !parsed.fallbackLocationId || locations.some((location) => location.id === parsed.fallbackLocationId)
 if (metricsStillExist && fallbackStillExists) return { ...suggested, ...parsed, headerRow, dataStartRow: parsed.dataStartRow || dataStartRow }
 }
 } catch {
 // A damaged local preset should never block a new import.
 }
 return suggested
 }

 const handleFile = async (file?: File) => {
 if (!file) return
 setParsing(true)
 setStep('analyzing')
 setFileName(file.name)
 setAiAnalysis(null)
 setManualFallbackReason('')
 try {
 const parsed = await parseSpreadsheet(file)
 if (!parsed.length || parsed.every((item) => item.rows.length === 0)) throw new Error('The spreadsheet is empty')
 setSheets(parsed)
 setSheetIndex(0)
 setMapping(buildSuggestedMapping(parsed[0]))
 try {
 const analysis = await apiService.analyzeDataImport(file)
 if (!analysis.proposals.length) throw new Error('AI did not find any numerical impact records to propose')
 const nextRecords: ReviewRecord[] = analysis.proposals.map((proposal) => {
 const draft: ReviewRecord = {
 id: createId(),
 sourceRow: proposal.source.row || 0,
 sourceSheet: proposal.source.sheet || 'Unknown sheet',
 sourceCell: proposal.source.cell || '',
 rawMetric: proposal.source.raw_metric || '',
 rawLocation: proposal.source.raw_location || '',
 rawValue: proposal.source.raw_value || '',
 valueMode: proposal.value_mode || 'inferred',
 rationale: proposal.rationale || '',
 origin: 'ai',
 checked: false,
 kpiId: proposal.kpi_id || '',
 value: proposal.value,
 date: proposal.date || '',
 dateRangeStart: proposal.date_range_start || '',
 dateRangeEnd: proposal.date_range_end || '',
 locationId: proposal.location_id || '',
 label: proposal.label || '',
 note: proposal.note || '',
 confidence: proposal.confidence,
 possibleDuplicate: proposal.issues?.includes('Possible duplicate of an existing claim') || false,
 issues: proposal.issues || [],
 }
 draft.issues = Array.from(new Set([...draft.issues, ...recordIssues(draft)]))
 draft.checked = draft.issues.length === 0
 return draft
 })
 setRecords(nextRecords)
 setAiAnalysis(analysis)
 setFilter('all')
 setGroupFilter('all')
 setPage(1)
 setApprovalChecked(false)
 setStep('review')
 } catch (aiError) {
 const message = aiError instanceof Error ? aiError.message : 'AI analysis was unavailable'
 setManualFallbackReason(message)
 setStep('map')
 notify.error(`${message}. The manual mapper is available as a fallback.`)
 }
 } catch (error) {
 setStep('upload')
 notify.error(error instanceof Error ? error.message : 'Could not read this spreadsheet')
 } finally {
 setParsing(false)
 }
 }

 const chooseSheet = (nextIndex: number) => {
 setSheetIndex(nextIndex)
 setMapping(buildSuggestedMapping(sheets[nextIndex]))
 }

 const changeHeaderRow = (headerRow: number) => {
 if (!sheet) return
 const bounded = Math.max(0, Math.min(headerRow, sheet.rows.length - 1))
 const next = { ...buildSuggestedMapping(sheet), headerRow: bounded, dataStartRow: bounded + 1 }
 setMapping(next)
 }

 const addMetricMapping = () => {
 setMapping((current) => ({
 ...current,
 metrics: [...current.metrics, { id: createId(), kpiId: '', valueColumn: null, constantValue: 1 }],
 }))
 }

 const updateMetricMapping = (id: string, patch: Partial<MetricMapping>) => {
 setMapping((current) => ({
 ...current,
 metrics: current.metrics.map((item) => item.id === id ? { ...item, ...patch } : item),
 }))
 }

 const createReviewRecords = () => {
 if (!sheet) return
 const configuredMetrics = mapping.metrics.filter((item) => item.kpiId)
 const hasDynamicMetric = mapping.metricNameColumn != null && mapping.metricValueColumn != null
 if (!configuredMetrics.length && !hasDynamicMetric) {
 notify.error('Map at least one metric before reviewing the import')
 return
 }
 if (mapping.dateColumn == null && !mapping.defaultDate) {
 notify.error('Choose a date column or a default date')
 return
 }

 const nextRecords: ReviewRecord[] = []
 sheet.rows.slice(mapping.dataStartRow).forEach((row, offset) => {
 if (!row.some((cell) => cellText(cell) !== '')) return
 const sourceRow = mapping.dataStartRow + offset + 1
 const date = mapping.dateColumn == null ? mapping.defaultDate : (parseImportDate(row[mapping.dateColumn]) || '')
 const locationSource = mapping.locationColumns
 .filter((column): column is number => column != null)
 .map((column) => cellText(row[column]))
 .filter(Boolean)
 .join(', ')
 const locationMatch = bestTextMatch(
 locationSource,
 locations,
 (location) => [location.name, location.country].filter(Boolean).join(' '),
 0.34,
 )
 const locationId = locationMatch?.option.id || mapping.fallbackLocationId

 const addRecord = (kpiId: string, value: number | null, metricConfidence: number, fallbackTitle: string, valueMode: ReviewRecord['valueMode']) => {
 const metric = metricById.get(kpiId)
 const rawTitle = mapping.titleColumn == null ? '' : cellText(row[mapping.titleColumn])
 const label = rawTitle || `${metric?.title || fallbackTitle || 'Imported data'} · ${sheet.name}`
 const note = mapping.noteColumn == null ? '' : cellText(row[mapping.noteColumn])
 const confidence = Math.round((date ? 35 : 0) + (locationId ? 35 * (locationMatch?.score || 1) : 0) + metricConfidence)
 const draft = {
 id: createId(),
 sourceRow,
 sourceSheet: sheet.name,
 sourceCell: '',
 rawMetric: fallbackTitle,
 rawLocation: locationSource,
 rawValue: value == null ? '' : String(value),
 valueMode,
 rationale: 'Created from the manual column mapping.',
 origin: 'manual' as const,
 checked: false,
 kpiId,
 value,
 date,
 dateRangeStart: '',
 dateRangeEnd: '',
 locationId: locationId || '',
 label,
 note,
 confidence,
 possibleDuplicate: false,
 issues: [] as string[],
 }
 draft.issues = recordIssues(draft)
 draft.checked = draft.issues.length === 0
 nextRecords.push(draft)
 }

 configuredMetrics.forEach((metricMapping) => {
 const value = metricMapping.valueColumn == null
 ? metricMapping.constantValue
 : parseImportNumber(row[metricMapping.valueColumn])
 if (value == null && metricMapping.valueColumn != null && cellText(row[metricMapping.valueColumn]) === '') return
 addRecord(metricMapping.kpiId, value, 30, metricById.get(metricMapping.kpiId)?.title || '', metricMapping.valueColumn == null ? 'row_count' : 'cell')
 })

 if (hasDynamicMetric) {
 const metricName = cellText(row[mapping.metricNameColumn as number])
 const value = parseImportNumber(row[mapping.metricValueColumn as number])
 if (metricName && (value != null || cellText(row[mapping.metricValueColumn as number]) !== '')) {
 const initiativeName = mapping.initiativeColumn == null ? '' : cellText(row[mapping.initiativeColumn])
 const initiativeMatch = bestTextMatch(initiativeName, initiatives, (initiative) => initiative.title, 0.35)
 const candidateMetrics = initiativeMatch?.option.id
 ? kpis.filter((kpi) => kpi.initiative_id === initiativeMatch.option.id)
 : kpis
 const metricMatch = bestTextMatch(metricName, candidateMetrics, (kpi) => kpi.title, 0.34)
 addRecord(metricMatch?.option.id || '', value, 30 * (metricMatch?.score || 0), metricName, 'cell')
 }
 }
 })

 if (!nextRecords.length) {
 notify.error('No importable values were found after the selected starting row')
 return
 }
 try {
 localStorage.setItem(`nexus-import-map:${organizationId || 'organization'}:${headerSignature(sheet, mapping.headerRow)}`, JSON.stringify(mapping))
 } catch {
 // Mapping reuse is a convenience; review can continue without local storage.
 }
 setRecords(nextRecords)
 setFilter('all')
 setGroupFilter('all')
 setPage(1)
 setApprovalChecked(false)
 setStep('review')
 }

 const updateRecord = (id: string, patch: Partial<ReviewRecord>) => {
 setRecords((current) => current.map((record) => {
 if (record.id !== id) return record
 const next = { ...record, ...patch }
 if (['kpiId', 'value', 'date', 'dateRangeStart', 'dateRangeEnd', 'locationId'].some((key) => key in patch)) {
 next.possibleDuplicate = false
 }
 next.issues = recordIssues(next)
 if (next.issues.length > 0) next.checked = false
 return next
 }))
 }

 const recordGroups = useMemo(() => {
 const groups = new Map<string, { key: string; label: string; count: number; issues: number }>()
 records.forEach((record) => {
 const key = recordGroupKey(record)
 const metricName = metricById.get(record.kpiId)?.title || record.rawMetric || 'Unmapped metric'
 const existing = groups.get(key)
 if (existing) {
 existing.count += 1
 if (record.issues.length) existing.issues += 1
 } else {
 groups.set(key, {
 key,
 label: `${record.sourceSheet} · ${metricName}`,
 count: 1,
 issues: record.issues.length ? 1 : 0,
 })
 }
 })
 return [...groups.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
 }, [records, metricById])

 const filteredRecords = records.filter((record) => {
 if (groupFilter !== 'all' && recordGroupKey(record) !== groupFilter) return false
 if (filter === 'ready') return record.issues.length === 0
 if (filter === 'issues') return record.issues.length > 0
 return true
 })
 const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
 const pagedRecords = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
 const readyCount = records.filter((record) => record.issues.length === 0).length
 const issueCount = records.length - readyCount
 const selectedRecords = records.filter((record) => record.checked && record.issues.length === 0)
 const parsedBulkValue = parseImportNumber(bulkValueDraft)

 const applyBulkField = (field: 'kpiId' | 'locationId' | 'value', value: string | number) => {
 const targetIds = new Set(filteredRecords
 .filter((record) => bulkScope === 'filtered' || (field === 'value' ? record.value == null : !record[field]))
 .map((record) => record.id))
 if (!targetIds.size) {
 notify.error(`No ${bulkScope === 'missing' ? 'missing ' : ''}${field === 'kpiId' ? 'metrics' : field === 'locationId' ? 'locations' : 'values'} in this group and filter`)
 return
 }
 setRecords((current) => current.map((record) => {
 if (!targetIds.has(record.id)) return record
 const next = { ...record, [field]: value, possibleDuplicate: false }
 next.issues = recordIssues(next)
 if (next.issues.length) next.checked = false
 return next
 }))
 if (field === 'kpiId') setGroupFilter('all')
 setApprovalChecked(false)
 notify.success(`Updated ${targetIds.size.toLocaleString()} ${targetIds.size === 1 ? 'record' : 'records'}`)
 }

 const toggleAllReady = (checked: boolean) => {
 setRecords((current) => current.map((record) => (
 record.issues.length === 0 ? { ...record, checked } : record
 )))
 }

 const importApproved = async () => {
 if (!approvalChecked || !selectedRecords.length) return
 setImporting(true)
 let completed = 0
 try {
 for (let index = 0; index < selectedRecords.length; index += 200) {
 const chunk = selectedRecords.slice(index, index + 200).map((record) => ({
 kpi_id: record.kpiId,
 value: record.value as number,
 date_represented: record.date,
 date_range_start: record.dateRangeStart || undefined,
 date_range_end: record.dateRangeEnd || undefined,
 location_id: record.locationId,
 label: record.label.trim(),
 note: record.note.trim() || undefined,
 }))
 const created = await apiService.createKPIUpdatesBatch(chunk)
 completed += created.length
 }
 apiService.clearCache('/kpis')
 apiService.clearCache('/initiatives')
 setImportedCount(completed)
 setStep('complete')
 notify.success(`${completed} impact ${completed === 1 ? 'claim' : 'claims'} imported`)
 } catch (error) {
 setImportedCount(completed)
 const prefix = completed ? `${completed} records were imported before the error. ` : ''
 notify.error(`${prefix}${error instanceof Error ? error.message : 'The import could not be completed'}`)
 } finally {
 setImporting(false)
 }
 }

 if (loadingReferences) return <PageLoader />

 return (
 <div className="app-canvas min-h-screen pt-24 pb-10 px-4 sm:px-6 lg:px-8">
 <div className="max-w-[1500px] mx-auto">
 <PageHeader
 title="Import impact data"
 subtitle="Let AI interpret the workbook against your existing initiatives, metrics, and locations—then review and approve every proposed claim."
 backTo="/"
 actions={step !== 'upload' ? (
 <Button variant="secondary" size="sm" onClick={reset}><RotateCcw className="w-4 h-4" /> Start over</Button>
 ) : undefined}
 />

 <div className="grid grid-cols-4 gap-2 mb-6" aria-label="Import progress">
 {['Upload', 'AI analysis', 'Review', 'Complete'].map((label, index) => {
 const activeIndex = step === 'upload' ? 0 : (step === 'analyzing' || step === 'map') ? 1 : step === 'review' ? 2 : 3
 return (
 <div key={label} className={`h-1.5 rounded-full ${index <= activeIndex ? 'bg-primary-500' : 'bg-gray-200'}`} title={label} />
 )
 })}
 </div>

 {!canAddImpactClaims && (
 <InlineAlert tone="warning" title="Import access is not enabled">
 Your team role cannot add impact claims. Ask an organization administrator to update your permissions.
 </InlineAlert>
 )}

 {step === 'upload' && (
 <div className="max-w-3xl mx-auto space-y-4">
 <AppCard padded>
 <button
 type="button"
 disabled={!canAddImpactClaims || parsing}
 onClick={() => inputRef.current?.click()}
 onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
 onDragOver={(event) => event.preventDefault()}
 onDragLeave={() => setDragging(false)}
 onDrop={(event) => {
 event.preventDefault()
 setDragging(false)
 void handleFile(event.dataTransfer.files[0])
 }}
 className={`w-full min-h-[310px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center px-6 text-center transition-colors ${dragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'} disabled:opacity-50 disabled:cursor-not-allowed`}
 >
 <div className="app-icon-tile app-icon-tile-accent !w-14 !h-14 mb-4">
 {parsing ? <Spinner className="w-6 h-6" /> : <UploadCloud className="w-7 h-7" />}
 </div>
 <h2 className="text-lg font-semibold text-secondary-900">Drop a spreadsheet here</h2>
 <p className="app-muted mt-2">or click to choose a CSV or XLSX file for AI analysis</p>
 <span className="app-chip mt-5">Nothing is imported without your approval</span>
 </button>
 <input
 ref={inputRef}
 type="file"
 accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
 className="hidden"
 onChange={(event) => void handleFile(event.target.files?.[0])}
 />
 </AppCard>
 <InlineAlert tone="info" title="AI processing and approval">
 The spreadsheet is sent securely to Nexus and OpenAI for temporary analysis. The uploaded AI file is deleted after processing. Nexus only adds records after you review, select, and explicitly approve them.
 </InlineAlert>
 </div>
 )}

 {step === 'analyzing' && (
 <div className="max-w-3xl mx-auto">
 <AnalyzingPanel fileName={fileName} />
 </div>
 )}

 {step === 'map' && sheet && (
 <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
 <div className="space-y-5 min-w-0">
 {manualFallbackReason && (
 <InlineAlert tone="warning" title="AI analysis was unavailable">
 {manualFallbackReason}. You can still use the manual column mapper below, or start over and retry AI analysis.
 </InlineAlert>
 )}
 <AppCard>
 <div className="app-card-header flex items-center justify-between gap-3">
 <div className="flex items-center gap-3 min-w-0">
 <FileSpreadsheet className="w-5 h-5 text-primary-600 flex-shrink-0" />
 <div className="min-w-0">
 <h2 className="app-card-title truncate">{fileName}</h2>
 <p className="app-muted text-xs">{sheet.rows.length.toLocaleString()} rows in this sheet</p>
 </div>
 </div>
 {sheets.length > 1 && (
 <select className="app-input !w-auto max-w-xs" value={sheetIndex} onChange={(event) => chooseSheet(Number(event.target.value))}>
 {sheets.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}
 </select>
 )}
 </div>
 <div className="p-4 overflow-x-auto">
 <div className="flex flex-wrap gap-4 mb-4">
 <label>
 <span className="app-label">Header row</span>
 <input className="app-input mt-1 w-28" type="number" min={1} max={sheet.rows.length} value={mapping.headerRow + 1} onChange={(event) => changeHeaderRow(Number(event.target.value) - 1)} />
 </label>
 <label>
 <span className="app-label">First data row</span>
 <input className="app-input mt-1 w-32" type="number" min={mapping.headerRow + 2} max={sheet.rows.length} value={mapping.dataStartRow + 1} onChange={(event) => setMapping((current) => ({ ...current, dataStartRow: Math.max(current.headerRow + 1, Number(event.target.value) - 1) }))} />
 </label>
 </div>
 <table className="min-w-full text-xs border-separate border-spacing-0">
 <tbody>
 {sheet.rows.slice(Math.max(0, mapping.headerRow - 2), mapping.headerRow + 7).map((row, visibleIndex) => {
 const rowIndex = Math.max(0, mapping.headerRow - 2) + visibleIndex
 const isHeader = rowIndex === mapping.headerRow
 const isDataStart = rowIndex === mapping.dataStartRow
 return (
 <tr key={rowIndex} className={isHeader ? 'bg-primary-50' : isDataStart ? 'bg-impact-50' : ''}>
 <th className="sticky left-0 bg-white border-b border-r border-gray-200 px-2 py-2 text-gray-400">{rowIndex + 1}</th>
 {Array.from({ length: Math.min(Math.max(headers.length, row.length), 14) }, (_, column) => (
 <td key={column} className="min-w-[130px] max-w-[240px] truncate border-b border-r border-gray-100 px-2 py-2" title={cellText(row[column])}>
 {cellText(row[column]) || <span className="text-gray-300">—</span>}
 </td>
 ))}
 </tr>
 )
 })}
 </tbody>
 </table>
 <p className="app-help mt-3">Highlighted header and first-data rows can be corrected above. Preview is limited to 14 columns.</p>
 </div>
 </AppCard>

 <AppCard padded>
 <h2 className="app-card-title mb-1">Shared fields</h2>
 <p className="app-muted text-sm mb-4">These values are reused for each metric generated from a source row.</p>
 <div className="grid sm:grid-cols-2 gap-4">
 <FieldSelect label="Date column" value={mapping.dateColumn} headers={headers} onChange={(dateColumn) => setMapping((current) => ({ ...current, dateColumn }))} />
 <label className="block">
 <span className="app-label">Default date</span>
 <input className="app-input mt-1" type="date" max={today} value={mapping.defaultDate} disabled={mapping.dateColumn != null} onChange={(event) => setMapping((current) => ({ ...current, defaultDate: event.target.value }))} />
 <span className="app-help">Used only when there is no date column.</span>
 </label>
 <FieldSelect label="Location column" value={mapping.locationColumns[0]} headers={headers} onChange={(value) => setMapping((current) => ({ ...current, locationColumns: [value, current.locationColumns[1]] }))} />
 <FieldSelect label="Second location column" value={mapping.locationColumns[1]} headers={headers} onChange={(value) => setMapping((current) => ({ ...current, locationColumns: [current.locationColumns[0], value] }))} />
 <label className="block sm:col-span-2">
 <span className="app-label">Fallback location</span>
 <select className="app-input mt-1" value={mapping.fallbackLocationId} onChange={(event) => setMapping((current) => ({ ...current, fallbackLocationId: event.target.value }))}>
 <option value="">No fallback — flag unmatched rows</option>
 {locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.country ? ` · ${location.country}` : ''}</option>)}
 </select>
 </label>
 <FieldSelect label="Claim title column" value={mapping.titleColumn} headers={headers} onChange={(titleColumn) => setMapping((current) => ({ ...current, titleColumn }))} />
 <FieldSelect label="Notes column" value={mapping.noteColumn} headers={headers} onChange={(noteColumn) => setMapping((current) => ({ ...current, noteColumn }))} />
 <FieldSelect label="Initiative / program column" value={mapping.initiativeColumn} headers={headers} onChange={(initiativeColumn) => setMapping((current) => ({ ...current, initiativeColumn }))} />
 </div>
 </AppCard>
 </div>

 <div className="space-y-4 xl:sticky xl:top-5">
 <AppCard>
 <div className="app-card-header flex items-center justify-between">
 <div>
 <h2 className="app-card-title">Metrics to create</h2>
 <p className="app-muted text-xs mt-0.5">One source row can create several claims.</p>
 </div>
 <Button size="sm" variant="secondary" onClick={addMetricMapping}><Plus className="w-4 h-4" /> Add</Button>
 </div>
 <div className="p-4 space-y-4">
 <div className="app-card-muted p-3">
 <p className="text-xs font-semibold text-secondary-600 uppercase tracking-wide">If each row names its metric</p>
 <div className="grid grid-cols-2 gap-3 mt-3">
 <FieldSelect label="Metric name" value={mapping.metricNameColumn} headers={headers} onChange={(metricNameColumn) => setMapping((current) => ({ ...current, metricNameColumn }))} />
 <FieldSelect label="Metric value" value={mapping.metricValueColumn} headers={headers} onChange={(metricValueColumn) => setMapping((current) => ({ ...current, metricValueColumn }))} />
 </div>
 </div>
 <div className="flex items-center gap-3 text-xs text-secondary-400"><span className="h-px bg-gray-200 flex-1" /><span>or map fixed metrics</span><span className="h-px bg-gray-200 flex-1" /></div>
 {mapping.metrics.length === 0 && (
 <InlineAlert tone="warning">No confident metric match was found. Add a metric and choose its value source.</InlineAlert>
 )}
 {mapping.metrics.map((item, index) => (
 <div key={item.id} className="app-card-muted p-3 space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-xs font-semibold text-secondary-600 uppercase tracking-wide">Metric {index + 1}</span>
 <button type="button" className="app-btn app-btn-icon app-btn-ghost !w-8 !h-8" onClick={() => setMapping((current) => ({ ...current, metrics: current.metrics.filter((metric) => metric.id !== item.id) }))} aria-label="Remove metric mapping">
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
 <label className="block">
 <span className="app-label">Existing Nexus metric</span>
 <select className="app-input mt-1" value={item.kpiId} onChange={(event) => updateMetricMapping(item.id, { kpiId: event.target.value })}>
 <option value="">Choose a metric</option>
 {initiatives.map((initiative) => {
 const options = kpis.filter((kpi) => kpi.initiative_id === initiative.id)
 if (!options.length) return null
 return (
 <optgroup key={initiative.id} label={initiative.title}>
 {options.map((kpi) => <option key={kpi.id} value={kpi.id}>{kpi.title} ({kpi.unit_of_measurement})</option>)}
 </optgroup>
 )
 })}
 </select>
 </label>
 <label className="block">
 <span className="app-label">Value source</span>
 <select className="app-input mt-1" value={item.valueColumn ?? 'constant'} onChange={(event) => updateMetricMapping(item.id, { valueColumn: event.target.value === 'constant' ? null : Number(event.target.value) })}>
 <option value="constant">Count every populated row</option>
 {headers.map((header, column) => <option key={column} value={column}>{columnLetter(column)} · {header}</option>)}
 </select>
 </label>
 {item.valueColumn == null && (
 <label className="block">
 <span className="app-label">Value per row</span>
 <input className="app-input mt-1" type="number" min={0} step="any" value={item.constantValue} onChange={(event) => updateMetricMapping(item.id, { constantValue: Number(event.target.value) })} />
 </label>
 )}
 </div>
 ))}
 </div>
 </AppCard>
 <Button className="w-full" size="lg" onClick={createReviewRecords} disabled={!mapping.metrics.some((item) => item.kpiId) && !(mapping.metricNameColumn != null && mapping.metricValueColumn != null)}>
 Build review <ArrowRight className="w-4 h-4" />
 </Button>
 <p className="app-help text-center">The mapping is saved in this browser for files with the same headers. Review is still required every time.</p>
 </div>
 </div>
 )}

 {step === 'review' && (
 <div className="space-y-5">
 {aiAnalysis && (
 <AppCard padded>
 <div className="flex items-start gap-3">
 <Sparkles className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <h2 className="app-card-title">AI workbook interpretation</h2>
 <Badge tone="accent">{aiAnalysis.model}</Badge>
 </div>
 <p className="text-sm text-secondary-700 mt-2">{aiAnalysis.summary}</p>
 {aiAnalysis.sheets_analyzed.length > 0 && (
 <div className="grid md:grid-cols-2 gap-2 mt-4">
 {aiAnalysis.sheets_analyzed.map((item) => (
 <div key={item.sheet} className="app-card-muted p-3">
 <div className="flex items-center justify-between gap-2">
 <span className="text-sm font-medium text-secondary-800">{item.sheet}</span>
 <span className="app-chip text-xs">{item.records_found} proposed</span>
 </div>
 <p className="app-help mt-1">{item.interpretation}</p>
 </div>
 ))}
 </div>
 )}
 {(aiAnalysis.warnings.length > 0 || aiAnalysis.ignored_areas.length > 0) && (
 <details className="mt-4 text-sm">
 <summary className="cursor-pointer font-medium text-secondary-700">Review AI warnings and ignored areas</summary>
 <div className="mt-2 space-y-1 app-muted">
 {[...aiAnalysis.warnings, ...aiAnalysis.ignored_areas].map((item, index) => <p key={`${index}-${item}`}>• {item}</p>)}
 </div>
 </details>
 )}
 </div>
 </div>
 </AppCard>
 )}
 <AppCard padded>
 <div className="flex items-start gap-3">
 <Layers3 className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
 <div className="flex-1 min-w-0">
 <h2 className="app-card-title">Group and fix records in bulk</h2>
 <p className="app-muted text-sm mt-1">Corrections apply across every page in the selected group. Source cities and provinces remain visible in the table while you connect them to an existing Nexus location.</p>
 <div className="grid lg:grid-cols-[minmax(240px,1fr)_190px] gap-3 mt-4">
 <label>
 <span className="app-label">Record group</span>
 <select className="app-input mt-1" value={groupFilter} onChange={(event) => { setGroupFilter(event.target.value); setPage(1) }}>
 <option value="all">All groups · {records.length.toLocaleString()} records</option>
 {recordGroups.map((group) => (
 <option key={group.key} value={group.key}>{group.label} · {group.count.toLocaleString()}{group.issues ? ` (${group.issues.toLocaleString()} need attention)` : ''}</option>
 ))}
 </select>
 </label>
 <label>
 <span className="app-label">Apply changes to</span>
 <select className="app-input mt-1" value={bulkScope} onChange={(event) => setBulkScope(event.target.value as 'missing' | 'filtered')}>
 <option value="missing">Only missing fields</option>
 <option value="filtered">All filtered records</option>
 </select>
 </label>
 </div>
 <div className="grid md:grid-cols-3 gap-3 mt-3">
 <div className="app-card-muted p-3">
 <span className="app-label">Metric</span>
 <select className="app-input mt-1 !py-2 text-xs" value={bulkKpiId} onChange={(event) => setBulkKpiId(event.target.value)}>
 <option value="">Choose metric</option>
 {kpis.map((kpi) => <option key={kpi.id} value={kpi.id}>{initiativeById.get(kpi.initiative_id)?.title || 'Initiative'} · {kpi.title}</option>)}
 </select>
 <Button className="w-full mt-2" size="sm" variant="secondary" disabled={!bulkKpiId} onClick={() => applyBulkField('kpiId', bulkKpiId)}>Apply metric</Button>
 </div>
 <div className="app-card-muted p-3">
 <span className="app-label">Location</span>
 <select className="app-input mt-1 !py-2 text-xs" value={bulkLocationId} onChange={(event) => setBulkLocationId(event.target.value)}>
 <option value="">Choose location</option>
 {locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.country ? ` · ${location.country}` : ''}</option>)}
 </select>
 <Button className="w-full mt-2" size="sm" variant="secondary" disabled={!bulkLocationId} onClick={() => applyBulkField('locationId', bulkLocationId)}>Apply location</Button>
 </div>
 <div className="app-card-muted p-3">
 <span className="app-label">Value</span>
 <input className="app-input mt-1 !py-2 text-xs" type="text" inputMode="decimal" placeholder="e.g. 1 or 1,250" value={bulkValueDraft} onChange={(event) => setBulkValueDraft(event.target.value)} />
 <Button className="w-full mt-2" size="sm" variant="secondary" disabled={parsedBulkValue == null} onClick={() => parsedBulkValue != null && applyBulkField('value', parsedBulkValue)}>Apply value</Button>
 </div>
 </div>
 <p className="app-help mt-3">Currently targeting {filteredRecords.length.toLocaleString()} records across all result pages. Choose “Only missing fields” to preserve AI-populated mappings.</p>
 </div>
 </div>
 </AppCard>
 <div className="grid sm:grid-cols-3 gap-3">
 <AppCard padded><p className="app-section-title">Detected</p><p className="text-2xl font-semibold text-secondary-900 mt-1">{records.length.toLocaleString()}</p></AppCard>
 <AppCard padded><p className="app-section-title">Ready</p><p className="text-2xl font-semibold text-impact-700 mt-1">{readyCount.toLocaleString()}</p></AppCard>
 <AppCard padded><p className="app-section-title">Needs attention</p><p className="text-2xl font-semibold text-amber-700 mt-1">{issueCount.toLocaleString()}</p></AppCard>
 </div>
 <InlineAlert tone="info" title="Review before approval">
 Checked records are proposed for import. Fix or leave unchecked anything that should not be added; no evidence files are created by this import.
 </InlineAlert>
 <AppCard>
 <div className="app-card-header flex flex-wrap items-center gap-2">
 {(['all', 'ready', 'issues'] as const).map((value) => (
 <button key={value} type="button" onClick={() => { setFilter(value); setPage(1) }} className={`app-chip capitalize ${filter === value ? 'app-chip-accent' : ''}`}>
 {value === 'issues' ? 'Needs attention' : value}
 </button>
 ))}
 <div className="ml-auto flex gap-2">
 <Button size="sm" variant="secondary" onClick={() => toggleAllReady(true)}>Select all ready</Button>
 <Button size="sm" variant="ghost" onClick={() => toggleAllReady(false)}>Clear</Button>
 </div>
 </div>
 <div className="overflow-x-auto">
 <table className="min-w-[1250px] w-full text-sm">
 <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-secondary-500">
 <tr>
 <th className="px-3 py-3 w-10">Add</th>
 <th className="px-3 py-3">Source</th>
 <th className="px-3 py-3 min-w-[240px]">Metric</th>
 <th className="px-3 py-3 w-32">Value</th>
 <th className="px-3 py-3 min-w-[180px]">Date / period</th>
 <th className="px-3 py-3 min-w-[210px]">Location</th>
 <th className="px-3 py-3 min-w-[240px]">Title</th>
 <th className="px-3 py-3 min-w-[240px]">Notes</th>
 <th className="px-3 py-3 w-36">Status</th>
 </tr>
 </thead>
 <tbody>
 {pagedRecords.map((record) => (
 <tr key={record.id} className={`border-t border-gray-100 align-top ${record.issues.length ? 'bg-amber-50/40' : ''}`}>
 <td className="px-3 py-3"><input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" checked={record.checked} disabled={record.issues.length > 0} onChange={(event) => updateRecord(record.id, { checked: event.target.checked })} /></td>
 <td className="px-3 py-3 text-secondary-500 max-w-[180px]">
 <div className="font-medium text-secondary-700 truncate" title={record.sourceSheet}>{record.sourceSheet}</div>
 <div className="text-xs mt-0.5">{record.sourceCell || (record.sourceRow ? `Row ${record.sourceRow}` : 'Source located by AI')}</div>
 {(record.rawMetric || record.rawLocation) && <div className="text-[11px] mt-1 truncate" title={[record.rawMetric, record.rawLocation].filter(Boolean).join(' · ')}>{[record.rawMetric, record.rawLocation].filter(Boolean).join(' · ')}</div>}
 </td>
 <td className="px-3 py-2">
 <select className="app-input !py-2 text-xs" value={record.kpiId} onChange={(event) => updateRecord(record.id, { kpiId: event.target.value })}>
 <option value="">Choose metric</option>
 {kpis.map((kpi) => <option key={kpi.id} value={kpi.id}>{initiativeById.get(kpi.initiative_id)?.title || 'Initiative'} · {kpi.title}</option>)}
 </select>
 </td>
 <td className="px-3 py-2">
 <EditableNumberInput value={record.value} onChange={(value) => updateRecord(record.id, { value })} />
 {record.rawValue && <div className="text-[11px] text-secondary-500 mt-1" title={`Source ${record.sourceCell || 'cell'} · ${record.valueMode}`}>Source: {record.rawValue}</div>}
 </td>
 <td className="px-3 py-2">
 <input className="app-input !py-2 text-xs" type="date" max={today} value={record.date} onChange={(event) => updateRecord(record.id, { date: event.target.value })} />
 {(record.dateRangeStart || record.dateRangeEnd) && (
 <div className="grid grid-cols-2 gap-1 mt-1" title="Reporting period interpreted by AI">
 <input aria-label="Period start" className="app-input !px-1 !py-1 text-[11px]" type="date" max={today} value={record.dateRangeStart} onChange={(event) => updateRecord(record.id, { dateRangeStart: event.target.value })} />
 <input aria-label="Period end" className="app-input !px-1 !py-1 text-[11px]" type="date" max={today} value={record.dateRangeEnd} onChange={(event) => updateRecord(record.id, { dateRangeEnd: event.target.value })} />
 </div>
 )}
 </td>
 <td className="px-3 py-2">
 <select className="app-input !py-2 text-xs" value={record.locationId} onChange={(event) => updateRecord(record.id, { locationId: event.target.value })}>
 <option value="">Choose location</option>
 {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
 </select>
 </td>
 <td className="px-3 py-2"><input className="app-input !py-2 text-xs" value={record.label} onChange={(event) => updateRecord(record.id, { label: event.target.value })} /></td>
 <td className="px-3 py-2"><input className="app-input !py-2 text-xs" value={record.note} onChange={(event) => updateRecord(record.id, { note: event.target.value })} /></td>
 <td className="px-3 py-3">
 {record.issues.length ? (
 <div title={[...record.issues, record.rationale].filter(Boolean).join(' — ')}><Badge tone="warning"><AlertTriangle className="w-3 h-3" /> {record.issues[0]}</Badge></div>
 ) : (
 <div title={record.rationale}><Badge tone={record.confidence >= 80 ? 'impact' : 'neutral'}><Check className="w-3 h-3" /> Ready · {record.confidence}%</Badge></div>
 )}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <div className="app-card-header !border-t !border-b-0 flex items-center justify-between">
 <span className="app-muted text-sm">Page {page} of {pageCount} · {filteredRecords.length.toLocaleString()} records</span>
 <div className="flex gap-2">
 <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
 <Button size="sm" variant="secondary" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button>
 </div>
 </div>
 </AppCard>

 <AppCard padded className="max-w-3xl ml-auto">
 <div className="flex items-start gap-3">
 <ShieldCheck className="w-6 h-6 text-primary-600 flex-shrink-0 mt-0.5" />
 <div className="flex-1">
 <h2 className="app-card-title">Final approval</h2>
 <p className="app-muted text-sm mt-1">This creates {selectedRecords.length.toLocaleString()} impact claims. Evidence can be attached afterward.</p>
 <label className="flex items-start gap-3 mt-4 cursor-pointer">
 <input type="checkbox" className="mt-1 rounded border-gray-300 text-primary-600 focus:ring-primary-500" checked={approvalChecked} onChange={(event) => setApprovalChecked(event.target.checked)} />
 <span className="text-sm text-secondary-700">I reviewed the selected records and approve adding them to this organization.</span>
 </label>
 <div className="flex justify-end gap-3 mt-5">
 <Button variant="secondary" onClick={() => setStep('map')}>Use manual mapper</Button>
 <Button disabled={!approvalChecked || !selectedRecords.length || importing} onClick={() => void importApproved()}>
 {importing ? 'Importing…' : <><FileUp className="w-4 h-4" /> Approve and import {selectedRecords.length.toLocaleString()}</>}
 </Button>
 </div>
 </div>
 </div>
 </AppCard>
 </div>
 )}

 {step === 'complete' && (
 <div className="max-w-2xl mx-auto">
 <AppCard padded className="text-center !p-10">
 <div className="app-icon-tile app-icon-tile-accent !w-16 !h-16 mx-auto mb-5"><CheckCircle2 className="w-8 h-8 text-impact-600" /></div>
 <h2 className="text-2xl font-semibold text-secondary-900">Import complete</h2>
 <p className="app-muted mt-2">{importedCount.toLocaleString()} impact {importedCount === 1 ? 'claim was' : 'claims were'} added. Future uploads will still be analyzed and shown for approval before anything is imported.</p>
 <div className="flex justify-center gap-3 mt-7">
 <Button variant="secondary" onClick={reset}><FileSpreadsheet className="w-4 h-4" /> Import another file</Button>
 <Button onClick={() => { window.location.href = '/' }}>Return to dashboard</Button>
 </div>
 </AppCard>
 </div>
 )}
 </div>
 </div>
 )
}
