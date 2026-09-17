/**
 * Tags attached to at least one metric in a program. Org-wide tag lists
 * include unused library tags; program filters should only offer these.
 */
export function tagsOnProgramMetrics<T extends { id: string }>(
  allTags: T[],
  kpis: Array<{ tag_ids?: string[] }>
): T[] {
  const used = new Set<string>()
  for (const k of kpis) {
    for (const id of k.tag_ids || []) used.add(id)
  }
  if (used.size === 0) return []
  return allTags.filter(t => used.has(t.id))
}
