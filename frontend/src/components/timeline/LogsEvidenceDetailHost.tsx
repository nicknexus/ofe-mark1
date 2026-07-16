import React, { useEffect, useMemo, useState } from 'react'
import {
  BeneficiaryGroup,
  KPI,
  Location,
  MetricTag,
  TimelineClaim,
  TimelineEvidence,
  TimelineResponse,
} from '../../types'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { useTeam } from '../../context/TeamContext'
import { SectionLoader } from '../ui'
import EvidenceDetailModal from './EvidenceDetailModal'
import ClaimDetailModal from './ClaimDetailModal'

interface LogsEvidenceDetailHostProps {
  evidenceId: string | null
  initiativeId: string
  onClose: () => void
  onDataChanged?: () => void
}

/**
 * Opens the same evidence → claim detail stack used on the Logs tab, from
 * anywhere else in the app (location/beneficiary detail modals, etc.).
 */
export default function LogsEvidenceDetailHost({
  evidenceId,
  initiativeId,
  onClose,
  onDataChanged,
}: LogsEvidenceDetailHostProps) {
  const { canDelete } = useTeam()
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
  const [tags, setTags] = useState<MetricTag[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedClaim, setSelectedClaim] = useState<{ claim: TimelineClaim; kpi: KPI | undefined } | null>(null)

  useEffect(() => {
    if (!evidenceId || !initiativeId) {
      setTimeline(null)
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([
      apiService.getInitiativeTimeline(initiativeId),
      apiService.getLocations(initiativeId),
      apiService.getBeneficiaryGroups(initiativeId),
      apiService.getMetricTags(),
    ])
      .then(([tl, locs, groups, tagList]) => {
        if (cancelled) return
        setTimeline(tl)
        setLocations(locs || [])
        setBeneficiaryGroups(groups || [])
        setTags(tagList || [])
      })
      .catch(() => {
        if (!cancelled) notify.error('Failed to load evidence details')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [evidenceId, initiativeId])

  const evidence = useMemo<TimelineEvidence | null>(() => {
    if (!evidenceId || !timeline) return null
    return timeline.evidence.find(e => e.id === evidenceId) ?? null
  }, [evidenceId, timeline])

  if (!evidenceId) return null

  if (loading || !timeline || !evidence) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm">
        <SectionLoader label="Loading evidence…" />
      </div>
    )
  }

  const connectedClaims = timeline.claims.filter(c =>
    (evidence.kpi_update_ids || []).includes(c.id!)
  )

  const handleDeleteEvidence = async () => {
    if (!evidence.id) return
    try {
      await apiService.deleteEvidence(evidence.id)
      notify.success('Evidence deleted')
      onDataChanged?.()
      onClose()
    } catch {
      notify.error('Failed to delete evidence')
    }
  }

  return (
    <>
      <EvidenceDetailModal
        evidence={evidence}
        kpis={timeline.kpis}
        locations={locations}
        tags={tags}
        beneficiaryGroups={beneficiaryGroups}
        contributors={timeline.contributors}
        connectedClaims={connectedClaims}
        onClose={onClose}
        onOpenClaim={(claim) => {
          setSelectedClaim({ claim, kpi: timeline.kpis.find(k => k.id === claim.kpi_id) })
        }}
        onDelete={canDelete ? handleDeleteEvidence : undefined}
      />

      {selectedClaim && (
        <ClaimDetailModal
          claim={selectedClaim.claim}
          kpi={selectedClaim.kpi}
          evidence={timeline.evidence.filter(ev =>
            (ev.kpi_update_ids || []).includes(selectedClaim.claim.id!)
          )}
          locations={locations}
          tags={tags}
          beneficiaryGroups={beneficiaryGroups}
          contributors={timeline.contributors}
          onClose={() => setSelectedClaim(null)}
          onOpenEvidence={() => setSelectedClaim(null)}
        />
      )}
    </>
  )
}
