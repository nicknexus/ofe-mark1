import React from 'react'
import {
    Globe,
    BookOpen,
    Compass,
    LineChart,
    Target,
} from 'lucide-react'
import type { PublicStatCard } from '../../../services/publicApi'
import type { OrganizationFeatureView } from './organizationTypes'

type Props = {
    activeView: OrganizationFeatureView
    chooseView: (v: OrganizationFeatureView) => void
    highlightCards: PublicStatCard[]
}

export function PublicOrganizationViewToggles({ activeView, chooseView, highlightCards }: Props) {
    return (
        <>
            <div className="md:hidden flex items-center gap-2 py-2 px-3 bg-white border-b border-gray-100 flex-shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&>button]:flex-shrink-0">
                <button
                    onClick={() => chooseView('globe')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeView === 'globe'
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-600'
                        }`}
                >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Globe</span>
                </button>
                <button
                    onClick={() => chooseView('stories')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeView === 'stories'
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-600'
                        }`}
                >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Stories</span>
                </button>
                {highlightCards.length > 0 && (
                    <button
                        onClick={() => chooseView('highlights')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeView === 'highlights'
                            ? 'bg-gray-800 text-white'
                            : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Context</span>
                    </button>
                )}
                <button
                    onClick={() => chooseView('graph')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeView === 'graph'
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-600'
                        }`}
                >
                    <LineChart className="w-3.5 h-3.5" />
                    <span>Graph</span>
                </button>
                <button
                    onClick={() => chooseView('initiatives')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeView === 'initiatives'
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-600'
                        }`}
                >
                    <Target className="w-3.5 h-3.5" />
                    <span>List</span>
                </button>
            </div>

            <div className="hidden md:flex w-16 flex-shrink-0 flex-col items-center py-4 gap-4 relative z-30">
                <div className="group relative z-[100]">
                    <button
                        onClick={() => chooseView('globe')}
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${activeView === 'globe'
                            ? 'bg-gray-800 text-white shadow-lg scale-110'
                            : 'bg-white text-gray-600 hover:bg-gray-50 hover:scale-105 border border-gray-100 shadow-sm'
                            }`}
                    >
                        <Globe className="w-5 h-5" />
                    </button>
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[100]">
                        Globe
                    </div>
                </div>
                <div className="group relative z-[100]">
                    <button
                        onClick={() => chooseView('stories')}
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${activeView === 'stories'
                            ? 'bg-gray-800 text-white shadow-lg scale-110'
                            : 'bg-white text-gray-600 hover:bg-gray-50 hover:scale-105 border border-gray-100 shadow-sm'
                            }`}
                    >
                        <BookOpen className="w-5 h-5" />
                    </button>
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[100]">
                        Stories
                    </div>
                </div>
                {highlightCards.length > 0 && (
                    <div className="group relative z-[100]">
                        <button
                            onClick={() => chooseView('highlights')}
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${activeView === 'highlights'
                                ? 'bg-gray-800 text-white shadow-lg scale-110'
                                : 'bg-white text-gray-600 hover:bg-gray-50 hover:scale-105 border border-gray-100 shadow-sm'
                                }`}
                        >
                            <Compass className="w-5 h-5" />
                        </button>
                        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[100]">
                            Context & Challenges
                        </div>
                    </div>
                )}
                <div className="group relative z-[100]">
                    <button
                        onClick={() => chooseView('graph')}
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${activeView === 'graph'
                            ? 'bg-gray-800 text-white shadow-lg scale-110'
                            : 'bg-white text-gray-600 hover:bg-gray-50 hover:scale-105 border border-gray-100 shadow-sm'
                            }`}
                    >
                        <LineChart className="w-5 h-5" />
                    </button>
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[100]">
                        Graph
                    </div>
                </div>
                <div className="group relative z-[100]">
                    <button
                        onClick={() => chooseView('initiatives')}
                        className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${activeView === 'initiatives'
                            ? 'bg-gray-800 text-white shadow-lg scale-110'
                            : 'bg-white text-gray-600 hover:bg-gray-50 hover:scale-105 border border-gray-100 shadow-sm'
                            }`}
                    >
                        <Target className="w-5 h-5" />
                    </button>
                    <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[100]">
                        Initiatives
                    </div>
                </div>
            </div>
        </>
    )
}
