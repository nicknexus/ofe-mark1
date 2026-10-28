// node -r sucrase/register --test frontend/src/components/upload/logDraft.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { INITIAL_WIZARD_STATE, WizardState, validateAll } from './wizardTypes'
import { buildLogPlan, fileRows, newLogRow, rowDetails, saveLogPlan, LogSaveProgress, matchingLogClaimKeys, setLogRowResult, setLogFileRow, logFieldIssues, evidenceMetricError } from './logDraft'

const row = (id: string, kpiId = id) => ({ ...newLogRow(kpiId, id), value: '10' })
const file = (id: string, rowIds?: string[]): WizardState['files'][number] => ({ id, name: `${id}.jpg`, size: 10, uploadedSize: 8, status: 'done', progress: 100, url: `https://example.test/${id}.jpg`, type: 'visual_proof', rowIds })
const draft = (patch: Partial<WizardState> = {}): WizardState => ({
 ...INITIAL_WIZARD_STATE, entryMode: true, dateSingle: '2026-10-01', evidenceTitle: 'October workshop',
 locationIds: ['centre'], logRows: [row('students'), row('kits')], ...patch,
})

test('direct entry includes only the typed metric, accepts zero, and keeps following files in sync', () => {
 const empty = draft({ logRows: [], files: [file('all')] })
 const visible = newLogRow('students', 's')
 assert.deepEqual(buildLogPlan(empty).evidence[0].payload.kpi_ids, [])
 const typed = { ...empty, ...setLogRowResult(empty, visible, '0') }
 assert.equal(validateAll(typed), null)
 assert.deepEqual(buildLogPlan(typed).claims.map(c => c.payload.value), [0])
 assert.deepEqual(buildLogPlan(typed).evidence[0].payload.kpi_ids, ['students'])
 const edited = { ...typed, ...setLogRowResult(typed, typed.logRows![0], '25') }
 assert.equal(edited.logRows!.length, 1)
 assert.equal(buildLogPlan(edited).claims[0].payload.value, 25)
 const cleared = { ...edited, ...setLogRowResult(edited, edited.logRows![0], '') }
 assert.equal(buildLogPlan(cleared).claims.length, 0)
 assert.deepEqual(buildLogPlan(cleared).evidence[0].payload.kpi_ids, [])
})

test('clearing a result removes explicit file assignments without broadening them', () => {
 const state = draft({ files: [file('selected', ['students']), file('all')] })
 const cleared = { ...state, ...setLogRowResult(state, state.logRows![0], '') }
 assert.deepEqual(cleared.logRows!.map(r => r.id), ['kits'])
 assert.deepEqual(cleared.files[0].rowIds, [])
 assert.equal(cleared.files[1].rowIds, undefined)
 assert.deepEqual(buildLogPlan(cleared).evidence.map(e => e.payload.kpi_ids), [[], ['kits']])
})

test('clearing totals retains intentional evidence scopes and incomplete tag allocations', () => {
 for (const extra of [{ keepForEvidence: true }, { overrides: { locationIds: ['north'] } }]) {
  const state = draft({ logRows: [{ ...row('students'), ...extra }], files: [file('all')] })
  const cleared = { ...state, ...setLogRowResult(state, state.logRows![0], '') }
  assert.equal(cleared.logRows!.length, 1)
  assert.equal(buildLogPlan(cleared).claims.length, 0)
  assert.deepEqual(buildLogPlan(cleared).evidence[0].payload.kpi_ids, ['students'])
 }
 const tagged = draft({ tagIds: ['a', 'b'], logRows: [{ ...row('students'), tagValues: { a: '6', b: '4' } }] })
 const cleared = { ...tagged, ...setLogRowResult(tagged, tagged.logRows![0], '') }
 assert.equal(cleared.logRows!.length, 1)
 assert.match(validateAll(cleared)!, /total result/)
})

test('detaching a file from one tagged scope preserves the upload and the other scope', () => {
 const state = draft({ logRows: [
  { ...row('culinary', 'participants'), overrides: { tagIds: ['culinary'] } },
  { ...row('sewing', 'participants'), overrides: { tagIds: ['sewing'] } },
 ], files: [file('photo'), file('register')] })
 const changed = { ...state, ...setLogFileRow(state, 'photo', 'sewing', false) }
 assert.equal(changed.files.length, 2)
 assert.equal(changed.files[0].url, state.files[0].url)
 assert.equal(changed.files[0].status, 'done')
 assert.deepEqual(fileRows(changed, changed.files[0]).map(r => r.id), ['culinary'])
 assert.equal(changed.files[1], state.files[1])
 const plan = buildLogPlan(changed)
 const photo = plan.evidence.find(e => e.files.some(f => f.id === 'photo'))!
 assert.deepEqual(photo.payload.tag_ids, ['culinary'])
 assert.deepEqual(matchingLogClaimKeys(plan.claims, photo), [plan.claims[0].key])
 const restored = { ...changed, ...setLogFileRow(changed, 'photo', 'sewing', true) }
 assert.deepEqual(fileRows(restored, restored.files[0]).map(r => r.id), ['culinary', 'sewing'])
 assert.equal(restored.files.length, 2)
})

test('detaching the last scope saves the file unassigned and restoration does not duplicate links', () => {
 const state = draft({ logRows: [row('students')], files: [file('photo')] })
 const detached = { ...state, ...setLogFileRow(state, 'photo', 'students', false) }
 assert.deepEqual(detached.files[0].rowIds, [])
 assert.equal(validateAll(detached), null)
 assert.deepEqual(buildLogPlan(detached).evidence[0].claimKeys, [])
 const restored = { ...detached, ...setLogFileRow(detached, 'photo', 'students', true) }
 const repeated = { ...restored, ...setLogFileRow(restored, 'photo', 'students', true) }
 assert.deepEqual(repeated.files[0].rowIds, ['students'])
 assert.equal(buildLogPlan(repeated).evidence[0].claimKeys.length, 1)
 assert.deepEqual(setLogFileRow(state, 'photo', 'missing', false), {})
})

test('new uploads follow all scopes after other files have custom assignments', () => {
 const state = draft({ files: [file('photo')] })
 const changed = { ...state, ...setLogFileRow(state, 'photo', 'students', false) }
 const added = { ...changed, files: [...changed.files, file('new')] }
 assert.deepEqual(fileRows(added, added.files[0]).map(r => r.id), ['kits'])
 assert.deepEqual(fileRows(added, added.files[1]).map(r => r.id), ['students', 'kits'])
 const unchanged = { ...added, ...setLogFileRow(added, 'new', 'students', true) }
 assert.equal(unchanged.files[1].rowIds, undefined)
})

test('shared changes propagate field by field while explicit empty overrides stay empty', () => {
 const custom = { ...row('students'), overrides: { evidenceTitle: '', locationIds: ['north'] } }
 const state = draft({ evidenceTitle: 'Updated title', dateSingle: '2026-10-02', evidenceDescription: 'Updated notes', logRows: [custom] })
 assert.equal(rowDetails(state, custom).evidenceTitle, '')
 assert.equal(rowDetails(state, custom).dateSingle, '2026-10-02')
 assert.equal(rowDetails(state, custom).evidenceDescription, 'Updated notes')
 assert.deepEqual(rowDetails(state, custom).locationIds, ['north'])
 assert.equal(rowDetails(state, { ...custom, overrides: {} }).evidenceTitle, 'Updated title')
})

test('each file keeps its own assignment; unassigned never acquires result links', () => {
 const state = draft({ files: [file('all'), file('students', ['students']), file('later', [])] })
 const plan = buildLogPlan(state)
 assert.equal(plan.evidence.length, 3)
 assert.deepEqual(plan.evidence.map(e => e.payload.kpi_ids), [['kits', 'students'], ['students'], []])
 assert.deepEqual(plan.evidence.map(e => e.claimKeys.length), [2, 1, 0])
 const withNewRow = { ...state, logRows: [...state.logRows!, row('sessions')] }
 assert.equal(fileRows(withNewRow, state.files[0]).length, 3)
 assert.equal(fileRows(withNewRow, state.files[1]).length, 1)
})

test('a file scope overrides its evidence record without changing results or other files', () => {
 const state = draft({ files: [file('photo'), { ...file('receipt'), overrides: { evidenceTitle: 'Kit receipts', locationIds: ['north'], dateSingle: '2026-09-30' } }] })
 const plan = buildLogPlan(state)
 assert.deepEqual(plan.evidence.map(e => [e.payload.title, e.payload.location_ids, e.payload.date_represented]), [
  ['October workshop', ['centre'], '2026-10-01'], ['Kit receipts', ['north'], '2026-09-30'],
 ])
 assert.deepEqual(plan.evidence[1].claimKeys, plan.evidence[0].claimKeys)
 assert.ok(plan.claims.every(c => c.payload.location_id === 'centre'))
})

test('a shared upload is separated across differing scopes without broad cross-product matches', () => {
 const state = draft({ logRows: [row('students'), { ...row('kits'), overrides: { locationIds: ['north'], dateSingle: '2026-10-02' } }], files: [file('shared')] })
 const plan = buildLogPlan(state)
 assert.equal(plan.evidence.length, 2)
 assert.deepEqual(plan.evidence.map(e => [e.payload.kpi_ids, e.payload.location_ids, e.payload.date_represented]), [
  [['students'], ['centre'], '2026-10-01'], [['kits'], ['north'], '2026-10-02'],
 ])
 assert.equal(plan.evidence[0].payload.file_url, plan.evidence[1].payload.file_url)
 assert.equal(plan.evidence[0].claimKeys.length, 1)
})

test('multiple scopes for the same metric produce distinct results and retry keys', () => {
 const state = draft({ logRows: [row('a', 'students'), { ...row('b', 'students'), overrides: { locationIds: ['north'] } }] })
 const plan = buildLogPlan(state)
 assert.equal(new Set(plan.claims.map(c => c.key)).size, 2)
 assert.deepEqual(plan.claims.map(c => c.payload.location_id), ['centre', 'north'])
 assert.equal(validateAll(state), null)
})

test('review includes automatic connections between overlapping scopes of the same metric', () => {
 const state = draft({ logRows: [row('a', 'students'), row('b', 'students'), { ...row('c', 'students'), overrides: { locationIds: ['north'] } }], files: [file('selected', ['a'])] })
 const plan = buildLogPlan(state)
 assert.equal(plan.evidence[0].claimKeys.length, 1)
 assert.deepEqual(matchingLogClaimKeys(plan.claims, plan.evidence[0]), [plan.claims[0].key, plan.claims[1].key])
})

test('tag allocation totals are checked, including blank, zero and decimal values', () => {
 const entry = { ...row('students'), value: '0.3', tagValues: { a: '0.1', b: '0.2' } }
 const state = draft({ tagIds: ['a', 'b'], logRows: [entry] })
 assert.equal(validateAll(state), null)
 assert.deepEqual(buildLogPlan(state).claims.map(c => [c.payload.tag_id, c.payload.value]), [['a', 0.1], ['b', 0.2]])
 assert.match(validateAll({ ...state, logRows: [{ ...entry, value: '10' }] })!, /add up/)
 assert.match(validateAll({ ...state, logRows: [{ ...entry, tagValues: { a: '0.3' } }] })!, /every tag/)
 assert.equal(validateAll({ ...state, logRows: [{ ...entry, value: '0', tagValues: { a: '0', b: '0' } }] }), null)
 assert.match(validateAll({ ...state, logRows: [{ ...entry, tagValues: { a: 'Infinity', b: '0' } }] })!, /finite numbers/)
})

test('evidence only, results only, scoped overrides and unfinished uploads validate independently', () => {
 assert.equal(validateAll(draft({ logRows: [], files: [file('later')] })), null)
 assert.match(validateAll(draft({ logRows: [], locationIds: [], files: [file('later')] }))!, /location for the evidence/)
 assert.equal(validateAll(draft({ logRows: [], locationIds: [], files: [{ ...file('later'), overrides: { locationIds: ['north'] } }] })), null)
 assert.equal(validateAll(draft({ logRows: [{ ...row('zero'), value: '0' }], evidenceTitle: '' })), null)
 assert.match(validateAll(draft({ logRows: [] }))!, /Add files/)
 assert.match(validateAll(draft({ files: [{ ...file('pending'), status: 'uploading' }] }))!, /finish/)
 assert.match(validateAll(draft({ files: [{ ...file('failed'), status: 'error' }] }))!, /retry/)
 assert.match(validateAll(draft({ logRows: [{ ...row('students'), overrides: { dateMode: 'range', dateStart: '2026-10-02', dateEnd: '2026-10-01' } }] }))!, /reversed/)
 assert.match(validateAll(draft({ logRows: [{ ...row('students'), overrides: { locationIds: [] } }] }))!, /one location/)
 assert.match(validateAll(draft(), [{ id: 'other' }])!, /no longer available/)
})

test('blank metric cards classify evidence without creating zero-valued results', () => {
 const state = draft({ logRows: [newLogRow('students', 's')], files: [file('photo')] })
 assert.equal(buildLogPlan(state).claims.length, 0)
 assert.deepEqual(buildLogPlan(state).evidence[0].payload.kpi_ids, ['students'])
 assert.equal(validateAll(state), null)
})

test('removing the last explicitly assigned metric leaves evidence unassigned', () => {
 const state = draft({ logRows: [], files: [file('photo', ['removed'])] })
 assert.deepEqual(buildLogPlan(state).evidence[0].payload.kpi_ids, [])
 assert.deepEqual(buildLogPlan(state).evidence[0].claimKeys, [])
})

test('save retries skip confirmed results and evidence and pin only selected results', async () => {
 const state = draft({ files: [file('students', ['students']), file('kits', ['kits'])] })
 const plan = buildLogPlan(state, 'program')
 const progress: LogSaveProgress = { claims: new Map(), evidence: new Set(), ownedUrls: new Set() }
 const claims: string[] = []
 const evidencePayloads: any[] = []
 let fail = true
 const api = {
  async createKPIUpdatesBatch(updates: any[]) { return updates.map(u => { claims.push(u.kpi_id); return { id: `saved-${u.kpi_id}`, kpi_id: u.kpi_id } }) },
  async createEvidence(payload: any) {
   if (payload.kpi_ids.includes('kits') && fail) { fail = false; throw new Error('Temporary failure') }
   evidencePayloads.push(payload)
   return { id: `evidence-${evidencePayloads.length}` }
  },
 }
 await assert.rejects(saveLogPlan(plan, api, progress, () => {}), /Temporary failure/)
 assert.equal(progress.claims.size, 2)
 assert.equal(progress.evidence.size, 1)
 assert.deepEqual([...progress.ownedUrls], ['https://example.test/students.jpg'])
 const reports: number[][] = []
 await saveLogPlan(plan, api, progress, (saved, total) => reports.push([saved, total]))
 assert.deepEqual(claims, ['students', 'kits'])
 assert.equal(evidencePayloads.length, 2)
 assert.deepEqual(evidencePayloads.map(e => e.kpi_update_ids), [['saved-students'], ['saved-kits']])
 assert.deepEqual(reports.at(-1), [4, 4])
})

test('batched results map back to the right scope when one metric has several scopes', async () => {
 const state = draft({ logRows: [row('s1', 'students'), row('k1', 'kits'), { ...row('s2', 'students'), value: '7', overrides: { locationIds: ['north'] } }], files: [file('north', ['s2'])] })
 const plan = buildLogPlan(state, 'program')
 const progress: LogSaveProgress = { claims: new Map(), evidence: new Set(), ownedUrls: new Set() }
 let linked: string[] = []
 await saveLogPlan(plan, {
  // Mirrors the server: rows come back grouped by metric in first-seen order.
  async createKPIUpdatesBatch(updates) {
   const order = [...new Set(updates.map(u => u.kpi_id))]
   return order.flatMap(kpi => updates.filter(u => u.kpi_id === kpi)).map(u => ({ id: `${u.kpi_id}-${u.value}`, kpi_id: u.kpi_id }))
  },
  async createEvidence(payload) { linked = payload.kpi_update_ids || []; return { id: 'evidence' } },
 }, progress, () => {})
 const byRow = Object.fromEntries(plan.claims.map(c => [c.rowId, progress.claims.get(c.key)]))
 assert.deepEqual(byRow, { s1: 'students-10', k1: 'kits-10', s2: 'students-7' })
 assert.deepEqual(linked, ['students-7'])
})

test('a failed evidence save waits for the others before reporting', async () => {
 const state = draft({ files: [file('a', ['students']), { ...file('b', ['kits']), type: 'documentation' }, { ...file('c', ['kits']), type: 'financials' }] })
 const plan = buildLogPlan(state, 'program')
 const progress: LogSaveProgress = { claims: new Map(), evidence: new Set(), ownedUrls: new Set() }
 let finished = 0
 await assert.rejects(saveLogPlan(plan, {
  async createKPIUpdatesBatch(updates) { return updates.map(u => ({ id: `id-${u.kpi_id}`, kpi_id: u.kpi_id })) },
  async createEvidence(payload) {
   if (payload.type === 'visual_proof') throw new Error('Boom')
   await new Promise(r => setTimeout(r, 20))
   finished++
   return { id: payload.type }
  },
 }, progress, () => {}), /Boom/)
 assert.equal(finished, plan.evidence.length - 1)
 assert.equal(progress.evidence.size, plan.evidence.length - 1)
})

test('evidence added from a result preserves the explicit pin even with no new result', async () => {
 const plan = buildLogPlan(draft({ logRows: [newLogRow('students', 's')], files: [file('photo')] }))
 let pinned: string[] = []
 await saveLogPlan(plan, {
  async createKPIUpdatesBatch() { throw new Error('No new claim expected') },
  async createEvidence(payload) { pinned = payload.kpi_update_ids || []; return { id: 'evidence' } },
 }, { claims: new Map(), evidence: new Set(), ownedUrls: new Set() }, () => {}, 'existing-result')
 assert.deepEqual(pinned, ['existing-result'])
})

test('field issues point at the scope that owns the missing value', () => {
 const state = draft({
  locationIds: [],
  logRows: [row('students'), { ...row('kits'), value: '', keepForEvidence: true, overrides: { evidenceTitle: '' } }],
  files: [file('photo', ['kits']), { ...file('receipt', ['students']), overrides: { dateSingle: '' } }],
 })
 const issues = logFieldIssues(state)
 assert.deepEqual(issues.shared, ['location'])
 assert.deepEqual(issues.rows, { kits: ['title'] })
 assert.deepEqual(issues.files, { receipt: ['date'] })
})

test('evidence-only logs need a metric tag when metrics exist', () => {
 assert.match(evidenceMetricError(draft({ logRows: [], files: [file('photo')] }), 3)!, /at least one metric/)
 assert.equal(evidenceMetricError(draft({ logRows: [], files: [file('photo')] }), 0), null)
 assert.equal(evidenceMetricError(draft({ logRows: [{ ...newLogRow('students', 's'), keepForEvidence: true }], files: [file('photo')] }), 3), null)
})
