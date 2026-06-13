import { KPI } from '../../types'

export interface ClaimDraft {
  id: string
  columnId: string
  value: number | ''
  date_represented: string
  date_range_start?: string
  date_range_end?: string
  label: string
  note: string
  location_id: string
  beneficiary_group_ids: string[]
  tag_id: string | null
}

export interface ClaimColumn {
  id: string
  kpi: KPI
}

export interface ClaimBatchState {
  columns: ClaimColumn[]
  claims: ClaimDraft[]
}

let _counter = 0
export function newId(prefix: string): string {
  return `${prefix}-${++_counter}-${Date.now().toString(36)}`
}
