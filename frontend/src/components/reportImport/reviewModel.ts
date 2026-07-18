import { ExtractedSuggestions, OrganizationContext } from '../../types'
import { ApplyInput, ApplyInitiative } from './applyImport'

/**
 * The editable review model sits between the raw AI suggestions and the apply
 * step. Every item carries an `include` flag (the user opts items in/out) and,
 * for metrics/groups, a `targetKey` naming the initiative to attach to.
 */

export interface ReviewOrg {
  include: boolean
  statement: string
  description: string
  website_url: string
  donation_url: string
}

export interface ReviewContext {
  includeProblem: boolean
  problem_statement: string
  includeToc: boolean
  theory_of_change: string
  includeAdditional: boolean
  additional_info: string
  strategies: { include: boolean; title: string; description: string }[]
  stats: { include: boolean; type: 'stat' | 'statement'; value: string; title: string; description: string; source: string }[]
}

export interface ReviewLocation { include: boolean; name: string; country: string }
export interface ReviewInitiative { key: string; include: boolean; title: string; description: string; region: string }
export interface ReviewMetric {
  include: boolean
  title: string
  description: string
  unit_of_measurement: string
  metric_type: 'number' | 'percentage'
  category: 'input' | 'output' | 'impact'
  value: number | null
  period_start: string
  period_end: string
  period_label: string
  tags: string[]
  targetKey: string
}
export interface ReviewGroup {
  include: boolean
  name: string
  description: string
  total_number: number | null
  age_range_start: number | null
  age_range_end: number | null
  targetKey: string
}

export interface ReviewState {
  org: ReviewOrg
  context: ReviewContext
  locations: ReviewLocation[]
  initiatives: ReviewInitiative[]
  metrics: ReviewMetric[]
  groups: ReviewGroup[]
}

export interface ExistingData {
  org?: { statement?: string; description?: string; website_url?: string; donation_url?: string }
  context?: OrganizationContext | null
  initiatives: { id: string; title: string }[]
}

/**
 * Scope controls which sections are in play.
 *  - 'organization' (default): everything — used during onboarding.
 *  - 'initiative': only metrics, beneficiary groups and locations, all attached
 *    to the given initiative — used inside an existing initiative.
 */
export interface ScopeOptions {
  scope?: 'organization' | 'initiative'
  initiativeId?: string
}

const EMPTY_CONTEXT: ReviewContext = {
  includeProblem: false, problem_statement: '',
  includeToc: false, theory_of_change: '',
  includeAdditional: false, additional_info: '',
  strategies: [], stats: [],
}

const prefer = (suggested?: string, existing?: string) =>
  (suggested && suggested.trim()) ? suggested.trim() : (existing || '')

/** Build the editable review state from extracted suggestions + what already exists. */
export function buildReviewState(
  s: ExtractedSuggestions,
  existing: ExistingData,
  scopeOpts: ScopeOptions = {},
): ReviewState {
  const initiatives: ReviewInitiative[] = (s.initiatives || []).map((i, idx) => ({
    key: `new:${idx}`,
    include: true,
    title: i.title || '',
    description: i.description || '',
    region: i.region || '',
  }))

  // Resolve a sensible default initiative target for a suggested attachment.
  const defaultTargetKey = (suggestedTitle?: string): string => {
    const t = (suggestedTitle || '').trim().toLowerCase()
    if (t) {
      const newMatch = initiatives.find(i => i.title.trim().toLowerCase() === t)
      if (newMatch) return newMatch.key
      const existMatch = existing.initiatives.find(i => i.title.trim().toLowerCase() === t)
      if (existMatch) return `exist:${existMatch.id}`
    }
    if (initiatives.length > 0) return initiatives[0].key
    if (existing.initiatives.length > 0) return `exist:${existing.initiatives[0].id}`
    return ''
  }

  const state: ReviewState = {
    org: {
      include: !!(s.organization?.statement || s.organization?.description || s.organization?.website_url || s.organization?.donation_url),
      statement: prefer(s.organization?.statement, existing.org?.statement),
      description: prefer(s.organization?.description, existing.org?.description),
      website_url: prefer(s.organization?.website_url, existing.org?.website_url),
      donation_url: prefer(s.organization?.donation_url, existing.org?.donation_url),
    },
    context: {
      includeProblem: !!s.context?.problem_statement,
      problem_statement: prefer(s.context?.problem_statement, existing.context?.problem_statement),
      includeToc: !!s.context?.theory_of_change,
      theory_of_change: prefer(s.context?.theory_of_change, existing.context?.theory_of_change),
      includeAdditional: !!s.context?.additional_info,
      additional_info: prefer(s.context?.additional_info, existing.context?.additional_info),
      strategies: (s.context?.strategies || []).map(st => ({
        include: true, title: st.title || '', description: st.description || '',
      })),
      stats: (s.context?.stats_and_statements || []).map(c => ({
        include: true,
        type: c.type === 'stat' ? 'stat' : 'statement',
        value: c.value || '',
        title: c.title || '',
        description: c.description || '',
        source: c.source || '',
      })),
    },
    locations: (s.locations || []).map(l => ({ include: true, name: l.name || '', country: l.country || '' })),
    initiatives,
    metrics: (s.metrics || []).map(m => ({
      include: true,
      title: m.title || '',
      description: m.description || '',
      unit_of_measurement: m.unit_of_measurement || '',
      metric_type: m.metric_type === 'percentage' ? 'percentage' : 'number',
      category: (['input', 'output', 'impact'].includes(m.category) ? m.category : 'output') as ReviewMetric['category'],
      value: typeof m.value === 'number' ? m.value : null,
      period_start: m.period_start || '',
      period_end: m.period_end || '',
      period_label: m.period_label || '',
      tags: m.tags || [],
      targetKey: defaultTargetKey(m.initiative),
    })),
    groups: (s.beneficiary_groups || []).map(g => ({
      include: true,
      name: g.name || '',
      description: g.description || '',
      total_number: g.total_number ?? null,
      age_range_start: g.age_range_start ?? null,
      age_range_end: g.age_range_end ?? null,
      targetKey: defaultTargetKey(g.initiative),
    })),
  }

  // Initiative scope: drop org-level sections and pin every metric/group to the
  // current initiative.
  if (scopeOpts.scope === 'initiative' && scopeOpts.initiativeId) {
    const tk = `exist:${scopeOpts.initiativeId}`
    state.org.include = false
    state.context = { ...EMPTY_CONTEXT }
    state.initiatives = []
    state.metrics = state.metrics.map(m => ({ ...m, targetKey: tk }))
    state.groups = state.groups.map(g => ({ ...g, targetKey: tk }))
  }

  return state
}

/** Initiative dropdown options for metric/group attachment. */
export function initiativeOptions(
  state: ReviewState,
  existingInitiatives: { id: string; title: string }[]
): { key: string; label: string }[] {
  const opts: { key: string; label: string }[] = []
  state.initiatives.filter(i => i.include && i.title.trim()).forEach(i => {
    opts.push({ key: i.key, label: `${i.title} (new)` })
  })
  existingInitiatives.forEach(i => {
    opts.push({ key: `exist:${i.id}`, label: i.title })
  })
  return opts
}

/** Convert the reviewed state into the apply payload (include-filtered). */
export function toApplyInput(
  state: ReviewState,
  orgId: string,
  existingInitiatives: { id: string; title: string }[],
  scopeOpts: ScopeOptions = {},
): ApplyInput {
  const linkLocationsToInitiativeId =
    scopeOpts.scope === 'initiative' ? scopeOpts.initiativeId : undefined
  const org = state.org.include
    ? {
        statement: state.org.statement || undefined,
        description: state.org.description || undefined,
        website_url: state.org.website_url || undefined,
        donation_url: state.org.donation_url || undefined,
      }
    : undefined

  const ctx = state.context
  const hasContext =
    (ctx.includeProblem && ctx.problem_statement.trim()) ||
    (ctx.includeToc && ctx.theory_of_change.trim()) ||
    (ctx.includeAdditional && ctx.additional_info.trim()) ||
    ctx.strategies.some(s => s.include && s.title.trim()) ||
    ctx.stats.some(s => s.include && (s.type === 'stat' ? s.value.trim() : s.title.trim() || s.description.trim()))

  const context = hasContext
    ? {
        problem_statement: ctx.includeProblem ? ctx.problem_statement || undefined : undefined,
        theory_of_change: ctx.includeToc ? ctx.theory_of_change || undefined : undefined,
        additional_info: ctx.includeAdditional ? ctx.additional_info || undefined : undefined,
        strategies: ctx.strategies.filter(s => s.include && s.title.trim()).map(s => ({ title: s.title, description: s.description })),
        stats_and_statements: ctx.stats
          .filter(s => s.include && (s.type === 'stat' ? s.value.trim() : s.title.trim() || s.description.trim()))
          .map(s => ({ type: s.type, value: s.value, title: s.title, description: s.description, source: s.source })),
      }
    : undefined

  const initiatives: ApplyInitiative[] = state.initiatives
    .filter(i => i.include && i.title.trim())
    .map(i => ({ key: i.key, title: i.title, description: i.description, region: i.region }))

  return {
    orgId,
    organization: org,
    context,
    locations: state.locations.filter(l => l.include && l.name.trim()).map(l => ({ name: l.name, country: l.country || undefined })),
    initiatives,
    metrics: state.metrics
      .filter(m => m.include && m.title.trim() && m.unit_of_measurement.trim())
      .map(m => ({
        title: m.title,
        description: m.description || undefined,
        unit_of_measurement: m.unit_of_measurement,
        metric_type: m.metric_type,
        category: m.category,
        value: m.value ?? undefined,
        period_start: m.period_start || undefined,
        period_end: m.period_end || undefined,
        period_label: m.period_label || undefined,
        tags: m.tags,
        targetKey: m.targetKey,
      })),
    groups: state.groups
      .filter(g => g.include && g.name.trim())
      .map(g => ({
        name: g.name,
        description: g.description || undefined,
        total_number: g.total_number,
        age_range_start: g.age_range_start,
        age_range_end: g.age_range_end,
        targetKey: g.targetKey,
      })),
    existingInitiatives,
    linkLocationsToInitiativeId,
  }
}

/** Count how many items are currently opted in (for the apply button label). */
export function countSelected(state: ReviewState): number {
  let n = 0
  if (state.org.include) n++
  const c = state.context
  if (c.includeProblem && c.problem_statement.trim()) n++
  if (c.includeToc && c.theory_of_change.trim()) n++
  if (c.includeAdditional && c.additional_info.trim()) n++
  n += c.strategies.filter(s => s.include && s.title.trim()).length
  n += c.stats.filter(s => s.include && (s.type === 'stat' ? s.value.trim() : s.title.trim() || s.description.trim())).length
  n += state.locations.filter(l => l.include && l.name.trim()).length
  n += state.initiatives.filter(i => i.include && i.title.trim()).length
  n += state.metrics.filter(m => m.include && m.title.trim() && m.unit_of_measurement.trim()).length
  n += state.groups.filter(g => g.include && g.name.trim()).length
  return n
}
