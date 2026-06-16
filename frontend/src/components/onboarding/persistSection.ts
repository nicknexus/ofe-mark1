import { apiService } from '../../services/api'
import { OnboardingDraftApi } from './useOnboardingDraft'
import {
  ChatStage, DescriptionItem, LocationItem, InitiativeItem, MetricItem, GroupItem, SectionItem,
} from './planTypes'
import { Initiative } from '../../types'

/** One-shot forward geocode for a place name. */
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

export interface PersistResult {
  errors: string[]
  /** Initiatives created (only populated for the 'initiatives' stage). */
  createdInitiatives: Initiative[]
}

export interface PersistContext {
  orgId: string | null
  initiativeId?: string
}

/**
 * Persist a single confirmed onboarding section using the same create
 * endpoints the manual wizard uses, mirroring results into the draft. Returns
 * any per-item errors (e.g. plan limits) without aborting the rest.
 */
export async function persistSection(
  stage: ChatStage,
  items: SectionItem[],
  ctx: PersistContext,
  draftApi: OnboardingDraftApi,
): Promise<PersistResult> {
  const errors: string[] = []
  const createdInitiatives: Initiative[] = []

  if (stage === 'description') {
    const d = items[0] as DescriptionItem | undefined
    if (ctx.orgId && d && (d.statement?.trim() || d.description?.trim())) {
      try {
        await apiService.updateOrganization(ctx.orgId, {
          statement: d.statement?.trim() || undefined,
          description: d.description?.trim() || undefined,
        })
        draftApi.setOrgText({ statement: d.statement || '', description: d.description || '' })
      } catch {
        errors.push('organization details')
      }
    }
    return { errors, createdInitiatives }
  }

  if (stage === 'locations') {
    for (const loc of items as LocationItem[]) {
      if (!loc.name?.trim()) continue
      const geo = await geocode(loc.name)
      if (!geo) { errors.push(`${loc.name} (no coordinates found)`); continue }
      try {
        const created = await apiService.createLocation({
          name: loc.name.trim(),
          latitude: geo.lat,
          longitude: geo.lng,
          country: loc.country || geo.country || undefined,
        })
        draftApi.addLocation(created)
      } catch {
        errors.push(loc.name)
      }
    }
    return { errors, createdInitiatives }
  }

  if (stage === 'initiatives') {
    for (const init of items as InitiativeItem[]) {
      if (!init.title?.trim()) continue
      try {
        const created = await apiService.createInitiative({
          title: init.title.trim(),
          description: (init.description || init.title).trim(),
          region: init.region?.trim() || undefined,
        })
        draftApi.addInitiative(created)
        createdInitiatives.push(created)
      } catch (e: any) {
        errors.push(`${init.title}${e?.message ? ` — ${e.message}` : ''}`)
      }
    }
    return { errors, createdInitiatives }
  }

  if (stage === 'metrics') {
    if (!ctx.initiativeId) return { errors: ['No initiative selected'], createdInitiatives }
    const metrics = items as MetricItem[]
    const tagMap = await ensureTags(metrics.flatMap(m => m.tags || []))
    for (const m of metrics) {
      if (!m.title?.trim() || !m.unit_of_measurement?.trim()) continue
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
          initiative_id: ctx.initiativeId,
          tag_ids,
        })
        draftApi.addMetric(ctx.initiativeId, created)
      } catch {
        errors.push(m.title)
      }
    }
    return { errors, createdInitiatives }
  }

  if (stage === 'groups') {
    if (!ctx.initiativeId) return { errors: ['No initiative selected'], createdInitiatives }
    for (const g of items as GroupItem[]) {
      if (!g.name?.trim()) continue
      try {
        const created = await apiService.createBeneficiaryGroup({
          initiative_id: ctx.initiativeId,
          name: g.name.trim(),
          description: g.description?.trim() || undefined,
          total_number: g.total_number ?? null,
          age_range_start: g.age_range_start ?? null,
          age_range_end: g.age_range_end ?? null,
        })
        draftApi.addGroup(ctx.initiativeId, created as any)
      } catch {
        errors.push(g.name)
      }
    }
    return { errors, createdInitiatives }
  }

  return { errors, createdInitiatives }
}
