import type { CreateEvidenceForm, CreateKPIUpdateForm } from '../../types'
import { previewMatchingClaims } from '../../utils/timeline'
import type { WizardFile, WizardState } from './wizardTypes'

/** Missing override fields inherit live defaults. Empty values are intentional overrides. */
export type LogDetails = Pick<WizardState, 'evidenceTitle' | 'evidenceDescription' | 'dateMode' | 'dateSingle' | 'dateStart' | 'dateEnd' | 'locationIds' | 'tagIds' | 'beneficiaryGroupIds'>
export interface LogMetricRow {
 id: string
 kpiId: string
 value: string
 tagValues: Record<string, string>
 overrides: Partial<LogDetails>
 /** Explicitly included for evidence even when its result is blank. */
 keepForEvidence?: boolean
}

export function newLogRow(kpiId: string, id: string = crypto.randomUUID()): LogMetricRow {
 return { id, kpiId, value: '', tagValues: {}, overrides: {} }
}

export function sharedLogDetails(state: WizardState): LogDetails {
 const { evidenceTitle, evidenceDescription, dateMode, dateSingle, dateStart, dateEnd, locationIds, tagIds, beneficiaryGroupIds } = state
 return { evidenceTitle, evidenceDescription, dateMode, dateSingle, dateStart, dateEnd, locationIds, tagIds, beneficiaryGroupIds }
}

export const rowDetails = (state: WizardState, row: LogMetricRow): LogDetails => ({ ...sharedLogDetails(state), ...row.overrides })
export const logDates = (details: LogDetails) => {
 const start = details.dateMode === 'single' ? details.dateSingle : details.dateStart
 const end = details.dateMode === 'single' ? start : details.dateEnd || start
 return { start, end }
}
const dateFields = (details: LogDetails) => {
 const { start, end } = logDates(details)
 return { date_represented: start, date_range_start: end !== start ? start : undefined, date_range_end: end !== start ? end : undefined }
}
const sorted = (ids: string[]) => [...new Set(ids)].sort()

export function rowHasResult(state: WizardState, row: LogMetricRow): boolean {
 const tags = rowDetails(state, row).tagIds
 return row.value.trim() !== '' || (tags.length > 1 && tags.some(id => (row.tagValues[id] || '').trim() !== ''))
}

export function fileRows(state: WizardState, file: WizardFile): LogMetricRow[] {
 return (state.logRows || []).filter(row => file.rowIds === undefined || file.rowIds.includes(row.id))
}

/** Both file and metric controls change the same assignment, never the upload. */
export function setLogFileRow(state: WizardState, fileId: string, rowId: string, included: boolean): Partial<WizardState> {
 if (!state.logRows?.some(row => row.id === rowId)) return {}
 return { files: state.files.map(file => {
  if (file.id !== fileId) return file
  const selected = fileRows(state, file).map(row => row.id)
  if (selected.includes(rowId) === included) return file
  return { ...file, rowIds: included ? [...selected, rowId] : selected.filter(id => id !== rowId) }
 }) }
}

export function removeLogRow(state: WizardState, id: string): Partial<WizardState> {
 return {
  logRows: (state.logRows || []).filter(row => row.id !== id),
  files: state.files.map(file => ({ ...file, rowIds: file.rowIds?.filter(rowId => rowId !== id) })),
 }
}

/** Visible empty cards are not selected. Typing includes one without a picker. */
export function setLogRowResult(state: WizardState, row: LogMetricRow, value: string): Partial<WizardState> {
 const next = { ...row, value }
 if (!rowHasResult(state, next) && !next.keepForEvidence && !Object.keys(next.overrides).length) return removeLogRow(state, row.id)
 const rows = state.logRows || []
 return { logRows: rows.some(r => r.id === row.id) ? rows.map(r => r.id === row.id ? next : r) : [...rows, next] }
}

export interface PlannedClaim {
 key: string
 rowId: string
 kpiId: string
 details: LogDetails
 payload: CreateKPIUpdateForm
}
export interface PlannedEvidence {
 key: string
 rowIds: string[]
 claimKeys: string[]
 files: WizardFile[]
 details: LogDetails
 payload: CreateEvidenceForm
}

/** The existing matcher can also connect overlapping scopes of the same metric. */
export function matchingLogClaimKeys(claims: PlannedClaim[], evidence: PlannedEvidence): string[] {
 const { start, end } = logDates(evidence.details)
 const matches = previewMatchingClaims(claims.map(c => ({
  ...c.payload, id: c.key, kpi_id: c.kpiId, evidence_count: 0,
 })), {
  kpiIds: evidence.payload.kpi_ids || [], locationIds: evidence.details.locationIds,
  tagIds: evidence.details.tagIds, beneficiaryGroupIds: evidence.details.beneficiaryGroupIds,
  dateStart: start, dateEnd: end,
 })
 return [...new Set([...evidence.claimKeys, ...matches.map(c => c.id!)])]
}

/** Both review and persistence consume this plan, so they cannot disagree about scope. */
export function buildLogPlan(state: WizardState, initiativeId?: string) {
 const claims: PlannedClaim[] = []
 for (const row of state.logRows || []) {
  if (!rowHasResult(state, row)) continue
  const details = rowDetails(state, row)
  const tags = details.tagIds.length ? details.tagIds : [null]
  for (const tagId of tags) {
   const value = tags.length > 1 ? row.tagValues[tagId!] || '' : row.value
   claims.push({
    key: JSON.stringify([row.id, tagId]), rowId: row.id, kpiId: row.kpiId, details,
    payload: {
     value: Number(value), label: details.evidenceTitle.trim() || undefined,
     note: details.evidenceDescription.trim() || undefined, ...dateFields(details),
     location_id: details.locationIds[0], tag_id: tagId,
     beneficiary_group_ids: details.beneficiaryGroupIds,
    },
   })
  }
 }

 // A file can support several scopes. Keep those scopes separate to avoid the
 // metric x location cross-product that a single broad evidence record creates.
 const buckets = new Map<string, PlannedEvidence>()
 for (const file of state.files) {
  if (file.status !== 'done' || !file.url) continue
  const rows = fileRows(state, file)
  const scopes = new Map<string, { details: LogDetails; rowIds: string[]; kpiIds: string[] }>()
  for (const row of rows.length ? rows : [null]) {
   const details = { ...(row ? rowDetails(state, row) : sharedLogDetails(state)), ...file.overrides }
   const scopeKey = JSON.stringify([details.evidenceTitle, details.evidenceDescription, logDates(details), sorted(details.locationIds), sorted(details.tagIds), sorted(details.beneficiaryGroupIds)])
   const scope = scopes.get(scopeKey) || { details, rowIds: [], kpiIds: [] }
   if (row) { scope.rowIds.push(row.id); scope.kpiIds.push(row.kpiId) }
   scopes.set(scopeKey, scope)
  }
  for (const [scopeKey, scope] of scopes) {
   const type = file.type || 'documentation'
   const key = JSON.stringify([type, scopeKey, sorted(scope.rowIds)])
   let bucket = buckets.get(key)
   if (!bucket) {
    bucket = {
     key, rowIds: scope.rowIds, claimKeys: claims.filter(c => scope.rowIds.includes(c.rowId)).map(c => c.key),
     files: [], details: scope.details,
     payload: {
      title: scope.details.evidenceTitle.trim(), description: scope.details.evidenceDescription.trim() || undefined,
      type, ...dateFields(scope.details), initiative_id: initiativeId,
      location_ids: scope.details.locationIds, kpi_ids: sorted(scope.kpiIds),
      tag_ids: scope.details.tagIds, beneficiary_group_ids: scope.details.beneficiaryGroupIds,
      file_urls: [], file_sizes: [],
     },
    }
    buckets.set(key, bucket)
   }
   bucket.files.push(file)
   bucket.payload.file_urls!.push(file.url)
   bucket.payload.file_sizes!.push(file.uploadedSize ?? file.size)
   bucket.payload.file_url ||= file.url
  }
 }
 return { claims, evidence: [...buckets.values()] }
}

export function validateLogDraft(state: WizardState, kpis?: Array<{ id?: string; title?: string }>): string | null {
 const rows = state.logRows || []
 if (!state.files.length && !rows.some(row => rowHasResult(state, row))) return 'Add files or enter a result to save this log'
 if (state.files.some(f => f.status === 'uploading')) return 'Wait for uploads to finish'
 if (state.files.some(f => f.status === 'error' || !f.url)) return 'Remove or retry failed uploads'
 for (const row of rows) {
  const name = kpis?.find(k => k.id === row.kpiId)?.title || 'This metric'
  if (kpis && !kpis.some(k => k.id === row.kpiId)) return 'A selected metric is no longer available. Remove it and choose another.'
  if (!rowHasResult(state, row)) continue
  const details = rowDetails(state, row)
  if (details.locationIds.length !== 1) return `${name}: choose one location for the result`
  const values = details.tagIds.length > 1 ? details.tagIds.map(id => row.tagValues[id] || '') : [row.value]
  if (values.some(v => !v.trim())) return `${name}: enter an amount for every tag, including 0 where needed`
  if (values.some(v => !Number.isFinite(Number(v)))) return `${name}: result values must be finite numbers`
  if (details.tagIds.length > 1) {
   if (!row.value.trim() || !Number.isFinite(Number(row.value))) return `${name}: enter the total result`
   const total = values.reduce((sum, v) => sum + Number(v), 0)
   if (Math.abs(total - Number(row.value)) > Math.max(1, Math.abs(total), Math.abs(Number(row.value))) * 1e-9) return `${name}: tag amounts must add up to the total result`
  }
 }
 const plan = buildLogPlan(state)
 for (const record of [...plan.claims, ...plan.evidence]) {
  const { start, end } = logDates(record.details)
  if (!start) return 'Choose an activity date for every item'
  if (start > end) return 'The date range is reversed'
 }
 if (plan.evidence.some(e => !e.payload.title)) return 'Give the evidence a short title in the Master Scope or its metric details'
 if (plan.evidence.some(e => !e.payload.location_ids?.length)) return 'Choose a location for the evidence so it can connect to results'
 return null
}

/** Evidence-only members can't add results, so a metric tag is the only way their files connect. */
export function evidenceMetricError(state: WizardState, metricCount: number): string | null {
 if (!metricCount || !state.files.length || (state.logRows || []).length) return null
 return 'Pick at least one metric this evidence supports'
}

export type LogField = 'title' | 'date' | 'location' | 'amount'
export interface LogFieldIssues {
 shared: LogField[]
 rows: Record<string, LogField[]>
 files: Record<string, LogField[]>
}

const FIELD_KEYS: Record<Exclude<LogField, 'amount'>, Array<keyof LogDetails>> = {
 title: ['evidenceTitle'],
 date: ['dateMode', 'dateSingle', 'dateStart', 'dateEnd'],
 location: ['locationIds'],
}

/** Points each validation gap at the scope that owns the empty field. */
export function logFieldIssues(state: WizardState): LogFieldIssues {
 const issues: LogFieldIssues = { shared: [], rows: {}, files: {} }
 const add = (list: LogField[], field: LogField) => { if (!list.includes(field)) list.push(field) }
 const owns = (overrides: Partial<LogDetails> | undefined, field: Exclude<LogField, 'amount'>) => FIELD_KEYS[field].some(key => overrides?.[key] !== undefined)
 const flag = (field: Exclude<LogField, 'amount'>, row?: LogMetricRow, file?: WizardFile) => {
  if (file && owns(file.overrides, field)) add(issues.files[file.id] ||= [], field)
  else if (row && owns(row.overrides, field)) add(issues.rows[row.id] ||= [], field)
  else add(issues.shared, field)
 }
 const badDate = (details: LogDetails) => {
  const { start, end } = logDates(details)
  return !start || start > end
 }
 const rows = state.logRows || []
 for (const row of rows) {
  if (!rowHasResult(state, row)) continue
  const details = rowDetails(state, row)
  if (details.locationIds.length !== 1) flag('location', row)
  if (badDate(details)) flag('date', row)
  const values = details.tagIds.length > 1 ? [row.value, ...details.tagIds.map(id => row.tagValues[id] || '')] : [row.value]
  if (values.some(v => !v.trim() || !Number.isFinite(Number(v)))) add(issues.rows[row.id] ||= [], 'amount')
 }
 for (const evidence of buildLogPlan(state).evidence) {
  const row = evidence.rowIds.length === 1 ? rows.find(r => r.id === evidence.rowIds[0]) : undefined
  for (const file of evidence.files) {
   if (!evidence.payload.title) flag('title', row, file)
   if (!evidence.details.locationIds.length) flag('location', row, file)
   if (badDate(evidence.details)) flag('date', row, file)
  }
 }
 return issues
}

export interface LogSaveProgress {
 claims: Map<string, string>
 evidence: Set<string>
 ownedUrls: Set<string>
}

/** Retain confirmed records on retry; never submit the already-saved prefix again. */
export async function saveLogPlan(
 plan: ReturnType<typeof buildLogPlan>,
 api: {
  createKPIUpdatesBatch: (updates: Array<CreateKPIUpdateForm & { kpi_id: string }>) => Promise<Array<{ id?: string; kpi_id?: string }>>
  createEvidence: (payload: CreateEvidenceForm) => Promise<{ id?: string }>
 },
 progress: LogSaveProgress,
 onProgress: (saved: number, total: number) => void,
 pinClaimId?: string,
) {
 const total = plan.claims.length + plan.evidence.length
 const report = () => onProgress(progress.claims.size + progress.evidence.size, total)
 report()
 const pendingClaims = plan.claims.filter(claim => !progress.claims.has(claim.key))
 if (pendingClaims.length) {
  // The batch endpoint returns rows grouped by metric in first-seen order; send them that way so indexes line up.
  const grouped = [...new Set(pendingClaims.map(c => c.kpiId))].flatMap(kpiId => pendingClaims.filter(c => c.kpiId === kpiId))
  const created = await api.createKPIUpdatesBatch(grouped.map(c => ({ ...c.payload, kpi_id: c.kpiId })))
  if (created.length !== grouped.length || created.some((row, i) => !row?.id || (row.kpi_id && row.kpi_id !== grouped[i].kpiId))) {
   throw new Error('The results could not be confirmed as saved')
  }
  grouped.forEach((claim, i) => progress.claims.set(claim.key, created[i].id!))
  report()
 }
 const queue = plan.evidence.filter(evidence => !progress.evidence.has(evidence.key))
 const worker = async () => {
  for (let evidence = queue.shift(); evidence; evidence = queue.shift()) {
   const created = await api.createEvidence({ ...evidence.payload, kpi_update_ids: sorted([
    ...evidence.claimKeys.flatMap(key => progress.claims.get(key) || []),
    ...(pinClaimId ? [pinClaimId] : []),
   ]) })
   if (!created?.id) throw new Error('The evidence could not be confirmed as saved')
   progress.evidence.add(evidence.key)
   evidence.files.forEach(f => progress.ownedUrls.add(f.url!))
   report()
  }
 }
 // Settle every in-flight request before surfacing an error, so a retry never races a save still running.
 const results = await Promise.allSettled(Array.from({ length: Math.min(3, queue.length) }, worker))
 const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
 if (failed) throw failed.reason
}
