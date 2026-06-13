import { ClaimDraft } from '../types'

export interface ClaimValidation {
  ready: boolean
  missing: string[]
}

export function validateClaim(c: ClaimDraft): ClaimValidation {
  const missing: string[] = []
  if (c.value === '' || c.value === undefined || c.value === null) {
    missing.push('Value')
  } else if (Number(c.value) <= 0) {
    missing.push('Value > 0')
  }
  const hasDate = !!c.date_represented || !!(c.date_range_start && c.date_range_end)
  if (!hasDate) missing.push('Date')
  if (!c.location_id) missing.push('Location')
  if (!c.label?.trim()) missing.push('Label')
  return { ready: missing.length === 0, missing }
}
