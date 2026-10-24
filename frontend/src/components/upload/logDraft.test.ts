// node -r sucrase/register --test frontend/src/components/upload/logDraft.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { INITIAL_WIZARD_STATE, WizardState, validateAll } from './wizardTypes'
import { buildLogPlan, fileRows, newLogRow, rowDetails, saveLogPlan, LogSaveProgress, matchingLogClaimKeys, setLogRowResult, hasAdvancedLogSettings } from './logDraft'

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

test('simple and advanced views save the same scopes, amounts and file assignments', () => {
 assert.equal(hasAdvancedLogSettings(draft()), false)
 const state = draft({
  logRows: [row('students'), { ...row('north', 'students'), overrides: { locationIds: ['north'] } }],
  files: [file('all'), file('selected', ['north']), file('unassigned', [])],
 })
 assert.equal(hasAdvancedLogSettings(state), true)
 assert.equal(hasAdvancedLogSettings(draft({ logRows: [row('a', 'students'), row('b', 'students')] })), true)
 assert.equal(hasAdvancedLogSettings(draft({ files: [file('unassigned', [])] })), true)
 assert.deepEqual(buildLogPlan({ ...state, logMode: 'simple' }), buildLogPlan({ ...state, logMode: 'advanced' }))
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
 assert.equal(validateAll(draft({ logRows: [], locationIds: [], files: [file('later')] })), null)
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
  async createKPIUpdate(id: string) { claims.push(id); return { id: `saved-${id}` } },
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

test('evidence added from a result preserves the explicit pin even with no new result', async () => {
 const plan = buildLogPlan(draft({ logRows: [newLogRow('students', 's')], files: [file('photo')] }))
 let pinned: string[] = []
 await saveLogPlan(plan, {
  async createKPIUpdate() { throw new Error('No new claim expected') },
  async createEvidence(payload) { pinned = payload.kpi_update_ids || []; return { id: 'evidence' } },
 }, { claims: new Map(), evidence: new Set(), ownedUrls: new Set() }, () => {}, 'existing-result')
 assert.deepEqual(pinned, ['existing-result'])
})
