import { aggregateKpiUpdates } from './kpiAggregation'
import type { PublicKPI } from '../services/publicApi'

/** A metric collapsed across every initiative that uses it. */
export interface GroupedPublicMetric extends PublicKPI {
  /** How many initiatives contributed to this card. */
  initiative_count: number
  /** Slug for the org-wide metric page. Absent on pre-migration rows. */
  definition_slug?: string
}

/**
 * Collapse per-initiative metric rows into one card per org-global metric.
 *
 * The public payload still returns one row per initiative (that's where the
 * claims live), so "Meals Provided" used in three initiatives arrives as three
 * near-identical rows. Anything user-facing wants them as one number.
 *
 * The pooled total is recomputed from the combined claims via
 * `aggregateKpiUpdates` rather than summed, because percentage metrics are
 * averaged and a mean of means is wrong.
 *
 * Rows without a `definition_id` (pre-migration data) are passed through
 * untouched, each as its own group.
 */
export function groupMetricsByDefinition(metrics: PublicKPI[]): GroupedPublicMetric[] {
  const groups = new Map<string, PublicKPI[]>()

  for (const metric of metrics) {
    // Fall back to the row id so ungrouped metrics stay distinct.
    const key = metric.definition_id || `kpi:${metric.id}`
    const existing = groups.get(key)
    if (existing) existing.push(metric)
    else groups.set(key, [metric])
  }

  const grouped: GroupedPublicMetric[] = []

  for (const rows of groups.values()) {
    const [first] = rows

    if (rows.length === 1) {
      grouped.push({ ...first, initiative_count: 1 })
      continue
    }

    const pooledUpdates = rows.flatMap(r => r.updates || [])
    grouped.push({
      ...first,
      total_value: aggregateKpiUpdates(pooledUpdates as any, first.metric_type),
      update_count: pooledUpdates.length,
      updates: pooledUpdates,
      evidence_count: rows.reduce((sum, r) => sum + (r.evidence_count || 0), 0),
      tag_ids: Array.from(new Set(rows.flatMap(r => r.tag_ids || []))),
      initiative_count: rows.length,
    })
  }

  return grouped.sort((a, b) => (b.total_value ?? 0) - (a.total_value ?? 0))
}

/**
 * Where a metric card should link. A metric used in one initiative goes
 * straight to that initiative's metric page; one spanning several goes to the
 * org-wide page where the visitor picks an initiative.
 */
export function metricCardHref(
  metric: GroupedPublicMetric,
  orgLinkBase: string,
  orgSlug: string,
  metricSlug: string
): string {
  if (metric.initiative_count > 1 && metric.definition_slug) {
    return `${orgLinkBase}/${orgSlug}/metric/${metric.definition_slug}`
  }
  return `${orgLinkBase}/${orgSlug}/${metric.initiative_slug}/metric/${metricSlug}`
}
