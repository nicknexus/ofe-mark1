import { apiService } from '../../services/api'
import {
  ExtractedLocation,
  ExtractedMetric,
  ExtractedBeneficiaryGroup,
  OrganizationContext,
  StatCard,
  Strategy,
  Initiative,
} from '../../types'

/**
 * Apply reviewed annual-report suggestions to the real data model, in
 * dependency order (org → context → locations → initiatives → metrics+groups).
 * Reuses the same create endpoints the manual wizard uses. Per-item failures
 * are collected, never fatal.
 *
 * Initiative references on metrics/groups use a target token:
 *   "exist:<initiativeId>"  → an initiative that already exists
 *   anything else           → the `key` of a suggested initiative created here
 */

export interface ApplyInitiative {
  key: string
  title: string
  description?: string
  region?: string
}

export interface ApplyInput {
  orgId: string
  organization?: {
    statement?: string
    description?: string
    website_url?: string
    donation_url?: string
  }
  context?: {
    problem_statement?: string
    theory_of_change?: string
    additional_info?: string
    strategies?: { title: string; description?: string }[]
    stats_and_statements?: { type: 'stat' | 'statement'; value?: string; title: string; description?: string; source?: string }[]
  }
  locations: ExtractedLocation[]
  initiatives: ApplyInitiative[]
  metrics: (ExtractedMetric & { targetKey: string })[]
  groups: (ExtractedBeneficiaryGroup & { targetKey: string })[]
  existingInitiatives: { id: string; title: string }[]
  /** When set, created locations are linked to this initiative (initiative scope). */
  linkLocationsToInitiativeId?: string
}

export interface ApplyResult {
  counts: {
    organization: number
    context: number
    locations: number
    initiatives: number
    metrics: number
    dataPoints: number
    groups: number
  }
  errors: string[]
}

function rid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** One-shot forward geocode for a place name (matches persistSection). */
async function geocode(name: string): Promise<{ lat: number; lng: number; country?: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&limit=1&addressdetails=1`,
      { headers: { 'User-Agent': 'OFE App' } }
    )
    const data = await res.json()
    const hit = data?.[0]
    if (!hit) return null
    return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), country: hit.address?.country }
  } catch {
    return null
  }
}

/** Ensure tags exist by name, returning a lowercased-name → id map. */
async function ensureTags(names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = Array.from(new Set(names.map(n => n.trim()).filter(Boolean)))
  if (unique.length === 0) return map
  try {
    const existing = await apiService.getMetricTags()
    existing.forEach(t => map.set(t.name.toLowerCase(), t.id))
  } catch { /* non-fatal */ }
  for (const name of unique) {
    if (map.has(name.toLowerCase())) continue
    try {
      const created = await apiService.createMetricTag(name)
      map.set(name.toLowerCase(), created.id)
    } catch { /* skip */ }
  }
  return map
}

export async function applyImport(input: ApplyInput): Promise<ApplyResult> {
  const errors: string[] = []
  const counts = {
    organization: 0,
    context: 0,
    locations: 0,
    initiatives: 0,
    metrics: 0,
    dataPoints: 0,
    groups: 0,
  }

  // 1. Organization profile -------------------------------------------------
  if (input.organization) {
    const o = input.organization
    const payload: Record<string, string> = {}
    if (o.statement?.trim()) payload.statement = o.statement.trim().slice(0, 150)
    if (o.description?.trim()) payload.description = o.description.trim()
    if (o.website_url?.trim()) payload.website_url = o.website_url.trim()
    if (o.donation_url?.trim()) payload.donation_url = o.donation_url.trim()
    if (Object.keys(payload).length > 0) {
      try {
        await apiService.updateOrganization(input.orgId, payload)
        counts.organization = 1
      } catch {
        errors.push('organization profile')
      }
    }
  }

  // 2. Organization context (merge with existing arrays) --------------------
  if (input.context) {
    const c = input.context
    let existing: OrganizationContext | null = null
    try {
      existing = await apiService.getOrgContext(input.orgId)
    } catch { /* treat as empty */ }

    const payload: Partial<OrganizationContext> = {}

    if (c.problem_statement?.trim()) payload.problem_statement = c.problem_statement.trim()
    if (c.theory_of_change?.trim()) payload.theory_of_change = c.theory_of_change.trim()
    if (c.additional_info?.trim()) payload.additional_info = c.additional_info.trim()

    const newStrategies = (c.strategies || [])
      .filter(s => s.title?.trim())
      .map<Strategy>(s => ({ id: rid(), title: s.title.trim(), description: (s.description || '').trim() }))
    if (newStrategies.length > 0) {
      payload.strategies = [...(existing?.strategies || []), ...newStrategies].slice(0, 12)
    }

    const newStats = (c.stats_and_statements || [])
      .filter(s => (s.type === 'stat' ? s.value?.trim() : (s.title?.trim() || s.description?.trim())))
      .map<StatCard>(s => ({
        id: rid(),
        type: s.type,
        value: s.type === 'stat' ? (s.value || '').trim() : '',
        title: (s.title || '').trim(),
        description: (s.description || '').trim(),
        source: (s.source || '').trim(),
        created_at: new Date().toISOString(),
      }))
    if (newStats.length > 0) {
      payload.stats_and_statements = [...(existing?.stats_and_statements || []), ...newStats].slice(0, 12)
    }

    if (Object.keys(payload).length > 0) {
      try {
        await apiService.updateOrgContext(input.orgId, payload)
        counts.context = 1
      } catch {
        errors.push('organization context')
      }
    }
  }

  // 3. Locations ------------------------------------------------------------
  for (const loc of input.locations) {
    if (!loc.name?.trim()) continue
    const geo = await geocode(loc.name)
    if (!geo) { errors.push(`location "${loc.name}" (no coordinates found)`); continue }
    try {
      await apiService.createLocation({
        name: loc.name.trim(),
        latitude: geo.lat,
        longitude: geo.lng,
        country: loc.country || geo.country || undefined,
        initiative_id: input.linkLocationsToInitiativeId || undefined,
      })
      counts.locations++
    } catch {
      errors.push(`location "${loc.name}"`)
    }
  }

  // 4. Initiatives — build a key → id map for metric/group attachment -------
  const keyToInitiativeId = new Map<string, string>()
  for (const init of input.existingInitiatives) {
    keyToInitiativeId.set(`exist:${init.id}`, init.id)
  }
  for (const init of input.initiatives) {
    if (!init.title?.trim()) continue
    try {
      const created: Initiative = await apiService.createInitiative({
        title: init.title.trim(),
        description: (init.description || init.title).trim(),
        region: init.region?.trim() || undefined,
      })
      if (created.id) keyToInitiativeId.set(init.key, created.id)
      counts.initiatives++
    } catch (e: any) {
      errors.push(`initiative "${init.title}"${e?.message ? ` — ${e.message}` : ''}`)
    }
  }

  const resolveInitiative = (targetKey: string): string | undefined => {
    if (keyToInitiativeId.has(targetKey)) return keyToInitiativeId.get(targetKey)
    // Fallback: first available initiative so a metric/group is never orphaned.
    const first = keyToInitiativeId.values().next()
    return first.done ? undefined : first.value
  }

  // 5. Metrics (+ optional first data point) --------------------------------
  const tagMap = await ensureTags(input.metrics.flatMap(m => m.tags || []))
  for (const m of input.metrics) {
    if (!m.title?.trim() || !m.unit_of_measurement?.trim()) continue
    const initiativeId = resolveInitiative(m.targetKey)
    if (!initiativeId) { errors.push(`metric "${m.title}" (no initiative to attach to)`); continue }
    const tag_ids = (m.tags || [])
      .map(t => tagMap.get(t.trim().toLowerCase()))
      .filter((id): id is string => !!id)
    try {
      const created = await apiService.createKPI({
        title: m.title.trim(),
        description: (m.description || m.title).trim(),
        unit_of_measurement: m.unit_of_measurement.trim(),
        metric_type: m.metric_type,
        category: m.category,
        initiative_id: initiativeId,
        tag_ids,
      })
      counts.metrics++

      // If the report stated a value, also seed an initial data point.
      if (created.id && typeof m.value === 'number' && Number.isFinite(m.value)) {
        const dateRepresented = m.period_end || m.period_start || new Date().toISOString().slice(0, 10)
        try {
          await apiService.createKPIUpdate(created.id, {
            value: m.value,
            date_represented: dateRepresented,
            date_range_start: m.period_start || undefined,
            date_range_end: m.period_end || undefined,
            label: m.period_label || undefined,
            note: 'Imported from annual report',
          } as any)
          counts.dataPoints++
        } catch {
          errors.push(`data point for "${m.title}"`)
        }
      }
    } catch {
      errors.push(`metric "${m.title}"`)
    }
  }

  // 6. Beneficiary groups ---------------------------------------------------
  for (const g of input.groups) {
    if (!g.name?.trim()) continue
    const initiativeId = resolveInitiative(g.targetKey)
    if (!initiativeId) { errors.push(`group "${g.name}" (no initiative to attach to)`); continue }
    try {
      await apiService.createBeneficiaryGroup({
        initiative_id: initiativeId,
        name: g.name.trim(),
        description: g.description?.trim() || undefined,
        total_number: g.total_number ?? null,
        age_range_start: g.age_range_start ?? null,
        age_range_end: g.age_range_end ?? null,
      })
      counts.groups++
    } catch {
      errors.push(`group "${g.name}"`)
    }
  }

  return { counts, errors }
}
