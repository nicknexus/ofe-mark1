import React, { useEffect, useState } from 'react'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { useTeam } from '../../context/TeamContext'
import { BeneficiaryGroup, Location, MetricTag, TimelineResponse } from '../../types'
import { PageLoader } from '../ui'
import UploadWizard from './UploadWizard'
import ImpactClaimUploadModal from '../impactClaims/ImpactClaimUploadModal'
import EvidenceUploadModal from '../evidence/EvidenceUploadModal'

interface UploadWizardLauncherProps {
 initiativeId: string
 onClose: () => void
 onCreated?: () => void
}

/**
 * Self-fetching wrapper around the full-screen UploadWizard for entry points
 * that don't already hold the Timeline payload (the mobile + button, quick
 * actions). Loads everything the wizard needs, then hands over.
 */
export default function UploadWizardLauncher({ initiativeId, onClose, onCreated }: UploadWizardLauncherProps) {
 const { canAddImpactClaims, canEditEvidence } = useTeam()
 const [data, setData] = useState<TimelineResponse | null>(null)
 const [locations, setLocations] = useState<Location[]>([])
 const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
 const [tags, setTags] = useState<MetricTag[]>([])
 const [loading, setLoading] = useState(true)
 const [advanced, setAdvanced] = useState<'claim' | 'evidence' | null>(null)

 useEffect(() => {
 let cancelled = false
 Promise.all([
 apiService.getInitiativeTimeline(initiativeId),
 apiService.getLocations(initiativeId),
 apiService.getBeneficiaryGroups(initiativeId),
 apiService.getMetricTags().catch(() => []),
 ]).then(([timeline, locs, groups, allTags]) => {
 if (cancelled) return
 setData(timeline)
 setLocations(locs || [])
 setBeneficiaryGroups(groups || [])
 setTags(allTags || [])
 setLoading(false)
 }).catch(error => {
 if (cancelled) return
 console.error('Failed to prepare upload:', error)
 notify.error('Failed to load initiative data')
 onClose()
 })
 return () => { cancelled = true }
 }, [initiativeId, onClose])

 if (loading || !data) {
 return (
 <div className="fixed inset-0 z-[100] bg-page">
 <PageLoader label="Getting ready..." />
 </div>
 )
 }

 if (advanced === 'claim') {
 return (
 <ImpactClaimUploadModal
 isOpen
 initialMode="advanced"
 initiativeId={initiativeId}
 availableKPIs={data.kpis}
 onClose={onClose}
 onCreated={() => onCreated?.()}
 />
 )
 }

 if (advanced === 'evidence') {
 return (
 <EvidenceUploadModal
 isOpen
 initialMode="batch"
 initiativeId={initiativeId}
 onClose={onClose}
 onCreated={() => onCreated?.()}
 />
 )
 }

 return (
 <UploadWizard
 initiativeId={initiativeId}
 canCreateClaim={canAddImpactClaims}
 canCreateEvidence={canEditEvidence}
 onAdvancedClaim={() => setAdvanced('claim')}
 onAdvancedEvidence={() => setAdvanced('evidence')}
 kpis={data.kpis}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 existingClaims={data.claims}
 existingEvidence={data.evidence}
 onClose={onClose}
 onCreated={onCreated || (() => {})}
 />
 )
}
