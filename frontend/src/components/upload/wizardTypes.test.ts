// Run from the repo root: node -r sucrase/register --test frontend/src/components/upload/wizardTypes.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
 INITIAL_WIZARD_STATE, WizardState, evidenceBuckets, validateAll,
 wizardClaims, wizardEvidenceMetricIds, wizardHasClaims, wizardHasEvidence,
} from './wizardTypes'

const draft = (patch: Partial<WizardState> = {}): WizardState => ({
 ...INITIAL_WIZARD_STATE,
 entryMode: true,
 kind: 'evidence',
 dateSingle: '2026-09-18',
 ...patch,
})
const files: WizardState['files'] = [
 { id: 'photo', name: 'Workshop.jpg', size: 512, status: 'done', progress: 100, url: 'https://example.test/photo.jpg', type: 'visual_proof' },
 { id: 'document', name: 'Attendance.pdf', size: 512, status: 'done', progress: 100, url: 'https://example.test/attendance.pdf', type: 'documentation' },
]
const entries = {
 students: { value: '24', label: '', note: '' },
 workshops: { value: '1', label: '', note: '' },
}

test('field staff can save evidence before assigning a metric or location', () => {
 const state = draft({ evidenceTitle: 'Workshop', files })
 assert.equal(validateAll(state), null)
 assert.equal(wizardHasClaims(state), false)
 assert.equal(wizardHasEvidence(state), true)
 assert.deepEqual(wizardEvidenceMetricIds(state), [])
 assert.equal(evidenceBuckets(state.files).length, 2)
})

test('multiple results can be saved without evidence; zero is a valid result', () => {
 const state = draft({ claimEntries: { ...entries, attendance: { value: '0', label: '', note: '' } }, locationIds: ['centre'] })
 assert.equal(validateAll(state), null)
 assert.equal(wizardHasEvidence(state), false)
 assert.equal(wizardClaims(state).length, 3)
})

test('combined entry includes the result metrics and explicitly chosen evidence metrics once', () => {
 const state = draft({ files, evidenceTitle: 'Workshop', claimEntries: entries, locationIds: ['centre'], evidenceKpiIds: ['students', 'employment'] })
 assert.equal(validateAll(state), null)
 assert.deepEqual(wizardEvidenceMetricIds(state), ['students', 'employment', 'workshops'])
})

test('empty or invalid entries cannot be saved', () => {
 assert.match(validateAll(draft())!, /Add files or enter a result/)
 assert.match(validateAll(draft({ claimEntries: entries }))!, /location/)
 assert.match(validateAll(draft({ claimEntries: entries, locationIds: ['a', 'b'] }))!, /one location/)
 assert.match(validateAll(draft({ claimEntries: entries, locationIds: ['a'], tagIds: ['a', 'b'] }))!, /one tag/)
 assert.match(validateAll(draft({ claimEntries: { students: { value: 'Infinity', label: '', note: '' } } }))!, /numbers/)
 assert.match(validateAll(draft({ files, evidenceTitle: 'Workshop', dateMode: 'range', dateStart: '2026-09-18', dateEnd: '2026-09-01' }))!, /reversed/)
})

test('unfinished and failed uploads block review even when results are filled', () => {
 for (const status of ['uploading', 'error'] as const) {
  const state = draft({ files: [{ ...files[0], status }], evidenceTitle: 'Workshop', claimEntries: entries, locationIds: ['centre'] })
  assert.match(validateAll(state)!, status === 'uploading' ? /finish/ : /retry/)
 }
})

test('removing results restores an evidence-only entry without stale implied metric links', () => {
 const state = draft({ files, evidenceTitle: 'Workshop', claimEntries: { students: { value: '', label: 'Draft', note: '' } } })
 assert.equal(validateAll(state), null)
 assert.deepEqual(wizardClaims(state), [])
 assert.deepEqual(wizardEvidenceMetricIds(state), [])
})

test('existing claim editing still uses the single result and requires its location', () => {
 const state = draft({ entryMode: false, editing: true, kind: 'claim', claimKpiId: 'students', claimValue: '5', locationIds: ['centre'] })
 assert.equal(validateAll(state), null)
 assert.deepEqual(wizardClaims(state).map(c => [c.kpiId, c.value]), [['students', '5']])
 assert.match(validateAll({ ...state, locationIds: [] })!, /location/)
})

test('captured evidence can be edited while still awaiting classification', () => {
 const state = draft({ entryMode: false, editing: true, kind: 'evidence', evidenceTitle: 'Workshop', files })
 assert.equal(validateAll(state), null)
})
