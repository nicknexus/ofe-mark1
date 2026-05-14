import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, Compass, MapPin, Target } from 'lucide-react'
import type { PublicInitiative, PublicOrganization } from '../../../services/publicApi'

type Props = {
    organization: PublicOrganization
    slug: string
    orgLinkBase: string
    brandColor: string
    filteredInitiatives: PublicInitiative[]
    heroInitiativePage: number
    setHeroInitiativePage: React.Dispatch<React.SetStateAction<number>>
}

export function PublicOrganizationHero({
    organization,
    slug,
    orgLinkBase,
    brandColor,
    filteredInitiatives,
    heroInitiativePage,
    setHeroInitiativePage,
}: Props) {
    return (
        <div className="flex flex-col md:flex-row md:items-start relative z-20">
            <div className="hidden md:block w-16 flex-shrink-0"></div>
            <div className="w-full md:w-[45%] flex-shrink-0 p-3 md:px-4 md:pt-3 md:pb-2">
                <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-24 h-24 md:w-[108px] md:h-[108px] rounded-xl md:rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-white border border-gray-100 shadow-sm">
                        {organization.logo_url ? (
                            <img src={organization.logo_url} alt={organization.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-4xl md:text-5xl font-bold text-gray-400">{organization.name.charAt(0)}</span>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-0.5 leading-tight">{organization.name}</h1>
                        {organization.statement && (
                            <p className="text-base md:text-lg text-muted-foreground leading-snug line-clamp-3 md:line-clamp-2">{organization.statement}</p>
                        )}

                        {(() => {
                            const brand = organization.brand_color || '#c0dfa1'
                            return (
                                <Link
                                    to={`${orgLinkBase}/${slug}/context`}
                                    className="group inline-flex items-center gap-1.5 mt-2 pl-1 pr-3 py-1 rounded-full text-xs font-semibold text-gray-900 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-px"
                                    style={{
                                        border: `1.5px solid ${brand}`,
                                        boxShadow: `0 1px 2px rgba(15,23,42,0.06), 0 4px 14px -8px ${brand}80`,
                                    }}
                                    title="Context & Challenges"
                                >
                                    <span
                                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ring-1 ring-black/[0.04]"
                                        style={{ backgroundColor: brand }}
                                    >
                                        <Compass className="w-3 h-3 text-white" strokeWidth={2.5} />
                                    </span>
                                    <span>Context &amp; Challenges</span>
                                    <ArrowRight className="w-3 h-3 text-gray-400 -ml-1 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                </Link>
                            )
                        })()}
                    </div>
                </div>
            </div>

            <div className="hidden md:block md:self-end flex-1 p-3 md:px-4 md:pt-2 md:pb-3 md:pl-2">
                <div className="h-full flex flex-col">
                    <div className="px-2 md:px-4 py-2 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)' }}
                            >
                                <Target
                                    className="w-3.5 h-3.5 md:w-4 md:h-4"
                                    style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                />
                            </div>
                            <h2 className="font-semibold text-foreground text-sm md:text-base">Initiatives</h2>
                            <span
                                className="px-2 py-0.5 text-xs font-semibold rounded-full text-gray-700"
                                style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                            >{filteredInitiatives.length}</span>
                        </div>
                        {filteredInitiatives.length > 4 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setHeroInitiativePage(p => Math.max(0, p - 1))}
                                    disabled={heroInitiativePage === 0}
                                    className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                                </button>
                                <span className="text-xs text-muted-foreground w-10 text-center">
                                    {heroInitiativePage + 1}/{Math.ceil(filteredInitiatives.length / 4)}
                                </span>
                                <button
                                    onClick={() => setHeroInitiativePage(p => Math.min(Math.ceil(filteredInitiatives.length / 4) - 1, p + 1))}
                                    disabled={heroInitiativePage >= Math.ceil(filteredInitiatives.length / 4) - 1}
                                    className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="px-2 md:px-3 pb-2">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {filteredInitiatives.slice(heroInitiativePage * 4, heroInitiativePage * 4 + 4).map((init) => (
                                <Link
                                    key={init.id}
                                    to={`${orgLinkBase}/${slug}/${init.slug}`}
                                    className="px-3 py-2 bg-white rounded-xl border border-gray-200/80 shadow-surface hover:shadow-surface-hover hover:border-gray-300 hover:-translate-y-px transition-all duration-200 group flex flex-col justify-center"
                                >
                                    <h4 className="font-medium text-foreground text-sm line-clamp-2 group-hover:text-accent transition-colors leading-snug">{init.title}</h4>
                                    {init.region && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                            <MapPin className="w-2.5 h-2.5" />{init.region}
                                        </p>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
