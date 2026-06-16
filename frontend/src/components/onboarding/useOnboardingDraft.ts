import { useState, useCallback } from 'react'
import { Initiative, KPI, Location, BeneficiaryGroup } from '../../types'

/**
 * In-memory mirror of everything the onboarding wizard has created. Entities
 * are persisted to the backend immediately on creation (create-as-you-go), so
 * this holds the returned rows (with ids) purely so the UI can list, edit, and
 * remove them without re-fetching. Nothing here is a deferred "commit".
 */
export interface OnboardingDraft {
  description: string
  statement: string
  locations: Location[]
  initiatives: Initiative[]
  metricsByInitiative: Record<string, KPI[]>
  groupsByInitiative: Record<string, BeneficiaryGroup[]>
}

const EMPTY: OnboardingDraft = {
  description: '',
  statement: '',
  locations: [],
  initiatives: [],
  metricsByInitiative: {},
  groupsByInitiative: {},
}

export function useOnboardingDraft() {
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY)

  const setOrgText = useCallback((patch: Partial<Pick<OnboardingDraft, 'description' | 'statement'>>) => {
    setDraft(d => ({ ...d, ...patch }))
  }, [])

  const addLocation = useCallback((loc: Location) => {
    setDraft(d => ({ ...d, locations: [...d.locations, loc] }))
  }, [])

  const removeLocation = useCallback((id: string) => {
    setDraft(d => ({ ...d, locations: d.locations.filter(l => l.id !== id) }))
  }, [])

  const addInitiative = useCallback((init: Initiative) => {
    setDraft(d => ({
      ...d,
      initiatives: [...d.initiatives, init],
      metricsByInitiative: { ...d.metricsByInitiative, [init.id!]: [] },
      groupsByInitiative: { ...d.groupsByInitiative, [init.id!]: [] },
    }))
  }, [])

  const removeInitiative = useCallback((id: string) => {
    setDraft(d => {
      const metrics = { ...d.metricsByInitiative }
      const groups = { ...d.groupsByInitiative }
      delete metrics[id]
      delete groups[id]
      return {
        ...d,
        initiatives: d.initiatives.filter(i => i.id !== id),
        metricsByInitiative: metrics,
        groupsByInitiative: groups,
      }
    })
  }, [])

  const addMetric = useCallback((initiativeId: string, kpi: KPI) => {
    setDraft(d => ({
      ...d,
      metricsByInitiative: {
        ...d.metricsByInitiative,
        [initiativeId]: [...(d.metricsByInitiative[initiativeId] || []), kpi],
      },
    }))
  }, [])

  const removeMetric = useCallback((initiativeId: string, kpiId: string) => {
    setDraft(d => ({
      ...d,
      metricsByInitiative: {
        ...d.metricsByInitiative,
        [initiativeId]: (d.metricsByInitiative[initiativeId] || []).filter(k => k.id !== kpiId),
      },
    }))
  }, [])

  const addGroup = useCallback((initiativeId: string, group: BeneficiaryGroup) => {
    setDraft(d => ({
      ...d,
      groupsByInitiative: {
        ...d.groupsByInitiative,
        [initiativeId]: [...(d.groupsByInitiative[initiativeId] || []), group],
      },
    }))
  }, [])

  const removeGroup = useCallback((initiativeId: string, groupId: string) => {
    setDraft(d => ({
      ...d,
      groupsByInitiative: {
        ...d.groupsByInitiative,
        [initiativeId]: (d.groupsByInitiative[initiativeId] || []).filter(g => g.id !== groupId),
      },
    }))
  }, [])

  return {
    draft,
    setOrgText,
    addLocation,
    removeLocation,
    addInitiative,
    removeInitiative,
    addMetric,
    removeMetric,
    addGroup,
    removeGroup,
  }
}

export type OnboardingDraftApi = ReturnType<typeof useOnboardingDraft>
