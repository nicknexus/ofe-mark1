import { GroupMetadata } from '../types'

export interface GroupValidation {
    ready: boolean
    missing: string[]
}

export function validateGroup(m: GroupMetadata): GroupValidation {
    const missing: string[] = []
    if (!m.title?.trim()) missing.push('Title')
    if (!m.location_ids?.length) missing.push('Location')
    if (!m.kpi_ids?.length) missing.push('Metric')
    const hasDate = !!m.date_represented || !!(m.date_range_start && m.date_range_end)
    if (!hasDate) missing.push('Date')
    return { ready: missing.length === 0, missing }
}
