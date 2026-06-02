import { useEffect, useMemo, useState } from 'react'
import { Globe, MapPin } from 'lucide-react'
import { apiService } from '../../services/api'
import type { Initiative, Location } from '../../types'
import type { TeamMemberScope } from '../../types/teamPermissions'

type TeamScopeFieldsProps = {
    scope: TeamMemberScope
    setScope: (value: TeamMemberScope) => void
}

function locationInitiativeIds(loc: Location): string[] {
    const ids = new Set<string>()
    if (loc.initiative_id) ids.add(loc.initiative_id)
    for (const id of loc.initiative_ids ?? []) ids.add(id)
    return Array.from(ids)
}

export function TeamScopeFields({ scope, setScope }: TeamScopeFieldsProps) {
    const [initiatives, setInitiatives] = useState<Initiative[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true
        ;(async () => {
            setLoading(true)
            try {
                const [inits, locs] = await Promise.all([
                    apiService.getInitiatives(),
                    apiService.getLocations(),
                ])
                if (!active) return
                setInitiatives(inits)
                setLocations(locs)
            } catch {
                if (active) {
                    setInitiatives([])
                    setLocations([])
                }
            } finally {
                if (active) setLoading(false)
            }
        })()
        return () => {
            active = false
        }
    }, [])

    // locations grouped by the initiatives they belong to
    const locationsByInitiative = useMemo(() => {
        const map = new Map<string, Location[]>()
        for (const loc of locations) {
            for (const initId of locationInitiativeIds(loc)) {
                if (!map.has(initId)) map.set(initId, [])
                map.get(initId)!.push(loc)
            }
        }
        return map
    }, [locations])

    const setAllInitiatives = (all: boolean) => {
        if (all) {
            setScope({ allInitiatives: true, initiativeIds: [], locationIds: [] })
        } else {
            setScope({ ...scope, allInitiatives: false })
        }
    }

    const toggleInitiative = (initId: string, checked: boolean) => {
        if (checked) {
            setScope({ ...scope, initiativeIds: [...scope.initiativeIds, initId] })
        } else {
            // drop the initiative and any of its locations from the narrowing list
            const initLocIds = new Set((locationsByInitiative.get(initId) ?? []).map((l) => l.id!))
            setScope({
                ...scope,
                initiativeIds: scope.initiativeIds.filter((id) => id !== initId),
                locationIds: scope.locationIds.filter((id) => !initLocIds.has(id)),
            })
        }
    }

    const toggleLocation = (locId: string, checked: boolean) => {
        if (checked) {
            setScope({ ...scope, locationIds: [...scope.locationIds, locId] })
        } else {
            setScope({ ...scope, locationIds: scope.locationIds.filter((id) => id !== locId) })
        }
    }

    return (
        <div className="space-y-2 rounded-xl border border-gray-200 p-3 bg-gray-50/50">
            <p className="text-sm font-medium text-gray-800 px-1">Access scope</p>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer">
                <input
                    type="radio"
                    name="scope-mode"
                    checked={scope.allInitiatives}
                    onChange={() => setAllInitiatives(true)}
                    className="mt-1 text-primary-600 focus:ring-primary-500"
                />
                <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                        <Globe className="w-3.5 h-3.5 text-primary-600" /> All initiatives
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">Full access to every initiative and location.</span>
                </span>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer">
                <input
                    type="radio"
                    name="scope-mode"
                    checked={!scope.allInitiatives}
                    onChange={() => setAllInitiatives(false)}
                    className="mt-1 text-primary-600 focus:ring-primary-500"
                />
                <span>
                    <span className="text-sm font-medium text-gray-800">Specific initiatives</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Pick the initiatives this member can access.</span>
                </span>
            </label>

            {!scope.allInitiatives && (
                <div className="space-y-1.5 pl-2">
                    {loading ? (
                        <p className="text-xs text-gray-400 px-1 py-2">Loading initiatives…</p>
                    ) : initiatives.length === 0 ? (
                        <p className="text-xs text-gray-400 px-1 py-2">No initiatives yet.</p>
                    ) : (
                        initiatives.map((init) => {
                            const checked = scope.initiativeIds.includes(init.id!)
                            const initLocations = locationsByInitiative.get(init.id!) ?? []
                            return (
                                <div key={init.id} className="rounded-lg border border-gray-100 bg-white">
                                    <label className="flex items-center gap-2.5 p-2.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => toggleInitiative(init.id!, e.target.checked)}
                                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                        />
                                        <span className="text-sm text-gray-800">{init.title}</span>
                                    </label>

                                    {checked && initLocations.length > 0 && (
                                        <div className="px-2.5 pb-2.5 pl-9 space-y-1">
                                            <p className="text-[11px] uppercase tracking-wide text-gray-400">
                                                Limit to locations (optional — all if none selected)
                                            </p>
                                            {initLocations.map((loc) => (
                                                <label key={loc.id} className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={scope.locationIds.includes(loc.id!)}
                                                        onChange={(e) => toggleLocation(loc.id!, e.target.checked)}
                                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <span className="flex items-center gap-1 text-xs text-gray-600">
                                                        <MapPin className="w-3 h-3 text-gray-400" /> {loc.name}
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            )}
        </div>
    )
}
