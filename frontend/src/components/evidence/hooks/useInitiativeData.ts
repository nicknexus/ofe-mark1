import { useEffect, useState } from 'react'
import { apiService } from '../../../services/api'
import { KPI, Location, BeneficiaryGroup } from '../../../types'

export interface InitiativeData {
    kpis: KPI[]
    locations: Location[]
    beneficiaryGroups: BeneficiaryGroup[]
    loading: boolean
    reloadLocations: () => Promise<void>
}

// Loads pickers data (kpis, locations, ben groups) for a single initiative.
// Cached per-modal-instance via parent component lifetime.
export function useInitiativeData(initiativeId: string, enabled: boolean): InitiativeData {
    const [kpis, setKpis] = useState<KPI[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
    const [loading, setLoading] = useState(false)

    const reloadLocations = async () => {
        try { setLocations(await apiService.getLocations(initiativeId)) } catch { /* noop */ }
    }

    useEffect(() => {
        if (!enabled || !initiativeId) return
        let cancelled = false
        setLoading(true)
        Promise.all([
            apiService.getKPIs(initiativeId).catch(() => [] as KPI[]),
            apiService.getLocations(initiativeId).catch(() => [] as Location[]),
            apiService.getBeneficiaryGroups(initiativeId).catch(() => [] as BeneficiaryGroup[]),
        ]).then(([k, l, b]) => {
            if (cancelled) return
            setKpis(k); setLocations(l); setBeneficiaryGroups(b)
        }).finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [initiativeId, enabled])

    return { kpis, locations, beneficiaryGroups, loading, reloadLocations }
}
