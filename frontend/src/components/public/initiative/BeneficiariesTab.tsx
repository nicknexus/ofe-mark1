import { Link } from 'react-router-dom'
import { useOrgLinkBase } from '../../../hooks/useOrgLinkBase'
import { ChevronRight, MapPin, Users } from 'lucide-react'
import { PublicBeneficiaryGroup } from '../../../services/publicApi'
import { EmptyState, LoadingState } from './PublicInitiativeTabStates'

export function BeneficiariesTab({ beneficiaries, orgSlug, initiativeSlug }: { beneficiaries: PublicBeneficiaryGroup[] | null; orgSlug: string; initiativeSlug: string }) {
    const orgLinkBase = useOrgLinkBase()
    if (!beneficiaries) return <LoadingState />
    if (beneficiaries.length === 0) return <EmptyState icon={Users} message="No beneficiary groups defined yet." />

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {beneficiaries.map((group) => (
                <Link key={group.id} to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/beneficiary/${group.id}`} className="group rounded-2xl overflow-hidden bg-white border border-gray-200/80 shadow-public hover:shadow-public-hover hover:border-gray-300 transition-all active:scale-[0.98]">
                    <div className="p-5 pb-3">
                        <div className="flex items-start gap-4">
                            <div className="w-11 h-11 bg-accent/15 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-accent/25 transition-colors">
                                <Users className="w-5 h-5 text-accent" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-foreground text-[15px] leading-snug mb-0.5 group-hover:text-accent transition-colors">{group.name}</h3>
                                {group.description && <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{group.description}</p>}
                            </div>
                        </div>
                    </div>

                    {(group.total_number || group.age_range_start || group.age_range_end || group.location?.name) && (
                        <div className="px-5 pb-3 flex flex-wrap gap-2">
                            {group.total_number != null && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200 text-xs font-semibold">
                                    <Users className="w-3 h-3" />
                                    {group.total_number.toLocaleString()}
                                </span>
                            )}
                            {(group.age_range_start || group.age_range_end) && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100/80 text-gray-600 text-xs font-medium">
                                    Ages {group.age_range_start || '?'}–{group.age_range_end || '?'}
                                </span>
                            )}
                            {group.location?.name && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100/80 text-gray-600 text-xs font-medium">
                                    <MapPin className="w-3 h-3" />
                                    {group.location.name}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="px-5 py-3 border-t border-gray-100/60 flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground group-hover:text-accent transition-colors">View details</span>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </div>
                </Link>
            ))}
        </div>
    )
}
